"""Invention Registry - Tracks new entities invented in generated content (Law 3).

Detects characters, locations, items, factions, and rules that appear
in the text but are not registered in the database. These are flagged
as potential hallucinations unless explicitly allowed.
"""

from __future__ import annotations

import re
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.domain import (
    Character,
    Faction,
    Item,
    Location,
    Rule,
)
from backend.services.constraints.core import (
    ConstraintViolation,
    LawType,
    Severity,
)


class InventionRegistry:
    """Tracks new entities invented in generated content (Law 3).

    Detects characters, locations, items, factions, and rules that appear
    in the text but are not registered in the database. These are flagged
    as potential hallucinations unless explicitly allowed.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def scan_for_new_entities(
        self,
        content: str,
        project_id: Optional[int] = None,
    ) -> list[ConstraintViolation]:
        """Scan content for entities not present in the database.

        Returns a list of violations for unregistered entities.
        """
        violations: list[ConstraintViolation] = []
        if not content:
            return violations

        # Load all registered entities for the project
        registered = await self._load_registered_entities(project_id)

        # Detect potential new entities using heuristics
        detected = self._detect_entities(content)

        for entity_type, entity_name in detected:
            if not self._is_registered(entity_name, entity_type, registered):
                violations.append(ConstraintViolation(
                    rule_id=f"invention_{entity_type}_{entity_name}",
                    law_type=LawType.INVENTION_REGISTRATION,
                    severity=Severity.MEDIUM,
                    message=f"检测到未注册的新{self._entity_type_name(entity_type)}: '{entity_name}'",
                    evidence=self._extract_evidence(content, entity_name),
                    suggestion=f"请在设定编辑界面注册此{self._entity_type_name(entity_type)}，或确认其为已有实体的别名",
                ))

        return violations

    async def _load_registered_entities(
        self,
        project_id: Optional[int] = None,
    ) -> dict[str, set[str]]:
        """Load all registered entity names from the database."""
        registered: dict[str, set[str]] = {
            "character": set(),
            "location": set(),
            "item": set(),
            "faction": set(),
            "rule": set(),
        }

        # Characters
        stmt = select(Character.name)
        if project_id is not None:
            stmt = stmt.where(Character.project_id == project_id)
        result = await self._db.execute(stmt)
        for row in result.scalars().all():
            if row:
                registered["character"].add(row.strip())

        # Locations
        stmt = select(Location.name)
        if project_id is not None:
            stmt = stmt.where(Location.project_id == project_id)
        result = await self._db.execute(stmt)
        for row in result.scalars().all():
            if row:
                registered["location"].add(row.strip())

        # Items
        stmt = select(Item.name)
        if project_id is not None:
            stmt = stmt.where(Item.project_id == project_id)
        result = await self._db.execute(stmt)
        for row in result.scalars().all():
            if row:
                registered["item"].add(row.strip())

        # Factions
        stmt = select(Faction.name)
        if project_id is not None:
            stmt = stmt.where(Faction.project_id == project_id)
        result = await self._db.execute(stmt)
        for row in result.scalars().all():
            if row:
                registered["faction"].add(row.strip())

        # Rules
        stmt = select(Rule.name)
        if project_id is not None:
            stmt = stmt.where(Rule.project_id == project_id)
        result = await self._db.execute(stmt)
        for row in result.scalars().all():
            if row:
                registered["rule"].add(row.strip())

        return registered

    def _detect_entities(self, content: str) -> list[tuple[str, str]]:
        """Detect potential entity mentions in content.

        Uses heuristic patterns to find names that might be new entities.
        Returns list of (entity_type, entity_name) tuples.
        """
        detected: list[tuple[str, str]] = []

        # Character detection: "名叫XXX", "XXX说道", "XXX微微一笑"
        char_patterns = [
            r"名叫[\"']?([^\"'，。！？\n]{2,8})[\"']?",
            r"([^\s。，！？]{2,4})(?:说道|回答|点头|摇头|微笑|皱眉|冷笑)",
            r"([一-龥]{2,4})的(?:目光|眼神|声音|身影|手|剑|刀)",
        ]
        char_names: set[str] = set()
        for pattern in char_patterns:
            for match in re.finditer(pattern, content):
                name = match.group(1).strip()
                if len(name) >= 2 and not self._is_common_word(name):
                    char_names.add(name)
        for name in char_names:
            detected.append(("character", name))

        # Location detection: "来到XXX", "在XXX", "前往XXX"
        loc_patterns = [
            r"(?:来到|前往|抵达|进入|离开|在)(?:了)?[\"']?([^\"'，。！？\n]{2,10})[\"']?(?:中|里|上|下|内|外)?",
            r"([一-龥]{2,6})(?:深处|入口|出口|大殿|密室|山谷|森林|城池|宗门)",
        ]
        loc_names: set[str] = set()
        for pattern in loc_patterns:
            for match in re.finditer(pattern, content):
                name = match.group(1).strip()
                if len(name) >= 2 and not self._is_common_word(name):
                    loc_names.add(name)
        for name in loc_names:
            detected.append(("location", name))

        # Item detection: "XXX剑", "XXX丹", "XXX法宝"
        item_patterns = [
            r"([一-龥]{2,6})(?:剑|刀|枪|棍|鞭|扇|鼎|炉|丹|药|符|阵|法宝|灵器|神器|秘籍|功法)",
            r"(?:取出|拿出|取出|祭出|使用)[\"']?([^\"'，。！？\n]{2,8})[\"']?",
        ]
        item_names: set[str] = set()
        for pattern in item_patterns:
            for match in re.finditer(pattern, content):
                name = match.group(1).strip()
                if len(name) >= 2 and not self._is_common_word(name):
                    item_names.add(name)
        for name in item_names:
            detected.append(("item", name))

        # Faction detection: "XXX宗", "XXX门", "XXX派"
        faction_patterns = [
            r"([一-龥]{2,6})(?:宗|门|派|教|盟|会|族|家|阁|殿|宫|谷|山庄|学院|军团)",
            r"(?:加入|投靠|背叛|隶属于)[\"']?([^\"'，。！？\n]{2,8})[\"']?",
        ]
        faction_names: set[str] = set()
        for pattern in faction_patterns:
            for match in re.finditer(pattern, content):
                name = match.group(1).strip()
                if len(name) >= 2 and not self._is_common_word(name):
                    faction_names.add(name)
        for name in faction_names:
            detected.append(("faction", name))

        return detected

    def _is_registered(
        self,
        name: str,
        entity_type: str,
        registered: dict[str, set[str]],
    ) -> bool:
        """Check if an entity name is registered."""
        names = registered.get(entity_type, set())
        if name in names:
            return True
        # Fuzzy match: check if any registered name contains this name or vice versa
        for reg_name in names:
            if name in reg_name or reg_name in name:
                return True
        return False

    def _is_common_word(self, word: str) -> bool:
        """Check if a word is a common Chinese word, not a proper noun."""
        common_words = {
            "自己", "对方", "众人", "大家", "有人", "无人", "此人", "那人",
            "这里", "那里", "哪里", "何处", "此时", "此刻", "当年", "今日",
            "手中", "身上", "心中", "眼前", "耳边", "背后", "面前", "脚下",
            "忽然", "突然", "猛然", "骤然", "顿时", "立刻", "马上", "随即",
            "虽然", "但是", "因为", "所以", "如果", "那么", "不仅", "而且",
            "一个", "两个", "三个", "一些", "这些", "那些", "什么", "怎么",
            "看着", "望着", "盯着", "瞧着", "听着", "想着", "感觉", "发现",
            "知道", "明白", "觉得", "认为", "以为", "记得", "忘记", "想起",
            "微微", "轻轻", "缓缓", "慢慢", "迅速", "快速", "猛然", "狠狠",
            "一声", "一下", "一番", "一道", "一股", "一片", "一团", "一丝",
        }
        return word in common_words

    def _extract_evidence(self, content: str, entity_name: str) -> str:
        """Extract a text snippet containing the entity mention."""
        idx = content.find(entity_name)
        if idx == -1:
            return ""
        start = max(0, idx - 30)
        end = min(len(content), idx + len(entity_name) + 30)
        return content[start:end].replace("\n", " ")

    def _entity_type_name(self, entity_type: str) -> str:
        names = {
            "character": "角色",
            "location": "地点",
            "item": "物品",
            "faction": "势力",
            "rule": "规则",
        }
        return names.get(entity_type, entity_type)
