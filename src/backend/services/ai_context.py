"""Deep Context Builder - assembles rich narrative context for AI operations.

Provides a structured context package that includes:
- Previous chapter summary (for narrative continuity)
- Current chapter's associated characters (with states)
- Active plot thread statuses (埋设/发展/揭示)
- Current outline title and description
- Active IF lines
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.domain.entities import (
    Chapter,
    Character,
    CharacterStoryline,
    IFLine,
    Outline,
    PlotThread,
)

logger = logging.getLogger(__name__)


@dataclass
class CharacterContext:
    """Character info within a deep context pack."""

    id: int
    name: str
    tier: Optional[str] = None
    cultivation_realm: Optional[str] = None
    personality: Optional[str] = None
    current_arc: Optional[str] = None
    progress: int = 0


@dataclass
class PlotThreadContext:
    """Plot thread with resolved status label."""

    id: int
    title: str
    description: Optional[str] = None
    status: str = "active"
    status_label: str = "发展"  # 埋设 / 发展 / 揭示
    created_chapter_id: Optional[int] = None
    reveal_chapter_id: Optional[int] = None


@dataclass
class IFLineContext:
    """IF line summary for context pack."""

    id: int
    title: str
    description: Optional[str] = None
    sync_mode: str = "auto"
    linked_character_id: Optional[int] = None


@dataclass
class OutlineContext:
    """Outline info attached to a chapter."""

    id: int
    title: str
    description: Optional[str] = None


@dataclass
class DeepContextPack:
    """Full deep context pack returned to the frontend."""

    chapter_id: int
    chapter_title: Optional[str] = None
    chapter_summary: Optional[str] = None
    chapter_order: int = 0

    # Previous chapter
    previous_chapter: Optional[Dict[str, Any]] = None

    # Current chapter's associated characters
    characters: List[CharacterContext] = field(default_factory=list)

    # Active plot threads with status labels
    plot_threads: List[PlotThreadContext] = field(default_factory=list)

    # Outline info
    outline: Optional[OutlineContext] = None

    # Active IF lines
    if_lines: List[IFLineContext] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to a plain dict for JSON response."""
        return {
            "chapter_id": self.chapter_id,
            "chapter_title": self.chapter_title,
            "chapter_summary": self.chapter_summary,
            "chapter_order": self.chapter_order,
            "previous_chapter": self.previous_chapter,
            "characters": [
                {
                    "id": c.id,
                    "name": c.name,
                    "tier": c.tier,
                    "cultivation_realm": c.cultivation_realm,
                    "personality": c.personality,
                    "current_arc": c.current_arc,
                    "progress": c.progress,
                }
                for c in self.characters
            ],
            "plot_threads": [
                {
                    "id": pt.id,
                    "title": pt.title,
                    "description": pt.description,
                    "status": pt.status,
                    "status_label": pt.status_label,
                    "created_chapter_id": pt.created_chapter_id,
                    "reveal_chapter_id": pt.reveal_chapter_id,
                }
                for pt in self.plot_threads
            ],
            "outline": (
                {
                    "id": self.outline.id,
                    "title": self.outline.title,
                    "description": self.outline.description,
                }
                if self.outline
                else None
            ),
            "if_lines": [
                {
                    "id": ifl.id,
                    "title": ifl.title,
                    "description": ifl.description,
                    "sync_mode": ifl.sync_mode,
                    "linked_character_id": ifl.linked_character_id,
                }
                for ifl in self.if_lines
            ],
        }


def _resolve_plot_status_label(status: str, reveal_chapter_id: Optional[int]) -> str:
    """Map plot thread status to a human-readable Chinese label.

    埋设 (planted/hidden) - status is 'hidden' or thread has no reveal yet
    发展 (developing/active) - status is 'active' or 'open'
    揭示 (revealed/resolved) - status is 'resolved' or 'revealed'
    """
    if status in ("resolved", "revealed"):
        return "揭示"
    if status in ("hidden",):
        return "埋设"
    # active, open, abandoned -> developing
    return "发展"


