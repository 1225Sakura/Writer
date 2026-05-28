# Auto Novel Writer - WorldSetting Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of WorldSettingRepositoryInterface

import json
from collections import defaultdict
from typing import List, Optional, Dict, Any
from sqlalchemy import select

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.world_setting.interfaces import WorldSettingRepositoryInterface
from backend.core.domain.entities import WorldSetting


class SQLAlchemyWorldSettingRepository(SQLAlchemyBaseRepository[WorldSetting], WorldSettingRepositoryInterface):
    """SQLAlchemy implementation of WorldSetting repository."""

    def __init__(self, db):
        super().__init__(db, WorldSetting)

    async def get_hierarchy(self, project_id: int) -> List[Dict[str, Any]]:
        """Group world settings by their first tag as category."""
        result = await self.db.execute(
            select(WorldSetting).where(WorldSetting.project_id == project_id)
        )
        settings = list(result.scalars().all())
        groups: Dict[str, List[WorldSetting]] = defaultdict(list)
        for s in settings:
            category = "uncategorized"
            if s.tags:
                try:
                    tags = json.loads(s.tags)
                    if isinstance(tags, list) and tags:
                        category = tags[0]
                except (json.JSONDecodeError, TypeError):
                    category = s.tags.split(",")[0].strip() if s.tags else "uncategorized"
            groups[category].append(s)
        return [
            {"category": cat, "settings": items}
            for cat, items in sorted(groups.items())
        ]

    async def get_by_category(self, category: str, project_id: Optional[int] = None) -> List[WorldSetting]:
        stmt = select(WorldSetting)
        if project_id is not None:
            stmt = stmt.where(WorldSetting.project_id == project_id)
        result = await self.db.execute(stmt)
        all_settings = list(result.scalars().all())
        # Filter by category in tags
        matched = []
        for s in all_settings:
            if not s.tags:
                continue
            try:
                tags = json.loads(s.tags)
                if isinstance(tags, list) and category in tags:
                    matched.append(s)
            except (json.JSONDecodeError, TypeError):
                if category in (s.tags or ""):
                    matched.append(s)
        return matched
