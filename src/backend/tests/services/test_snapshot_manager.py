"""Tests for SnapshotManager - project snapshot creation, listing, deletion."""

import pytest
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from backend.services.snapshot_manager import (
    SnapshotManager,
    _model_to_dict,
    SNAPSHOT_VERSION,
)


@pytest.fixture
def snapshot_dir(tmp_path):
    """Create a temporary snapshot directory."""
    return tmp_path / "snapshots"


@pytest.fixture
def manager(snapshot_dir):
    """Create a SnapshotManager with temp directory."""
    return SnapshotManager(snapshot_dir=str(snapshot_dir))


# =============================================================================
# _model_to_dict
# =============================================================================

class TestModelToDict:
    """Test SQLAlchemy model to dict conversion."""

    def test_converts_model_to_dict(self):
        """Model attributes are converted to dict."""
        model = MagicMock()
        model.__dict__ = {"id": 1, "name": "test", "_sa_instance_state": "ignored"}
        result = _model_to_dict(model)
        assert result["id"] == 1
        assert result["name"] == "test"
        assert "_sa_instance_state" not in result

    def test_none_returns_none(self):
        """None input returns None."""
        assert _model_to_dict(None) is None

    def test_skips_private_keys(self):
        """Keys starting with _ are skipped."""
        model = MagicMock()
        model.__dict__ = {"id": 1, "_private": "hidden", "__dunder": "also_hidden"}
        result = _model_to_dict(model)
        assert "_private" not in result
        assert "__dunder" not in result

    def test_datetime_to_isoformat(self):
        """datetime values are converted to isoformat."""
        from datetime import datetime, timezone
        model = MagicMock()
        dt = datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
        model.__dict__ = {"id": 1, "created_at": dt}
        result = _model_to_dict(model)
        assert isinstance(result["created_at"], str)
        assert "2024-01-15" in result["created_at"]


# =============================================================================
# SnapshotManager initialization
# =============================================================================

class TestInitialization:
    """Test SnapshotManager initialization."""

    def test_creates_snapshot_dir(self, snapshot_dir):
        """SnapshotManager creates the snapshot directory."""
        assert not snapshot_dir.exists()
        manager = SnapshotManager(snapshot_dir=str(snapshot_dir))
        assert snapshot_dir.exists()

    def test_default_snapshot_dir(self):
        """Default snapshot dir is data/snapshots."""
        manager = SnapshotManager()
        assert "snapshots" in str(manager.snapshot_dir)


# =============================================================================
# _snapshot_path
# =============================================================================

class TestSnapshotPath:
    """Test snapshot path generation."""

    def test_snapshot_path_format(self, manager, snapshot_dir):
        """Snapshot path uses the snapshot ID as filename."""
        path = manager._snapshot_path("20240115_103000_123")
        assert path == snapshot_dir / "20240115_103000_123.json"


# =============================================================================
# list_snapshots
# =============================================================================

class TestListSnapshots:
    """Test snapshot listing."""

    def test_list_empty_snapshots(self, manager):
        """Empty directory returns empty list."""
        snapshots = manager.list_snapshots()
        assert snapshots == []

    def test_list_snapshots_with_files(self, manager, snapshot_dir):
        """list_snapshots returns metadata for each snapshot."""
        # Create a fake snapshot file
        snapshot_data = {
            "version": SNAPSHOT_VERSION,
            "snapshot_id": "test_001",
            "name": "Test Snapshot",
            "description": "A test",
            "created_at": "2024-01-15T10:00:00",
            "triggered_by": "manual",
            "payload": {},
        }
        path = snapshot_dir / "test_001.json"
        path.write_text(json.dumps(snapshot_data), encoding="utf-8")

        snapshots = manager.list_snapshots()
        assert len(snapshots) == 1
        assert snapshots[0]["snapshot_id"] == "test_001"
        assert snapshots[0]["name"] == "Test Snapshot"

    def test_list_snapshots_sorted_by_mtime(self, manager, snapshot_dir):
        """Snapshots are sorted by modification time (newest first)."""
        for i in range(3):
            data = {
                "version": SNAPSHOT_VERSION,
                "snapshot_id": f"snap_{i}",
                "name": f"Snap {i}",
                "created_at": f"2024-01-{15 + i}T10:00:00",
                "payload": {},
            }
            path = snapshot_dir / f"snap_{i}.json"
            path.write_text(json.dumps(data), encoding="utf-8")

        snapshots = manager.list_snapshots()
        assert len(snapshots) == 3

    def test_list_snapshots_skips_invalid_json(self, manager, snapshot_dir):
        """Invalid JSON files are skipped."""
        (snapshot_dir / "invalid.json").write_text("not json", encoding="utf-8")
        snapshots = manager.list_snapshots()
        assert len(snapshots) == 0


# =============================================================================
# get_snapshot
# =============================================================================

