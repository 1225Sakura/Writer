"""DraftService: thin facade over DraftRepository.

All version-number bookkeeping is delegated to the repository's
TOCTOU-safe `create_next_version`. The service must NOT compute
version numbers itself.
"""
from __future__ import annotations

from app.models import Draft
from app.repositories.draft import DraftRepository


class DraftService:
    def __init__(self, repo: DraftRepository):
        self._repo = repo

    def list(self, chapter_id: int, skip: int = 0, limit: int = 100) -> list[Draft]:
        return self._repo.list(chapter_id=chapter_id, skip=skip, limit=limit)

    def get(self, chapter_id: int, version_number: int) -> Draft | None:
        return self._repo.get(chapter_id, version_number)

    def get_latest(self, chapter_id: int) -> Draft | None:
        return self._repo.get_latest(chapter_id)

    def create_next_version(self, chapter_id: int, content: str) -> Draft:
        return self._repo.create_next_version(chapter_id, content)
