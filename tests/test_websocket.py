"""
Tests for WebSocket connection handling.
"""

import pytest
import json
import time
from unittest.mock import AsyncMock, MagicMock, patch
from starlette.websockets import WebSocketState

from backend.interface.web.main import app, manager, ConnectionManager, QueuedMessage


class TestConnectionManager:
    """Test ConnectionManager unit methods."""

    @pytest.fixture
    def connection_manager(self):
        """Create a fresh ConnectionManager."""
        return ConnectionManager()

    @pytest.mark.asyncio
    async def test_connect_new_session(self, connection_manager):
        """Test connecting to a new session."""
        websocket = AsyncMock()
        await connection_manager.connect(websocket, session_id=1)

        assert 1 in connection_manager.active_connections
        assert len(connection_manager.active_connections[1]) == 1
        assert connection_manager.connection_status[1] == "connected"
        websocket.accept.assert_called_once()

    @pytest.mark.asyncio
    async def test_connect_existing_session(self, connection_manager):
        """Test multiple connections to the same session."""
        ws1 = AsyncMock()
        ws2 = AsyncMock()

        await connection_manager.connect(ws1, session_id=1)
        await connection_manager.connect(ws2, session_id=1)

        assert len(connection_manager.active_connections[1]) == 2

    @pytest.mark.asyncio
    async def test_disconnect_removes_connection(self, connection_manager):
        """Test disconnect removes websocket from session."""
        websocket = AsyncMock()
        await connection_manager.connect(websocket, session_id=1)

        connection_manager.disconnect(websocket, session_id=1)

        assert 1 not in connection_manager.active_connections
        assert 1 not in connection_manager.connection_status

    @pytest.mark.asyncio
    async def test_disconnect_partial(self, connection_manager):
        """Test disconnect with multiple connections leaves session active."""
        ws1 = AsyncMock()
        ws2 = AsyncMock()

        await connection_manager.connect(ws1, session_id=1)
        await connection_manager.connect(ws2, session_id=1)

        connection_manager.disconnect(ws1, session_id=1)

        assert len(connection_manager.active_connections[1]) == 1
        assert 1 in connection_manager.connection_status

    @pytest.mark.asyncio
    async def test_send_to_session(self, connection_manager):
        """Test sending message to all connections in a session."""
        ws1 = AsyncMock()
        ws1.client_state = WebSocketState.CONNECTED
        ws2 = AsyncMock()
        ws2.client_state = WebSocketState.CONNECTED

        await connection_manager.connect(ws1, session_id=1)
        await connection_manager.connect(ws2, session_id=1)

        message = {"type": "test", "content": "hello"}
        await connection_manager.send_to_session(1, message)

        ws1.send_json.assert_called_once_with(message)
        ws2.send_json.assert_called_once_with(message)

    @pytest.mark.asyncio
    async def test_send_to_session_no_connections(self, connection_manager):
        """Test sending to session with no connections does not error."""
        message = {"type": "test", "content": "hello"}
        await connection_manager.send_to_session(999, message)

    @pytest.mark.asyncio
    async def test_send_to_session_one_fails(self, connection_manager):
        """Test send continues even if one connection fails."""
        ws1 = AsyncMock()
        ws1.client_state = WebSocketState.CONNECTED
        ws1.send_json = AsyncMock(side_effect=Exception("Connection broken"))
        ws2 = AsyncMock()
        ws2.client_state = WebSocketState.CONNECTED

        await connection_manager.connect(ws1, session_id=1)
        await connection_manager.connect(ws2, session_id=1)

        message = {"type": "test"}
        await connection_manager.send_to_session(1, message)

        ws2.send_json.assert_called_once_with(message)

    @pytest.mark.asyncio
    async def test_broadcast(self, connection_manager):
        """Test broadcasting to all sessions."""
        ws1 = AsyncMock()
        ws1.client_state = WebSocketState.CONNECTED
        ws2 = AsyncMock()
        ws2.client_state = WebSocketState.CONNECTED

        await connection_manager.connect(ws1, session_id=1)
        await connection_manager.connect(ws2, session_id=2)

        message = {"type": "broadcast"}
        await connection_manager.broadcast(message)

        ws1.send_json.assert_called_once_with(message)
        ws2.send_json.assert_called_once_with(message)

    def test_get_status_connected(self, connection_manager):
        """Test get_status for connected session."""
        websocket = AsyncMock()

        import asyncio
        asyncio.run(connection_manager.connect(websocket, session_id=1))

        status = connection_manager.get_status(1)
        assert status["session_id"] == 1
        assert status["status"] == "connected"
        assert status["connections"] == 1

    def test_get_status_unknown(self, connection_manager):
        """Test get_status for unknown session."""
        status = connection_manager.get_status(999)
        assert status["session_id"] == 999
        assert status["status"] == "unknown"
        assert status["connections"] == 0


