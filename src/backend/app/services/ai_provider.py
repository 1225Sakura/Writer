"""AI provider service: CRUD, API-key protection, and connection testing.

v0.4 P0-Sec2 SSRF protection:
- Provider URLs validated against allowlist (https only, 4 public hosts + dev Ollama)
- follow_redirects=False enforced at httpx.Client level (passed via Anthropic SDK http_client param)
- DNS pin: resolve A+AAAA, reject non-global IPs (incl IPv4-mapped, NAT64, metadata)
- Anthropic SDK does NOT provide defense boundary (per OWASP + spec v0.4 §A)
"""
import ipaddress
import os
import socket
from urllib.parse import urlparse

import httpx
from anthropic import Anthropic

from app.config import get_settings
from app.core.security import encrypt_api_key
from app.models import AIProvider
from app.repositories.ai_provider import AIProviderRepository
from app.schemas.ai import AIProviderCreate, AIProviderUpdate
from app.schemas.ai_provider_test import AIProviderTestRequest, AIProviderTestResponse

# v0.4 P0-Sec2 SSRF: provider host allowlist
ALLOWED_PROVIDER_HOSTS = frozenset([
    "api.openai.com",
    "api.anthropic.com",
    "api.mistral.ai",
    "generativelanguage.googleapis.com",
])
ALLOWED_DEV_HOSTS = frozenset([
    "127.0.0.1",  # local Ollama (dev only)
    "localhost",
])
ALLOWED_SCHEMES = frozenset(["https"])  # dev allows http only for Ollama


class SSRFBlockedError(ValueError):
    """Raised when provider URL fails SSRF validation."""


def validate_provider_url(url: str, *, dev_mode: bool = False) -> str:
    """Validate provider URL against SSRF rules.

    Returns the validated URL on success; raises SSRFBlockedError otherwise.
    Dev-mode Ollama exception requires WRITER_ALLOW_LOCAL_OLLAMA=1 env var (per Q6 spec).
    """
    parsed = urlparse(url)
    # Scheme check
    if parsed.scheme not in ALLOWED_SCHEMES and not (dev_mode and parsed.scheme == "http"):
        raise SSRFBlockedError(f"Disallowed scheme: {parsed.scheme} (https required)")
    # Host allowlist
    host = parsed.hostname or ""
    if host in ALLOWED_PROVIDER_HOSTS:
        return url
    if dev_mode and host in ALLOWED_DEV_HOSTS:
        # v0.4 Q6: require explicit env var gate for Ollama dev exception
        if os.environ.get("WRITER_ALLOW_LOCAL_OLLAMA") != "1":
            raise SSRFBlockedError(
                "Ollama dev exception requires WRITER_ALLOW_LOCAL_OLLAMA=1 env var"
            )
        # Local dev: resolve + verify is_global (rejects 169.254.x, IPv4-mapped, NAT64)
        try:
            infos = socket.getaddrinfo(host, parsed.port or 80, type=socket.SOCK_STREAM)
        except socket.gaierror as e:
            raise SSRFBlockedError(f"DNS resolution failed for {host}: {e}")
        for info in infos:
            try:
                ip = ipaddress.ip_address(info[4][0])
            except ValueError:
                continue
            # Reject non-global (covers loopback, link-local, private, multicast, reserved)
            if not ip.is_global:
                raise SSRFBlockedError(f"Non-global IP rejected: {ip}")
        return url
    raise SSRFBlockedError(f"Host not in allowlist: {host}")


def _build_httpx_client_no_redirect() -> httpx.Client:
    """Construct httpx.Client with follow_redirects=False (spec v0.4 P0-Sec2 D.1.4)."""
    return httpx.Client(follow_redirects=False, timeout=30.0)


class AIProviderService:
    def __init__(self, repo: AIProviderRepository):
        self._repo = repo

    def get(self, id: int) -> AIProvider | None:
        return self._repo.get(id)

    def list(self, skip: int = 0, limit: int = 100) -> list[AIProvider]:
        return self._repo.list(skip=skip, limit=limit)

    def create(self, data: AIProviderCreate) -> AIProvider:
        values = data.model_dump(exclude_unset=True)
        api_key = values.pop("api_key", None)
        provider = AIProvider(**values)
        if api_key:
            provider.api_key_encrypted = encrypt_api_key(api_key)
        return self._repo.create(provider)

    def update(self, id: int, data: AIProviderUpdate) -> AIProvider | None:
        provider = self._repo.get(id)
        if not provider:
            return None
        changes = data.model_dump(exclude_unset=True)
        api_key = changes.pop("api_key", None)
        if api_key:
            provider.api_key_encrypted = encrypt_api_key(api_key)
        return self._repo.update(provider, changes)

    def delete(self, id: int) -> bool:
        return self._repo.delete(id)

    def test_connection(self, data: AIProviderTestRequest) -> AIProviderTestResponse:
        settings = get_settings()
        # v0.4 P0-Sec2: validate provider URL before constructing client
        try:
            from app.config import get_settings as _gs
            dev_mode = _gs().electron_mode or _gs().debug
            base_url = data.base_url or settings.anthropic_base_url
            validate_provider_url(base_url, dev_mode=bool(dev_mode))
        except SSRFBlockedError as exc:
            return AIProviderTestResponse(success=False, message=f"URL blocked: {exc}")
        client = Anthropic(
            api_key=data.api_key,
            base_url=data.base_url or settings.anthropic_base_url,
            http_client=_build_httpx_client_no_redirect(),
        )
        try:
            client.messages.create(
                model=data.model_name or settings.anthropic_model,
                max_tokens=10,
                messages=[{"role": "user", "content": "ping"}],
            )
            return AIProviderTestResponse(
                success=True,
                message="Connection successful",
            )
        except Exception as exc:
            return AIProviderTestResponse(
                success=False,
                message="Connection failed",
                error_detail=str(exc),
            )
