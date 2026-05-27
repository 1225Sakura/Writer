"""Tests for ArchiveManager — compressed project export/import."""

from __future__ import annotations

import json
import tarfile
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.services.archive_manager import ArchiveManager


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_snapshot_mgr(snapshot_data=None):
    """Create a mock SnapshotManager."""
    mgr = MagicMock()
    if snapshot_data is None:
        snapshot_data = {
            "snapshot_id": "snap-001",
            "name": "Test Snapshot",
            "payload": {
                "content_storage": {"c1": "hello world", "c2": None},
            },
        }
    mgr.get_snapshot.return_value = snapshot_data
    mgr.create_snapshot = AsyncMock(return_value={"snapshot_id": "snap-001"})
    mgr.restore_snapshot = AsyncMock(return_value={"entities_restored": 5})
    return mgr


def _create_test_zip(archive_dir: Path, filename: str = "project_export_20250101_000000.zip") -> Path:
    """Create a minimal valid ZIP archive for import testing."""
    archive_path = archive_dir / filename
    snapshot = {"snapshot_id": "snap-001", "data": {"characters": []}}
    with zipfile.ZipFile(archive_path, "w") as zf:
        zf.writestr("snapshot.json", json.dumps(snapshot))
    return archive_path


def _create_test_tar_gz(archive_dir: Path) -> Path:
    """Create a minimal valid tar.gz archive for import testing."""
    archive_path = archive_dir / "project_export_20250101_000000.tar.gz"
    snapshot = {"snapshot_id": "snap-002", "data": {"characters": []}}
    with tarfile.open(archive_path, "w:gz") as tf:
        import io
        data = json.dumps(snapshot).encode("utf-8")
        info = tarfile.TarInfo(name="snapshot.json")
        info.size = len(data)
        tf.addfile(info, io.BytesIO(data))
    return archive_path


# =============================================================================
# Construction
# =============================================================================

class TestArchiveManagerInit:
    def test_default_archive_dir(self, tmp_path):
        with patch("backend.services.archive_manager.snapshot_manager"):
            mgr = ArchiveManager(archive_dir=str(tmp_path / "archives"))
            assert mgr.archive_dir == tmp_path / "archives"
            assert mgr.archive_dir.exists()

    def test_custom_archive_dir(self, tmp_path):
        custom = tmp_path / "custom" / "exports"
        mgr = ArchiveManager(archive_dir=str(custom))
        assert mgr.archive_dir == custom
        assert custom.exists()

    def test_default_snapshot_mgr(self, tmp_path):
        with patch("backend.services.archive_manager.snapshot_manager", MagicMock()) as mock_sm:
            mgr = ArchiveManager(archive_dir=str(tmp_path))
            assert mgr.snapshot_mgr is mock_sm

    def test_custom_snapshot_mgr(self, tmp_path):
        custom_mgr = MagicMock()
        mgr = ArchiveManager(snapshot_mgr=custom_mgr, archive_dir=str(tmp_path))
        assert mgr.snapshot_mgr is custom_mgr


# =============================================================================
# _archive_path
# =============================================================================

class TestArchivePath:
    def test_returns_correct_path(self, tmp_path):
        mgr = ArchiveManager(archive_dir=str(tmp_path))
        assert mgr._archive_path("test.zip") == tmp_path / "test.zip"


# =============================================================================
# export_project
# =============================================================================

