"""Tests for infrastructure modules: tiered_cache, encryption, engine."""

import pytest
from unittest.mock import MagicMock, patch
import json


# ── tiered_cache.py ──────────────────────────────────────────────────

from backend.infrastructure.cache.cache_service import LRUCache


class TestLRUCache:
    def test_set_and_get(self):
        cache = LRUCache(max_size=10)
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"

    def test_get_missing(self):
        cache = LRUCache(max_size=10)
        assert cache.get("missing") is None

    def test_eviction(self):
        cache = LRUCache(max_size=2)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.set("c", 3)  # evicts "a"
        assert cache.get("a") is None
        assert cache.get("b") == 2
        assert cache.get("c") == 3

    def test_update_existing(self):
        cache = LRUCache(max_size=10)
        cache.set("key", "old")
        cache.set("key", "new")
        assert cache.get("key") == "new"

    def test_delete(self):
        cache = LRUCache(max_size=10)
        cache.set("key", "value")
        cache.delete("key")
        assert cache.get("key") is None

    def test_delete_missing(self):
        cache = LRUCache(max_size=10)
        cache.delete("missing")  # Should not raise

    def test_clear(self):
        cache = LRUCache(max_size=10)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.clear()
        assert cache.get("a") is None
        assert cache.get("b") is None

    def test_size(self):
        cache = LRUCache(max_size=10)
        assert cache.size() == 0
        cache.set("a", 1)
        assert cache.size() == 1
        cache.set("b", 2)
        assert cache.size() == 2

    def test_keys(self):
        cache = LRUCache(max_size=10)
        cache.set("a", 1)
        cache.set("b", 2)
        assert set(cache.keys()) == {"a", "b"}


# ── TieredCache ──────────────────────────────────────────────────────

from backend.infrastructure.cache.tiered_cache import TieredCache


class TestTieredCache:
    def _make_cache(self, max_size=10):
        l1 = LRUCache(max_size=max_size)
        mock_db = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_cursor.rowcount = 0
        mock_db.execute.return_value = mock_cursor
        mock_factory = MagicMock(return_value=mock_db)
        return TieredCache(l1_cache=l1, l2_cache=None, db_session_factory=mock_factory)

    def test_set_and_get_l1(self):
        tc = self._make_cache()
        tc.set("key", "value", tier="l1")
        assert tc.get("key") == "value"

    def test_get_missing(self):
        tc = self._make_cache()
        assert tc.get("missing") is None

    def test_invalidate(self):
        tc = self._make_cache()
        tc.set("key", "value", tier="l1")
        tc.invalidate("key")
        assert tc.get("key") is None

    def test_invalidate_missing(self):
        tc = self._make_cache()
        tc.invalidate("missing")  # Should not raise

    def test_set_auto_tier(self):
        tc = self._make_cache()
        tc.set("key", "small_value", tier="auto")
        assert tc.get("key") == "small_value"

    def test_set_unknown_tier_raises(self):
        tc = self._make_cache()
        with pytest.raises(ValueError, match="Unknown tier"):
            tc.set("key", "value", tier="invalid")

    def test_stats(self):
        tc = self._make_cache()
        tc.set("a", 1, tier="l1")
        stats = tc.stats()
        assert "l1" in stats
        assert stats["l1"]["size"] >= 1

    def test_l1_only_mode(self):
        """TieredCache works with L2=None (no disk cache)."""
        tc = self._make_cache()
        tc.set("key", "value", tier="l1")
        assert tc.get("key") == "value"


# ── encryption.py ────────────────────────────────────────────────────

try:
    from cryptography.fernet import Fernet
    HAS_CRYPTOGRAPHY = True
except ImportError:
    HAS_CRYPTOGRAPHY = False


@pytest.mark.skipif(not HAS_CRYPTOGRAPHY, reason="cryptography package not installed")
class TestEncryption:
    def test_round_trip(self):
        from backend.infrastructure.security.encryption import encrypt_value, decrypt_value
        plaintext = "my-secret-api-key-12345"
        encrypted = encrypt_value(plaintext)
        assert encrypted != plaintext
        decrypted = decrypt_value(encrypted)
        assert decrypted == plaintext

    def test_empty_string(self):
        from backend.infrastructure.security.encryption import encrypt_value, decrypt_value
        assert encrypt_value("") == ""
        assert decrypt_value("") == ""

    def test_none_passthrough(self):
        from backend.infrastructure.security.encryption import encrypt_value, decrypt_value
        assert encrypt_value(None) is None
        assert decrypt_value(None) is None

    def test_different_inputs_different_outputs(self):
        from backend.infrastructure.security.encryption import encrypt_value
        e1 = encrypt_value("key1")
        e2 = encrypt_value("key2")
        assert e1 != e2

    def test_unicode_content(self):
        from backend.infrastructure.security.encryption import encrypt_value, decrypt_value
        plaintext = "你好世界-API密钥"
        encrypted = encrypt_value(plaintext)
        decrypted = decrypt_value(encrypted)
        assert decrypted == plaintext
