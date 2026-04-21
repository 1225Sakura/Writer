"""
Tests for WebSocket connection handling.
"""

import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))

from main import app, manager, ConnectionManager


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
        ws2 = AsyncMock()

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
        ws1.send_json = AsyncMock(side_effect=Exception("Connection broken"))
        ws2 = AsyncMock()

        await connection_manager.connect(ws1, session_id=1)
        await connection_manager.connect(ws2, session_id=1)

        message = {"type": "test"}
        await connection_manager.send_to_session(1, message)

        ws2.send_json.assert_called_once_with(message)

    @pytest.mark.asyncio
    async def test_broadcast(self, connection_manager):
        """Test broadcasting to all sessions."""
        ws1 = AsyncMock()
        ws2 = AsyncMock()

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


class TestWebSocketErrorHandling:
    """Test WebSocket error handling."""

    def test_manager_disconnect_nonexistent(self):
        """Test disconnecting from non-existent session is safe."""
        websocket = AsyncMock()
        manager.disconnect(websocket, session_id=9999)
        # Should not raise

    def test_manager_disconnect_websocket_not_in_list(self):
        """Test disconnecting websocket not in session list is safe."""
        ws1 = AsyncMock()
        ws2 = AsyncMock()

        import asyncio
        asyncio.run(manager.connect(ws1, session_id=1))
        manager.disconnect(ws2, session_id=1)

        assert len(manager.active_connections[1]) == 1
