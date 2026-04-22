"""Writing Constraint Engine - Unified constraint management for the Three Anti-Hallucination Laws.

Laws:
1. 大纲即法律 (Outline is Law) - generated content must follow outline
2. 设定即物理 (Setting is Physics) - content must obey world settings
3. 发明需识别 (Invention Requires Registration) - new entities must be tracked

This module provides:
- ConstraintRule: Data model for a single constraint rule
- ConstraintViolation: Data model for detected violations
- ConstraintEngine: Unified engine that orchestrates all three law enforcers
- ConflictDetector: Detects conflicts between rules and content
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.domain import (
    Chapter,
    DraftVersion,
    Outline,
    Character,
    WorldSetting,
    Rule,
    Location,
    Item,
    Faction,
    PlotThread,
    AIInspectionResult,
)
from backend.agents.checkers import (
    OutlineLawEnforcer,
    SettingPhysicsEnforcer,
    CheckerResult,
)
from backend.core.services.ai.ai_service import AIService


class Severity(str, Enum):
    """Violation severity levels."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class LawType(str, Enum):
    """The three anti-hallucination laws."""

    OUTLINE_LAW = "outline_law"          # 大纲即法律
    SETTING_PHYSICS = "setting_physics"  # 设定即物理
    INVENTION_REGISTRATION = "invention_registration"  # 发明需识别


class RuleStatus(str, Enum):
    """Constraint rule status."""

    ACTIVE = "active"
    DISABLED = "disabled"
    DEPRECATED = "deprecated"


@dataclass
class ConstraintRule:
    """A single constraint rule definition.

    Rules can be auto-extracted from settings or manually defined.
    They are stored as JSON in the database (via AIInspectionResult
    or a dedicated JSON field).
    """

    id: str
    law_type: LawType
    name: str
    description: str
    pattern: Optional[str] = None          # Regex pattern for quick detection
    severity: Severity = Severity.HIGH
    status: RuleStatus = RuleStatus.ACTIVE
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "law_type": self.law_type.value,
            "name": self.name,
            "description": self.description,
            "pattern": self.pattern,
            "severity": self.severity.value,
            "status": self.status.value,
            "metadata": self.metadata,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ConstraintRule:
        return cls(
            id=data["id"],
            law_type=LawType(data.get("law_type", "outline_law")),
            name=data["name"],
            description=data.get("description", ""),
            pattern=data.get("pattern"),
            severity=Severity(data.get("severity", "high")),
            status=RuleStatus(data.get("status", "active")),
            metadata=data.get("metadata", {}),
            created_at=data.get("created_at", datetime.utcnow().isoformat()),
        )


@dataclass
class ConstraintViolation:
    """A detected constraint violation."""

    rule_id: str
    law_type: LawType
    severity: Severity
    message: str
    evidence: str = ""                     # Text snippet showing the violation
    location: Optional[str] = None         # Where in the text (e.g., "paragraph 3")
    suggestion: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "rule_id": self.rule_id,
            "law_type": self.law_type.value,
            "severity": self.severity.value,
            "message": self.message,
            "evidence": self.evidence,
            "location": self.location,
            "suggestion": self.suggestion,
            "metadata": self.metadata,
        }


@dataclass
class ConstraintCheckResult:
    """Result of a full constraint check."""

    passed: bool
    overall_score: int                     # 0-100
    violations: list[ConstraintViolation] = field(default_factory=list)
    rules_checked: list[str] = field(default_factory=list)
    summary: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "passed": self.passed,
            "overall_score": self.overall_score,
            "violations": [v.to_dict() for v in self.violations],
            "rules_checked": self.rules_checked,
            "summary": self.summary,
            "metadata": self.metadata,
        }


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


