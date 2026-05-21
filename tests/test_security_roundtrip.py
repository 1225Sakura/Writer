"""Security round-trip tests: encryption, rate limiter, WS message queue.

Tests:
- encrypt_value / decrypt_value round-trip
- decrypt_value legacy plaintext passthrough
- is_encryption_available
- SQLiteRateLimiter: allow/block/reset
- WSMessageQueue: enqueue/dequeue, FIFO order, session isolation
"""

import asyncio
import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))
sys.path.insert(0, str(PROJECT_ROOT / "src" / "backend"))


# ===========================================================================
# Encryption tests
# ===========================================================================


class TestEncryptionRoundTrip:
    """encrypt_value -> decrypt_value must return the original plaintext."""

    def test_encrypt_decrypt_round_trip(self):
        """Encrypting then decrypting returns the original string."""
        from backend.infrastructure.security.encryption import (
            encrypt_value,
            decrypt_value,
        )

        plaintext = "sk-test-api-key-12345-secret"
        ciphertext = encrypt_value(plaintext)

        # Ciphertext should differ from plaintext
        assert ciphertext != plaintext
        # Must be valid UTF-8
        assert isinstance(ciphertext, str)

        recovered = decrypt_value(ciphertext)
        assert recovered == plaintext

    def test_encrypt_decrypt_unicode(self):
        """Round-trip works for Unicode / Chinese text."""
        from backend.infrastructure.security.encryption import (
            encrypt_value,
            decrypt_value,
        )

        plaintext = "这是一个中文API密钥测试_🔑"
        ciphertext = encrypt_value(plaintext)
        recovered = decrypt_value(ciphertext)
        assert recovered == plaintext

    def test_encrypt_decrypt_empty_string(self):
        """Round-trip works for an empty string."""
        from backend.infrastructure.security.encryption import (
            encrypt_value,
            decrypt_value,
        )

        plaintext = ""
        ciphertext = encrypt_value(plaintext)
        recovered = decrypt_value(ciphertext)
        assert recovered == plaintext

    def test_decrypt_non_fernet_returns_as_is(self):
        """decrypt_value on a non-Fernet string returns it unchanged (legacy plaintext)."""
        from backend.infrastructure.security.encryption import decrypt_value

        legacy_key = "my-old-plaintext-api-key-abc123"
        result = decrypt_value(legacy_key)
        assert result == legacy_key

    def test_is_encryption_available(self):
        """is_encryption_available returns True when cryptography is installed."""
        from backend.infrastructure.security.encryption import is_encryption_available

        assert is_encryption_available() is True

    def test_multiple_encryptions_differ(self):
        """Encrypting the same plaintext twice produces different ciphertexts (random IV)."""
        from backend.infrastructure.security.encryption import encrypt_value

        plaintext = "same-key"
        ct1 = encrypt_value(plaintext)
        ct2 = encrypt_value(plaintext)
        # Fernet uses a random IV, so ciphertexts should differ
        assert ct1 != ct2


# ===========================================================================
# Rate limiter tests (async, SQLite-backed)
# ===========================================================================


