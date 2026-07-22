"""Provider Resolver — single point of truth for active AI provider.

v0.5 Phase 1 Track A.2: Replaces scattered `settings.anthropic_*` reads with
a cached, key-aware lookup. The resolver is the ONLY code path that calls
`decrypt_api_key()` for runtime AI consumption (the explicit `/key` endpoint
is the only other consumer).

Design (see docs/architecture/adr-provider-resolver.md):
- §1 Session lifecycle: caller-owned (FastAPI Depends(get_db))
- §2 Cache: in-process dict, 5-min TTL, asyncio.Lock guard
- §3 Invalidation: synchronous after write transaction commits
- §4 Error code: PROVIDER_NONE_ACTIVE → 409 Conflict
- §5 Decryption responsibility: ONLY this module + explicit /key endpoint
- §6 SecretStr: plaintext minimized via bytearray + zeroizable wrapper
- §7 SQLite: WAL mode + partial unique index for activate race
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.core.security import SecretStr, decrypt_api_key
from app.models import AIProvider
from app.repositories.ai_provider import AIProviderRepository

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class ProviderResolutionError(Exception):
    """Base class for provider resolution failures."""


class NoActiveProviderError(ProviderResolutionError):
    """No active AI provider configured (HTTP 409)."""

    error_code = "PROVIDER_NONE_ACTIVE"

    def __init__(self, user_id: str):
        self.user_id = user_id
        super().__init__(
            f"No active AI provider for user {user_id!r}; "
            f"activate one via POST /settings/ai-provider/{{id}}/activate"
        )


class ProviderNotFoundError(ProviderResolutionError):
    """Requested provider does not exist (HTTP 404)."""

    error_code = "PROVIDER_NOT_FOUND"


# ---------------------------------------------------------------------------
# ProviderConfig — immutable snapshot (ADR §2)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ProviderConfig:
    """Immutable snapshot of an active AI provider's runtime config.

    The `_key` field is a SecretStr; access plaintext via `.key.get()` and
    clear via `.key.clear()` (or rely on `__del__`).
    """

    provider_id: int
    name: str
    model: str
    base_url: str
    key: SecretStr
    max_tokens: int
    temperature: float

    def __repr__(self) -> str:
        # Never include the key in repr.
        return (
            f"ProviderConfig(provider_id={self.provider_id}, "
            f"name={self.name!r}, model={self.model!r}, "
            f"base_url={self.base_url!r}, key=***)"
        )


# ---------------------------------------------------------------------------
# Cache key + entry
# ---------------------------------------------------------------------------

# Cache key = (user_id, project_id, active_provider_id)
# project_id may be 0 for "no project context" — we resolve at user scope
# because AIProvider model is currently user-scoped (no project_id FK).
CacheKey = Tuple[str, int, int]


@dataclass
class _CacheEntry:
    config: ProviderConfig
    expires_at: float  # time.monotonic() seconds


# ---------------------------------------------------------------------------
# ProviderResolver
# ---------------------------------------------------------------------------

CACHE_TTL_SECONDS = 300.0  # 5 minutes (ADR §2)


class ProviderResolver:
    """Process-local cache for active AI provider configuration.

    Thread-/asyncio-safe via `asyncio.Lock`. Single-process desktop app;
    no cross-process synchronization needed (see ADR §3).
    """

    def __init__(self, ttl_seconds: float = CACHE_TTL_SECONDS):
        self._cache: dict[CacheKey, _CacheEntry] = {}
        self._lock = asyncio.Lock()
        self._ttl = ttl_seconds

    async def get_active(
        self,
        session: Session,
        user_id: str,
        project_id: int = 0,
    ) -> ProviderConfig:
        """Resolve the active provider for `user_id`.

        Cache lookup → if hit and not expired, return snapshot.
        Cache miss → query DB for active provider → decrypt key → cache.

        Raises:
            NoActiveProviderError: when no provider has is_active=True
        """
        # Fast path: cache hit (no lock needed for reads on dict).
        # We use try/except for KeyError because dict access is atomic in CPython.
        now = time.monotonic()
        # Provisional key — provider_id unknown until we look up the row.
        # Use a sentinel that won't collide; we'll patch after lookup.
        active = self._find_active_in_db(session, user_id)
        if active is None:
            raise NoActiveProviderError(user_id)

        cache_key: CacheKey = (user_id, project_id, active.id)
        entry = self._cache.get(cache_key)
        if entry is not None and entry.expires_at > now:
            return entry.config

        # Cache miss / expired → build a fresh snapshot under lock.
        async with self._lock:
            # Double-check after acquiring lock (another coroutine may have filled it).
            entry = self._cache.get(cache_key)
            if entry is not None and entry.expires_at > time.monotonic():
                return entry.config

            # Decrypt the API key (single point of decryption for AI flows).
            assert active.api_key_encrypted, (
                f"Active provider {active.id} has no api_key_encrypted; "
                f"this should be impossible due to NOT NULL in DB"
            )
            secret = decrypt_api_key(active.api_key_encrypted)
            try:
                config = ProviderConfig(
                    provider_id=active.id,
                    name=active.name,
                    model=active.model_name,
                    base_url=active.base_url or "",
                    key=secret,
                    max_tokens=active.max_tokens,
                    temperature=active.temperature,
                )
            except Exception:
                # If snapshot construction fails, clear the secret immediately.
                secret.clear()
                raise

            self._cache[cache_key] = _CacheEntry(
                config=config,
                expires_at=time.monotonic() + self._ttl,
            )
            return config

    def invalidate(self, user_id: str, project_id: int = 0, provider_id: Optional[int] = None) -> None:
        """Clear cache entries for a user (and optionally a specific provider).

        Called AFTER a successful write transaction commits (ADR §3).

        Args:
            user_id: the user whose cache entries to clear
            project_id: project scope; 0 means user-global
            provider_id: if given, only clear that provider's entry;
                         if None, clear all entries for (user_id, project_id)
        """
        keys_to_drop: list[CacheKey] = []
        for key in self._cache:
            uid, pid, prov_id = key
            if uid != user_id:
                continue
            if pid != project_id:
                continue
            if provider_id is not None and prov_id != provider_id:
                continue
            keys_to_drop.append(key)
        for key in keys_to_drop:
            entry = self._cache.pop(key, None)
            if entry is not None and entry.config.key is not None:
                try:
                    entry.config.key.clear()
                except Exception:
                    pass

    def invalidate_all(self) -> None:
        """Clear entire cache. Use sparingly (e.g., test setup)."""
        for key in list(self._cache.keys()):
            entry = self._cache.pop(key, None)
            if entry is not None and entry.config.key is not None:
                try:
                    entry.config.key.clear()
                except Exception:
                    pass

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _find_active_in_db(session: Session, user_id: str) -> AIProvider | None:
        """Query the single active provider for `user_id`.

        Uses AIProviderRepository for typed access. The DB partial unique
        index guarantees at most one is_active=True row per user.
        """
        repo = AIProviderRepository(session)
        # AIProviderRepository doesn't expose a get_active yet; query directly
        # via SQLAlchemy here to keep repository surface minimal in Phase 1.
        return (
            session.query(AIProvider)
            .filter(AIProvider.user_id == user_id, AIProvider.is_active.is_(True))
            .first()
        )


# ---------------------------------------------------------------------------
# Singleton accessor (FastAPI dependency)
# ---------------------------------------------------------------------------

_resolver_instance: Optional[ProviderResolver] = None
_resolver_lock = asyncio.Lock()


def get_provider_resolver() -> ProviderResolver:
    """FastAPI dependency: returns the process-global resolver.

    First call constructs the resolver; subsequent calls return the same
    instance. Tests that need an isolated resolver should construct their
    own `ProviderResolver()` and override this dependency.
    """
    global _resolver_instance
    if _resolver_instance is None:
        _resolver_instance = ProviderResolver()
    return _resolver_instance


def reset_provider_resolver_for_testing() -> None:
    """Reset the global resolver. Test-only."""
    global _resolver_instance
    if _resolver_instance is not None:
        _resolver_instance.invalidate_all()
    _resolver_instance = None