@pytest.mark.asyncio
class TestExportProject:
    async def test_export_zip_creates_file(self, tmp_path):
        mgr = ArchiveManager(
            snapshot_mgr=_make_snapshot_mgr(),
            archive_dir=str(tmp_path),
        )
        result = await mgr.export_project(format="zip")
        assert result["format"] == "zip"
        assert result["filename"].endswith(".zip")
        assert Path(result["path"]).exists()
        assert result["size_bytes"] > 0
        assert result["snapshot_id"] == "snap-001"

    async def test_export_tar_gz(self, tmp_path):
        mgr = ArchiveManager(
            snapshot_mgr=_make_snapshot_mgr(),
            archive_dir=str(tmp_path),
        )
        result = await mgr.export_project(format="tar.gz")
        assert result["format"] == "tar.gz"
        assert result["filename"].endswith(".tar.gz")
        assert Path(result["path"]).exists()

    async def test_export_tar_bz2(self, tmp_path):
        mgr = ArchiveManager(
            snapshot_mgr=_make_snapshot_mgr(),
            archive_dir=str(tmp_path),
        )
        result = await mgr.export_project(format="tar.bz2")
        assert result["format"] == "tar.bz2"
        assert result["filename"].endswith(".tar.bz2")

    async def test_export_with_existing_snapshot_id(self, tmp_path):
        mgr = ArchiveManager(
            snapshot_mgr=_make_snapshot_mgr(),
            archive_dir=str(tmp_path),
        )
        result = await mgr.export_project(snapshot_id="snap-001")
        assert result["snapshot_id"] == "snap-001"

    async def test_export_snapshot_not_found_raises(self, tmp_path):
        sm = _make_snapshot_mgr()
        sm.get_snapshot.return_value = None
        mgr = ArchiveManager(snapshot_mgr=sm, archive_dir=str(tmp_path))
        with pytest.raises(FileNotFoundError, match="Snapshot not found"):
            await mgr.export_project(snapshot_id="nonexistent")

    async def test_export_create_snapshot_fails_raises(self, tmp_path):
        sm = _make_snapshot_mgr()
        sm.get_snapshot.side_effect = [None, None]  # first for explicit, second for create
        sm.create_snapshot = AsyncMock(return_value={"snapshot_id": "new-snap"})
        mgr = ArchiveManager(snapshot_mgr=sm, archive_dir=str(tmp_path))
        with pytest.raises(RuntimeError, match="Failed to create"):
            await mgr.export_project()

    async def test_export_zip_contains_content_files(self, tmp_path):
        snapshot_data = {
            "snapshot_id": "snap-001",
            "payload": {
                "content_storage": {"c1": "text1", "c2": "text2", "c3": None},
            },
        }
        mgr = ArchiveManager(
            snapshot_mgr=_make_snapshot_mgr(snapshot_data),
            archive_dir=str(tmp_path),
        )
        result = await mgr.export_project(format="zip")
        with zipfile.ZipFile(result["path"]) as zf:
            names = zf.namelist()
            assert "snapshot.json" in names
            assert "content/c1.txt" in names
            assert "content/c2.txt" in names
            assert "content/c3.txt" not in names  # None values skipped

    async def test_export_excludes_content_when_flag_false(self, tmp_path):
        snapshot_data = {
            "snapshot_id": "snap-001",
            "payload": {"content_storage": {"c1": "text"}},
        }
        mgr = ArchiveManager(
            snapshot_mgr=_make_snapshot_mgr(snapshot_data),
            archive_dir=str(tmp_path),
        )
        result = await mgr.export_project(format="zip", include_content_storage=False)
        with zipfile.ZipFile(result["path"]) as zf:
            assert "content/c1.txt" not in zf.namelist()

    async def test_export_temp_file_cleaned_up(self, tmp_path):
        mgr = ArchiveManager(
            snapshot_mgr=_make_snapshot_mgr(),
            archive_dir=str(tmp_path),
        )
        await mgr.export_project()
        temp_files = list(tmp_path.glob("_temp_*.json"))
        assert len(temp_files) == 0

    async def test_export_unsupported_format_raises(self, tmp_path):
        mgr = ArchiveManager(
            snapshot_mgr=_make_snapshot_mgr(),
            archive_dir=str(tmp_path),
        )
        with pytest.raises(ValueError, match="Unsupported archive format"):
            await mgr.export_project(format="rar")


# =============================================================================
# import_project
# =============================================================================

