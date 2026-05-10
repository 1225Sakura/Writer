"""Constraint Engine - Unified constraint management for the Three Anti-Hallucination Laws.

Laws:
1. 大纲即法律 (Outline is Law) - generated content must follow outline
2. 设定即物理 (Setting is Physics) - content must obey world settings
3. 发明需识别 (Invention Requires Registration) - new entities must be tracked

This module provides:
- ConstraintEngine: Unified engine that orchestrates all three law enforcers
"""

from __future__ import annotations

import json
import logging
import re
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
    AIInspectionResult,
)
from backend.agents.checkers import (
    OutlineLawEnforcer,
    SettingPhysicsEnforcer,
    CheckerResult,
)
from backend.core.services.ai.ai_service import AIService
from backend.services.constraints.core import (
    ConstraintCheckResult,
    ConstraintRule,
    ConstraintViolation,
    LawType,
    RuleStatus,
    Severity,
)
from backend.services.constraints.conflict_detector import ConflictDetector
from backend.services.constraints.invention_registry import InventionRegistry


logger = logging.getLogger(__name__)


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
    # Public API: DSL parsing and validation
    # ------------------------------------------------------------------

    async def parse_dsl(self, dsl_content: str) -> list[ConstraintRule]:
        """Parse DSL content (YAML/JSON) into ConstraintRule objects.

        Args:
            dsl_content: YAML or JSON string containing rule definitions.

        Returns:
            List of parsed ConstraintRule objects.

        Raises:
            DSLValidationError: If the DSL content is invalid.
        """
        from backend.services.constraint_dsl import ConstraintDSLCParser
        parser = ConstraintDSLCParser()
        rules = parser.parse(dsl_content)
        logger.info("Parsed %d rules from DSL", len(rules))
        return rules

    async def validate_dsl(self, dsl_content: str) -> tuple[bool, list[str]]:
        """Validate DSL content without parsing.

        Args:
            dsl_content: YAML or JSON string containing rule definitions.

        Returns:
            Tuple of (is_valid, error_messages).
        """
        from backend.services.constraint_dsl import ConstraintDSLCParser
        parser = ConstraintDSLCParser()
        return parser.validate(dsl_content)

    async def validate_rule(self, rule: ConstraintRule) -> bool:
        """Validate a constraint rule for correctness.

        Args:
            rule: The ConstraintRule to validate.

        Returns:
            True if the rule is valid, False otherwise.
        """
        from backend.services.constraint_dsl import ConditionParser

        if not rule.id:
            logger.warning("Rule validation failed: missing rule ID")
            return False

        if not rule.name:
            logger.warning("Rule %s validation failed: missing name", rule.id)
            return False

        # Validate conditions in metadata
        conditions_data = rule.metadata.get("conditions", [])
        if conditions_data:
            conditions = ConditionParser.parse_all(conditions_data)
            for cond in conditions:
                errors = cond.validate()
                if errors:
                    logger.warning(
                        "Rule %s condition validation failed: %s",
                        rule.id,
                        errors
                    )
                    return False

        return True

    async def generate_violation_report(
        self,
        violations: list[ConstraintViolation],
        format: str = "text",
    ) -> str:
        """Generate a human-readable violation report.

        Args:
            violations: List of ConstraintViolation objects.
            format: Output format - "text" or "json".

        Returns:
            Formatted violation report string.
        """
        if format == "json":
            return json.dumps(
                [v.to_dict() for v in violations],
                ensure_ascii=False,
                indent=2
            )

        if not violations:
            return "约束检查通过，未发现违规。"

        # Group violations by law type and severity
        by_law: dict[str, list[ConstraintViolation]] = {}
        by_severity: dict[Severity, int] = {}

        for v in violations:
            law_key = v.law_type.value
            if law_key not in by_law:
                by_law[law_key] = []
            by_law[law_key].append(v)

            by_severity[v.severity] = by_severity.get(v.severity, 0) + 1

        # Build report
        lines = [
            "=" * 60,
            "约束违规报告",
            "=" * 60,
            f"总计违规: {len(violations)} 处",
            "",
        ]

        # Summary by severity
        lines.append("【严重程度分布】")
        severity_order = [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO]
        for sev in severity_order:
            count = by_severity.get(sev, 0)
            if count > 0:
                lines.append(f"  {sev.value}: {count} 处")

        lines.append("")

        # Summary by law type
        lines.append("【违规类型分布】")
        law_names = {
            "outline_law": "大纲即法律",
            "setting_physics": "设定即物理",
            "invention_registration": "发明需识别",
        }
        for law_key, law_violations in by_law.items():
            law_name = law_names.get(law_key, law_key)
            lines.append(f"  {law_name}: {len(law_violations)} 处")

        lines.append("")

        # Detailed violations
        lines.append("【违规详情】")
        for idx, v in enumerate(violations, 1):
            lines.append(f"\n--- 违规 {idx} ---")
            lines.append(f"规则ID: {v.rule_id}")
            lines.append(f"严重程度: {v.severity.value}")
            lines.append(f"法律类型: {law_names.get(v.law_type.value, v.law_type.value)}")
            lines.append(f"违规信息: {v.message}")
            if v.evidence:
                lines.append(f"证据: {v.evidence}")
            if v.location:
                lines.append(f"位置: {v.location}")
            if v.suggestion:
                lines.append(f"建议: {v.suggestion}")

        lines.append("")
        lines.append("=" * 60)

        return "\n".join(lines)

    async def real_time_validate(
        self,
        content: str,
        rules: Optional[list[ConstraintRule]] = None,
        chapter_id: Optional[int] = None,
        project_id: Optional[int] = None,
    ) -> ConstraintCheckResult:
        """Real-time validation of content as it is being written.

        This is optimized for quick feedback during the writing process.

        Args:
            content: The text content to validate.
            rules: Optional list of rules to check. If None, uses stored rules.
            chapter_id: Optional chapter ID for context.
            project_id: Optional project ID for context.

        Returns:
            ConstraintCheckResult with any violations found.
        """
        from backend.services.constraint_dsl import ConditionParser

        violations: list[ConstraintViolation] = []
        rules_checked: list[str] = []

        # Use provided rules or fetch from database
        if rules is None:
            rules = await self.get_rules(status=RuleStatus.ACTIVE)

        # Build context
        context = await self._build_context(chapter_id, project_id, None)
        context["current_chapter"] = chapter_id or 0

        # Check each rule
        for rule in rules:
            if rule.status != RuleStatus.ACTIVE:
                continue

            rules_checked.append(rule.id)

            # Check pattern-based rules first (quick)
            if rule.pattern:
                matches = list(re.finditer(rule.pattern, content))
                for match in matches[:3]:
                    violations.append(ConstraintViolation(
                        rule_id=rule.id,
                        law_type=rule.law_type,
                        severity=rule.severity,
                        message=rule.description,
                        evidence=match.group(0),
                        location=f"position {match.start()}",
                        suggestion=f"违反规则: {rule.name}",
                    ))

            # Check condition-based rules
            conditions_data = rule.metadata.get("conditions", [])
            if conditions_data:
                conditions = ConditionParser.parse_all(conditions_data)
                for cond in conditions:
                    cond_violations = cond.check(content, context)
                    violations.extend(cond_violations)

        # Compute score
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
