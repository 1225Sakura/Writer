"""Index debt tracking service.

Tracks "index debt" - chapters that need re-indexing, entities that need re-linking,
and other maintenance tasks that accumulate during writing.

Uses the existing database tables with JSON fields for flexible debt tracking.
Integrates with Chapter, Character, PlotThread, and AIInspectionResult entities.
"""

from __future__ import annotations

import json
from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import select, func, desc, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import async_session_maker
from backend.core.domain import (
    Chapter,
    Character,
    CharacterRelationship,
    PlotThread,
    AIInspectionResult,
    Item,
    Location,
    Faction,
)
from backend.utils.logging import get_logger

logger = get_logger("writer-api.index_debt")


class DebtType(str, Enum):
    """Types of index debt."""
    CHAPTER_REINDEX = "chapter_reindex"
    ENTITY_RELINK = "entity_relink"
    ORPHAN_ENTITY = "orphan_entity"
    MISSING_RELATIONSHIP = "missing_relationship"
    PLOT_THREAD_GAP = "plot_thread_gap"
    INSPECTION_STALE = "inspection_stale"
    WORD_COUNT_MISMATCH = "word_count_mismatch"


class DebtSeverity(str, Enum):
    """Severity levels for debt items."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class DebtStatus(str, Enum):
    """Status of a debt item."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    IGNORED = "ignored"


