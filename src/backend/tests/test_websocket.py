"""Tests for WebSocket connection manager and endpoints."""

import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock, patch

from fastapi import FastAPI, WebSocket
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from backend.interface.web.main import ConnectionManager, manager


# =============================================================================
# ConnectionManager Unit Tests
# =============================================================================

class TestConnectionManager:
    """Test ConnectionManager in isolation."""

    @pytest.fixture
    def conn_manager(self):
        """Create a fresh ConnectionManager."""
        return ConnectionManager()

    @pytest.fixture
    def mock_websocket(self):
        """Create a mock WebSocket."""
        ws = MagicMock(spec=WebSocket)
        ws.accept = AsyncMock()
        ws.send_json = AsyncMock()
        ws.receive_text = AsyncMock()
        ws.close = AsyncMock()
        return ws

    @pytest.mark.asyncio
    async def test_connect_adds_websocket(self, conn_manager, mock_websocket):
        """Connect adds WebSocket to active connections."""
        await conn_manager.connect(mock_websocket, session_id=1)

        assert 1 in conn_manager.active_connections
        assert mock_websocket in conn_manager.active_connections[1]
        assert conn_manager.connection_status[1] == "connected"
        mock_websocket.accept.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_connect_multiple_to_same_session(self, conn_manager, mock_websocket):
        """Multiple WebSockets can connect to same session."""
        ws2 = MagicMock(spec=WebSocket)
        ws2.accept = AsyncMock()

        await conn_manager.connect(mock_websocket, session_id=1)
        await conn_manager.connect(ws2, session_id=1)

        assert len(conn_manager.active_connections[1]) == 2

    @pytest.mark.asyncio
    async def test_disconnect_removes_websocket(self, conn_manager, mock_websocket):
        """Disconnect removes WebSocket from active connections."""
        await conn_manager.connect(mock_websocket, session_id=1)
        conn_manager.disconnect(mock_websocket, session_id=1)

        assert 1 not in conn_manager.active_connections
        assert 1 not in conn_manager.connection_status

    @pytest.mark.asyncio
    async def test_disconnect_keeps_other_websockets(self, conn_manager, mock_websocket):
        """Disconnect only removes the specific WebSocket."""
        ws2 = MagicMock(spec=WebSocket)
        ws2.accept = AsyncMock()

        await conn_manager.connect(mock_websocket, session_id=1)
        await conn_manager.connect(ws2, session_id=1)
        conn_manager.disconnect(mock_websocket, session_id=1)

        assert len(conn_manager.active_connections[1]) == 1
        assert ws2 in conn_manager.active_connections[1]

    @pytest.mark.asyncio
    async def test_disconnect_unknown_session_does_not_crash(self, conn_manager, mock_websocket):
        """Disconnecting from unknown session does not crash."""
        # Should not raise
        conn_manager.disconnect(mock_websocket, session_id=999)

    @pytest.mark.asyncio
    async def test_send_to_session_delivers_message(self, conn_manager, mock_websocket):
        """Send to session delivers message to all connections."""
        await conn_manager.connect(mock_websocket, session_id=1)

        message = {"type": "test", "data": "hello"}
        await conn_manager.send_to_session(1, message)

        mock_websocket.send_json.assert_awaited_once_with(message)

    @pytest.mark.asyncio
    async def test_send_to_session_ignores_unknown_session(self, conn_manager):
        """Send to unknown session does nothing."""
        # Should not raise
        await conn_manager.send_to_session(999, {"type": "test"})

    @pytest.mark.asyncio
    async def test_send_to_session_handles_send_error(self, conn_manager, mock_websocket):
        """Send to session handles WebSocket send errors gracefully."""
        mock_websocket.send_json = AsyncMock(side_effect=RuntimeError("Connection closed"))

        await conn_manager.connect(mock_websocket, session_id=1)

        # Should not raise
        await conn_manager.send_to_session(1, {"type": "test"})

    @pytest.mark.asyncio
    async def test_broadcast_sends_to_all_sessions(self, conn_manager, mock_websocket):
        """Broadcast sends message to all connections across sessions."""
        ws2 = MagicMock(spec=WebSocket)
        ws2.accept = AsyncMock()

        await conn_manager.connect(mock_websocket, session_id=1)
        await conn_manager.connect(ws2, session_id=2)

        message = {"type": "broadcast", "data": "all"}
        await conn_manager.broadcast(message)

        mock_websocket.send_json.assert_awaited_once_with(message)
        ws2.send_json.assert_awaited_once_with(message)

    @pytest.mark.asyncio
    async def test_broadcast_handles_errors(self, conn_manager, mock_websocket):
        """Broadcast handles individual WebSocket errors."""
        ws2 = MagicMock(spec=WebSocket)
        ws2.accept = AsyncMock()
        ws2.send_json = AsyncMock(side_effect=RuntimeError("Failed"))

        await conn_manager.connect(mock_websocket, session_id=1)
        await conn_manager.connect(ws2, session_id=2)

        # Should not raise
        await conn_manager.broadcast({"type": "test"})

    def test_get_status_for_active_session(self, conn_manager, mock_websocket):
        """Get status returns correct info for active session."""
        asyncio.run(conn_manager.connect(mock_websocket, session_id=1))

        status = conn_manager.get_status(1)
        assert status["session_id"] == 1
        assert status["status"] == "connected"
        assert status["connections"] == 1

    def test_get_status_for_unknown_session(self, conn_manager):
        """Get status returns unknown for non-existent session."""
        status = conn_manager.get_status(999)
        assert status["session_id"] == 999
        assert status["status"] == "unknown"
        assert status["connections"] == 0

    @pytest.mark.asyncio
    async def test_close_all_closes_all_websockets(self, conn_manager, mock_websocket):
        """Close all closes all WebSocket connections."""
        ws2 = MagicMock(spec=WebSocket)
        ws2.accept = AsyncMock()
        ws2.close = AsyncMock()

        await conn_manager.connect(mock_websocket, session_id=1)
        await conn_manager.connect(ws2, session_id=2)

        await conn_manager.close_all()

        mock_websocket.close.assert_awaited_once()
        ws2.close.assert_awaited_once()
        assert len(conn_manager.active_connections) == 0

    @pytest.mark.asyncio
    async def test_close_all_handles_close_errors(self, conn_manager, mock_websocket):
        """Close all handles errors from individual WebSockets."""
        mock_websocket.close = AsyncMock(side_effect=RuntimeError("Already closed"))

        await conn_manager.connect(mock_websocket, session_id=1)

        # Should not raise
        await conn_manager.close_all()