class ConflictDetector:
    """Detects conflicts between rules and generated content.

    Performs both pattern-based and semantic conflict detection.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def detect_conflicts(
        self,
        content: str,
        rules: list[ConstraintRule],
    ) -> list[ConstraintViolation]:
        """Check content against a list of constraint rules.

        Returns violations for any rules that are broken.
        """
        violations: list[ConstraintViolation] = []
        if not content:
            return violations

        for rule in rules:
            if rule.status != RuleStatus.ACTIVE:
                continue

            # Pattern-based detection
            if rule.pattern:
                matches = list(re.finditer(rule.pattern, content))
                if matches:
                    for match in matches[:3]:  # Limit to first 3 matches
                        violations.append(ConstraintViolation(
                            rule_id=rule.id,
                            law_type=rule.law_type,
                            severity=rule.severity,
                            message=rule.description,
                            evidence=match.group(0),
                            location=f"position {match.start()}",
                            suggestion=f"违反规则: {rule.name}",
                        ))

        return violations

    async def detect_outline_conflicts(
        self,
        content: str,
        outline_id: Optional[int] = None,
    ) -> list[ConstraintViolation]:
        """Detect conflicts between content and outline constraints.

        Extracts implicit constraints from the outline and checks them.
        """
        violations: list[ConstraintViolation] = []
        if not outline_id:
            return violations

        result = await self._db.execute(
            select(Outline).where(Outline.id == outline_id)
        )
        outline = result.scalar_one_or_none()
        if not outline or not outline.description:
            return violations

        # Extract character death prohibitions from outline
        death_prohibitions = self._extract_death_prohibitions(outline.description)
        for char_name in death_prohibitions:
            if self._character_dies_in_content(char_name, content):
                violations.append(ConstraintViolation(
                    rule_id=f"outline_no_death_{char_name}",
                    law_type=LawType.OUTLINE_LAW,
                    severity=Severity.CRITICAL,
                    message=f"大纲禁止角色'{char_name}'死亡，但正文中出现了死亡描写",
                    evidence=self._extract_death_evidence(char_name, content),
                    suggestion="请修改剧情，确保该角色存活，或先修改大纲",
                ))

        # Extract plot point requirements
        required_plot_points = self._extract_required_plot_points(outline.description)
        for point in required_plot_points:
            if not self._plot_point_present(point, content):
                violations.append(ConstraintViolation(
                    rule_id=f"outline_required_plot_{point}",
                    law_type=LawType.OUTLINE_LAW,
                    severity=Severity.HIGH,
                    message=f"大纲要求本章包含剧情点'{point}'，但未在正文中检测到",
                    suggestion="请补充该剧情点，或调整大纲要求",
                ))

        return violations

    def _extract_death_prohibitions(self, outline_text: str) -> list[str]:
        """Extract character names that must not die from outline text."""
        prohibitions: list[str] = []
        patterns = [
            r"([^，。！？\n]{2,6})(?:不能死|不可死|不得死|禁止死亡|不会死|不应死)",
            r"(?:保证|确保|维持)([^，。！？\n]{2,6})(?:存活|活着|不死)",
        ]
        for pattern in patterns:
            for match in re.finditer(pattern, outline_text):
                name = match.group(1).strip()
                if len(name) >= 2:
                    prohibitions.append(name)
        return prohibitions

    def _character_dies_in_content(self, char_name: str, content: str) -> bool:
        """Check if a character dies in the content."""
        death_patterns = [
            rf"{re.escape(char_name)}[^。！？]{{0,15}}(?:死了|死亡|陨落|牺牲|阵亡|毙命|断气|身亡|殒命)",
            rf"(?:死了|死亡|陨落|牺牲)的[^。！？]{{0,10}}{re.escape(char_name)}",
        ]
        for pattern in death_patterns:
            if re.search(pattern, content):
                return True
        return False

    def _extract_death_evidence(self, char_name: str, content: str) -> str:
        """Extract evidence of character death."""
        death_patterns = [
            rf"{re.escape(char_name)}[^。！？]{{0,15}}(?:死了|死亡|陨落|牺牲|阵亡|毙命|断气|身亡|殒命)",
        ]
        for pattern in death_patterns:
            match = re.search(pattern, content)
            if match:
                return match.group(0)
        return ""

    def _extract_required_plot_points(self, outline_text: str) -> list[str]:
        """Extract plot points that must appear from outline text."""
        points: list[str] = []
        patterns = [
            r"(?:本章|本回|此章).*?(?:需要|必须|应当|要).*?(?:写|描写|展现|出现)([^，。！？\n]{3,20})",
            r"(?:剧情点|关键节点|高潮|转折)(?:：|:)([^，。！？\n]{3,20})",
        ]
        for pattern in patterns:
            for match in re.finditer(pattern, outline_text):
                point = match.group(1).strip()
                if len(point) >= 3:
                    points.append(point)
        return points

    def _plot_point_present(self, point: str, content: str) -> bool:
        """Check if a plot point is present in content (fuzzy match)."""
        # Direct substring match
        if point in content:
            return True
        # Keyword match: at least 2 keywords from the point appear
        keywords = [w for w in point if len(w) >= 2]
        if len(keywords) >= 2:
            matches = sum(1 for kw in keywords if kw in content)
            return matches >= max(2, len(keywords) // 2)
        return False


class ConstraintEngine:
    """Unified constraint management engine.

    Orchestrates the three anti-hallucination laws:
    1. Outline Law Enforcer (大纲即法律)
    2. Setting Physics Enforcer (设定即物理)
    3. Invention Registry (发明需识别)

    Provides both quick_scan (heuristic) and deep_analyze (AI-powered) modes.
    """

    # Score thresholds
    PASS_THRESHOLD = 70
    CRITICAL_THRESHOLD = 40

    def __init__(
        self,
        db: AsyncSession,
        ai_service: Optional[AIService] = None,
    ) -> None:
        self._db = db
        self._ai_service = ai_service
        self._outline_enforcer = OutlineLawEnforcer(ai_service)
        self._physics_enforcer = SettingPhysicsEnforcer(ai_service)
        self._invention_registry = InventionRegistry(db)
        self._conflict_detector = ConflictDetector(db)

    # ------------------------------------------------------------------
    # Public API: Quick scan
    # ------------------------------------------------------------------

    async def quick_scan(
        self,
        content: str,
        chapter_id: Optional[int] = None,
        project_id: Optional[int] = None,
        outline_id: Optional[int] = None,
    ) -> ConstraintCheckResult:
        """Run quick heuristic scan for all three laws.

        This is fast and does not require AI calls.
        """
        violations: list[ConstraintViolation] = []
        rules_checked: list[str] = []

        # Law 1: Outline Law (quick scan)
        outline_result = await self._outline_enforcer.quick_scan(content)
        for issue in outline_result.issues:
            violations.append(self._checker_issue_to_violation(
                issue, LawType.OUTLINE_LAW
            ))
        rules_checked.append("outline_law_quick")

        # Law 2: Setting Physics (quick scan)
        physics_result = await self._physics_enforcer.quick_scan(content)
        for issue in physics_result.issues:
            violations.append(self._checker_issue_to_violation(
                issue, LawType.SETTING_PHYSICS
            ))
        rules_checked.append("setting_physics_quick")

        # Law 3: Invention Registration
        invention_violations = await self._invention_registry.scan_for_new_entities(
            content, project_id
        )
        violations.extend(invention_violations)
        rules_checked.append("invention_registration")

        # Additional: outline conflict detection
        if outline_id:
            outline_conflicts = await self._conflict_detector.detect_outline_conflicts(
                content, outline_id
            )
            violations.extend(outline_conflicts)
            rules_checked.append("outline_conflict_detection")

        # Compute overall score
        overall_score = self._compute_score(violations)
        passed = overall_score >= self.PASS_THRESHOLD

        # Build summary
        summary = self._build_summary(violations, overall_score)

        return ConstraintCheckResult(
            passed=passed,
            overall_score=overall_score,
            violations=violations,
            rules_checked=rules_checked,
            summary=summary,
        )

    # ------------------------------------------------------------------
    # Public API: Deep analyze
    # ------------------------------------------------------------------

    async def deep_analyze(
        self,
        content: str,
        chapter_id: Optional[int] = None,
        project_id: Optional[int] = None,
        outline_id: Optional[int] = None,
    ) -> ConstraintCheckResult:
        """Run deep AI-powered analysis for all three laws.

        This may invoke AI calls and is more thorough.
        """
        # Build context from database
        context = await self._build_context(chapter_id, project_id, outline_id)

        violations: list[ConstraintViolation] = []
        rules_checked: list[str] = []

        # Law 1: Outline Law (deep analyze)
        outline_result = await self._outline_enforcer.deep_analyze(content, context)
        for issue in outline_result.issues:
            violations.append(self._checker_issue_to_violation(
                issue, LawType.OUTLINE_LAW
            ))
        rules_checked.append("outline_law_deep")

        # Law 2: Setting Physics (deep analyze)
        physics_result = await self._physics_enforcer.deep_analyze(content, context)
        for issue in physics_result.issues:
            violations.append(self._checker_issue_to_violation(
                issue, LawType.SETTING_PHYSICS
            ))
        rules_checked.append("setting_physics_deep")

        # Law 3: Invention Registration (same as quick scan)
        invention_violations = await self._invention_registry.scan_for_new_entities(
            content, project_id
        )
        violations.extend(invention_violations)
        rules_checked.append("invention_registration")

        # Additional: outline conflict detection
        if outline_id:
            outline_conflicts = await self._conflict_detector.detect_outline_conflicts(
                content, outline_id
            )
            violations.extend(outline_conflicts)
            rules_checked.append("outline_conflict_detection")

        # Compute overall score
        overall_score = self._compute_score(violations)
        passed = overall_score >= self.PASS_THRESHOLD

        # Build summary
        summary = self._build_summary(violations, overall_score)

        # Store result in database
        await self._store_result(
            chapter_id=chapter_id,
            result=ConstraintCheckResult(
                passed=passed,
                overall_score=overall_score,
                violations=violations,
                rules_checked=rules_checked,
                summary=summary,
            ),
        )

        return ConstraintCheckResult(
            passed=passed,
            overall_score=overall_score,
            violations=violations,
            rules_checked=rules_checked,
            summary=summary,
        )

    # ------------------------------------------------------------------
    # Public API: Enforce
    # ------------------------------------------------------------------

    async def enforce(
        self,
        content: str,
        chapter_id: Optional[int] = None,
        project_id: Optional[int] = None,
        outline_id: Optional[int] = None,
        mode: str = "quick",
    ) -> ConstraintCheckResult:
        """Run constraint check and return result.

        Args:
            content: The text content to check.
            chapter_id: Optional chapter ID for context lookup.
            project_id: Optional project ID for entity lookup.
            outline_id: Optional outline ID for outline law checking.
            mode: "quick" or "deep".

        Returns:
            ConstraintCheckResult with violations and score.
        """
        if mode == "deep":
            return await self.deep_analyze(content, chapter_id, project_id, outline_id)
        return await self.quick_scan(content, chapter_id, project_id, outline_id)

    # ------------------------------------------------------------------
    # Public API: Rule management
    # ------------------------------------------------------------------

    async def get_rules(
        self,
        law_type: Optional[LawType] = None,
        status: Optional[RuleStatus] = None,
    ) -> list[ConstraintRule]:
        """Get all constraint rules, optionally filtered.

        Rules are stored as AIInspectionResult records with inspection_type='constraint_rule'.
        """
        stmt = select(AIInspectionResult).where(
            AIInspectionResult.inspection_type == "constraint_rule"
        )
        result = await self._db.execute(stmt)
        rules: list[ConstraintRule] = []

        for record in result.scalars().all():
            try:
                data = json.loads(record.issues_json or "{}")
                if isinstance(data, dict) and "rules" in data:
                    for rule_data in data["rules"]:
                        rule = ConstraintRule.from_dict(rule_data)
                        if law_type and rule.law_type != law_type:
                            continue
                        if status and rule.status != status:
                            continue
                        rules.append(rule)
                elif isinstance(data, dict) and "id" in data:
                    rule = ConstraintRule.from_dict(data)
                    if law_type and rule.law_type != law_type:
                        continue
                    if status and rule.status != status:
                        continue
                    rules.append(rule)
            except (json.JSONDecodeError, KeyError, ValueError):
                continue

        return rules

    async def add_rule(self, rule: ConstraintRule) -> ConstraintRule:
        """Add a new constraint rule.

        Stores the rule as an AIInspectionResult with inspection_type='constraint_rule'.
        """
        record = AIInspectionResult(
            project_id=None,
            chapter_id=0,  # 0 means global rule
            inspection_type="constraint_rule",
            issues_json=json.dumps(rule.to_dict(), ensure_ascii=False),
            suggestions_json=json.dumps(["自定义约束规则"], ensure_ascii=False),
        )
        self._db.add(record)
        await self._db.commit()
        return rule

    async def delete_rule(self, rule_id: str) -> bool:
        """Delete a constraint rule by ID."""
        stmt = select(AIInspectionResult).where(
            AIInspectionResult.inspection_type == "constraint_rule"
        )
        result = await self._db.execute(stmt)

        for record in result.scalars().all():
            try:
                data = json.loads(record.issues_json or "{}")
                if isinstance(data, dict):
                    if data.get("id") == rule_id:
                        await self._db.delete(record)
                        await self._db.commit()
                        return True
                    if "rules" in data:
                        for rule_data in data["rules"]:
                            if rule_data.get("id") == rule_id:
                                await self._db.delete(record)
                                await self._db.commit()
                                return True
            except (json.JSONDecodeError, KeyError):
                continue

        return False

    # ------------------------------------------------------------------
    # Public API: Violation history
    # ------------------------------------------------------------------

    async def get_violations(
        self,
        chapter_id: Optional[int] = None,
        law_type: Optional[LawType] = None,
        severity: Optional[Severity] = None,
        limit: int = 100,
    ) -> list[ConstraintViolation]:
        """Get historical violations from stored inspection results.

        Looks up AIInspectionResult records with inspection_type='constraint_check'.
        """
        stmt = select(AIInspectionResult).where(
            AIInspectionResult.inspection_type == "constraint_check"
        )
        if chapter_id is not None:
            stmt = stmt.where(AIInspectionResult.chapter_id == chapter_id)
        stmt = stmt.order_by(AIInspectionResult.created_at.desc()).limit(limit)

        result = await self._db.execute(stmt)
        violations: list[ConstraintViolation] = []

        for record in result.scalars().all():
            try:
                data = json.loads(record.issues_json or "{}")
                if isinstance(data, list):
                    for vdata in data:
                        v = ConstraintViolation(
                            rule_id=vdata.get("rule_id", "unknown"),
                            law_type=LawType(vdata.get("law_type", "outline_law")),
                            severity=Severity(vdata.get("severity", "medium")),
                            message=vdata.get("message", ""),
                            evidence=vdata.get("evidence", ""),
                            location=vdata.get("location"),
                            suggestion=vdata.get("suggestion", ""),
                        )
                        if law_type and v.law_type != law_type:
                            continue
                        if severity and v.severity != severity:
                            continue
                        violations.append(v)
                elif isinstance(data, dict) and "violations" in data:
                    for vdata in data["violations"]:
                        v = ConstraintViolation(
                            rule_id=vdata.get("rule_id", "unknown"),
                            law_type=LawType(vdata.get("law_type", "outline_law")),
                            severity=Severity(vdata.get("severity", "medium")),
                            message=vdata.get("message", ""),
                            evidence=vdata.get("evidence", ""),
                            location=vdata.get("location"),
                            suggestion=vdata.get("suggestion", ""),
                        )
                        if law_type and v.law_type != law_type:
                            continue
                        if severity and v.severity != severity:
                            continue
                        violations.append(v)
            except (json.JSONDecodeError, KeyError, ValueError):
                continue

        return violations

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _build_context(
        self,
        chapter_id: Optional[int],
        project_id: Optional[int],
        outline_id: Optional[int],
    ) -> dict[str, Any]:
        """Build analysis context from database."""
        context: dict[str, Any] = {}

        if chapter_id:
            result = await self._db.execute(
                select(Chapter).where(Chapter.id == chapter_id)
            )
            chapter = result.scalar_one_or_none()
            if chapter:
                context["chapter"] = {
                    "id": chapter.id,
                    "title": chapter.title,
                    "summary": chapter.summary,
                }
                outline_id = outline_id or chapter.outline_id

            result = await self._db.execute(
                select(DraftVersion)
                .where(DraftVersion.chapter_id == chapter_id)
                .order_by(DraftVersion.version_number.desc())
            )
            draft = result.scalar_one_or_none()
            context["chapter_content"] = draft.content if draft else ""

        if outline_id:
            result = await self._db.execute(
                select(Outline).where(Outline.id == outline_id)
            )
            outline = result.scalar_one_or_none()
            if outline:
                context["outline"] = {
                    "id": outline.id,
                    "title": outline.title,
                    "description": outline.description,
                }

        # World settings
        stmt = select(WorldSetting)
        if project_id is not None:
            stmt = stmt.where(WorldSetting.project_id == project_id)
        result = await self._db.execute(stmt)
        world_settings = result.scalars().all()
        context["world_settings"] = [
            {"id": ws.id, "name": ws.name, "description": ws.description}
            for ws in world_settings
        ]

        # Rules
        stmt = select(Rule)
        if project_id is not None:
            stmt = stmt.where(Rule.project_id == project_id)
        result = await self._db.execute(stmt)
        rules = result.scalars().all()
        context["rules"] = [
            {"id": r.id, "name": r.name, "description": r.description, "type": r.type}
            for r in rules
        ]

        # Characters
        stmt = select(Character)
        if project_id is not None:
            stmt = stmt.where(Character.project_id == project_id)
        result = await self._db.execute(stmt)
        characters = result.scalars().all()
        context["characters"] = [
            {
                "id": c.id,
                "name": c.name,
                "gender": c.gender,
                "personality": c.personality,
                "cultivation_realm": c.cultivation_realm,
            }
            for c in characters
        ]

        # Previous chapters
        if chapter_id and outline_id:
            result = await self._db.execute(
                select(Chapter)
                .where(
                    Chapter.outline_id == outline_id,
                    Chapter.id < chapter_id,
                )
                .order_by(Chapter.chapter_order.desc())
                .limit(3)
            )
            prev_chapters = result.scalars().all()
            context["previous_chapters"] = [
                {"id": c.id, "title": c.title, "summary": c.summary}
                for c in prev_chapters
            ]

        # Power system detection
        result = await self._db.execute(
            select(func.count(Character.id)).where(Character.cultivation_realm.isnot(None))
        )
        has_cultivation = result.scalar() or 0
        if has_cultivation > 0:
            context["power_system"] = {
                "type": "cultivation",
                "note": f"检测到{has_cultivation}个角色有修为等级设定",
            }

        return context

    def _checker_issue_to_violation(
        self,
        issue: dict[str, Any],
        law_type: LawType,
    ) -> ConstraintViolation:
        """Convert a checker issue dict to a ConstraintViolation."""
        severity_map = {
            "critical": Severity.CRITICAL,
            "high": Severity.HIGH,
            "medium": Severity.MEDIUM,
            "low": Severity.LOW,
        }
        sev_str = issue.get("severity", "medium")
        severity = severity_map.get(sev_str, Severity.MEDIUM)

        return ConstraintViolation(
            rule_id=issue.get("type", "unknown"),
            law_type=law_type,
            severity=severity,
            message=issue.get("message", ""),
            evidence=issue.get("evidence", issue.get("details", "")),
            suggestion=issue.get("suggestion", ""),
        )

    def _compute_score(self, violations: list[ConstraintViolation]) -> int:
        """Compute overall score from violations."""
        if not violations:
            return 100

        score = 100
        severity_penalties = {
            Severity.CRITICAL: 25,
            Severity.HIGH: 15,
            Severity.MEDIUM: 8,
            Severity.LOW: 3,
            Severity.INFO: 0,
        }

        for v in violations:
            score -= severity_penalties.get(v.severity, 5)

        return max(0, score)

    def _build_summary(
        self,
        violations: list[ConstraintViolation],
        score: int,
    ) -> str:
        """Build a human-readable summary of the check result."""
        if not violations:
            return "所有约束检查通过，未发现违规。"

        by_law: dict[str, int] = {}
        by_severity: dict[str, int] = {}
        for v in violations:
            by_law[v.law_type.value] = by_law.get(v.law_type.value, 0) + 1
            by_severity[v.severity.value] = by_severity.get(v.severity.value, 0) + 1

        parts = [f"约束检查完成，综合得分: {score}/100。"]
        parts.append(f"共发现 {len(violations)} 处违规:")

        for law, count in sorted(by_law.items()):
            law_names = {
                "outline_law": "大纲即法律",
                "setting_physics": "设定即物理",
                "invention_registration": "发明需识别",
            }
            parts.append(f"  - {law_names.get(law, law)}: {count}处")

        critical = by_severity.get("critical", 0)
        high = by_severity.get("high", 0)
        if critical > 0:
            parts.append(f"警告: 存在 {critical} 处严重违规，必须修正！")
        elif high > 0:
            parts.append(f"注意: 存在 {high} 处高风险违规，建议修正。")

        return " ".join(parts)

    async def _store_result(
        self,
        chapter_id: Optional[int],
        result: ConstraintCheckResult,
    ) -> None:
        """Store check result in the database."""
        if chapter_id is None:
            return

        record = AIInspectionResult(
            project_id=None,
            chapter_id=chapter_id,
            inspection_type="constraint_check",
            issues_json=json.dumps(
                [v.to_dict() for v in result.violations],
                ensure_ascii=False,
            ),
            suggestions_json=json.dumps(
                [v.suggestion for v in result.violations if v.suggestion],
                ensure_ascii=False,
            ),
        )
        self._db.add(record)
        await self._db.commit()