class IndexDebtTracker:
    """Tracks and manages index debt for the writing project.

    Debt types:
    - CHAPTER_REINDEX: Chapters whose content changed but index wasn't updated
    - ENTITY_RELINK: Entities referenced in chapters but not properly linked
    - ORPHAN_ENTITY: Entities with no references in any chapter
    - MISSING_RELATIONSHIP: Characters without relationship definitions
    - PLOT_THREAD_GAP: Plot threads with large gaps between related chapters
    - INSPECTION_STALE: Chapters without recent AI inspection
    - WORD_COUNT_MISMATCH: Chapters where stored word_count differs from content
    """

    def __init__(self) -> None:
        self._debt_cache: list[dict[str, Any]] | None = None
        self._cache_timestamp: datetime | None = None
        self._cache_ttl_seconds: float = 30.0

    # ------------------------------------------------------------------
    # Debt detection
    # ------------------------------------------------------------------

    async def scan_all_debt(self) -> list[dict[str, Any]]:
        """Scan the entire project for all types of debt.

        Returns:
            List of debt items, each with type, severity, entity info, and description.
        """
        debts: list[dict[str, Any]] = []

        debts.extend(await self._scan_chapter_reindex_debt())
        debts.extend(await self._scan_orphan_entities())
        debts.extend(await self._scan_missing_relationships())
        debts.extend(await self._scan_plot_thread_gaps())
        debts.extend(await self._scan_inspection_stale())
        debts.extend(await self._scan_word_count_mismatch())

        # Sort by severity (critical first)
        severity_order = {
            DebtSeverity.CRITICAL: 0,
            DebtSeverity.HIGH: 1,
            DebtSeverity.MEDIUM: 2,
            DebtSeverity.LOW: 3,
        }
        debts.sort(key=lambda d: severity_order.get(d.get("severity"), 99))

        self._debt_cache = debts
        self._cache_timestamp = datetime.utcnow()
        return debts

    async def _scan_chapter_reindex_debt(self) -> list[dict[str, Any]]:
        """Find chapters that may need re-indexing.

        Chapters with status 'draft' or 'review' that have been updated
        more recently than their last inspection.
        """
        debts: list[dict[str, Any]] = []
        async with async_session_maker() as session:
            result = await session.execute(
                select(Chapter)
                .where(Chapter.status.in_(["draft", "review"]))
                .order_by(desc(Chapter.updated_at))
            )
            chapters = result.scalars().all()

        for ch in chapters:
            # Check if chapter has recent inspection
            async with async_session_maker() as session:
                insp_result = await session.execute(
                    select(AIInspectionResult)
                    .where(AIInspectionResult.chapter_id == ch.id)
                    .order_by(desc(AIInspectionResult.created_at))
                    .limit(1)
                )
                latest_insp = insp_result.scalar_one_or_none()

            needs_reindex = False
            if latest_insp is None:
                needs_reindex = True
                reason = "章节从未进行过AI审查"
            elif ch.updated_at and latest_insp.created_at:
                if ch.updated_at > latest_insp.created_at:
                    needs_reindex = True
                    reason = f"章节在 {ch.updated_at.isoformat()} 更新后未重新审查"

            if needs_reindex:
                debts.append({
                    "id": f"reindex_ch_{ch.id}",
                    "type": DebtType.CHAPTER_REINDEX,
                    "severity": DebtSeverity.MEDIUM,
                    "entity_type": "chapter",
                    "entity_id": ch.id,
                    "entity_name": ch.title or f"第{ch.chapter_order}章",
                    "description": reason,
                    "created_at": datetime.utcnow().isoformat(),
                    "status": DebtStatus.PENDING,
                })

        return debts

    async def _scan_orphan_entities(self) -> list[dict[str, Any]]:
        """Find entities that are not referenced by any chapter or relationship."""
        debts: list[dict[str, Any]] = []

        # Check characters without relationships
        async with async_session_maker() as session:
            result = await session.execute(select(Character))
            characters = result.scalars().all()

        for char in characters:
            async with async_session_maker() as session:
                rel_count = await session.scalar(
                    select(func.count())
                    .select_from(CharacterRelationship)
                    .where(CharacterRelationship.character_id == char.id)
                )

            if not rel_count:
                debts.append({
                    "id": f"orphan_char_{char.id}",
                    "type": DebtType.ORPHAN_ENTITY,
                    "severity": DebtSeverity.LOW,
                    "entity_type": "character",
                    "entity_id": char.id,
                    "entity_name": char.name,
                    "description": f"角色 '{char.name}' 没有定义任何关系",
                    "created_at": datetime.utcnow().isoformat(),
                    "status": DebtStatus.PENDING,
                })

        # Check items without owners
        async with async_session_maker() as session:
            result = await session.execute(
                select(Item).where((Item.owner == None) | (Item.owner == ""))
            )
            orphan_items = result.scalars().all()

        for item in orphan_items:
            debts.append({
                "id": f"orphan_item_{item.id}",
                "type": DebtType.ORPHAN_ENTITY,
                "severity": DebtSeverity.LOW,
                "entity_type": "item",
                "entity_id": item.id,
                "entity_name": item.name,
                "description": f"物品 '{item.name}' 没有指定所有者",
                "created_at": datetime.utcnow().isoformat(),
                "status": DebtStatus.PENDING,
            })

        return debts

    async def _scan_missing_relationships(self) -> list[dict[str, Any]]:
        """Find characters that should have relationships but don't."""
        debts: list[dict[str, Any]] = []

        async with async_session_maker() as session:
            result = await session.execute(select(Character))
            characters = result.scalars().all()

        for char in characters:
            async with async_session_maker() as session:
                rel_count = await session.scalar(
                    select(func.count())
                    .select_from(CharacterRelationship)
                    .where(
                        (CharacterRelationship.character_id == char.id)
                        | (CharacterRelationship.target_id == char.id)
                    )
                )

            if not rel_count:
                debts.append({
                    "id": f"missing_rel_{char.id}",
                    "type": DebtType.MISSING_RELATIONSHIP,
                    "severity": DebtSeverity.LOW,
                    "entity_type": "character",
                    "entity_id": char.id,
                    "entity_name": char.name,
                    "description": f"角色 '{char.name}' 没有任何人际关系定义",
                    "created_at": datetime.utcnow().isoformat(),
                    "status": DebtStatus.PENDING,
                })

        return debts

    async def _scan_plot_thread_gaps(self) -> list[dict[str, Any]]:
        """Find plot threads with large gaps or inconsistencies."""
        debts: list[dict[str, Any]] = []

        async with async_session_maker() as session:
            result = await session.execute(
                select(PlotThread).where(PlotThread.status == "active")
            )
            threads = result.scalars().all()

        for thread in threads:
            # Check if plot thread has both created and reveal chapters
            if thread.created_chapter_id and thread.reveal_chapter_id:
                gap = abs(thread.reveal_chapter_id - thread.created_chapter_id)
                if gap > 50:  # Large gap threshold
                    debts.append({
                        "id": f"thread_gap_{thread.id}",
                        "type": DebtType.PLOT_THREAD_GAP,
                        "severity": DebtSeverity.HIGH if gap > 100 else DebtSeverity.MEDIUM,
                        "entity_type": "plot_thread",
                        "entity_id": thread.id,
                        "entity_name": thread.title,
                        "description": (
                            f"伏笔 '{thread.title}' 从创建到揭示跨越 {gap} 章"
                        ),
                        "created_at": datetime.utcnow().isoformat(),
                        "status": DebtStatus.PENDING,
                        "meta": {
                            "created_chapter": thread.created_chapter_id,
                            "reveal_chapter": thread.reveal_chapter_id,
                            "gap": gap,
                        },
                    })

            # Check if plot thread has no reveal chapter set
            if thread.created_chapter_id and not thread.reveal_chapter_id:
                debts.append({
                    "id": f"thread_noreveal_{thread.id}",
                    "type": DebtType.PLOT_THREAD_GAP,
                    "severity": DebtSeverity.MEDIUM,
                    "entity_type": "plot_thread",
                    "entity_id": thread.id,
                    "entity_name": thread.title,
                    "description": f"伏笔 '{thread.title}' 已创建但未设置揭示章节",
                    "created_at": datetime.utcnow().isoformat(),
                    "status": DebtStatus.PENDING,
                })

        return debts

    async def _scan_inspection_stale(self) -> list[dict[str, Any]]:
        """Find chapters without recent AI inspection."""
        debts: list[dict[str, Any]] = []

        async with async_session_maker() as session:
            result = await session.execute(
                select(Chapter)
                .where(Chapter.status.in_(["published", "review"]))
            )
            chapters = result.scalars().all()

        for ch in chapters:
            async with async_session_maker() as session:
                insp_result = await session.execute(
                    select(AIInspectionResult)
                    .where(AIInspectionResult.chapter_id == ch.id)
                    .order_by(desc(AIInspectionResult.created_at))
                    .limit(1)
                )
                latest_insp = insp_result.scalar_one_or_none()

            if latest_insp is None:
                debts.append({
                    "id": f"stale_insp_{ch.id}",
                    "type": DebtType.INSPECTION_STALE,
                    "severity": DebtSeverity.MEDIUM,
                    "entity_type": "chapter",
                    "entity_id": ch.id,
                    "entity_name": ch.title or f"第{ch.chapter_order}章",
                    "description": f"章节 '{ch.title or '未命名'}' 没有AI审查记录",
                    "created_at": datetime.utcnow().isoformat(),
                    "status": DebtStatus.PENDING,
                })

        return debts

    async def _scan_word_count_mismatch(self) -> list[dict[str, Any]]:
        """Find chapters with suspicious word counts.

        Currently flags chapters with 0 word_count that have content storage.
        """
        debts: list[dict[str, Any]] = []

        async with async_session_maker() as session:
            result = await session.execute(
                select(Chapter)
                .where(
                    (Chapter.word_count == 0)
                    & (Chapter.content_storage_id != None)
                )
            )
            chapters = result.scalars().all()

        for ch in chapters:
            debts.append({
                "id": f"wc_mismatch_{ch.id}",
                "type": DebtType.WORD_COUNT_MISMATCH,
                "severity": DebtSeverity.LOW,
                "entity_type": "chapter",
                "entity_id": ch.id,
                "entity_name": ch.title or f"第{ch.chapter_order}章",
                "description": (
                    f"章节 '{ch.title or '未命名'}' 有内容存储但字数为0，"
                    "可能需要重新统计字数"
                ),
                "created_at": datetime.utcnow().isoformat(),
                "status": DebtStatus.PENDING,
            })

        return debts

    # ------------------------------------------------------------------
    # Debt queries
    # ------------------------------------------------------------------

    async def get_debt_summary(self) -> dict[str, Any]:
        """Get a summary of all debt items grouped by type and severity."""
        debts = await self.scan_all_debt()

        by_type: dict[str, int] = {}
        by_severity: dict[str, int] = {}
        by_status: dict[str, int] = {}

        for debt in debts:
            by_type[debt["type"]] = by_type.get(debt["type"], 0) + 1
            by_severity[debt["severity"]] = by_severity.get(debt["severity"], 0) + 1
            by_status[debt.get("status", DebtStatus.PENDING)] = (
                by_status.get(debt.get("status", DebtStatus.PENDING), 0) + 1
            )

        return {
            "total": len(debts),
            "by_type": by_type,
            "by_severity": by_severity,
            "by_status": by_status,
            "timestamp": datetime.utcnow().isoformat(),
        }

    async def get_debts_by_type(
        self,
        debt_type: DebtType,
        status: DebtStatus | None = None,
    ) -> list[dict[str, Any]]:
        """Get debt items filtered by type and optionally status."""
        debts = await self.scan_all_debt()
        filtered = [d for d in debts if d["type"] == debt_type]
        if status is not None:
            filtered = [d for d in filtered if d.get("status") == status]
        return filtered

    async def get_debts_by_entity(
        self,
        entity_type: str,
        entity_id: int,
    ) -> list[dict[str, Any]]:
        """Get all debt items for a specific entity."""
        debts = await self.scan_all_debt()
        return [
            d for d in debts
            if d.get("entity_type") == entity_type and d.get("entity_id") == entity_id
        ]

    # ------------------------------------------------------------------
    # Debt resolution
    # ------------------------------------------------------------------

    async def resolve_debt(self, debt_id: str) -> dict[str, Any]:
        """Mark a debt item as resolved.

        Args:
            debt_id: The unique ID of the debt item.

        Returns:
            Result with success flag and message.
        """
        debts = await self.scan_all_debt()

        for debt in debts:
            if debt["id"] == debt_id:
                if debt.get("status") == DebtStatus.RESOLVED:
                    return {
                        "success": False,
                        "message": "债务项已经是已解决状态",
                        "debt": debt,
                    }

                debt["status"] = DebtStatus.RESOLVED
                debt["resolved_at"] = datetime.utcnow().isoformat()
                # Invalidate cache since we modified a debt
                self._debt_cache = None
                self._cache_timestamp = None

                logger.info("Debt resolved: %s (%s)", debt_id, debt["type"])
                return {
                    "success": True,
                    "message": "债务项已标记为已解决",
                    "debt": debt,
                }

        return {
            "success": False,
            "message": f"未找到债务项: {debt_id}",
        }

    async def ignore_debt(self, debt_id: str, reason: str = "") -> dict[str, Any]:
        """Mark a debt item as ignored.

        Args:
            debt_id: The unique ID of the debt item.
            reason: Optional reason for ignoring.

        Returns:
            Result with success flag and message.
        """
        debts = await self.scan_all_debt()

        for debt in debts:
            if debt["id"] == debt_id:
                debt["status"] = DebtStatus.IGNORED
                debt["ignored_at"] = datetime.utcnow().isoformat()
                if reason:
                    debt["ignore_reason"] = reason
                self._debt_cache = None
                self._cache_timestamp = None

                logger.info("Debt ignored: %s (%s)", debt_id, debt["type"])
                return {
                    "success": True,
                    "message": "债务项已标记为已忽略",
                    "debt": debt,
                }

        return {
            "success": False,
            "message": f"未找到债务项: {debt_id}",
        }

    async def resolve_debts_by_entity(
        self,
        entity_type: str,
        entity_id: int,
    ) -> dict[str, Any]:
        """Resolve all debt items for a specific entity.

        Returns:
            Result with count of resolved items.
        """
        debts = await self.scan_all_debt()
        resolved_count = 0

        for debt in debts:
            if (
                debt.get("entity_type") == entity_type
                and debt.get("entity_id") == entity_id
                and debt.get("status") != DebtStatus.RESOLVED
            ):
                debt["status"] = DebtStatus.RESOLVED
                debt["resolved_at"] = datetime.utcnow().isoformat()
                resolved_count += 1

        if resolved_count > 0:
            self._debt_cache = None
            self._cache_timestamp = None

        logger.info(
            "Resolved %d debts for %s:%d", resolved_count, entity_type, entity_id
        )
        return {
            "success": True,
            "resolved_count": resolved_count,
            "message": f"已解决 {resolved_count} 个债务项",
        }


# Global singleton instance
index_debt_tracker = IndexDebtTracker()
