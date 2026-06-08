# Auto Novel Writer - Chapter Repository Interface
# Abstract interface for Chapter persistence operations

from abc import abstractmethod
from typing import Optional, List, TYPE_CHECKING

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import Chapter, DraftVersion, Snapshot


class ChapterRepositoryInterface(BaseRepositoryInterface[Chapter]):
    """Abstract interface for Chapter repository operations."""

    @abstractmethod
    async def get_by_outline(self, outline_id: int, skip: int = 0, limit: int = 100) -> List[Chapter]:
        """Fetch chapters belonging to an outline."""
        ...

    @abstractmethod
    async def get_draft_versions(self, chapter_id: int) -> List[DraftVersion]:
        """Fetch all draft versions for a chapter."""
        ...

    @abstractmethod
    async def create_draft_version(self, data: dict) -> DraftVersion:
        """Create a new draft version."""
        ...

    @abstractmethod
    async def get_draft_version(self, chapter_id: int, version_number: int) -> Optional[DraftVersion]:
        """Get a specific draft version by chapter and version number."""
        ...

    @abstractmethod
    async def delete_draft_version(self, chapter_id: int, version_number: int) -> bool:
        """Delete a specific draft version by chapter and version number."""
        ...

    @abstractmethod
    async def get_chapters_with_word_count(self, min_word_count: int, project_id: Optional[int] = None) -> List[Chapter]:
        """Fetch chapters with at least min_word_count words."""
        ...

    @abstractmethod
    async def reorder_chapters(self, outline_id: int, chapter_orders: List[dict]) -> bool:
        """Reorder chapters within an outline.

        Args:
            outline_id: The outline whose chapters to reorder
            chapter_orders: List of {"id": chapter_id, "chapter_order": new_order}
        """
        ...

    # -- Snapshot operations --

    @abstractmethod
    async def get_snapshots(self, chapter_id: int, skip: int = 0, limit: int = 100) -> List[Snapshot]:
        """Fetch all snapshots for a chapter, ordered by created_at desc."""
        ...

    @abstractmethod
    async def create_snapshot(self, data: dict) -> Snapshot:
        """Create a new snapshot."""
        ...

    @abstractmethod
    async def get_snapshot(self, snapshot_id: int) -> Optional[Snapshot]:
        """Get a snapshot by its ID."""
        ...

    @abstractmethod
    async def delete_snapshot(self, snapshot_id: int) -> bool:
        """Delete a snapshot by its ID."""
        ...

    @abstractmethod
    async def count_unmarked_snapshots(self, chapter_id: int) -> int:
        """Count unmarked (auto) snapshots for a chapter."""
        ...

    @abstractmethod
    async def delete_oldest_unmarked_snapshot(self, chapter_id: int) -> bool:
        """Delete the oldest unmarked snapshot for a chapter."""
        ...