@pytest.mark.asyncio
class TestImportProject:
    async def test_import_zip(self, tmp_path):
        archive_path = _create_test_zip(tmp_path)
        sm = _make_snapshot_mgr()
        sm._snapshot_path = MagicMock(return_value=tmp_path / "new_snap.json")
        mgr = ArchiveManager(snapshot_mgr=sm, archive_dir=str(tmp_path))

        result = await mgr.import_project(archive_path)
        assert result["snapshot_id"] == "snap-001"
        assert result["entities_restored"] == 5

    async def test_import_tar_gz(self, tmp_path):
        archive_path = _create_test_tar_gz(tmp_path)
        sm = _make_snapshot_mgr()
        sm._snapshot_path = MagicMock(return_value=tmp_path / "new_snap.json")
        mgr = ArchiveManager(snapshot_mgr=sm, archive_dir=str(tmp_path))

        result = await mgr.import_project(archive_path)
        assert result["snapshot_id"] == "snap-002"

    async def test_import_nonexistent_file_raises(self, tmp_path):
        mgr = ArchiveManager(snapshot_mgr=_make_snapshot_mgr(), archive_dir=str(tmp_path))
        with pytest.raises(FileNotFoundError, match="Archive not found"):
            await mgr.import_project(tmp_path / "does_not_exist.zip")

    async def test_import_unsupported_format_raises(self, tmp_path):
        bad_file = tmp_path / "bad.txt"
        bad_file.write_text("not an archive")
        mgr = ArchiveManager(snapshot_mgr=_make_snapshot_mgr(), archive_dir=str(tmp_path))
        with pytest.raises(ValueError, match="Unsupported archive"):
            await mgr.import_project(bad_file)

    async def test_import_missing_snapshot_json_raises(self, tmp_path):
        archive_path = tmp_path / "no_snapshot.zip"
        with zipfile.ZipFile(archive_path, "w") as zf:
            zf.writestr("other.json", "{}")
        sm = _make_snapshot_mgr()
        sm._snapshot_path = MagicMock(return_value=tmp_path / "dest.json")
        mgr = ArchiveManager(snapshot_mgr=sm, archive_dir=str(tmp_path))
        with pytest.raises(ValueError, match="snapshot.json"):
            await mgr.import_project(archive_path)

    async def test_import_overwrite_existing(self, tmp_path):
        archive_path = _create_test_zip(tmp_path)
        sm = _make_snapshot_mgr()
        dest = tmp_path / "existing_snap.json"
        dest.write_text("{}")
        sm._snapshot_path = MagicMock(return_value=dest)
        mgr = ArchiveManager(snapshot_mgr=sm, archive_dir=str(tmp_path))

        result = await mgr.import_project(archive_path, overwrite=True)
        assert result["snapshot_id"] == "snap-001"

    async def test_import_no_overwrite_existing_raises(self, tmp_path):
        archive_path = _create_test_zip(tmp_path)
        sm = _make_snapshot_mgr()
        dest = tmp_path / "existing_snap.json"
        dest.write_text("{}")
        sm._snapshot_path = MagicMock(return_value=dest)
        mgr = ArchiveManager(snapshot_mgr=sm, archive_dir=str(tmp_path))

        with pytest.raises(FileExistsError, match="already exists"):
            await mgr.import_project(archive_path, overwrite=False)

    async def test_import_cleanup_extract_dir(self, tmp_path):
        archive_path = _create_test_zip(tmp_path)
        sm = _make_snapshot_mgr()
        sm._snapshot_path = MagicMock(return_value=tmp_path / "new.json")
        mgr = ArchiveManager(snapshot_mgr=sm, archive_dir=str(tmp_path))

        await mgr.import_project(archive_path)
        import_dirs = list(tmp_path.glob("_import_*"))
        assert len(import_dirs) == 0

    async def test_import_recursive_snapshot_search(self, tmp_path):
        """snapshot.json nested in subdirectory should still be found."""
        archive_path = tmp_path / "nested.zip"
        snapshot = {"snapshot_id": "nested-snap", "data": {}}
        with zipfile.ZipFile(archive_path, "w") as zf:
            zf.writestr("subdir/snapshot.json", json.dumps(snapshot))
        sm = _make_snapshot_mgr()
        sm._snapshot_path = MagicMock(return_value=tmp_path / "dest.json")
        mgr = ArchiveManager(snapshot_mgr=sm, archive_dir=str(tmp_path))

        result = await mgr.import_project(archive_path)
        assert result["snapshot_id"] == "nested-snap"


