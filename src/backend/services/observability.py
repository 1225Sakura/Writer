"""Observability service - collects system metrics, writing quality trends, and API call stats.

Integrates with the existing metrics_service for runtime performance data,
and queries the database for writing quality trends, AI inspection results,
and chapter-level statistics.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import async_session_maker
from backend.core.domain import (
    Chapter,
    AIInspectionResult,
    DraftVersion,
    Character,
    PlotThread,
    WorkflowExecution,
    AgentExecutionLog,
)
from backend.services.metrics_service import metrics_service
from backend.utils.logging import get_logger

logger = get_logger("writer-api.observability")


class ObservabilityService:
    """Centralized observability service for system and writing metrics.

    Collects:
    - System metrics (from metrics_service): request latency, AI call rates, DB queries
    - Writing quality trends: chapter quality over time, inspection scores
    - API call statistics: AI provider usage, success/failure rates
    - Entity statistics: character counts, plot thread counts, draft version counts
    """

    async def get_system_metrics(self, window_seconds: float = 300.0) -> dict[str, Any]:
        """Get combined system metrics including runtime and database stats.

        Args:
            window_seconds: Time window for runtime metrics (default 5 minutes).

        Returns:
            Dictionary with runtime metrics, database entity counts, and storage stats.
        """
        # Get runtime metrics from metrics_service
        runtime_metrics = await metrics_service.get_summary(window_seconds=window_seconds)

        # Get database-level entity counts
        async with async_session_maker() as session:
            entity_counts = await self._get_entity_counts(session)
            chapter_stats = await self._get_chapter_stats(session)
            inspection_stats = await self._get_inspection_stats(session)
            workflow_stats = await self._get_workflow_stats(session)

        return {
            "timestamp": datetime.utcnow().isoformat(),
            "window_seconds": window_seconds,
            "runtime": runtime_metrics,
            "entities": entity_counts,
            "chapters": chapter_stats,
            "inspections": inspection_stats,
            "workflows": workflow_stats,
        }

    async def _get_entity_counts(self, session: AsyncSession) -> dict[str, int]:
        """Get counts of key entities in the database."""
        chapter_count = await session.scalar(select(func.count()).select_from(Chapter))
        character_count = await session.scalar(select(func.count()).select_from(Character))
        plot_thread_count = await session.scalar(select(func.count()).select_from(PlotThread))
        draft_count = await session.scalar(select(func.count()).select_from(DraftVersion))
        inspection_count = await session.scalar(
            select(func.count()).select_from(AIInspectionResult)
        )

        return {
            "chapters": chapter_count or 0,
            "characters": character_count or 0,
            "plot_threads": plot_thread_count or 0,
            "draft_versions": draft_count or 0,
            "ai_inspections": inspection_count or 0,
        }

    async def _get_chapter_stats(self, session: AsyncSession) -> dict[str, Any]:
        """Get chapter-level statistics."""
        # Total word count
        word_count_result = await session.execute(select(func.sum(Chapter.word_count)))
        total_words = word_count_result.scalar_one_or_none() or 0

        # Chapters by status
        status_result = await session.execute(
            select(Chapter.status, func.count())
            .group_by(Chapter.status)
        )
        by_status = {row[0] or "unknown": row[1] for row in status_result.all()}

        # Average word count
        avg_result = await session.execute(select(func.avg(Chapter.word_count)))
        avg_words = avg_result.scalar_one_or_none() or 0

        # Max chapter order (approximate chapter count)
        max_order_result = await session.execute(select(func.max(Chapter.chapter_order)))
        max_order = max_order_result.scalar_one_or_none() or 0

        return {
            "total_word_count": int(total_words),
            "average_word_count": round(float(avg_words), 1),
            "max_chapter_order": int(max_order),
            "by_status": by_status,
        }

    async def _get_inspection_stats(self, session: AsyncSession) -> dict[str, Any]:
        """Get AI inspection result statistics."""
        # Count by inspection type
        type_result = await session.execute(
            select(AIInspectionResult.inspection_type, func.count())
            .group_by(AIInspectionResult.inspection_type)
        )
        by_type = {row[0]: row[1] for row in type_result.all()}

        # Count auto-fixed vs manual
        auto_fixed_result = await session.execute(
            select(AIInspectionResult.auto_fixed, func.count())
            .group_by(AIInspectionResult.auto_fixed)
        )
        auto_fixed_counts = {str(row[0]): row[1] for row in auto_fixed_result.all()}

        # Recent inspections (last 24 hours)
        since = datetime.utcnow() - timedelta(hours=24)
        recent_result = await session.execute(
            select(func.count())
            .select_from(AIInspectionResult)
            .where(AIInspectionResult.created_at >= since)
        )
        recent_count = recent_result.scalar_one_or_none() or 0

        return {
            "by_type": by_type,
            "auto_fixed_counts": auto_fixed_counts,
            "recent_24h": recent_count,
        }

    async def _get_workflow_stats(self, session: AsyncSession) -> dict[str, Any]:
        """Get workflow execution statistics."""
        # Count by status
        status_result = await session.execute(
            select(WorkflowExecution.status, func.count())
            .group_by(WorkflowExecution.status)
        )
        by_status = {row[0]: row[1] for row in status_result.all()}

        # Total agent logs
        agent_log_count = await session.scalar(
            select(func.count()).select_from(AgentExecutionLog)
        )

        # Recent workflows (last 24 hours)
        since = datetime.utcnow() - timedelta(hours=24)
        recent_result = await session.execute(
            select(func.count())
            .select_from(WorkflowExecution)
            .where(WorkflowExecution.started_at >= since)
        )
        recent_count = recent_result.scalar_one_or_none() or 0

        return {
            "by_status": by_status,
            "total_agent_logs": agent_log_count or 0,
            "recent_24h": recent_count,
        }

    async def get_writing_quality_trends(
        self,
        limit: int = 20,
        chapter_id: int | None = None,
    ) -> dict[str, Any]:
        """Get writing quality trends from AI inspection results.

        Args:
            limit: Maximum number of recent inspection results to analyze.
            chapter_id: Optional chapter ID to filter by.

        Returns:
            Dictionary with quality trend data, severity counts, and dimension scores.
        """
        async with async_session_maker() as session:
            query = select(AIInspectionResult).order_by(
                desc(AIInspectionResult.created_at)
            )
            if chapter_id is not None:
                query = query.where(AIInspectionResult.chapter_id == chapter_id)
            query = query.limit(limit)

            result = await session.execute(query)
            inspections = result.scalars().all()

        if not inspections:
            return {
                "count": 0,
                "trend": [],
                "severity_totals": {},
                "dimension_avg": {},
                "overall_avg": 0.0,
            }

        trend_items: list[dict[str, Any]] = []
        severity_totals: dict[str, int] = {}
        dimension_scores: dict[str, list[float]] = {}
        overall_scores: list[float] = []

        for insp in inspections:
            item: dict[str, Any] = {
                "id": insp.id,
                "chapter_id": insp.chapter_id,
                "inspection_type": insp.inspection_type,
                "created_at": insp.created_at.isoformat() if insp.created_at else None,
                "auto_fixed": bool(insp.auto_fixed),
            }

            # Parse issues_json for severity counts
            severities: dict[str, int] = {}
            if insp.issues_json:
                try:
                    issues = json.loads(insp.issues_json)
                    if isinstance(issues, list):
                        for issue in issues:
                            if isinstance(issue, dict):
                                sev = str(issue.get("severity", "low")).lower()
                                severities[sev] = severities.get(sev, 0) + 1
                    elif isinstance(issues, dict):
                        # Some formats may have severity counts directly
                        for k, v in issues.items():
                            if isinstance(v, int):
                                severities[k.lower()] = severities.get(k.lower(), 0) + v
                except json.JSONDecodeError:
                    pass

            item["severity_counts"] = severities
            for sev, count in severities.items():
                severity_totals[sev] = severity_totals.get(sev, 0) + count

            # Parse suggestions_json for dimension scores
            dimensions: dict[str, float] = {}
            if insp.suggestions_json:
                try:
                    suggestions = json.loads(insp.suggestions_json)
                    if isinstance(suggestions, list):
                        for sug in suggestions:
                            if isinstance(sug, dict):
                                dim = sug.get("dimension") or sug.get("category") or "general"
                                score = sug.get("score")
                                if score is not None:
                                    try:
                                        dimensions[str(dim)] = float(score)
                                    except (TypeError, ValueError):
                                        pass
                    elif isinstance(suggestions, dict):
                        for k, v in suggestions.items():
                            if isinstance(v, (int, float)):
                                dimensions[str(k)] = float(v)
                except json.JSONDecodeError:
                    pass

            item["dimension_scores"] = dimensions
            for dim, score in dimensions.items():
                if dim not in dimension_scores:
                    dimension_scores[dim] = []
                dimension_scores[dim].append(score)

            # Compute overall score from dimensions
            if dimensions:
                overall = sum(dimensions.values()) / len(dimensions)
                item["overall_score"] = round(overall, 1)
                overall_scores.append(overall)
            else:
                item["overall_score"] = None

            trend_items.append(item)

        # Compute dimension averages
        dimension_avg = {}
        for dim, scores in dimension_scores.items():
            if scores:
                dimension_avg[dim] = round(sum(scores) / len(scores), 1)

        return {
            "count": len(trend_items),
            "trend": list(reversed(trend_items)),  # Oldest first
            "severity_totals": severity_totals,
            "dimension_avg": dimension_avg,
            "overall_avg": round(sum(overall_scores) / len(overall_scores), 1)
            if overall_scores else 0.0,
        }

    async def get_historical_system_metrics(self, hours: int = 24) -> list[dict]:
        """Get historical system metrics from persistent storage."""
        return await metrics_service.get_historical_metrics(hours)

    async def get_api_call_stats(
        self,
        window_seconds: float = 3600.0,
    ) -> dict[str, Any]:
        """Get API call statistics from metrics_service.

        Args:
            window_seconds: Time window for aggregation (default 1 hour).

        Returns:
            Dictionary with AI call stats, provider breakdown, and error analysis.
        """
        # Get metrics from metrics_service
        metrics = await metrics_service.get_summary(window_seconds=window_seconds)
        ai_calls = metrics.get("ai_calls", {})

        return {
            "timestamp": datetime.utcnow().isoformat(),
            "window_seconds": window_seconds,
            "ai_calls": ai_calls,
            "summary": {
                "total_calls": ai_calls.get("total", 0),
                "successful": ai_calls.get("success", 0),
                "failed": ai_calls.get("failed", 0),
                "success_rate": ai_calls.get("success_rate", 0.0),
                "avg_latency_ms": ai_calls.get("avg_ms", 0.0),
                "p95_latency_ms": ai_calls.get("p95_ms", 0.0),
                "calls_per_minute": ai_calls.get("per_minute", 0.0),
            },
        }

    async def get_chapter_quality_timeline(
        self,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """Get a timeline of chapter quality scores.

        Returns chapter data with associated inspection scores,
        ordered by chapter order.

        Args:
            limit: Maximum number of chapters to return.
        """
        async with async_session_maker() as session:
            result = await session.execute(
                select(Chapter)
                .order_by(Chapter.chapter_order)
                .limit(limit)
            )
            chapters = result.scalars().all()

        timeline: list[dict[str, Any]] = []
        for ch in chapters:
            # Get latest inspection for this chapter
            async with async_session_maker() as session:
                insp_result = await session.execute(
                    select(AIInspectionResult)
                    .where(AIInspectionResult.chapter_id == ch.id)
                    .order_by(desc(AIInspectionResult.created_at))
                    .limit(1)
                )
                latest_insp = insp_result.scalar_one_or_none()

            quality_score = None
            if latest_insp and latest_insp.suggestions_json:
                try:
                    suggestions = json.loads(latest_insp.suggestions_json)
                    if isinstance(suggestions, dict) and "overall_score" in suggestions:
                        quality_score = float(suggestions["overall_score"])
                    elif isinstance(suggestions, list):
                        scores = [
                            float(s.get("score", 0))
                            for s in suggestions
                            if isinstance(s, dict) and s.get("score") is not None
                        ]
                        if scores:
                            quality_score = round(sum(scores) / len(scores), 1)
                except (json.JSONDecodeError, TypeError, ValueError):
                    pass

            timeline.append({
                "chapter_id": ch.id,
                "chapter_order": ch.chapter_order,
                "title": ch.title,
                "status": ch.status,
                "word_count": ch.word_count,
                "quality_score": quality_score,
                "inspection_count": await self._get_inspection_count_for_chapter(ch.id),
                "updated_at": ch.updated_at.isoformat() if ch.updated_at else None,
            })

        return timeline

    async def _get_inspection_count_for_chapter(self, chapter_id: int) -> int:
        """Get the number of inspections for a chapter."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(func.count())
                .select_from(AIInspectionResult)
                .where(AIInspectionResult.chapter_id == chapter_id)
            )
            return result.scalar_one_or_none() or 0


# Global singleton instance
observability_service = ObservabilityService()
