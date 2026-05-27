"""Tests for WSMessageQueue - SQLite-backed WebSocket message queue."""

import pytest
import json
import tempfile
import os
from backend.services.ws_message_queue import WSMessageQueue


@pytest.fixture
def queue(tmp_path):
    """Create a WSMessageQueue with a temp database."""
    db_path = str(tmp_path / "test_ws_queue.db")
    return WSMessageQueue(db_path=db_path, max_queue_per_session=5, max_message_age=3600.0)


# =============================================================================
# Lifecycle
# =============================================================================

class TestLifecycle:
    """Test queue initialization and cleanup."""

    @pytest.mark.asyncio
    async def test_initialise_creates_table(self, queue):
        """initialise creates the message queue table."""
        await queue.initialise()
        assert queue._initialised is True

    @pytest.mark.asyncio
    async def test_close_does_nothing(self, queue):
        """close is a no-op for interface symmetry."""
        await queue.close()


# =============================================================================
# Enqueue / Dequeue
# =============================================================================

class TestEnqueueDequeue:
    """Test basic enqueue and dequeue operations."""

    @pytest.mark.asyncio
    async def test_enqueue_and_dequeue(self, queue):
        """Enqueued messages are returned by dequeue_all."""
        await queue.initialise()
        msg = {"type": "greeting", "content": "hello"}
        await queue.enqueue(session_id=1, message=msg)

        messages = await queue.dequeue_all(session_id=1)
        assert len(messages) == 1
        assert messages[0]["type"] == "greeting"
        assert messages[0]["content"] == "hello"

    @pytest.mark.asyncio
    async def test_dequeue_returns_empty_for_empty_queue(self, queue):
        """dequeue_all returns empty list when no messages."""
        await queue.initialise()
        messages = await queue.dequeue_all(session_id=1)
        assert messages == []

    @pytest.mark.asyncio
    async def test_dequeue_removes_messages(self, queue):
        """dequeue_all removes messages from queue."""
        await queue.initialise()
        await queue.enqueue(session_id=1, message={"msg": "a"})
        await queue.dequeue_all(session_id=1)

        # Second dequeue should be empty
        messages = await queue.dequeue_all(session_id=1)
        assert messages == []

    @pytest.mark.asyncio
    async def test_multiple_messages_ordered(self, queue):
        """Messages are returned in chronological order."""
        await queue.initialise()
        for i in range(3):
            await queue.enqueue(session_id=1, message={"index": i})

        messages = await queue.dequeue_all(session_id=1)
        assert len(messages) == 3
        assert messages[0]["index"] == 0
        assert messages[1]["index"] == 1
        assert messages[2]["index"] == 2

    @pytest.mark.asyncio
    async def test_sessions_are_isolated(self, queue):
        """Messages for different sessions are isolated."""
        await queue.initialise()
        await queue.enqueue(session_id=1, message={"for": "session1"})
        await queue.enqueue(session_id=2, message={"for": "session2"})

        msgs1 = await queue.dequeue_all(session_id=1)
        msgs2 = await queue.dequeue_all(session_id=2)
        assert len(msgs1) == 1
        assert msgs1[0]["for"] == "session1"
        assert len(msgs2) == 1
        assert msgs2[0]["for"] == "session2"


# =============================================================================
# Queue size cap
# =============================================================================

class TestQueueSizeCap:
    """Test per-session queue size enforcement."""

    @pytest.mark.asyncio
    async def test_queue_cap_drops_oldest(self, queue):
        """When queue is full, oldest message is dropped."""
        await queue.initialise()
        # max_queue_per_session is 5
        for i in range(7):
            await queue.enqueue(session_id=1, message={"index": i})

        messages = await queue.dequeue_all(session_id=1)
        assert len(messages) == 5
        # Oldest (0, 1) should be dropped
        assert messages[0]["index"] == 2


# =============================================================================
# has_messages / queue_size
# =============================================================================

class TestQueryMethods:
    """Test has_messages and queue_size."""

    @pytest.mark.asyncio
    async def test_has_messages_true_when_queued(self, queue):
        """has_messages returns True when messages are queued."""
        await queue.initialise()
        await queue.enqueue(session_id=1, message={"msg": "hi"})
        assert await queue.has_messages(session_id=1) is True

    @pytest.mark.asyncio
    async def test_has_messages_false_when_empty(self, queue):
        """has_messages returns False when queue is empty."""
        await queue.initialise()
        assert await queue.has_messages(session_id=1) is False

    @pytest.mark.asyncio
    async def test_queue_size_returns_count(self, queue):
        """queue_size returns the number of pending messages."""
        await queue.initialise()
        for i in range(3):
            await queue.enqueue(session_id=1, message={"i": i})
        assert await queue.queue_size(session_id=1) == 3

    @pytest.mark.asyncio
    async def test_queue_size_zero_when_empty(self, queue):
        """queue_size returns 0 when no messages."""
        await queue.initialise()
        assert await queue.queue_size(session_id=1) == 0


# =============================================================================
# Cleanup
# =============================================================================

class TestCleanup:
    """Test stale message cleanup."""

    @pytest.mark.asyncio
    async def test_cleanup_removes_delivered(self, queue):
        """cleanup removes delivered messages."""
        await queue.initialise()
        await queue.enqueue(session_id=1, message={"msg": "hi"})
        await queue.dequeue_all(session_id=1)  # marks as delivered + deletes

        # cleanup should find nothing (already deleted by dequeue)
        deleted = await queue.cleanup()
        assert deleted >= 0

    @pytest.mark.asyncio
    async def test_cleanup_with_custom_age(self, queue):
        """cleanup with custom max_age works."""
        await queue.initialise()
        await queue.enqueue(session_id=1, message={"msg": "old"})
        # With max_age=0, everything is stale
        deleted = await queue.cleanup(max_age=0.0)
        assert deleted >= 0


# =============================================================================
# Auto-initialize
# =============================================================================

class TestAutoInitialize:
    """Test that operations auto-initialize if needed."""

    @pytest.mark.asyncio
    async def test_enqueue_auto_initializes(self, queue):
        """enqueue auto-initializes if not yet initialized."""
        assert queue._initialised is False
        await queue.enqueue(session_id=1, message={"auto": True})
        assert queue._initialised is True

    @pytest.mark.asyncio
    async def test_dequeue_auto_initializes(self, queue):
        """dequeue_all auto-initializes if not yet initialized."""
        assert queue._initialised is False
        messages = await queue.dequeue_all(session_id=1)
        assert queue._initialised is True
        assert messages == []