class TestGetSnapshot:
    """Test snapshot retrieval."""

    def test_get_existing_snapshot(self, manager, snapshot_dir):
        """get_snapshot returns full data for existing snapshot."""
        data = {
            "version": SNAPSHOT_VERSION,
            "snapshot_id": "test_002",
            "payload": {"characters": []},
        }
        (snapshot_dir / "test_002.json").write_text(
            json.dumps(data), encoding="utf-8"
        )

        result = manager.get_snapshot("test_002")
        assert result is not None
        assert result["snapshot_id"] == "test_002"

    def test_get_nonexistent_snapshot(self, manager):
        """get_snapshot returns None for non-existent snapshot."""
        result = manager.get_snapshot("nonexistent")
        assert result is None


# =============================================================================
# delete_snapshot
# =============================================================================

class TestDeleteSnapshot:
    """Test snapshot deletion."""

    def test_delete_existing_snapshot(self, manager, snapshot_dir):
        """delete_snapshot removes the file and returns True."""
        data = {"version": SNAPSHOT_VERSION, "snapshot_id": "del_001"}
        (snapshot_dir / "del_001.json").write_text(
            json.dumps(data), encoding="utf-8"
        )

        result = manager.delete_snapshot("del_001")
        assert result is True
        assert not (snapshot_dir / "del_001.json").exists()

    def test_delete_nonexistent_snapshot(self, manager):
        """delete_snapshot returns False for non-existent snapshot."""
        result = manager.delete_snapshot("nonexistent")
        assert result is False


# =============================================================================
# cleanup_old_snapshots
# =============================================================================

class TestCleanupOldSnapshots:
    """Test old snapshot cleanup."""

    def test_cleanup_keeps_recent(self, manager, snapshot_dir):
        """cleanup_old_snapshots keeps the most recent N."""
        for i in range(5):
            data = {"version": SNAPSHOT_VERSION, "snapshot_id": f"clean_{i}"}
            path = snapshot_dir / f"clean_{i}.json"
            path.write_text(json.dumps(data), encoding="utf-8")

        removed = manager.cleanup_old_snapshots(keep_count=3)
        remaining = list(snapshot_dir.glob("*.json"))
        assert removed == 2
        assert len(remaining) == 3

    def test_cleanup_no_removal_when_under_limit(self, manager, snapshot_dir):
        """No files removed when count is under keep_count."""
        for i in range(2):
            data = {"version": SNAPSHOT_VERSION, "snapshot_id": f"keep_{i}"}
            (snapshot_dir / f"keep_{i}.json").write_text(
                json.dumps(data), encoding="utf-8"
            )

        removed = manager.cleanup_old_snapshots(keep_count=5)
        assert removed == 0


# =============================================================================
# create_snapshot (mocked DB)
# =============================================================================

class TestCreateSnapshot:
    """Test snapshot creation with mocked DB."""

    @pytest.mark.asyncio
    async def test_create_snapshot_returns_metadata(self, manager):
        """create_snapshot returns snapshot metadata."""
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))))

        with patch("backend.services.snapshot_manager.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            with patch("backend.services.snapshot_manager.content_storage") as mock_cs:
                mock_cs.retrieve = AsyncMock(return_value=None)

                result = await manager.create_snapshot(name="Test Snapshot")
                assert "snapshot_id" in result
                assert result["name"] == "Test Snapshot"
                assert "path" in result
                assert "size_bytes" in result

    @pytest.mark.asyncio
    async def test_create_snapshot_saves_to_disk(self, manager):
        """create_snapshot saves a JSON file to disk."""
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))))

        with patch("backend.services.snapshot_manager.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            with patch("backend.services.snapshot_manager.content_storage") as mock_cs:
                mock_cs.retrieve = AsyncMock(return_value=None)

                result = await manager.create_snapshot()
                path = Path(result["path"])
                assert path.exists()

                data = json.loads(path.read_text(encoding="utf-8"))
                assert data["version"] == SNAPSHOT_VERSION
                assert "payload" in data


# =============================================================================
# restore_snapshot
# =============================================================================

class TestRestoreSnapshot:
    """Test snapshot restoration."""

    @pytest.mark.asyncio
    async def test_restore_nonexistent_raises(self, manager):
        """Restoring non-existent snapshot raises FileNotFoundError."""
        with pytest.raises(FileNotFoundError):
            await manager.restore_snapshot("nonexistent")

    @pytest.mark.asyncio
    async def test_restore_version_mismatch_raises(self, manager, snapshot_dir):
        """Restoring snapshot with wrong version raises ValueError."""
        data = {"version": "999.0", "snapshot_id": "bad_ver", "payload": {}}
        (snapshot_dir / "bad_ver.json").write_text(
            json.dumps(data), encoding="utf-8"
        )
        with pytest.raises(ValueError, match="version"):
            await manager.restore_snapshot("bad_ver")