class DeepContextBuilder:
    """Builds a deep context pack for a chapter from database entities."""

    def __init__(self, max_characters: int = 10) -> None:
        self.max_characters = max_characters

    async def build(
        self,
        chapter_id: int,
        db: AsyncSession,
    ) -> DeepContextPack:
        """Build a deep context pack for the given chapter.

        Args:
            chapter_id: Target chapter ID
            db: Async database session

        Returns:
            DeepContextPack with all context data

        Raises:
            ValueError: If the chapter is not found
        """
        # Load target chapter
        result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
        chapter = result.scalar_one_or_none()
        if not chapter:
            raise ValueError(f"Chapter {chapter_id} not found")

        pack = DeepContextPack(
            chapter_id=chapter.id,
            chapter_title=chapter.title,
            chapter_summary=chapter.summary,
            chapter_order=chapter.chapter_order,
        )

        # 1. Previous chapter summary
        pack.previous_chapter = await self._get_previous_chapter(chapter, db)

        # 2. Outline info
        if chapter.outline_id:
            pack.outline = await self._get_outline(chapter.outline_id, db)

        # 3. Characters associated with the current chapter
        pack.characters = await self._get_chapter_characters(chapter, db)

        # 4. Active plot threads with status labels
        pack.plot_threads = await self._get_plot_threads(chapter_id, chapter, db)

        # 5. Active IF lines
        pack.if_lines = await self._get_if_lines(db)

        return pack

    async def _get_previous_chapter(
        self, chapter: Chapter, db: AsyncSession
    ) -> Optional[Dict[str, Any]]:
        """Get the previous chapter's summary for narrative continuity."""
        if chapter.chapter_order <= 0:
            return None

        result = await db.execute(
            select(Chapter).where(
                Chapter.outline_id == chapter.outline_id,
                Chapter.chapter_order == chapter.chapter_order - 1,
            )
        )
        prev = result.scalar_one_or_none()
        if not prev:
            # Fallback: try any chapter with lower order
            result = await db.execute(
                select(Chapter)
                .where(Chapter.chapter_order < chapter.chapter_order)
                .order_by(Chapter.chapter_order.desc())
                .limit(1)
            )
            prev = result.scalar_one_or_none()

        if not prev:
            return None

        return {
            "id": prev.id,
            "title": prev.title,
            "summary": prev.summary,
            "chapter_order": prev.chapter_order,
        }

    async def _get_outline(
        self, outline_id: int, db: AsyncSession
    ) -> Optional[OutlineContext]:
        """Get the outline associated with the chapter."""
        result = await db.execute(select(Outline).where(Outline.id == outline_id))
        outline = result.scalar_one_or_none()
        if not outline:
            return None
        return OutlineContext(
            id=outline.id,
            title=outline.title,
            description=outline.description,
        )

    async def _get_chapter_characters(
        self, chapter: Chapter, db: AsyncSession
    ) -> List[CharacterContext]:
        """Get characters associated with the current chapter.

        Association logic:
        1. Characters linked to the same outline via storylines
        2. Characters linked via IF lines that reference this chapter's outline
        3. Fallback: all characters (limited by max_characters)
        """
        characters: List[CharacterContext] = []

        # Strategy 1: characters with storylines
        result = await db.execute(
            select(Character, CharacterStoryline)
            .outerjoin(
                CharacterStoryline,
                CharacterStoryline.character_id == Character.id,
            )
            .limit(self.max_characters)
        )
        seen_ids: set[int] = set()
        for char, cs in result.all():
            if char.id in seen_ids:
                continue
            seen_ids.add(char.id)
            characters.append(
                CharacterContext(
                    id=char.id,
                    name=char.name,
                    tier=char.tier,
                    cultivation_realm=char.cultivation_realm,
                    personality=char.personality,
                    current_arc=cs.arc if cs else None,
                    progress=cs.progress if cs else 0,
                )
            )

        return characters

    async def _get_plot_threads(
        self,
        chapter_id: int,
        chapter: Chapter,
        db: AsyncSession,
    ) -> List[PlotThreadContext]:
        """Get plot threads with status labels.

        Returns all plot threads created at or before this chapter,
        including resolved ones (for full context awareness).
        """
        result = await db.execute(
            select(PlotThread)
            .where(PlotThread.created_chapter_id <= chapter_id)
            .order_by(PlotThread.created_at.desc())
            .limit(20)
        )
        threads: List[PlotThreadContext] = []
        for pt in result.scalars().all():
            label = _resolve_plot_status_label(pt.status, pt.reveal_chapter_id)
            threads.append(
                PlotThreadContext(
                    id=pt.id,
                    title=pt.title,
                    description=pt.description,
                    status=pt.status,
                    status_label=label,
                    created_chapter_id=pt.created_chapter_id,
                    reveal_chapter_id=pt.reveal_chapter_id,
                )
            )

        return threads

    async def _get_if_lines(self, db: AsyncSession) -> List[IFLineContext]:
        """Get all active IF lines."""
        result = await db.execute(select(IFLine).limit(10))
        lines: List[IFLineContext] = []
        for ifl in result.scalars().all():
            lines.append(
                IFLineContext(
                    id=ifl.id,
                    title=ifl.title,
                    description=ifl.description,
                    sync_mode=ifl.sync_mode,
                    linked_character_id=ifl.linked_character_id,
                )
            )
        return lines
