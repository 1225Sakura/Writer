"""Observability API routes.

Provides endpoints for system metrics, debt tracking, quality trends,
and comprehensive project status reporting.

Endpoints:
- GET  /observability/metrics       : System metrics (runtime + DB)
- GET  /observability/debt          : Index debt summary and items
- POST /observability/debt/resolve  : Resolve a debt item
- GET  /observability/trends        : Writing quality trends
- GET  /observability/status        : Comprehensive project status report
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from backend.middleware.auth import require_auth
from backend.services.observability import observability_service
from backend.services.index_debt_tracker import (
    index_debt_tracker,
    DebtType,
    DebtStatus,
)
from backend.services.quality_trend import quality_trend_service
from backend.services.status_reporter import status_reporter

router = APIRouter(prefix="/observability", tags=["observability"])


# ------------------------------------------------------------------
# Request/Response Models
# ------------------------------------------------------------------

class ResolveDebtRequest(BaseModel):
    """Request to resolve a debt item."""
    debt_id: str = Field(..., description="The unique ID of the debt item to resolve")


class ResolveDebtResponse(BaseModel):
    """Response for debt resolution."""
    success: bool
    message: str
    debt: dict[str, Any] | None = None


class IgnoreDebtRequest(BaseModel):
    """Request to ignore a debt item."""
    debt_id: str = Field(..., description="The unique ID of the debt item to ignore")
    reason: str = Field(default="", description="Optional reason for ignoring")


# ------------------------------------------------------------------
# Metrics Endpoints
# ------------------------------------------------------------------

@router.get(
    "/metrics",
    dependencies=[require_auth],
    summary="获取系统指标",
    description="返回系统运行时指标和数据库实体统计，包括请求延迟、AI调用率、实体数量等。",
)
async def get_observability_metrics(
    window_seconds: int = Query(default=300, ge=10, le=3600),
) -> dict[str, Any]:
    """Get combined system and database metrics.

    Args:
        window_seconds: Time window for runtime metrics (10-3600s, default 300s).

    Returns:
        Dictionary with runtime metrics, entity counts, chapter stats,
        inspection stats, and workflow stats.
    """
    return await observability_service.get_system_metrics(
        window_seconds=window_seconds
    )


# ------------------------------------------------------------------
# Debt Endpoints
# ------------------------------------------------------------------

@router.get(
    "/debt",
    dependencies=[require_auth],
    summary="获取索引债务列表",
    description="扫描并返回所有索引债务项，包括章节需重索引、实体需重链接、孤立实体等。",
)
async def get_debt_items(
    debt_type: str | None = Query(default=None, description="按债务类型过滤"),
    status: str | None = Query(default=None, description="按状态过滤 (pending/in_progress/resolved/ignored)"),
    entity_type: str | None = Query(default=None, description="按实体类型过滤"),
    entity_id: int | None = Query(default=None, description="按实体ID过滤"),
) -> dict[str, Any]:
    """Get index debt items with optional filtering.

    Args:
        debt_type: Filter by debt type (e.g., chapter_reindex, orphan_entity).
        status: Filter by status.
        entity_type: Filter by entity type (chapter, character, item, etc.).
        entity_id: Filter by specific entity ID.

    Returns:
        Dictionary with debt summary and filtered items.
    """
    debts = await index_debt_tracker.scan_all_debt()

    # Apply filters
    if debt_type:
        debts = [d for d in debts if d.get("type") == debt_type]
    if status:
        debts = [d for d in debts if d.get("status") == status]
    if entity_type:
        debts = [d for d in debts if d.get("entity_type") == entity_type]
    if entity_id is not None:
        debts = [d for d in debts if d.get("entity_id") == entity_id]

    summary = await index_debt_tracker.get_debt_summary()

    return {
        "summary": summary,
        "items": debts,
        "filtered_count": len(debts),
    }


@router.post(
    "/debt/resolve",
    dependencies=[require_auth],
    summary="解决债务项",
    description="将指定的债务项标记为已解决。",
)
async def resolve_debt(request: ResolveDebtRequest) -> ResolveDebtResponse:
    """Resolve a specific debt item.

    Args:
        request: Contains the debt_id to resolve.

    Returns:
        Result with success flag and updated debt item.
    """
    result = await index_debt_tracker.resolve_debt(request.debt_id)
    return ResolveDebtResponse(
        success=result["success"],
        message=result["message"],
        debt=result.get("debt"),
    )


@router.post(
    "/debt/ignore",
    dependencies=[require_auth],
    summary="忽略债务项",
    description="将指定的债务项标记为已忽略，可附带原因。",
)
async def ignore_debt(request: IgnoreDebtRequest) -> ResolveDebtResponse:
    """Ignore a specific debt item.

    Args:
        request: Contains the debt_id and optional reason.

    Returns:
        Result with success flag and updated debt item.
    """
    result = await index_debt_tracker.ignore_debt(
        request.debt_id, reason=request.reason
    )
    return ResolveDebtResponse(
        success=result["success"],
        message=result["message"],
        debt=result.get("debt"),
    )


@router.post(
    "/debt/resolve-by-entity",
    dependencies=[require_auth],
    summary="按实体解决所有债务",
    description="解决指定实体的所有待处理债务项。",
)
async def resolve_debts_by_entity(
    entity_type: str = Query(..., description="实体类型"),
    entity_id: int = Query(..., description="实体ID"),
) -> dict[str, Any]:
    """Resolve all debt items for a specific entity.

    Args:
        entity_type: Type of entity (chapter, character, etc.).
        entity_id: ID of the entity.

    Returns:
        Result with count of resolved items.
    """
    return await index_debt_tracker.resolve_debts_by_entity(entity_type, entity_id)


# ------------------------------------------------------------------
# Trends Endpoints
# ------------------------------------------------------------------

@router.get(
    "/trends",
    dependencies=[require_auth],
    summary="获取质量趋势报告",
    description="返回写作质量趋势分析，包括AI审查评分、维度均分、严重问题统计和风险提示。",
)
async def get_quality_trends(
    limit: int = Query(default=20, ge=1, le=100),
    chapter_id: int | None = Query(default=None, description="按章节ID过滤"),
) -> dict[str, Any]:
    """Get writing quality trend report.

    Args:
        limit: Maximum number of inspections to analyze (1-100, default 20).
        chapter_id: Optional chapter ID to filter by.

    Returns:
        Quality trend report with scores, severity counts, dimension averages,
        and risk flags.
    """
    return await quality_trend_service.get_quality_trend_report(
        limit=limit, chapter_id=chapter_id
    )


@router.get(
    "/trends/chapter/{chapter_id}",
    dependencies=[require_auth],
    summary="获取章节质量评分",
    description="返回指定章节的最新质量评分详情。",
)
async def get_chapter_quality(chapter_id: int) -> dict[str, Any] | None:
    """Get quality score for a specific chapter.

    Args:
        chapter_id: The chapter ID to query.

    Returns:
        Chapter quality data or None if no inspections exist.
    """
    return await quality_trend_service.get_chapter_quality_score(chapter_id)


@router.get(
    "/trends/dimension/{dimension}",
    dependencies=[require_auth],
    summary="获取维度趋势",
    description="返回指定质量维度的历史趋势数据。",
)
async def get_dimension_trend(
    dimension: str,
    limit: int = Query(default=20, ge=1, le=100),
) -> list[dict[str, Any]]:
    """Get trend data for a specific quality dimension.

    Args:
        dimension: The dimension name to track (e.g., plot, character, style).
        limit: Maximum number of data points (1-100, default 20).

    Returns:
        List of {chapter_id, score, created_at} data points.
    """
    return await quality_trend_service.get_dimension_trend(dimension, limit=limit)


@router.post(
    "/trends/compare",
    dependencies=[require_auth],
    summary="对比章节质量",
    description="对比多个章节的质量评分，返回维度对比矩阵。",
)
async def compare_chapter_quality(chapter_ids: list[int]) -> dict[str, Any]:
    """Compare quality scores across multiple chapters.

    Args:
        chapter_ids: List of chapter IDs to compare.

    Returns:
        Comparison report with per-chapter scores and dimension matrix.
    """
    return await quality_trend_service.get_comparison_report(chapter_ids)


# ------------------------------------------------------------------
# Status Endpoints
# ------------------------------------------------------------------

@router.get(
    "/status",
    dependencies=[require_auth],
    summary="获取项目综合状态报告",
    description="返回全面的项目健康报告，包括基本统计、角色活跃度、伏笔状态、写作进度、质量概览和近期活动。",
)
async def get_project_status() -> dict[str, Any]:
    """Get comprehensive project status report.

    Returns:
        Full status report with health score, statistics, character activity,
        plot thread status, writing progress, quality overview, and recent activity.
    """
    return await status_reporter.generate_status_report()


@router.get(
    "/status/quick",
    dependencies=[require_auth],
    summary="获取快速状态摘要",
    description="返回简化的项目状态，适合仪表盘显示。",
)
async def get_quick_status() -> dict[str, Any]:
    """Get a quick one-line status summary.

    Returns:
        Simplified status with chapter count, word count, pending items,
        and 24h activity.
    """
    return await status_reporter.get_quick_status()
