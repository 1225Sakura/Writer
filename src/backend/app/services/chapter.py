"""ChapterService: business logic for chapter CRUD under a project."""
from __future__ import annotations

from app.models import Chapter
from app.repositories.chapter import ChapterRepository
from app.schemas.chapter import ChapterCreate, ChapterUpdate


class ChapterService:
    def __init__(self, repo: ChapterRepository):
        self._repo = repo

    def create(self, data: ChapterCreate, *, project_id: int) -> Chapter:
        payload = data.model_dump(exclude_unset=True)
        pid = payload.pop("project_id", project_id)
        return self._repo.create(Chapter(project_id=pid, **payload))

    def list(
        self,
        project_id: int | None = None,
        outline_id: int | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Chapter]:
        return self._repo.list(project_id=project_id, outline_id=outline_id, skip=skip, limit=limit)

    def get(self, id: int) -> Chapter | None:
        return self._repo.get(id)

    def update(self, id: int, data: ChapterUpdate) -> Chapter | None:
        chapter = self._repo.get(id)
        if not chapter:
            return None
        return self._repo.update(chapter, data.model_dump(exclude_unset=True))

    def delete(self, id: int) -> bool:
        return self._repo.delete(id)