class TestSQLiteRateLimiter:
    """SQLiteRateLimiter: allow within limit, block over limit, reset."""

    @pytest.mark.asyncio
    async def test_allows_within_limit(self):
        """First request within limit is allowed with correct remaining count."""
        from backend.infrastructure.rate_limit.sqlite_limiter import SQLiteRateLimiter

        with tempfile.TemporaryDirectory() as td:
            limiter = SQLiteRateLimiter(db_path=os.path.join(td, "test.db"))
            await limiter.initialise()

            allowed, limit, remaining = await limiter.check(
                "127.0.0.1", max_requests=5, window_seconds=60
            )
            assert allowed is True
            assert limit == 5
            assert remaining == 4

    @pytest.mark.asyncio
    async def test_blocks_over_limit(self):
        """Requests beyond the limit are blocked."""
        from backend.infrastructure.rate_limit.sqlite_limiter import SQLiteRateLimiter

        with tempfile.TemporaryDirectory() as td:
            limiter = SQLiteRateLimiter(db_path=os.path.join(td, "test.db"))
            await limiter.initialise()

            for _ in range(5):
                await limiter.check("127.0.0.1", max_requests=5, window_seconds=60)

            allowed, limit, remaining = await limiter.check(
                "127.0.0.1", max_requests=5, window_seconds=60
            )
            assert allowed is False
            assert limit == 5
            assert remaining == 0

    @pytest.mark.asyncio
    async def test_reset_allows_again(self):
        """After reset, the same client is allowed again."""
        from backend.infrastructure.rate_limit.sqlite_limiter import SQLiteRateLimiter

        with tempfile.TemporaryDirectory() as td:
            limiter = SQLiteRateLimiter(db_path=os.path.join(td, "test.db"))
            await limiter.initialise()

            for _ in range(5):
                await limiter.check("127.0.0.1", max_requests=5, window_seconds=60)

            # Verify blocked
            allowed, _, _ = await limiter.check(
                "127.0.0.1", max_requests=5, window_seconds=60
            )
            assert allowed is False

            # Reset and try again
            await limiter.reset("127.0.0.1")
            allowed, _, remaining = await limiter.check(
                "127.0.0.1", max_requests=5, window_seconds=60
            )
            assert allowed is True
            assert remaining == 4

    @pytest.mark.asyncio
    async def test_independent_clients(self):
        """Different clients have independent rate limits."""
        from backend.infrastructure.rate_limit.sqlite_limiter import SQLiteRateLimiter

        with tempfile.TemporaryDirectory() as td:
            limiter = SQLiteRateLimiter(db_path=os.path.join(td, "test.db"))
            await limiter.initialise()

            # Exhaust limit for client A
            for _ in range(5):
                await limiter.check("client-A", max_requests=5, window_seconds=60)

            # Client B should still be allowed
            allowed, _, _ = await limiter.check(
                "client-B", max_requests=5, window_seconds=60
            )
            assert allowed is True

    @pytest.mark.asyncio
    async def test_custom_window_name(self):
        """Different window names have independent counters."""
        from backend.infrastructure.rate_limit.sqlite_limiter import SQLiteRateLimiter

        with tempfile.TemporaryDirectory() as td:
            limiter = SQLiteRateLimiter(db_path=os.path.join(td, "test.db"))
            await limiter.initialise()

            # Exhaust "default" window
            for _ in range(3):
                await limiter.check(
                    "127.0.0.1", max_requests=3, window_seconds=60, window_name="default"
                )

            # "checker" window should still be allowed
            allowed, _, _ = await limiter.check(
                "127.0.0.1", max_requests=3, window_seconds=60, window_name="checker"
            )
            assert allowed is True

    @pytest.mark.asyncio
    async def test_auto_initialise(self):
        """check() auto-initialises if initialise() was not called."""
        from backend.infrastructure.rate_limit.sqlite_limiter import SQLiteRateLimiter

        with tempfile.TemporaryDirectory() as td:
            limiter = SQLiteRateLimiter(db_path=os.path.join(td, "test.db"))
            # Do NOT call initialise()
            allowed, _, _ = await limiter.check(
                "127.0.0.1", max_requests=5, window_seconds=60
            )
            assert allowed is True


# ===========================================================================
# WS Message Queue tests (async, SQLite-backed)
# ===========================================================================


