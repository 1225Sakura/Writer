# Auto Novel Writer - External Content Storage
# Stores large text content (chapter bodies, draft versions) on disk
# to keep the SQLite database lightweight.

import hashlib
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class ContentStorage:
    """File-system backed storage for large text content.

    Layout: data/content/{project_id}/{sid[:2]}/{sid}.md
    """

    def __init__(self, base_dir: Path = Path("data/content")):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def save(self, project_id: int, content: str) -> str:
        """Persist *content* and return its SHA-256 storage id."""
        storage_id = self._compute_hash(content)
        file_path = self._get_path(project_id, storage_id)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content, encoding="utf-8")
        logger.debug("Content saved: %s", file_path)
        return storage_id

    def load(self, storage_id: str, project_id: Optional[int] = None) -> str:
        """Load content by *storage_id*.

        If *project_id* is provided the lookup is direct; otherwise a
        breadth-first search under ``base_dir`` is performed.
        """
        if project_id is not None:
            file_path = self._get_path(project_id, storage_id)
            if file_path.exists():
                return file_path.read_text(encoding="utf-8")
            raise FileNotFoundError(f"Content not found: {file_path}")

        # Search across all project directories
        for proj_dir in self.base_dir.iterdir():
            if not proj_dir.is_dir():
                continue
            file_path = self._get_path(int(proj_dir.name), storage_id)
            if file_path.exists():
                return file_path.read_text(encoding="utf-8")
        raise FileNotFoundError(f"Content not found for storage_id: {storage_id}")

    def delete(self, storage_id: str, project_id: Optional[int] = None) -> bool:
        """Delete content by *storage_id*.  Returns *True* if deleted."""
        if project_id is not None:
            file_path = self._get_path(project_id, storage_id)
            if file_path.exists():
                file_path.unlink()
                self._cleanup_empty_dirs(file_path.parent)
                return True
            return False

        for proj_dir in self.base_dir.iterdir():
            if not proj_dir.is_dir():
                continue
            file_path = self._get_path(int(proj_dir.name), storage_id)
            if file_path.exists():
                file_path.unlink()
                self._cleanup_empty_dirs(file_path.parent)
                return True
        return False

    def exists(self, storage_id: str, project_id: int) -> bool:
        """Check whether content exists for the given ids."""
        return self._get_path(project_id, storage_id).exists()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_path(self, project_id: int, storage_id: str) -> Path:
        """Resolve filesystem path for a storage id."""
        prefix = storage_id[:2]
        return self.base_dir / str(project_id) / prefix / f"{storage_id}.md"

    @staticmethod
    def _compute_hash(content: str) -> str:
        """Compute SHA-256 hex digest of *content*."""
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def _cleanup_empty_dirs(self, directory: Path) -> None:
        """Remove empty parent directories up to ``base_dir``."""
        try:
            for parent in [directory, directory.parent]:
                if parent == self.base_dir:
                    break
                if parent.exists() and not any(parent.iterdir()):
                    parent.rmdir()
        except OSError:
            pass
