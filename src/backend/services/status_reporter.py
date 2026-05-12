"""Comprehensive project status reporter.

Generates a holistic project status report including:
- Basic project statistics (chapters, words, characters)
- Character activity analysis (which characters haven't appeared recently)
- Plot thread / foreshadowing tracking
- Writing progress and pace
- Quality overview
- Debt summary

Uses existing database tables: Chapter, Character, CharacterRelationship,
PlotThread, AIInspectionResult, DraftVersion, etc.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import async_session_maker
from backend.core.domain import (
    Chapter,
    Character,
    CharacterRelationship,
    PlotThread,
    AIInspectionResult,
    DraftVersion,
    Outline,
    IFLine,
    Item,
    Location,
    Faction,
    WorldSetting,
    Rule,
    ChatSession,
)
from backend.utils.logging import get_logger

logger = get_logger("writer-api.status_reporter")


class StatusReporter:
    """Generates comprehensive project status reports.

    Provides a macro-level view of the writing project, helping authors
    understand the overall health and progress of their work.
    """

    # Character absence thresholds (in chapters)
    CHARACTER_ABSENCE_WARNING = 20
    CHARACTER_ABSENCE_CRITICAL = 50

    # Plot thread thresholds
    PLOT_THREAD_GAP_WARNING = 50
    PLOT_THREAD_GAP_CRITICAL = 100

    # Quality thresholds
    QUALITY_SCORE_WARNING = 70.0
    QUALITY_SCORE_CRITICAL = 60.0

    async def generate_status_report(self) -> dict[str, Any]:
        """Generate a comprehensive project status report.

        Returns:
            Dictionary with all status sections.
        """
        generated_at = datetime.now(timezone.utc).isoformat()

        basic_stats = await self._get_basic_stats()
        character_activity = await self._get_character_activity()
        plot_thread_status = await self._get_plot_thread_status()
        writing_progress = await self._get_writing_progress()
        quality_overview = await self._get_quality_overview()
        recent_activity = await self._get_recent_activity()

        # Compute overall health score
        health_score = self._compute_health_score(
            basic_stats=basic_stats,
            character_activity=character_activity,
            plot_thread_status=plot_thread_status,
            quality_overview=quality_overview,
        )

        return {
            "generated_at": generated_at,
            "health_score": health_score,
            "health_status": self._health_status_label(health_score),
            "basic_stats": basic_stats,
            "character_activity": character_activity,
            "plot_threads": plot_thread_status,
            "writing_progress": writing_progress,
            "quality_overview": quality_overview,
            "recent_activity": recent_activity,
        }

    async def _get_basic_stats(self) -> dict[str, Any]:
        """Get basic project statistics."""
        async with async_session_maker() as session:
            chapter_count = await session.scalar(
                select(func.count()).select_from(Chapter)
            )
            character_count = await session.scalar(
                select(func.count()).select_from(Character)
            )
            outline_count = await session.scalar(
                select(func.count()).select_from(Outline)
            )
            if_line_count = await session.scalar(
                select(func.count()).select_from(IFLine)
            )
            plot_thread_count = await session.scalar(
                select(func.count()).select_from(PlotThread)
            )
            draft_count = await session.scalar(
                select(func.count()).select_from(DraftVersion)
            )
            item_count = await session.scalar(
                select(func.count()).select_from(Item)
            )
            location_count = await session.scalar(
                select(func.count()).select_from(Location)
            )
            faction_count = await session.scalar(
                select(func.count()).select_from(Faction)
            )
            world_setting_count = await session.scalar(
                select(func.count()).select_from(WorldSetting)
            )
            rule_count = await session.scalar(
                select(func.count()).select_from(Rule)
            )
            chat_session_count = await session.scalar(
                select(func.count()).select_from(ChatSession)
            )

            word_count_result = await session.execute(
                select(func.sum(Chapter.word_count))
            )
            total_words = word_count_result.scalar_one_or_none() or 0

            # Chapters by status
            status_result = await session.execute(
                select(Chapter.status, func.count()).group_by(Chapter.status)
            )
            by_status = {row[0] or "unknown": row[1] for row in status_result.all()}

            # Max chapter order
            max_order_result = await session.execute(
                select(func.max(Chapter.chapter_order))
            )
            max_order = max_order_result.scalar_one_or_none() or 0

        return {
            "total_chapters": chapter_count or 0,
            "total_characters": character_count or 0,
            "total_outlines": outline_count or 0,
            "total_if_lines": if_line_count or 0,
            "total_plot_threads": plot_thread_count or 0,
            "total_draft_versions": draft_count or 0,
            "total_items": item_count or 0,
            "total_locations": location_count or 0,
            "total_factions": faction_count or 0,
            "total_world_settings": world_setting_count or 0,
            "total_rules": rule_count or 0,
            "total_chat_sessions": chat_session_count or 0,
            "total_word_count": int(total_words),
            "chapters_by_status": by_status,
            "max_chapter_order": int(max_order),
        }

    async def _get_character_activity(self) -> dict[str, Any]:
        """Analyze character activity - which characters haven't appeared recently.

        Since we don't have chapter-character linkage in the schema,
        we use character relationship data and storyline progress as proxies.
        """
        async with async_session_maker() as session:
            result = await session.execute(
                select(Character).order_by(Character.id)
            )
            characters = result.scalars().all()

        # Get max chapter order as proxy for "current chapter"
        async with async_session_maker() as session:
            max_order_result = await session.execute(
                select(func.max(Chapter.chapter_order))
            )
            current_chapter = max_order_result.scalar_one_or_none() or 0

        active_characters: list[dict[str, Any]] = []
        dropped_characters: list[dict[str, Any]] = []

        for char in characters:
            # Use storyline progress as proxy for last appearance
            # In a full implementation, this would query chapter-character links
            async with async_session_maker() as session:
                rel_count = await session.scalar(
                    select(func.count())
                    .select_from(CharacterRelationship)
                    .where(
                        (CharacterRelationship.character_id == char.id)
                        | (CharacterRelationship.target_id == char.id)
                    )
                )

            # Proxy: characters with no relationships are considered "inactive"
            # Characters with relationships are considered "active"
            if rel_count and rel_count > 0:
                active_characters.append({
                    "id": char.id,
                    "name": char.name,
                    "tier": char.tier,
                    "relationship_count": rel_count,
                })
            else:
                dropped_characters.append({
                    "id": char.id,
                    "name": char.name,
                    "tier": char.tier,
                    "absence_chapters": current_chapter,  # Proxy: never appeared
                    "status": "严重掉线",
                })

        return {
            "total": len(characters),
            "active_count": len(active_characters),
            "dropped_count": len(dropped_characters),
            "active_characters": active_characters,
            "dropped_characters": sorted(
                dropped_characters,
                key=lambda x: x["absence_chapters"],
                reverse=True,
            )[:10],  # Top 10 dropped
        }

    async def _get_plot_thread_status(self) -> dict[str, Any]:
        """Analyze plot thread / foreshadowing status."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(PlotThread).order_by(PlotThread.id)
            )
            threads = result.scalars().all()

        active_threads: list[dict[str, Any]] = []
        resolved_threads: list[dict[str, Any]] = []
        overdue_threads: list[dict[str, Any]] = []

        for thread in threads:
            thread_data = {
                "id": thread.id,
                "title": thread.title,
                "status": thread.status,
                "created_chapter_id": thread.created_chapter_id,
                "reveal_chapter_id": thread.reveal_chapter_id,
            }

            if thread.status == "resolved":
                resolved_threads.append(thread_data)
            elif thread.reveal_chapter_id and thread.created_chapter_id:
                gap = abs(thread.reveal_chapter_id - thread.created_chapter_id)
                if gap > self.PLOT_THREAD_GAP_CRITICAL:
                    thread_data["gap"] = gap
                    thread_data["overdue_status"] = "严重超时"
                    overdue_threads.append(thread_data)
                elif gap > self.PLOT_THREAD_GAP_WARNING:
                    thread_data["gap"] = gap
                    thread_data["overdue_status"] = "轻度超时"
                    overdue_threads.append(thread_data)
                else:
                    active_threads.append(thread_data)
            else:
                active_threads.append(thread_data)

        return {
            "total": len(threads),
            "active_count": len(active_threads),
            "resolved_count": len(resolved_threads),
            "overdue_count": len(overdue_threads),
            "active_threads": active_threads,
            "resolved_threads": resolved_threads,
            "overdue_threads": sorted(
                overdue_threads,
                key=lambda x: x.get("gap", 0),
                reverse=True,
            ),
        }

    async def _get_writing_progress(self) -> dict[str, Any]:
        """Analyze writing progress and pace."""
        async with async_session_maker() as session:
            # Get chapter timeline
            result = await session.execute(
                select(Chapter).order_by(Chapter.chapter_order)
            )
            chapters = result.scalars().all()

            total_words_result = await session.execute(
                select(func.sum(Chapter.word_count))
            )
            total_words = total_words_result.scalar_one_or_none() or 0

            avg_words_result = await session.execute(
                select(func.avg(Chapter.word_count))
            )
            avg_words = avg_words_result.scalar_one_or_none() or 0

            # Recent chapters (last 7 days)
            since = datetime.now(timezone.utc) - timedelta(days=7)
            recent_result = await session.execute(
                select(func.count(Chapter.id))
                .where(Chapter.created_at >= since)
            )
            recent_chapters = recent_result.scalar_one_or_none() or 0

            # Recent words
            recent_words_result = await session.execute(
                select(func.sum(Chapter.word_count))
                .where(Chapter.created_at >= since)
            )
            recent_words = recent_words_result.scalar_one_or_none() or 0

        chapter_count = len(chapters)

        # Estimate completion (assume 200万字 target as default)
        target_words = 2_000_000
        completion_pct = (total_words / target_words * 100) if target_words > 0 else 0

        return {
            "total_chapters": chapter_count,
            "total_words": int(total_words),
            "average_words_per_chapter": round(float(avg_words), 1),
            "target_words": target_words,
            "completion_percentage": round(completion_pct, 1),
            "recent_7d": {
                "chapters_created": recent_chapters,
                "words_written": int(recent_words),
            },
            "chapter_timeline": [
                {
                    "id": ch.id,
                    "order": ch.chapter_order,
                    "title": ch.title,
                    "status": ch.status,
                    "word_count": ch.word_count,
                    "created_at": ch.created_at.isoformat() if ch.created_at else None,
                }
                for ch in chapters[-20:]  # Last 20 chapters
            ],
        }

    async def _get_quality_overview(self) -> dict[str, Any]:
        """Get a high-level quality overview."""
        async with async_session_maker() as session:
            # Total inspections
            inspection_count = await session.scalar(
                select(func.count()).select_from(AIInspectionResult)
            )

            # Inspections by type
            type_result = await session.execute(
                select(AIInspectionResult.inspection_type, func.count())
                .group_by(AIInspectionResult.inspection_type)
            )
            by_type = {row[0]: row[1] for row in type_result.all()}

            # Recent inspections (last 7 days)
            since = datetime.now(timezone.utc) - timedelta(days=7)
            recent_result = await session.execute(
                select(func.count())
                .select_from(AIInspectionResult)
                .where(AIInspectionResult.created_at >= since)
            )
            recent_count = recent_result.scalar_one_or_none() or 0

            # Chapters with inspections
            inspected_chapters_result = await session.execute(
                select(func.count(func.distinct(AIInspectionResult.chapter_id)))
                .select_from(AIInspectionResult)
            )
            inspected_chapters = inspected_chapters_result.scalar_one_or_none() or 0

            # Total chapters
            total_chapters = await session.scalar(
                select(func.count()).select_from(Chapter)
            )

        coverage_pct = (
            (inspected_chapters / total_chapters * 100)
            if total_chapters and total_chapters > 0
            else 0.0
        )

        return {
            "total_inspections": inspection_count or 0,
            "by_type": by_type,
            "recent_7d": recent_count,
            "chapters_with_inspection": inspected_chapters,
            "total_chapters": total_chapters or 0,
            "inspection_coverage_pct": round(coverage_pct, 1),
        }

    async def _get_recent_activity(self) -> dict[str, Any]:
        """Get recent project activity summary."""
        since = datetime.now(timezone.utc) - timedelta(days=7)

        async with async_session_maker() as session:
            # Recent chapters
            recent_chapters_result = await session.execute(
                select(Chapter)
                .where(Chapter.created_at >= since)
                .order_by(desc(Chapter.created_at))
                .limit(5)
            )
            recent_chapters = recent_chapters_result.scalars().all()

            # Recent inspections
            recent_inspections_result = await session.execute(
                select(AIInspectionResult)
                .where(AIInspectionResult.created_at >= since)
                .order_by(desc(AIInspectionResult.created_at))
                .limit(5)
            )
            recent_inspections = recent_inspections_result.scalars().all()

            # Recent drafts
            recent_drafts_result = await session.execute(
                select(DraftVersion)
                .where(DraftVersion.created_at >= since)
                .order_by(desc(DraftVersion.created_at))
                .limit(5)
            )
            recent_drafts = recent_drafts_result.scalars().all()

        return {
            "recent_chapters": [
                {
                    "id": ch.id,
                    "title": ch.title,
                    "order": ch.chapter_order,
                    "created_at": ch.created_at.isoformat() if ch.created_at else None,
                }
                for ch in recent_chapters
            ],
            "recent_inspections": [
                {
                    "id": insp.id,
                    "chapter_id": insp.chapter_id,
                    "type": insp.inspection_type,
                    "created_at": insp.created_at.isoformat() if insp.created_at else None,
                }
                for insp in recent_inspections
            ],
            "recent_drafts": [
                {
                    "id": d.id,
                    "chapter_id": d.chapter_id,
                    "version": d.version_number,
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                }
                for d in recent_drafts
            ],
        }

    def _compute_health_score(
        self,
        basic_stats: dict[str, Any],
        character_activity: dict[str, Any],
        plot_thread_status: dict[str, Any],
        quality_overview: dict[str, Any],
    ) -> float:
        """Compute an overall project health score (0-100).

        Factors:
        - Inspection coverage (20 points)
        - Character activity ratio (20 points)
        - Plot thread resolution ratio (20 points)
        - Writing progress (20 points)
        - Quality inspection recency (20 points)
        """
        score = 0.0

        # Inspection coverage (20 points max)
        coverage = quality_overview.get("inspection_coverage_pct", 0)
        score += min(20.0, coverage / 5.0)

        # Character activity (20 points max)
        total_chars = character_activity.get("total", 0)
        active_chars = character_activity.get("active_count", 0)
        if total_chars > 0:
            activity_ratio = active_chars / total_chars
            score += activity_ratio * 20.0
        else:
            score += 20.0  # No characters yet = no debt

        # Plot thread resolution (20 points max)
        total_threads = plot_thread_status.get("total", 0)
        resolved_threads = plot_thread_status.get("resolved_count", 0)
        overdue_threads = plot_thread_status.get("overdue_count", 0)
        if total_threads > 0:
            resolution_ratio = resolved_threads / total_threads
            overdue_penalty = min(overdue_threads / total_threads * 10.0, 10.0)
            score += max(0.0, resolution_ratio * 20.0 - overdue_penalty)
        else:
            score += 20.0  # No threads yet = no debt

        # Writing progress (20 points max)
        completion = basic_stats.get("completion_percentage", 0)
        score += min(20.0, completion / 5.0)

        # Quality recency (20 points max)
        recent_inspections = quality_overview.get("recent_7d", 0)
        total_chapters = basic_stats.get("total_chapters", 0)
        if total_chapters > 0:
            recency_ratio = min(recent_inspections / max(total_chapters * 0.1, 1), 1.0)
            score += recency_ratio * 20.0
        else:
            score += 20.0

        return round(score, 1)

    @staticmethod
    def _health_status_label(score: float) -> str:
        """Convert health score to a status label."""
        if score >= 80:
            return "健康"
        elif score >= 60:
            return "良好"
        elif score >= 40:
            return "一般"
        elif score >= 20:
            return "需关注"
        else:
            return "严重"

    async def get_quick_status(self) -> dict[str, Any]:
        """Get a quick one-line status summary for dashboard display."""
        async with async_session_maker() as session:
            chapter_count = await session.scalar(
                select(func.count()).select_from(Chapter)
            )
            word_count_result = await session.execute(
                select(func.sum(Chapter.word_count))
            )
            total_words = word_count_result.scalar_one_or_none() or 0

            # Pending chapters
            pending_result = await session.execute(
                select(func.count())
                .select_from(Chapter)
                .where(Chapter.status == "pending")
            )
            pending_count = pending_result.scalar_one_or_none() or 0

            # Recent activity (24h)
            since = datetime.now(timezone.utc) - timedelta(hours=24)
            recent_chapters = await session.scalar(
                select(func.count())
                .select_from(Chapter)
                .where(Chapter.created_at >= since)
            )
            recent_inspections = await session.scalar(
                select(func.count())
                .select_from(AIInspectionResult)
                .where(AIInspectionResult.created_at >= since)
            )

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "total_chapters": chapter_count or 0,
            "total_words": int(total_words),
            "pending_chapters": pending_count,
            "recent_24h": {
                "chapters": recent_chapters or 0,
                "inspections": recent_inspections or 0,
            },
        }


# Global singleton instance
status_reporter = StatusReporter()