# =============================================================================
# list_archives
# =============================================================================

class TestListArchives:
    def test_list_empty(self, tmp_path):
        mgr = ArchiveManager(archive_dir=str(tmp_path))
        assert mgr.list_archives() == []

    def test_list_returns_sorted_by_mtime(self, tmp_path):
        import time
        mgr = ArchiveManager(archive_dir=str(tmp_path))
        f1 = tmp_path / "project_export_20250101_000000.zip"
        f1.write_text("a")
        time.sleep(0.05)  # ensure distinct mtime
        f2 = tmp_path / "project_export_20250102_000000.zip"
        f2.write_text("b")
        results = mgr.list_archives()
        assert len(results) == 2
        # Should be sorted newest first (by mtime descending)
        assert results[0]["filename"] == "project_export_20250102_000000.zip"
        assert results[1]["filename"] == "project_export_20250101_000000.zip"

    def test_list_ignores_non_matching_files(self, tmp_path):
        mgr = ArchiveManager(archive_dir=str(tmp_path))
        (tmp_path / "project_export_test.zip").write_text("a")
        (tmp_path / "other_file.zip").write_text("b")
        results = mgr.list_archives()
        assert len(results) == 1

    def test_list_includes_size_and_created_at(self, tmp_path):
        mgr = ArchiveManager(archive_dir=str(tmp_path))
        (tmp_path / "project_export_test.zip").write_bytes(b"x" * 1024)
        results = mgr.list_archives()
        assert results[0]["size_bytes"] == 1024
        assert "created_at" in results[0]


# =============================================================================
# delete_archive
# =============================================================================

class TestDeleteArchive:
    def test_delete_existing(self, tmp_path):
        mgr = ArchiveManager(archive_dir=str(tmp_path))
        f = tmp_path / "project_export_test.zip"
        f.write_text("data")
        assert mgr.delete_archive("project_export_test.zip") is True
        assert not f.exists()

    def test_delete_nonexistent(self, tmp_path):
        mgr = ArchiveManager(archive_dir=str(tmp_path))
        assert mgr.delete_archive("nope.zip") is False


# =============================================================================
# cleanup_old_archives
# =============================================================================

class TestCleanupOldArchives:
    def test_cleanup_removes_old(self, tmp_path):
        mgr = ArchiveManager(archive_dir=str(tmp_path))
        for i in range(5):
            (tmp_path / f"project_export_{i}.zip").write_text(str(i))
        removed = mgr.cleanup_old_archives(keep_count=2)
        assert removed == 3
        remaining = list(tmp_path.glob("project_export_*"))
        assert len(remaining) == 2

    def test_cleanup_keep_all_when_fewer(self, tmp_path):
        mgr = ArchiveManager(archive_dir=str(tmp_path))
        (tmp_path / "project_export_a.zip").write_text("a")
        removed = mgr.cleanup_old_archives(keep_count=10)
        assert removed == 0

    def test_cleanup_keep_count_zero(self, tmp_path):
        mgr = ArchiveManager(archive_dir=str(tmp_path))
        for i in range(3):
            (tmp_path / f"project_export_{i}.zip").write_text(str(i))
        removed = mgr.cleanup_old_archives(keep_count=0)
        assert removed == 3
        assert len(list(tmp_path.glob("project_export_*"))) == 0

    def test_cleanup_ignores_non_matching_files(self, tmp_path):
        mgr = ArchiveManager(archive_dir=str(tmp_path))
        (tmp_path / "project_export_a.zip").write_text("a")
        (tmp_path / "other.zip").write_text("b")
        removed = mgr.cleanup_old_archives(keep_count=0)
        assert removed == 1
        assert (tmp_path / "other.zip").exists()
