# Auto Novel Writer - AIInspectionResult Repository Interface
# Abstract interface for AIInspectionResult persistence operations

from abc import abstractmethod
from typing import List

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import AIInspectionResult


class AIInspectionResultRepositoryInterface(BaseRepositoryInterface[AIInspectionResult]):
    """Abstract interface for AIInspectionResult repository operations."""

    @abstractmethod
    async def get_by_chapter(self, chapter_id: int) -> List[AIInspectionResult]:
        """Fetch all AI inspection results for a chapter."""
        ...
