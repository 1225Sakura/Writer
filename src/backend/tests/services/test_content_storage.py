"""Tests for Content Storage - save, load, delete, exists operations."""

import hashlib
import pytest
import tempfile
from pathlib import Path

from backend.services.content_storage import ContentStorage


@pytest.fixture
def tmp_storage(tmp_path):
    """Create a ContentStorage with a temp directory."""
    return ContentStorage(base_dir=tmp_path / "content")


# =============================================================================
# save
# =============================================================================


class TestSave:
    """Test content saving."""

    def test_save_returns_hash(self, tmp_storage):
        content = "Hello, world!"
        storage_id = tmp_storage.save(project_id=1, content=content)
        expected = hashlib.sha256(content.encode("utf-8")).hexdigest()
        assert storage_id == expected

    def test_save_creates_file(self, tmp_storage):
        content = "Test content"
        storage_id = tmp_storage.save(project_id=1, content=content)
        file_path = tmp_storage._get_path(1, storage_id)
        assert file_path.exists()

    def test_save_same_content_same_id(self, tmp_storage):
        id1 = tmp_storage.save(project_id=1, content="same")
        id2 = tmp_storage.save(project_id=1, content="same")
        assert id1 == id2

    def test_save_different_content_different_id(self, tmp_storage):
        id1 = tmp_storage.save(project_id=1, content="content A")
        id2 = tmp_storage.save(project_id=1, content="content B")
        assert id1 != id2


# =============================================================================
# load
# =============================================================================


class TestLoad:
    """Test content loading."""

    def test_load_with_project_id(self, tmp_storage):
        content = "Load me"
        storage_id = tmp_storage.save(project_id=1, content=content)
        loaded = tmp_storage.load(storage_id, project_id=1)
        assert loaded == content

    def test_load_without_project_id_searches(self, tmp_storage):
        content = "Search me"
        storage_id = tmp_storage.save(project_id=42, content=content)
        loaded = tmp_storage.load(storage_id)
        assert loaded == content

    def test_load_not_found_raises(self, tmp_storage):
        with pytest.raises(FileNotFoundError):
            tmp_storage.load("nonexistent_hash", project_id=1)

    def test_load_not_found_global_raises(self, tmp_storage):
        with pytest.raises(FileNotFoundError):
            tmp_storage.load("nonexistent_hash")

    def test_load_chinese_content(self, tmp_storage):
        content = "这是中文内容测试"
        storage_id = tmp_storage.save(project_id=1, content=content)
        loaded = tmp_storage.load(storage_id, project_id=1)
        assert loaded == content


# =============================================================================
# delete
# =============================================================================


class TestDelete:
    """Test content deletion."""

    def test_delete_existing_returns_true(self, tmp_storage):
        storage_id = tmp_storage.save(project_id=1, content="delete me")
        assert tmp_storage.delete(storage_id, project_id=1) is True

    def test_delete_existing_removes_file(self, tmp_storage):
        storage_id = tmp_storage.save(project_id=1, content="delete me")
        tmp_storage.delete(storage_id, project_id=1)
        assert tmp_storage.exists(storage_id, project_id=1) is False

    def test_delete_nonexistent_returns_false(self, tmp_storage):
        assert tmp_storage.delete("nonexistent", project_id=1) is False

    def test_delete_global_search(self, tmp_storage):
        storage_id = tmp_storage.save(project_id=99, content="global delete")
        assert tmp_storage.delete(storage_id) is True

    def test_delete_global_nonexistent_returns_false(self, tmp_storage):
        assert tmp_storage.delete("nonexistent") is False


# =============================================================================
# exists
# =============================================================================


class TestExists:
    """Test existence check."""

    def test_exists_true(self, tmp_storage):
        storage_id = tmp_storage.save(project_id=1, content="exists")
        assert tmp_storage.exists(storage_id, project_id=1) is True

    def test_exists_false(self, tmp_storage):
        assert tmp_storage.exists("nonexistent", project_id=1) is False

    def test_exists_after_delete(self, tmp_storage):
        storage_id = tmp_storage.save(project_id=1, content="gone")
        tmp_storage.delete(storage_id, project_id=1)
        assert tmp_storage.exists(storage_id, project_id=1) is False


# =============================================================================
# _compute_hash
# =============================================================================


class TestComputeHash:
    """Test hash computation."""

    def test_hash_is_sha256(self):
        content = "test"
        result = ContentStorage._compute_hash(content)
        expected = hashlib.sha256(content.encode("utf-8")).hexdigest()
        assert result == expected

    def test_empty_string_hash(self):
        result = ContentStorage._compute_hash("")
        assert len(result) == 64  # SHA-256 hex length


# =============================================================================
# _get_path
# =============================================================================


class TestGetPath:
    """Test path resolution."""

    def test_path_structure(self, tmp_storage):
        path = tmp_storage._get_path(1, "abcdef1234567890")
        assert path == tmp_storage.base_dir / "1" / "ab" / "abcdef1234567890.md"

    def test_path_uses_first_two_chars_as_prefix(self, tmp_storage):
        path = tmp_storage._get_path(42, "ff00112233445566")
        assert "ff" in path.parts
        assert path.name == "ff00112233445566.md"


# =============================================================================
# _cleanup_empty_dirs
# =============================================================================


class TestCleanupEmptyDirs:
    """Test empty directory cleanup."""

    def test_removes_empty_dir(self, tmp_storage):
        empty_dir = tmp_storage.base_dir / "1" / "ab"
        empty_dir.mkdir(parents=True, exist_ok=True)
        tmp_storage._cleanup_empty_dirs(empty_dir)
        assert not empty_dir.exists()

    def test_does_not_remove_nonempty_dir(self, tmp_storage):
        nonempty_dir = tmp_storage.base_dir / "1" / "ab"
        nonempty_dir.mkdir(parents=True, exist_ok=True)
        (nonempty_dir / "file.txt").write_text("data")
        tmp_storage._cleanup_empty_dirs(nonempty_dir)
        assert nonempty_dir.exists()
