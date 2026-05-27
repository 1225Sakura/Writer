"""Tests for snapshot & backup API endpoints.

Covers:
- POST /snapshots/create
- POST /snapshots/restore/{snapshot_id}
- GET  /snapshots
- GET  /snapshots/{snapshot_id}
- DELETE /snapshots/{snapshot_id}
- POST /snapshots/backups/trigger
- GET  /snapshots/backups/status
- POST /snapshots/backups/schedule
- POST /snapshots/backups/start-scheduler
- POST /snapshots/backups/stop-scheduler
- POST /snapshots/archives/export
- POST /snapshots/archives/import
- GET  /snapshots/archives/list
- DELETE /snapshots/archives/{filename}
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient


# ===========================================================================
# Snapshot CRUD Tests
# ===========================================================================

class TestSnapshotCRUDEndpoints:

    @pytest.mark.asyncio
    async def test_list_snapshots_empty(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/snapshots")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_get_snapshot_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/snapshots/nonexistent-id")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_snapshot_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.delete("/api/v1/snapshots/nonexistent-id")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_restore_snapshot_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post("/api/v1/snapshots/restore/nonexistent-id")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_snapshot(self, authenticated_client: AsyncClient):
        mock_result = {
            "snapshot_id": "test-id-123",
            "name": "test-snap",
            "description": "A test snapshot",
            "created_at": "2026-01-01T00:00:00Z",
        }
        with patch(
            "backend.api.v1.endpoints.snapshots.snapshot_manager"
        ) as mock_sm:
            mock_sm.create_snapshot = AsyncMock(return_value=mock_result)
            response = await authenticated_client.post(
                "/api/v1/snapshots/create",
                params={"name": "test-snap", "description": "A test snapshot"},
            )
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_create_and_list_snapshot(self, authenticated_client: AsyncClient):
        mock_result = {
            "snapshot_id": "test-id-456",
            "name": "snap-list-test",
            "created_at": "2026-01-01T00:00:00Z",
        }
        with patch(
            "backend.api.v1.endpoints.snapshots.snapshot_manager"
        ) as mock_sm:
            mock_sm.create_snapshot = AsyncMock(return_value=mock_result)
            mock_sm.list_snapshots = MagicMock(return_value=[mock_result])
            create_resp = await authenticated_client.post(
                "/api/v1/snapshots/create",
                params={"name": "snap-list-test"},
            )
            assert create_resp.status_code == 200
            list_resp = await authenticated_client.get("/api/v1/snapshots")
            assert list_resp.status_code == 200


# ===========================================================================
# Backup Tests
# ===========================================================================

class TestBackupEndpoints:

    @pytest.mark.asyncio
    async def test_get_backup_status(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/snapshots/backups/status")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_trigger_backup(self, authenticated_client: AsyncClient):
        mock_result = {
            "snapshot_id": "backup-id-789",
            "name": "manual-backup",
            "trigger": "manual",
            "created_at": "2026-01-01T00:00:00Z",
        }
        with patch(
            "backend.api.v1.endpoints.snapshots.backup_manager"
        ) as mock_bm:
            mock_bm.backup = AsyncMock(return_value=mock_result)
            response = await authenticated_client.post(
                "/api/v1/snapshots/backups/trigger",
                params={"name": "manual-backup"},
            )
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_update_backup_schedule(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/snapshots/backups/schedule",
            params={"enabled": True, "interval_minutes": 60},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_start_backup_scheduler(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post("/api/v1/snapshots/backups/start-scheduler")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "started"

    @pytest.mark.asyncio
    async def test_stop_backup_scheduler(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post("/api/v1/snapshots/backups/stop-scheduler")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "stopped"


# ===========================================================================
# Archive Tests
# ===========================================================================

class TestArchiveEndpoints:

    @pytest.mark.asyncio
    async def test_list_archives(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/snapshots/archives/list")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_archive_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.delete("/api/v1/snapshots/archives/nonexistent.zip")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_import_project_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/snapshots/archives/import",
            params={"archive_path": "/nonexistent/path.zip"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_export_project(self, authenticated_client: AsyncClient):
        mock_result = {
            "filename": "project_export_20260101.zip",
            "path": "/tmp/project_export_20260101.zip",
            "size_bytes": 1024,
            "format": "zip",
        }
        with patch(
            "backend.api.v1.endpoints.snapshots.archive_manager"
        ) as mock_am:
            mock_am.export_project = AsyncMock(return_value=mock_result)
            response = await authenticated_client.post(
                "/api/v1/snapshots/archives/export",
                params={"format": "zip"},
            )
            assert response.status_code == 200
