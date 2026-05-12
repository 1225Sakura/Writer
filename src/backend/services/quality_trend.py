"""Quality trend reporting service.

Generates quality trend reports including:
- Chapter quality scores over time
- AI inspection checker scores
- Writing quality dimension analysis
- Risk flag detection

Uses existing AIInspectionResult, Chapter, and DraftVersion tables with JSON fields.
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
    AIInspectionResult,
    DraftVersion,
)
from backend.utils.logging import get_logger

logger = get_logger("writer-api.quality_trend")


class QualityTrendService:
    """Generates writing quality trend reports from inspection data.

    Analyzes AIInspectionResult records to produce:
    - Overall quality trends over time
    - Per-dimension score tracking
    - Severity issue tracking
    - Risk flag detection for declining quality
    """

    # Thresholds for risk detection
    OVERALL_SCORE_WARNING = 70.0
    OVERALL_SCORE_CRITICAL = 60.0
    COMPLETION_RATE_WARNING = 0.7
    HIGH_ISSUE_THRESHOLD = 5
    DECLINE_WINDOW_CHAPTERS = 10
    DECLINE_THRESHOLD = 10.0

    async def get_quality_trend_report(
        self,
        limit: int = 20,
        chapter_id: int | None = None,
    ) -> dict[str, Any]:
        """Generate a comprehensive quality trend report.

        Args:
            limit: Number of recent inspections to analyze.
            chapter_id: Optional chapter ID to filter by.

        Returns:
            Report dictionary with trend data, averages, severity counts, and risk flags.
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
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "count": 0,
                "limit": limit,
                "overall_avg": 0.0,
                "trend": [],
                "severity_totals": {},
                "dimension_avg": {},
                "chapter_scores": [],
                "risk_flags": ["暂无质量检查数据"],
            }

        trend_items: list[dict[str, Any]] = []
        severity_totals: dict[str, int] = {}
        dimension_scores: dict[str, list[float]] = {}
        overall_scores: list[float] = []
        chapter_score_map: dict[int, dict[str, Any]] = {}

        for insp in inspections:
            item = self._parse_inspection(insp)
            trend_items.append(item)

            # Accumulate severity counts
            for sev, count in item.get("severity_counts", {}).items():
                severity_totals[sev] = severity_totals.get(sev, 0) + count

            # Accumulate dimension scores
            for dim, score in item.get("dimension_scores", {}).items():
                if dim not in dimension_scores:
                    dimension_scores[dim] = []
                dimension_scores[dim].append(score)

            # Track overall scores
            if item.get("overall_score") is not None:
                overall_scores.append(item["overall_score"])

            # Track per-chapter best score
            ch_id = insp.chapter_id
            if ch_id not in chapter_score_map:
                chapter_score_map[ch_id] = {
                    "chapter_id": ch_id,
                    "best_score": item.get("overall_score"),
                    "inspection_count": 0,
                    "latest_inspection_id": insp.id,
                }
            chapter_score_map[ch_id]["inspection_count"] += 1
            if item.get("overall_score") is not None:
                current_best = chapter_score_map[ch_id]["best_score"]
                if current_best is None or item["overall_score"] > current_best:
                    chapter_score_map[ch_id]["best_score"] = item["overall_score"]

        # Compute dimension averages
        dimension_avg = {}
        for dim, scores in dimension_scores.items():
            if scores:
                dimension_avg[dim] = round(sum(scores) / len(scores), 1)

        # Compute overall average
        overall_avg = round(sum(overall_scores) / len(overall_scores), 1) if overall_scores else 0.0

        # Build chapter scores list (sorted by chapter_id)
        chapter_scores = sorted(chapter_score_map.values(), key=lambda x: x["chapter_id"])

        # Detect risk flags
        risk_flags = self._detect_risk_flags(
            overall_avg=overall_avg,
            severity_totals=severity_totals,
            dimension_avg=dimension_avg,
            chapter_scores=chapter_scores,
            trend_items=trend_items,
        )

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "count": len(trend_items),
            "limit": limit,
            "overall_avg": overall_avg,
            "trend": list(reversed(trend_items)),  # Oldest first
            "severity_totals": severity_totals,
            "dimension_avg": dimension_avg,
            "chapter_scores": chapter_scores,
            "risk_flags": risk_flags,
        }

    def _parse_inspection(self, insp: AIInspectionResult) -> dict[str, Any]:
        """Parse an AIInspectionResult into a structured quality item."""
        item: dict[str, Any] = {
            "id": insp.id,
            "chapter_id": insp.chapter_id,
            "inspection_type": insp.inspection_type,
            "created_at": insp.created_at.isoformat() if insp.created_at else None,
            "auto_fixed": bool(insp.auto_fixed),
            "severity_counts": {},
            "dimension_scores": {},
            "overall_score": None,
        }

        # Parse issues_json
        if insp.issues_json:
            try:
                issues = json.loads(insp.issues_json)
                if isinstance(issues, list):
                    for issue in issues:
                        if isinstance(issue, dict):
                            sev = str(issue.get("severity", "low")).lower()
                            item["severity_counts"][sev] = item["severity_counts"].get(sev, 0) + 1
                elif isinstance(issues, dict):
                    for k, v in issues.items():
                        if isinstance(v, int):
                            item["severity_counts"][k.lower()] = item["severity_counts"].get(k.lower(), 0) + v
            except json.JSONDecodeError:
                pass

        # Parse suggestions_json for scores
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
                                    item["dimension_scores"][str(dim)] = float(score)
                                except (TypeError, ValueError):
                                    pass
                elif isinstance(suggestions, dict):
                    for k, v in suggestions.items():
                        if isinstance(v, (int, float)):
                            item["dimension_scores"][str(k)] = float(v)
                        elif isinstance(v, dict) and "score" in v:
                            try:
                                item["dimension_scores"][str(k)] = float(v["score"])
                            except (TypeError, ValueError):
                                pass
            except json.JSONDecodeError:
                pass

        # Compute overall score
        if item["dimension_scores"]:
            item["overall_score"] = round(
                sum(item["dimension_scores"].values()) / len(item["dimension_scores"]), 1
            )

        return item

    def _detect_risk_flags(
        self,
        overall_avg: float,
        severity_totals: dict[str, int],
        dimension_avg: dict[str, float],
        chapter_scores: list[dict[str, Any]],
        trend_items: list[dict[str, Any]],
    ) -> list[str]:
        """Detect quality risk flags based on trend analysis."""
        flags: list[str] = []

        # Overall score warning
        if overall_avg > 0:
            if overall_avg < self.OVERALL_SCORE_CRITICAL:
                flags.append(
                    f"整体质量评分严重偏低（{overall_avg:.1f}分），"
                    "建议全面回顾近期章节"
                )
            elif overall_avg < self.OVERALL_SCORE_WARNING:
                flags.append(
                    f"整体质量评分偏低（{overall_avg:.1f}分），"
                    "建议关注低分章节"
                )

        # Critical issues
        critical_count = severity_totals.get("critical", 0)
        if critical_count > 0:
            flags.append(
                f"发现 {critical_count} 个严重(critical)问题，建议设为最高修复优先级"
            )

        # High issues
        high_count = severity_totals.get("high", 0)
        if high_count >= self.HIGH_ISSUE_THRESHOLD:
            flags.append(
                f"高级别问题累计 {high_count} 个，建议做批量修复专项"
            )

        # Low dimension scores
        for dim, avg in dimension_avg.items():
            if avg < self.OVERALL_SCORE_CRITICAL:
                flags.append(
                    f"维度 '{dim}' 平均分严重偏低（{avg:.1f}分）"
                )
            elif avg < self.OVERALL_SCORE_WARNING:
                flags.append(
                    f"维度 '{dim}' 平均分偏低（{avg:.1f}分）"
                )

        # Declining trend detection
        if len(chapter_scores) >= self.DECLINE_WINDOW_CHAPTERS:
            recent = chapter_scores[-self.DECLINE_WINDOW_CHAPTERS:]
            recent_scores = [
                s["best_score"] for s in recent
                if s.get("best_score") is not None
            ]
            if len(recent_scores) >= 5:
                first_half = recent_scores[: len(recent_scores) // 2]
                second_half = recent_scores[len(recent_scores) // 2:]
                if first_half and second_half:
                    first_avg = sum(first_half) / len(first_half)
                    second_avg = sum(second_half) / len(second_half)
                    if first_avg - second_avg > self.DECLINE_THRESHOLD:
                        flags.append(
                            f"近期质量呈下降趋势（前段平均{first_avg:.1f}分 "
                            f"vs 后段平均{second_avg:.1f}分）"
                        )

        if not flags:
            flags.append("近期质量指标整体稳定，暂无高优先级风险")

        return flags

    async def get_chapter_quality_score(self, chapter_id: int) -> dict[str, Any] | None:
        """Get the latest quality score for a specific chapter.

        Args:
            chapter_id: The chapter ID to query.

        Returns:
            Quality score data or None if no inspections exist.
        """
        async with async_session_maker() as session:
            result = await session.execute(
                select(AIInspectionResult)
                .where(AIInspectionResult.chapter_id == chapter_id)
                .order_by(desc(AIInspectionResult.created_at))
                .limit(1)
            )
            latest = result.scalar_one_or_none()

        if not latest:
            return None

        item = self._parse_inspection(latest)

        # Get chapter info
        async with async_session_maker() as session:
            ch_result = await session.execute(
                select(Chapter).where(Chapter.id == chapter_id)
            )
            chapter = ch_result.scalar_one_or_none()

        return {
            "chapter_id": chapter_id,
            "chapter_title": chapter.title if chapter else None,
            "chapter_order": chapter.chapter_order if chapter else None,
            "inspection_id": latest.id,
            "inspection_type": latest.inspection_type,
            "overall_score": item.get("overall_score"),
            "dimension_scores": item.get("dimension_scores"),
            "severity_counts": item.get("severity_counts"),
            "created_at": latest.created_at.isoformat() if latest.created_at else None,
        }

    async def get_dimension_trend(
        self,
        dimension: str,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """Get trend data for a specific quality dimension.

        Args:
            dimension: The dimension name to track.
            limit: Maximum number of data points.

        Returns:
            List of {chapter_id, score, created_at} data points.
        """
        async with async_session_maker() as session:
            result = await session.execute(
                select(AIInspectionResult)
                .order_by(desc(AIInspectionResult.created_at))
                .limit(limit * 2)  # Fetch more to filter
            )
            inspections = result.scalars().all()

        trend: list[dict[str, Any]] = []
        for insp in inspections:
            item = self._parse_inspection(insp)
            dim_score = item.get("dimension_scores", {}).get(dimension)
            if dim_score is not None:
                trend.append({
                    "chapter_id": insp.chapter_id,
                    "inspection_id": insp.id,
                    "score": dim_score,
                    "created_at": insp.created_at.isoformat() if insp.created_at else None,
                })
            if len(trend) >= limit:
                break

        return list(reversed(trend))

    async def get_comparison_report(
        self,
        chapter_ids: list[int],
    ) -> dict[str, Any]:
        """Compare quality scores across multiple chapters.

        Args:
            chapter_ids: List of chapter IDs to compare.

        Returns:
            Comparison report with per-chapter scores and aggregate stats.
        """
        chapters_data: list[dict[str, Any]] = []
        all_dimensions: set[str] = set()

        for ch_id in chapter_ids:
            score_data = await self.get_chapter_quality_score(ch_id)
            if score_data:
                chapters_data.append(score_data)
                all_dimensions.update(score_data.get("dimension_scores", {}).keys())

        if not chapters_data:
            return {
                "chapter_ids": chapter_ids,
                "count": 0,
                "chapters": [],
                "dimension_comparison": {},
            }

        # Build dimension comparison matrix
        dimension_comparison: dict[str, list[dict[str, Any]]] = {}
        for dim in sorted(all_dimensions):
            dimension_comparison[dim] = []
            for ch in chapters_data:
                dim_scores = ch.get("dimension_scores", {})
                dimension_comparison[dim].append({
                    "chapter_id": ch["chapter_id"],
                    "chapter_title": ch.get("chapter_title"),
                    "score": dim_scores.get(dim),
                })

        return {
            "chapter_ids": chapter_ids,
            "count": len(chapters_data),
            "chapters": chapters_data,
            "dimension_comparison": dimension_comparison,
        }


# Global singleton instance
quality_trend_service = QualityTrendService()