class TestWebSocketRateLimiting:
    """Test WebSocket rate limiting functionality."""

    @pytest.fixture
    def connection_manager(self):
        """Create a ConnectionManager with known rate limits."""
        return ConnectionManager(
            rate_limit_window=60.0,
            rate_limit_max_messages=5
        )

    def test_rate_limit_allows_under_limit(self, connection_manager):
        """Test rate limit allows messages under the limit."""
        allowed, info = connection_manager.check_rate_limit(1)
        assert allowed is True
        assert info["remaining"] == 4

    def test_rate_limit_blocks_over_limit(self, connection_manager):
        """Test rate limit blocks messages over the limit."""
        # Exhaust the limit
        for _ in range(5):
            connection_manager.check_rate_limit(1)

        allowed, info = connection_manager.check_rate_limit(1)
        assert allowed is False
        assert info["allowed"] is False
        assert info["current_count"] >= 5

    def test_rate_limit_resets_after_window(self, connection_manager):
        """Test rate limit resets after the window expires."""
        # Exhaust the limit
        for _ in range(5):
            connection_manager.check_rate_limit(1)

        # Manually clear rate tracking to simulate time passing
        connection_manager.rate_limit_tracking[1] = []

        allowed, info = connection_manager.check_rate_limit(1)
        assert allowed is True


class TestWebSocketMessageQueuing:
    """Test message queuing for disconnected clients."""

    @pytest.fixture
    def connection_manager(self):
        """Create a ConnectionManager."""
        return ConnectionManager()

    @pytest.mark.asyncio
    async def test_queue_message(self, connection_manager):
        """Test queuing a message for a session."""
        message = {"type": "test", "content": "hello"}
        await connection_manager.queue_message(1, message)

        assert connection_manager.has_queued_messages(1)
        assert connection_manager.get_queue_size(1) == 1

    @pytest.mark.asyncio
    async def test_get_queued_messages(self, connection_manager):
        """Test retrieving and clearing queued messages."""
        message1 = {"type": "test", "content": "hello"}
        message2 = {"type": "test", "content": "world"}
        await connection_manager.queue_message(1, message1)
        await connection_manager.queue_message(1, message2)

        messages = connection_manager.get_queued_messages(1)

        assert len(messages) == 2
        assert messages[0]["content"] == "hello"
        assert messages[1]["content"] == "world"
        assert not connection_manager.has_queued_messages(1)

    @pytest.mark.asyncio
    async def test_queue_size_limit(self, connection_manager):
        """Test queue respects max size limit."""
        for i in range(105):
            await connection_manager.queue_message(1, {"type": "test", "content": f"msg{i}"})

        assert connection_manager.get_queue_size(1) == 100

    def test_has_queued_messages_false_for_unknown_session(self, connection_manager):
        """Test has_queued_messages returns False for unknown session."""
        assert connection_manager.has_queued_messages(999) is False


class TestWebSocketHeartbeat:
    """Test heartbeat/ping-pong functionality."""

    @pytest.fixture
    def connection_manager(self):
        """Create a ConnectionManager."""
        return ConnectionManager(
            heartbeat_interval=30.0,
            heartbeat_timeout=90.0
        )

    @pytest.mark.asyncio
    async def test_update_pong(self, connection_manager):
        """Test updating last pong timestamp."""
        websocket = AsyncMock()
        await connection_manager.connect(websocket, session_id=1)

        ws_id = id(websocket)
        initial_time = connection_manager.connection_last_pong[ws_id]

        # Small delay to ensure time changes
        time.sleep(0.01)
        connection_manager.update_pong(websocket)

        assert connection_manager.connection_last_pong[ws_id] > initial_time

    @pytest.mark.asyncio
    async def test_is_stale_false_recent_pong(self, connection_manager):
        """Test connection is not stale when pong is recent."""
        websocket = AsyncMock()
        await connection_manager.connect(websocket, session_id=1)

        assert connection_manager.is_stale(websocket, session_id=1) is False

    def test_is_stale_true_no_pong(self, connection_manager):
        """Test connection is stale when no pong recorded."""
        websocket = AsyncMock()

        # Mark connection as stale by setting last_pong to old time
        connection_manager.connection_last_pong[id(websocket)] = time.time() - 100

        assert connection_manager.is_stale(websocket, session_id=1) is True


class TestWebSocketMessageValidation:
    """Test message validation."""

    @pytest.fixture
    def connection_manager(self):
        """Create a ConnectionManager with known message size limit."""
        return ConnectionManager(max_message_size=1000)

    def test_validate_message_size_valid(self, connection_manager):
        """Test valid message size passes validation."""
        valid, msg = connection_manager.validate_message_size("hello world")
        assert valid is True
        assert msg == ""

    def test_validate_message_size_too_large(self, connection_manager):
        """Test oversized message fails validation."""
        large_message = "x" * 2000
        valid, msg = connection_manager.validate_message_size(large_message)
        assert valid is False
        assert "exceeds limit" in msg