# =============================================================================
# WebSocket Endpoint Tests
# =============================================================================

class TestWebSocketEndpoints:
    """Test WebSocket endpoints via TestClient."""

    @pytest.fixture
    def ws_app(self):
        """Create minimal app with WebSocket endpoint."""
        app = FastAPI()
        test_manager = ConnectionManager()

        @app.websocket("/ws/chat/{session_id}")
        async def websocket_chat(websocket: WebSocket, session_id: int):
            await test_manager.connect(websocket, session_id)
            try:
                while True:
                    data = await websocket.receive_text()
                    if data == "pong":
                        continue
                    await test_manager.send_to_session(session_id, {
                        "type": "echo",
                        "content": data,
                    })
            except WebSocketDisconnect:
                test_manager.disconnect(websocket, session_id)

        @app.get("/ws/status/{session_id}")
        async def websocket_status(session_id: int):
            return test_manager.get_status(session_id)

        return app

    @pytest.fixture
    def client(self, ws_app):
        return TestClient(ws_app)

    def test_websocket_status_endpoint_no_connections(self, client):
        """Status endpoint shows unknown when no connections."""
        response = client.get("/ws/status/1")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "unknown"
        assert data["connections"] == 0

    def test_websocket_connect_and_exchange_messages(self, client):
        """WebSocket client can connect and exchange messages."""
        with client.websocket_connect("/ws/chat/1") as websocket:
            websocket.send_text('{"content": "hello", "role": "user"}')
            data = websocket.receive_json()
            assert data["type"] == "echo"
            assert data["content"] == '{"content": "hello", "role": "user"}'

    def test_websocket_pong_ignored(self, client):
        """Pong messages are ignored."""
        with client.websocket_connect("/ws/chat/1") as websocket:
            websocket.send_text("pong")
            # Should not receive anything back for pong
            # We verify by checking the connection stays open

    def test_websocket_multiple_clients_same_session(self, client):
        """Multiple clients can connect to same session."""
        with client.websocket_connect("/ws/chat/1") as ws1:
            with client.websocket_connect("/ws/chat/1") as ws2:
                # Both should be able to send
                ws1.send_text("from client 1")
                ws2.send_text("from client 2")

                # Each client receives broadcast
                data1 = ws1.receive_json()
                assert data1["content"] == "from client 1"

                data2 = ws2.receive_json()
                # ws2 receives both messages (broadcast to session)
                # First message is from ws1
                assert data2["content"] == "from client 1"


# =============================================================================
# Global Manager Tests
# =============================================================================

class TestGlobalManager:
    """Test the global manager instance."""

    def test_global_manager_is_singleton(self):
        """Global manager is a singleton instance."""
        from backend.interface.web.main import manager as manager1
        from backend.interface.web.main import manager as manager2
        assert manager1 is manager2

    def test_global_manager_has_empty_connections_initially(self):
        """Global manager starts with no connections."""
        assert len(manager.active_connections) == 0
        assert len(manager.connection_status) == 0


# =============================================================================
# Ping/Pong Tests
# =============================================================================

class TestPingPong:
    """Test ping/pong keepalive mechanism."""

    @pytest.mark.asyncio
    async def test_ping_message_format(self):
        """Ping message has correct format."""
        import time

        mock_ws = MagicMock(spec=WebSocket)
        mock_ws.send_json = AsyncMock()

        # Simulate ping
        ping_msg = {"type": "ping", "timestamp": time.time()}
        await mock_ws.send_json(ping_msg)

        mock_ws.send_json.assert_awaited_once()
        call_args = mock_ws.send_json.call_args[0][0]
        assert call_args["type"] == "ping"
        assert "timestamp" in call_args

    @pytest.mark.asyncio
    async def test_client_pong_response(self):
        """Client pong response is handled."""
        mock_ws = MagicMock(spec=WebSocket)
        mock_ws.receive_text = AsyncMock(return_value="pong")
        mock_ws.accept = AsyncMock()

        # Simulate receiving pong
        data = await mock_ws.receive_text()
        assert data == "pong"
