"""Tests for ProviderResolver — cache, TTL, invalidation, error paths."""
from __future__ import annotations

import asyncio
import time

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import SecretStr, encrypt_api_key
from app.database import Base
from app.models import AIProvider
from app.services.provider_resolver import (
    NoActiveProviderError,
    ProviderConfig,
    ProviderResolver,
    reset_provider_resolver_for_testing,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def resolver():
    """Fresh resolver per test."""
    return ProviderResolver(ttl_seconds=60.0)


@pytest.fixture
def session():
    """Per-test in-memory SQLite session with shared pool."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()
        engine.dispose()


def _make_active_provider(session, *, key="sk-test-aaaa", name="MiniMax",
                          model="MiniMax-M3", base_url="https://api.minimaxi.com/anthropic"):
    p = AIProvider(
        user_id="default-user",
        name=name,
        api_key_encrypted=encrypt_api_key(key),
        base_url=base_url,
        model_name=model,
        max_tokens=4096,
        temperature=0.7,
        is_active=True,
    )
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


# ---------------------------------------------------------------------------
# Test 1: NoActiveProviderError when no active provider
# ---------------------------------------------------------------------------

def test_get_active_raises_when_none(resolver, session):
    """No is_active=True row → NoActiveProviderError (HTTP 409 target)."""
    with pytest.raises(NoActiveProviderError) as exc_info:
        asyncio.run(resolver.get_active(session, user_id="default-user"))
    assert exc_info.value.error_code == "PROVIDER_NONE_ACTIVE"
    assert "default-user" in str(exc_info.value)


# ---------------------------------------------------------------------------
# Test 2: Returns ProviderConfig with SecretStr key
# ---------------------------------------------------------------------------

def test_get_active_returns_snapshot(resolver, session):
    p = _make_active_provider(session, key="sk-test-aaaa-12345")
    config = asyncio.run(resolver.get_active(session, user_id="default-user"))
    assert isinstance(config, ProviderConfig)
    assert config.provider_id == p.id
    assert config.name == "MiniMax"
    assert config.model == "MiniMax-M3"
    assert isinstance(config.key, SecretStr)
    assert config.key.get() == "sk-test-aaaa-12345"
    # Plaintext must not appear in repr
    assert "sk-test-aaaa-12345" not in repr(config)


# ---------------------------------------------------------------------------
# Test 3: Cache hit returns same instance on second call
# ---------------------------------------------------------------------------

def test_cache_hit_returns_same_config(resolver, session):
    p = _make_active_provider(session)
    c1 = asyncio.run(resolver.get_active(session, user_id="default-user"))
    c2 = asyncio.run(resolver.get_active(session, user_id="default-user"))
    # Same cache entry → same ProviderConfig instance (frozen dataclass)
    assert c1 is c2


# ---------------------------------------------------------------------------
# Test 4: TTL expiry triggers re-fetch
# ---------------------------------------------------------------------------

def test_ttl_expiry_triggers_refetch(session):
    """With ttl_seconds=0.05, second call after sleep returns fresh snapshot."""
    resolver = ProviderResolver(ttl_seconds=0.05)
    _make_active_provider(session)
    c1 = asyncio.run(resolver.get_active(session, user_id="default-user"))
    time.sleep(0.1)
    # New entry: not the same instance, but same content
    c2 = asyncio.run(resolver.get_active(session, user_id="default-user"))
    assert c1 is not c2
    assert c1.provider_id == c2.provider_id


# ---------------------------------------------------------------------------
# Test 5: invalidate clears entry; next call rebuilds
# ---------------------------------------------------------------------------

def test_invalidate_clears_entry(resolver, session):
    _make_active_provider(session)
    c1 = asyncio.run(resolver.get_active(session, user_id="default-user"))
    resolver.invalidate(user_id="default-user")
    c2 = asyncio.run(resolver.get_active(session, user_id="default-user"))
    assert c1 is not c2


# ---------------------------------------------------------------------------
# Test 6: invalidate_all clears everything
# ---------------------------------------------------------------------------

def test_invalidate_all(resolver, session):
    _make_active_provider(session)
    asyncio.run(resolver.get_active(session, user_id="default-user"))
    assert len(resolver._cache) == 1
    resolver.invalidate_all()
    assert len(resolver._cache) == 0


# ---------------------------------------------------------------------------
# Test 7: deactivate then re-resolve raises
# ---------------------------------------------------------------------------

def test_deactivate_then_resolve_raises(resolver, session):
    """If we deactivate the provider between calls, the next resolve raises
    NoActiveProviderError because the resolver re-queries the DB to find the
    active provider_id on every call (only the per-provider snapshot is cached).
    The resolver always uses the LATEST active_provider_id from DB; only the
    per-provider config snapshot (decryption) is cached."""
    p = _make_active_provider(session)
    c1 = asyncio.run(resolver.get_active(session, user_id="default-user"))
    assert c1.provider_id == p.id
    # Deactivate in DB
    p.is_active = False
    session.commit()
    # Without invalidation, resolver still queries DB → finds no active → raises
    with pytest.raises(NoActiveProviderError):
        asyncio.run(resolver.get_active(session, user_id="default-user"))
    # Note: invalidate() clears the (now-orphaned) cache entry for cleanup
    resolver.invalidate(user_id="default-user")
    assert len(resolver._cache) == 0


# ---------------------------------------------------------------------------
# Test 8: multiple users have isolated cache
# ---------------------------------------------------------------------------

def test_multi_user_isolation(resolver, session):
    p1 = AIProvider(
        user_id="user-1", name="P1",
        api_key_encrypted=encrypt_api_key("sk-user1-key"),
        base_url="https://api.minimaxi.com/anthropic",
        model_name="MiniMax-M3",
        max_tokens=4096, temperature=0.7, is_active=True,
    )
    p2 = AIProvider(
        user_id="user-2", name="P2",
        api_key_encrypted=encrypt_api_key("sk-user2-key"),
        base_url="https://api.minimaxi.com/anthropic",
        model_name="MiniMax-M3",
        max_tokens=4096, temperature=0.7, is_active=True,
    )
    session.add_all([p1, p2])
    session.commit()

    c1 = asyncio.run(resolver.get_active(session, user_id="user-1"))
    c2 = asyncio.run(resolver.get_active(session, user_id="user-2"))
    assert c1.provider_id != c2.provider_id
    assert c1.key.get() == "sk-user1-key"
    assert c2.key.get() == "sk-user2-key"

    # Invalidate user-1 only
    resolver.invalidate(user_id="user-1")
    assert len(resolver._cache) == 1  # user-2 still cached


# ---------------------------------------------------------------------------
# Test 9: cache key includes provider_id (sensitive to activations)
# ---------------------------------------------------------------------------

def test_cache_key_includes_provider_id(resolver, session):
    """Cache entries are keyed by (user, project, provider_id). Activating a
    different provider creates a new cache entry — old one can still be
    returned if requested by ID."""
    p_a = _make_active_provider(session, name="ProviderA", key="sk-key-a")
    c_a = asyncio.run(resolver.get_active(session, user_id="default-user"))
    assert c_a.key.get() == "sk-key-a"

    # Activate a different provider (deactivate old, activate new)
    p_a.is_active = False
    p_b = AIProvider(
        user_id="default-user", name="ProviderB",
        api_key_encrypted=encrypt_api_key("sk-key-b"),
        base_url="https://api.minimaxi.com/anthropic",
        model_name="MiniMax-M3",
        max_tokens=4096, temperature=0.7, is_active=True,
    )
    session.add(p_b)
    session.commit()

    # Without invalidation, the cache might still serve the old active.
    # This is the documented behavior (caller-driven invalidation).
    # After explicit invalidate, the new active is returned.
    resolver.invalidate(user_id="default-user")
    c_b = asyncio.run(resolver.get_active(session, user_id="default-user"))
    assert c_b.key.get() == "sk-key-b"
    assert c_b is not c_a


# ---------------------------------------------------------------------------
# Test 10: global resolver accessor + reset
# ---------------------------------------------------------------------------

def test_global_accessor_singleton():
    from app.services.provider_resolver import get_provider_resolver
    reset_provider_resolver_for_testing()
    r1 = get_provider_resolver()
    r2 = get_provider_resolver()
    assert r1 is r2
    reset_provider_resolver_for_testing()
    r3 = get_provider_resolver()
    assert r3 is not r1


# ---------------------------------------------------------------------------
# Test 11: SecretStr exposure via __repr__ never leaks
# ---------------------------------------------------------------------------

def test_provider_config_repr_redacts_secret():
    s = SecretStr("sk-supersecret-12345")
    config = ProviderConfig(
        provider_id=1, name="x", model="m", base_url="u",
        key=s, max_tokens=4096, temperature=0.7,
    )
    assert "sk-supersecret-12345" not in repr(config)
    s.clear()
