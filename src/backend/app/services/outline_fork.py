"""OutlineForkService (US-015): forks an outline into a new IFLine.

Behavior:
  1. Validate source outline exists (404 otherwise).
  2. Validate fork_chapter_id (if provided) exists (404 otherwise).
  3. Create new IFLine bound to project_id, with optional fork_chapter_id.
  4. Create new Outline (carrying title/description) bound to that IFLine via
     chapters; the IFLine itself doesn't hold an outline reference, so the
     link is the chapters' outline_id pointing at the new outline.
  5. Copy every chapter from the source outline to the new outline,
     preserving rich fields (sections, pacing_notes, character_dynamics,
     foreshadowing, etc.).
  6. Compute common_chapters: if fork_chapter_id is given, chapters at or
     before the fork chapter's chapter_order are common; otherwise every
     copied chapter is common.
"""
from __future__ import annotations

from app.core.exceptions import NotFoundException
from app.models import Chapter, IFLine, Outline
from app.repositories.chapter import ChapterRepository
from app.repositories.outline import OutlineRepository


class OutlineForkService:
    def __init__(
        self,
        outline_repo: OutlineRepository,
        chapter_repo: ChapterRepository,
        db,
    ):
        self._outlines = outline_repo
        self._chapters = chapter_repo
        self._db = db

    def fork(
        self,
        source_outline_id: int,
        *,
        name: str,
        project_id: int,
        fork_chapter_id: int | None = None,
    ) -> dict:
        source = self._outlines.get(source_outline_id)
        if not source:
            raise NotFoundException("Outline", source_outline_id)

        fork_chapter = None
        if fork_chapter_id is not None:
            fork_chapter = self._chapters.get(fork_chapter_id)
            if not fork_chapter:
                raise NotFoundException("Chapter", fork_chapter_id)

        if_line = IFLine(
            user_id="default-user",
            project_id=project_id,
            name=name,
            fork_chapter_id=fork_chapter_id,
        )
        self._db.add(if_line)
        self._db.flush()

        new_outline = Outline(
            project_id=project_id,
            title=source.title,
            description=source.description,
        )
        self._db.add(new_outline)
        self._db.flush()

        source_chapters = self._chapters.list(outline_id=source_outline_id)
        ordered = sorted(source_chapters, key=lambda c: c.chapter_order)

        common_chapter_ids: list[int] = []
        for src_ch in ordered:
            new_ch = Chapter(
                project_id=project_id,
                outline_id=new_outline.id,
                title=src_ch.title,
                summary=src_ch.summary,
                status=src_ch.status,
                word_count=src_ch.word_count,
                chapter_order=src_ch.chapter_order,
                content=src_ch.content,
                notes=src_ch.notes,
                note_category=src_ch.note_category,
                note_pinned=src_ch.note_pinned,
                battle_station_data=src_ch.battle_station_data,
                sections=src_ch.sections,
                pacing_notes=src_ch.pacing_notes,
                character_dynamics=src_ch.character_dynamics,
                foreshadowing=src_ch.foreshadowing,
            )
            self._db.add(new_ch)
            self._db.flush()

            if fork_chapter is None or src_ch.chapter_order <= fork_chapter.chapter_order:
                common_chapter_ids.append(new_ch.id)

        self._db.commit()

        return {
            "if_line_id": if_line.id,
            "forked_outline_id": new_outline.id,
            "common_chapters": common_chapter_ids,
        }