@pytest.mark.skip(reason="Starlette TestClient event loop compatibility issue")
class TestWebSocketEndpoints:
    """Test WebSocket endpoints via TestClient."""

    def test_websocket_general_connect(self):
        """Test general WebSocket endpoint accepts connection."""
        from starlette.testclient import TestClient

        with TestClient(app) as test_client:
            with test_client.websocket_connect("/ws") as websocket:
                websocket.send_text("pong")
                data = websocket.receive_json()
                assert data["type"] == "ack"
                assert data["received"] is True

    def test_websocket_chat_connect(self):
        """Test chat WebSocket endpoint accepts connection."""
        from starlette.testclient import TestClient

        with TestClient(app) as test_client:
            with test_client.websocket_connect("/ws/chat/1") as websocket:
                websocket.send_text(json.dumps({"content": "hello", "role": "user"}))
                data = websocket.receive_json()
                assert data["type"] == "message"
                assert data["content"] == "hello"

    def test_websocket_chat_pong(self):
        """Test chat WebSocket handles pong messages silently."""
        from starlette.testclient import TestClient

        with TestClient(app) as test_client:
            with test_client.websocket_connect("/ws/chat/1") as websocket:
                websocket.send_text("pong")
                # Should not receive anything for pong

    def test_websocket_general_pong(self):
        """Test general WebSocket handles pong messages silently."""
        from starlette.testclient import TestClient

        with TestClient(app) as test_client:
            with test_client.websocket_connect("/ws") as websocket:
                websocket.send_text("pong")
                # Should not receive anything for pong

    def test_websocket_chat_disconnect(self):
        """Test chat WebSocket handles disconnect gracefully."""
        from starlette.testclient import TestClient

        with TestClient(app) as test_client:
            with test_client.websocket_connect("/ws/chat/1") as websocket:
                pass  # Connection closed on exit

        # Verify session is cleaned up
        status = manager.get_status(1)
        assert status["status"] == "unknown"
        assert status["connections"] == 0

    def test_websocket_chat_invalid_json(self):
        """Test chat WebSocket handles invalid JSON gracefully."""
        from starlette.testclient import TestClient

        with TestClient(app) as test_client:
            with test_client.websocket_connect("/ws/chat/1") as websocket:
                websocket.send_text("not valid json {")
                data = websocket.receive_json()
                assert data["type"] == "error"
                assert data["code"] == "invalid_json"

    def test_websocket_chat_message_too_large(self):
        """Test chat WebSocket rejects oversized messages."""
        from starlette.testclient import TestClient

        # Create a message larger than default 64KB limit
        large_content = "x" * 100000
        message = json.dumps({"content": large_content, "role": "user"})

        with TestClient(app) as test_client:
            with test_client.websocket_connect("/ws/chat/1") as websocket:
                websocket.send_text(message)
                data = websocket.receive_json()
                assert data["type"] == "error"
                assert data["code"] == "message_too_large"


class TestWebSocketErrorHandling:
    """Test WebSocket error handling."""

    @pytest.fixture
    def fresh_manager(self):
        """Create a fresh ConnectionManager for isolated tests."""
        return ConnectionManager()

    @pytest.mark.asyncio
    async def test_manager_disconnect_nonexistent(self, fresh_manager):
        """Test disconnecting from non-existent session is safe."""
        websocket = AsyncMock()
        fresh_manager.disconnect(websocket, session_id=9999)

    @pytest.mark.asyncio
    async def test_manager_disconnect_websocket_not_in_list(self, fresh_manager):
        """Test disconnecting websocket not in session list is safe."""
        ws1 = AsyncMock()
        ws1.client_state = WebSocketState.CONNECTED
        ws2 = AsyncMock()
        ws2.client_state = WebSocketState.CONNECTED

        await fresh_manager.connect(ws1, session_id=1)
        fresh_manager.disconnect(ws2, session_id=1)

        assert len(fresh_manager.active_connections[1]) == 1

    @pytest.mark.asyncio
    async def test_close_all_cleans_all_state(self, fresh_manager):
        """Test close_all properly cleans up all state."""
        ws1 = AsyncMock()
        ws1.client_state = WebSocketState.CONNECTED
        ws2 = AsyncMock()
        ws2.client_state = WebSocketState.CONNECTED

        await fresh_manager.connect(ws1, session_id=1)
        await fresh_manager.connect(ws2, session_id=2)

        await fresh_manager.close_all()

        assert len(fresh_manager.active_connections) == 0
        assert len(fresh_manager.connection_status) == 0
        assert len(fresh_manager.connection_last_pong) == 0
        assert len(fresh_manager.message_queues) == 0

    @pytest.mark.asyncio
    async def test_get_all_status(self, fresh_manager):
        """Test getting status of all sessions."""
        ws1 = AsyncMock()
        ws1.client_state = WebSocketState.CONNECTED
        await fresh_manager.connect(ws1, session_id=1)

        all_status = fresh_manager.get_all_status()
        assert "total_sessions" in all_status
        assert "total_connections" in all_status
        assert "sessions" in all_status