class TestWSMessageQueue:
    """WSMessageQueue: enqueue/dequeue, FIFO order, session isolation."""

    @pytest.mark.asyncio
    async def test_enqueue_dequeue(self):
        """Enqueued message can be dequeued; queue is empty after dequeue."""
        from backend.services.ws_message_queue import WSMessageQueue

        with tempfile.TemporaryDirectory() as td:
            queue = WSMessageQueue(db_path=os.path.join(td, "test.db"))
            await queue.initialise()

            await queue.enqueue(session_id=1, message={"type": "test", "content": "hello"})
            messages = await queue.dequeue_all(session_id=1)

            assert len(messages) == 1
            assert messages[0]["type"] == "test"
            assert messages[0]["content"] == "hello"

            # After dequeue, queue should be empty
            assert await queue.has_messages(1) is False

    @pytest.mark.asyncio
    async def test_fifo_order(self):
        """Messages are dequeued in FIFO (enqueue) order."""
        from backend.services.ws_message_queue import WSMessageQueue

        with tempfile.TemporaryDirectory() as td:
            queue = WSMessageQueue(db_path=os.path.join(td, "test.db"))
            await queue.initialise()

            await queue.enqueue(1, {"order": 1})
            await queue.enqueue(1, {"order": 2})
            await queue.enqueue(1, {"order": 3})

            messages = await queue.dequeue_all(1)
            assert [m["order"] for m in messages] == [1, 2, 3]

    @pytest.mark.asyncio
    async def test_session_isolation(self):
        """Messages for different sessions are isolated."""
        from backend.services.ws_message_queue import WSMessageQueue

        with tempfile.TemporaryDirectory() as td:
            queue = WSMessageQueue(db_path=os.path.join(td, "test.db"))
            await queue.initialise()

            await queue.enqueue(1, {"for": "session1"})
            await queue.enqueue(2, {"for": "session2"})

            msg1 = await queue.dequeue_all(1)
            msg2 = await queue.dequeue_all(2)

            assert len(msg1) == 1
            assert msg1[0]["for"] == "session1"
            assert len(msg2) == 1
            assert msg2[0]["for"] == "session2"

    @pytest.mark.asyncio
    async def test_dequeue_empty_returns_empty_list(self):
        """Dequeue on an empty queue returns an empty list."""
        from backend.services.ws_message_queue import WSMessageQueue

        with tempfile.TemporaryDirectory() as td:
            queue = WSMessageQueue(db_path=os.path.join(td, "test.db"))
            await queue.initialise()

            messages = await queue.dequeue_all(999)
            assert messages == []

    @pytest.mark.asyncio
    async def test_has_messages_and_queue_size(self):
        """has_messages and queue_size reflect the queue state accurately."""
        from backend.services.ws_message_queue import WSMessageQueue

        with tempfile.TemporaryDirectory() as td:
            queue = WSMessageQueue(db_path=os.path.join(td, "test.db"))
            await queue.initialise()

            assert await queue.has_messages(1) is False
            assert await queue.queue_size(1) == 0

            await queue.enqueue(1, {"a": 1})
            await queue.enqueue(1, {"b": 2})

            assert await queue.has_messages(1) is True
            assert await queue.queue_size(1) == 2

            await queue.dequeue_all(1)
            assert await queue.has_messages(1) is False
            assert await queue.queue_size(1) == 0

    @pytest.mark.asyncio
    async def test_auto_initialise(self):
        """enqueue/dequeue auto-initialise if initialise() was not called."""
        from backend.services.ws_message_queue import WSMessageQueue

        with tempfile.TemporaryDirectory() as td:
            queue = WSMessageQueue(db_path=os.path.join(td, "test.db"))
            # Do NOT call initialise()
            await queue.enqueue(1, {"auto": True})
            messages = await queue.dequeue_all(1)
            assert len(messages) == 1
            assert messages[0]["auto"] is True

    @pytest.mark.asyncio
    async def test_complex_message_payload(self):
        """Nested dicts and lists survive round-trip."""
        from backend.services.ws_message_queue import WSMessageQueue

        with tempfile.TemporaryDirectory() as td:
            queue = WSMessageQueue(db_path=os.path.join(td, "test.db"))
            await queue.initialise()

            payload = {
                "type": "ai_response",
                "content": "这是一段中文内容",
                "metadata": {"model": "gpt-4o", "tokens": 150},
                "chunks": ["part1", "part2", "part3"],
            }
            await queue.enqueue(1, payload)
            messages = await queue.dequeue_all(1)

            assert len(messages) == 1
            assert messages[0] == payload
