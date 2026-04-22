# Auto Novel Writer - Startup Preload Service
# Preloads hot data into TieredCache at application startup

import time
import logging
from typing import Any, Optional

from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from database import async_session_maker
from core.domain.entities import (
    WorldSetting,
    Character,
    Outline,
    Chapter,
    WritingSettings,
    Rule,
    Item,
    Location,
    Faction,
)
from services.tiered_cache import TieredCache
from services.cache_service import get_cache_service

logger = logging.getLogger(__name__)


class PreloadService:
    """Service that preloads frequently accessed data into cache at startup.

    Preloaded data:
      - Writing settings (human_ai_ratio, writing_style, etc.)
      - Recent chapters (summary + status)
      - Active outlines
      - Main characters
      - World settings, rules, items, locations, factions
    """

    # Number of recent chapters to preload
    RECENT_CHAPTERS_LIMIT: int = 20

    def __init__(self, tiered_cache: Optional[TieredCache] = None) -> None:
        self._tiered_cache = tiered_cache
        self._stats: dict[str, Any] = {
            "started_at": None,
            "completed_at": None,
            "elapsed_ms": 0.0,
            "total_items": 0,
            "categories": {},
            "errors": [],
        }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def preload_all(self) -> dict[str, Any]:
        """Run all preload routines and return summary statistics."""
        self._stats["started_at"] = time.time()
        logger.info("Starting preload service...")

        await self._safe_preload("settings", self.preload_settings)
        await self._safe_preload("recent_chapters", self.preload_recent_chapters)
        await self._safe_preload("active_outlines", self.preload_active_outlines)
        await self._safe_preload("characters", self.preload_characters)
        await self._safe_preload("world_settings", self.preload_world_settings)
        await self._safe_preload("rules", self.preload_rules)
        await self._safe_preload("items", self.preload_items)
        await self._safe_preload("locations", self.preload_locations)
        await self._safe_preload("factions", self.preload_factions)

        elapsed = (time.time() - self._stats["started_at"]) * 1000
        self._stats["completed_at"] = time.time()
        self._stats["elapsed_ms"] = round(elapsed, 2)

        logger.info(
            "Preload complete: %d items in %.2f ms",
            self._stats["total_items"],
            elapsed,
        )
        return self.get_preload_summary()

    def get_preload_summary(self) -> dict[str, Any]:
        """Return current preload statistics."""
        return {
            "status": "completed" if self._stats["completed_at"] else "in_progress",
            "elapsed_ms": self._stats["elapsed_ms"],
            "total_items": self._stats["total_items"],
            "categories": self._stats["categories"],
            "errors": self._stats["errors"],
        }

    # ------------------------------------------------------------------
    # Individual preload routines
    # ------------------------------------------------------------------

    async def preload_settings(self) -> int:
        """Load all writing settings into cache."""
        count = 0
        async with async_session_maker() as session:
            result = await session.execute(select(WritingSettings))
            for setting in result.scalars().all():
                key = f"writing_settings:{setting.id}"
                data = {
                    "id": setting.id,
                    "project_id": setting.project_id,
                    "human_ai_ratio": setting.human_ai_ratio,
                    "writing_style": setting.writing_style,
                    "target_word_count": setting.target_word_count,
                }
                self._cache_set("writing_settings", key, data, ttl=600)
                count += 1
        return count

    async def preload_recent_chapters(self) -> int:
        """Load the most recent N chapters (summary + status) into cache."""
        count = 0
        async with async_session_maker() as session:
            result = await session.execute(
                select(Chapter)
                .order_by(desc(Chapter.updated_at))
                .limit(self.RECENT_CHAPTERS_LIMIT)
            )
            for chapter in result.scalars().all():
                key = f"chapter:{chapter.id}"
                data = {
                    "id": chapter.id,
                    "project_id": chapter.project_id,
                    "outline_id": chapter.outline_id,
                    "title": chapter.title,
                    "summary": chapter.summary,
                    "status": chapter.status,
                    "word_count": chapter.word_count,
                    "chapter_order": chapter.chapter_order,
                    "updated_at": chapter.updated_at.isoformat() if chapter.updated_at else None,
                }
                self._cache_set("chapter", key, data, ttl=300)
                count += 1
        return count

    async def preload_active_outlines(self) -> int:
        """Load all active outlines (with chapter counts) into cache."""
        count = 0
        async with async_session_maker() as session:
            result = await session.execute(
                select(Outline).options(selectinload(Outline.chapters))
            )
            for outline in result.scalars().all():
                key = f"outline:{outline.id}"
                data = {
                    "id": outline.id,
                    "project_id": outline.project_id,
                    "title": outline.title,
                    "description": outline.description,
                    "chapter_count": len(outline.chapters) if outline.chapters else 0,
                }
                self._cache_set("outline", key, data, ttl=300)
                count += 1
        return count

    async def preload_characters(self) -> int:
        """Load main characters into cache."""
        count = 0
        async with async_session_maker() as session:
            result = await session.execute(
                select(Character).options(selectinload(Character.storylines))
            )
            for char in result.scalars().all():
                key = f"character:{char.id}"
                data = {
                    "id": char.id,
                    "project_id": char.project_id,
                    "name": char.name,
                    "gender": char.gender,
                    "personality": char.personality,
                    "desires": char.desires,
                    "flaws": char.flaws,
                    "description": char.description,
                    "tier": char.tier,
                    "cultivation_realm": char.cultivation_realm,
                    "storyline_count": len(char.storylines) if char.storylines else 0,
                }
                self._cache_set("character", key, data, ttl=300)
                count += 1
        return count

    async def preload_world_settings(self) -> int:
        """Load world settings into cache."""
        count = 0
        async with async_session_maker() as session:
            result = await session.execute(select(WorldSetting))
            for ws in result.scalars().all():
                key = f"world_setting:{ws.id}"
                data = {
                    "id": ws.id,
                    "project_id": ws.project_id,
                    "name": ws.name,
                    "description": ws.description,
                    "details_json": ws.details_json,
                }
                self._cache_set("world_setting", key, data, ttl=600)
                count += 1
        return count

    async def preload_rules(self) -> int:
        """Load rules into cache."""
        count = 0
        async with async_session_maker() as session:
            result = await session.execute(select(Rule))
            for rule in result.scalars().all():
                key = f"rule:{rule.id}"
                data = {
                    "id": rule.id,
                    "project_id": rule.project_id,
                    "name": rule.name,
                    "description": rule.description,
                    "type": rule.type,
                }
                self._cache_set("rule", key, data, ttl=300)
                count += 1
        return count

    async def preload_items(self) -> int:
        """Load items into cache."""
        count = 0
        async with async_session_maker() as session:
            result = await session.execute(select(Item))
            for item in result.scalars().all():
                key = f"item:{item.id}"
                data = {
                    "id": item.id,
                    "project_id": item.project_id,
                    "name": item.name,
                    "description": item.description,
                    "owner": item.owner,
                    "location": item.location,
                }
                self._cache_set("item", key, data, ttl=300)
                count += 1
        return count

    async def preload_locations(self) -> int:
        """Load locations into cache."""
        count = 0
        async with async_session_maker() as session:
            result = await session.execute(select(Location))
            for loc in result.scalars().all():
                key = f"location:{loc.id}"
                data = {
                    "id": loc.id,
                    "project_id": loc.project_id,
                    "name": loc.name,
                    "description": loc.description,
                    "importance": loc.importance,
                }
                self._cache_set("location", key, data, ttl=300)
                count += 1
        return count

    async def preload_factions(self) -> int:
        """Load factions into cache."""
        count = 0
        async with async_session_maker() as session:
            result = await session.execute(select(Faction))
            for faction in result.scalars().all():
                key = f"faction:{faction.id}"
                data = {
                    "id": faction.id,
                    "project_id": faction.project_id,
                    "name": faction.name,
                    "description": faction.description,
                    "type": faction.type,
                }
                self._cache_set("faction", key, data, ttl=300)
                count += 1
        return count

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _safe_preload(self, name: str, coro) -> None:
        """Run a preload coroutine safely, recording stats and errors."""
        try:
            count = await coro()
            self._stats["categories"][name] = {"count": count, "error": None}
            self._stats["total_items"] += count
            logger.debug("Preloaded %d %s", count, name)
        except Exception as exc:
            error_msg = f"{name}: {exc}"
            self._stats["errors"].append(error_msg)
            self._stats["categories"][name] = {"count": 0, "error": str(exc)}
            logger.warning("Preload failed for %s: %s", name, exc)

    def _cache_set(self, entity_type: str, key: str, value: Any, ttl: int) -> None:
        """Store value in cache_service (and optionally TieredCache)."""
        get_cache_service().set(entity_type, key, value, ttl=ttl)
        if self._tiered_cache is not None:
            try:
                self._tiered_cache.set(key, value, ttl=ttl, tier="l1")
            except Exception:
                pass


# Singleton instance
preload_service = PreloadService()
