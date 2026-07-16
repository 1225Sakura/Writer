"""ChapterForkService (US-016): forks a single chapter into a new IFLine.

Behavior:
  1. Validate source chapter exists (404 otherwise).
  2. Validate IFLine exists (404 otherwise).
  3. Determine the target outline for the new chapter:
       - If IFLine.fork_chapter_id references a chapter that belongs to an
         outline, use that outline (so the new chapter lands in the IFLine's
         storyline).
       - Otherwise create a new outline for this IFLine and place the chapter
         there.
  4. Copy every field from the source chapter, including rich fields
     (sections, pacing_notes, character_dynamics, foreshadowing).
  5. Return the new chapter id, the source chapter id (parentChapterId) and
     the IFLine id so the caller can record the divergence.
"""
from __future__ import annotations

from app.core.exceptions import NotFoundException
from app.models import Chapter, IFLine, Outline
from app.repositories.chapter import ChapterRepository


class ChapterForkService:
    def __init__(
        self,
        chapter_repo: ChapterRepository,
        outline_repo,
        db,
    ):
        self._chapters = chapter_repo
        self._outlines = outline_repo
        self._db = db

    def fork(
        self,
        source_chapter_id: int,
        if_line_id: int,
        name: str | None = None,
    ) -> dict:
        source = self._chapters.get(source_chapter_id)
        if not source:
            raise NotFoundException("Chapter", source_chapter_id)

        if_line = self._db.get(IFLine, if_line_id)
        if not if_line:
            raise NotFoundException("IFLine", if_line_id)

        target_outline_id = self._resolve_target_outline_id(if_line, source)

        new_chapter = Chapter(
            project_id=source.project_id,
            outline_id=target_outline_id,
            title=name or source.title,
            summary=source.summary,
            status=source.status,
            word_count=source.word_count,
            chapter_order=source.chapter_order,
            content=source.content,
            notes=source.notes,
            note_category=source.note_category,
            note_pinned=source.note_pinned,
            battle_station_data=source.battle_station_data,
            sections=source.sections,
            pacing_notes=source.pacing_notes,
            character_dynamics=source.character_dynamics,
            foreshadowing=source.foreshadowing,
        )
        self._db.add(new_chapter)
        self._db.commit()
        self._db.refresh(new_chapter)

        return {
            "new_chapter_id": new_chapter.id,
            "parent_chapter_id": source.id,
            "if_line_id": if_line_id,
        }

    def _resolve_target_outline_id(
        self, if_line: IFLine, source: Chapter
    ) -> int:
        """Pick the outline the new chapter should belong to.

        Order of preference:
          1. IFLine.fork_chapter.outline_id (the IFLine's existing storyline)
          2. The source chapter's own outline_id (if Line has no fork_chapter)
          3. A freshly-created outline (last-resort when neither is set)
        """
        if if_line.fork_chapter_id is not None:
            fork_chapter = self._chapters.get(if_line.fork_chapter_id)
            if fork_chapter is not None and fork_chapter.outline_id is not None:
                return fork_chapter.outline_id

        if source.outline_id is not None:
            return source.outline_id

        new_outline = Outline(
            project_id=source.project_id,
            title=f"IF线 #{if_line.id} 分叉",
        )
        self._db.add(new_outline)
        self._db.flush()
        return new_outline.id