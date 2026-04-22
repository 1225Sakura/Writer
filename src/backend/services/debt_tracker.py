# -*- coding: utf-8 -*-
"""
Narrative Debt Tracker Service

Tracks "narrative debts" — promises made to the reader that have not yet been fulfilled.
This includes:
- Plot promises (剧情承诺): setup events that require payoff
- Character arcs (角色弧线): character development threads
- Mystery threads (谜题线索): questions raised but not answered
- Foreshadowing (伏笔): hints dropped that need resolution

Uses existing PlotThread table + JSON fields for storage.
"""

import re
import json
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum
from datetime import datetime


class DebtType(str, Enum):
    """Types of narrative debt."""
    PLOT_PROMISE = "plot_promise"       # 剧情承诺
    CHARACTER_ARC = "character_arc"     # 角色弧线
    MYSTERY = "mystery"                 # 谜题线索
    FORESHADOWING = "foreshadowing"     # 伏笔
    RELATIONSHIP = "relationship"       # 关系线
    WORLD_BUILDING = "world_building"   # 世界观设定


class DebtStatus(str, Enum):
    """Status of a narrative debt."""
    ACTIVE = "active"           # 未兑现
    FULFILLED = "fulfilled"     # 已兑现
    OVERDUE = "overdue"         # 超期未兑现 (risky)
    ABANDONED = "abandoned"     # 已放弃


class DebtPriority(str, Enum):
    """Priority of a narrative debt."""
    CRITICAL = "critical"       # 核心债务，必须兑现
    HIGH = "high"               # 重要债务
    MEDIUM = "medium"           # 一般债务
    LOW = "low"                 # 次要债务


@dataclass
class NarrativeDebt:
    """A single narrative debt item."""
    id: Optional[int] = None
    type: DebtType = DebtType.PLOT_PROMISE
    status: DebtStatus = DebtStatus.ACTIVE
    priority: DebtPriority = DebtPriority.MEDIUM
    title: str = ""
    description: str = ""
    created_chapter_id: Optional[int] = None
    created_chapter_title: Optional[str] = None
    expected_chapter_id: Optional[int] = None  # When it should be resolved
    resolved_chapter_id: Optional[int] = None
    keywords: List[str] = field(default_factory=list)
    related_character_ids: List[int] = field(default_factory=list)
    created_at: Optional[str] = None
    resolved_at: Optional[str] = None
    overdue_chapters: int = 0  # How many chapters since expected resolution


@dataclass
class DebtReport:
    """Complete debt tracking report for a project/story."""
    project_id: Optional[int] = None
    total_debts: int = 0
    active_debts: int = 0
    fulfilled_debts: int = 0
    overdue_debts: int = 0
    abandoned_debts: int = 0

    debts_by_type: Dict[str, int] = field(default_factory=dict)
    debts_by_priority: Dict[str, int] = field(default_factory=dict)

    critical_overdue: List[NarrativeDebt] = field(default_factory=list)
    high_priority_active: List[NarrativeDebt] = field(default_factory=list)

    debt_health_score: float = 0.0  # 0.0 - 100.0
    risk_assessment: str = ""
    suggestions: List[str] = field(default_factory=list)


# ============================================================================
# Detection patterns for extracting debts from chapter content
# ============================================================================

DEBT_DETECTION_PATTERNS = {
    DebtType.PLOT_PROMISE: {
        "patterns": [
            r"[一定|必定|发誓|承诺].{0,30}[报仇|复仇|夺回|拯救|保护|找到]",
            r"[约定|盟约|誓言].{0,20}[三年|五年|十年|之日|之时]",
            r"[目标|目的].{0,20}[成为|达到|超越|击败|统一]",
        ],
        "keywords": ["约定", "承诺", "誓言", "目标", "目的", "发誓", "立志"],
    },
    DebtType.CHARACTER_ARC: {
        "patterns": [
            r"[总有一天|终有一日].{0,30}[会|必将|定要]",
            r"[改变|蜕变|成长].{0,20}[变强|成为|不再]",
            r"[心结|执念|夙愿].{0,20}[解开|实现|完成]",
        ],
        "keywords": ["成长", "蜕变", "心结", "执念", "夙愿", "梦想", "追求"],
    },
    DebtType.MYSTERY: {
        "patterns": [
            r"[究竟|到底|为什么|怎么回事].{0,30}[?？]",
            r"[谜团|谜题|秘密|真相].{0,20}[未解|未知|隐藏|待解]",
            r"[身世|来历|背景|目的].{0,20}[不明|成谜|未知]",
        ],
        "keywords": ["谜团", "秘密", "真相", "身世", "来历", "未知", "未解"],
    },
    DebtType.FORESHADOWING: {
        "patterns": [
            r"[日后|将来|未来|以后].{0,30}[方知|才知|才明白]",
            r"[伏笔|铺垫|暗示|预示].{0,20}[应验|实现|成真]",
            r"[当时|那时].{0,20}[没想到|不曾想|未料到]",
        ],
        "keywords": ["伏笔", "铺垫", "暗示", "预示", "征兆", "日后", "将来"],
    },
    DebtType.RELATIONSHIP: {
        "patterns": [
            r"[感情|情愫|心意].{0,20}[未明|不明|待解]",
            r"[误会|误解|隔阂].{0,20}[消除|化解|解开]",
            r"[恩怨|情仇].{0,20}[了结|清算|解决]",
        ],
        "keywords": ["感情", "误会", "恩怨", "情仇", "羁绊", "缘分", "纠葛"],
    },
    DebtType.WORLD_BUILDING: {
        "patterns": [
            r"[传说|神话|古籍].{0,20}[记载|提到|预言]",
            r"[秘境|遗迹|禁地].{0,20}[探索|开启|进入]",
            r"[力量|法则|规则].{0,20}[秘密|真相|本源]",
        ],
        "keywords": ["传说", "秘境", "遗迹", "法则", "本源", "奥秘", "天机"],
    },
}

FULFILLMENT_INDICATORS = [
    r"[终于|总算].{0,30}[实现|完成|达成|做到]",
    r"[承诺|誓言|约定].{0,20}[兑现|履行|完成]",
    r"[谜团|秘密|真相].{0,20}[揭开|揭晓|大白]",
    r"[误会|隔阂].{0,20}[消除|化解|解开]",
    r"[目标|心愿|梦想].{0,20}[达成|实现|完成]",
    r"[伏笔|暗示].{0,20}[应验|实现|成真|揭晓]",
]


class DebtTracker:
    """Tracks narrative debts across chapters."""

    def __init__(self):
        self.detection_patterns = DEBT_DETECTION_PATTERNS
        self.fulfillment_indicators = FULFILLMENT_INDICATORS

    # ------------------------------------------------------------------
    # Public API: Detection
    # ------------------------------------------------------------------

    def detect_debts_from_content(
        self,
        chapter_id: int,
        chapter_title: str,
        content: str,
        existing_debts: Optional[List[NarrativeDebt]] = None,
    ) -> List[NarrativeDebt]:
        """
        Detect new narrative debts from chapter content.

        Args:
            chapter_id: Current chapter ID
            chapter_title: Current chapter title
            content: Chapter text content
            existing_debts: Previously detected debts (to avoid duplicates)

        Returns:
            List of newly detected NarrativeDebt items
        """
        if not content:
            return []

        existing_titles = {d.title for d in (existing_debts or [])}
        new_debts = []

        for debt_type, config in self.detection_patterns.items():
            # Pattern-based detection
            for pattern in config["patterns"]:
                for match in re.finditer(pattern, content):
                    title = match.group()[:40]
                    if title in existing_titles:
                        continue

                    debt = NarrativeDebt(
                        type=debt_type,
                        status=DebtStatus.ACTIVE,
                        priority=self._infer_priority(content, match.start(), debt_type),
                        title=title,
                        description=match.group()[:100],
                        created_chapter_id=chapter_id,
                        created_chapter_title=chapter_title,
                        keywords=config["keywords"][:3],
                        created_at=datetime.utcnow().isoformat(),
                    )
                    new_debts.append(debt)
                    existing_titles.add(title)

            # Keyword-based detection for missed items
            for keyword in config["keywords"]:
                if keyword in content:
                    # Check if already captured by pattern
                    already_captured = any(keyword in d.title for d in new_debts)
                    if not already_captured:
                        # Create a generic debt entry
                        context = self._extract_context(content, content.find(keyword))
                        title = f"{keyword}相关线索"
                        if title not in existing_titles:
                            debt = NarrativeDebt(
                                type=debt_type,
                                status=DebtStatus.ACTIVE,
                                priority=DebtPriority.LOW,
                                title=title,
                                description=context[:100],
                                created_chapter_id=chapter_id,
                                created_chapter_title=chapter_title,
                                keywords=[keyword],
                                created_at=datetime.utcnow().isoformat(),
                            )
                            new_debts.append(debt)
                            existing_titles.add(title)

        return new_debts

    def check_fulfillments(
        self,
        chapter_id: int,
        content: str,
        active_debts: List[NarrativeDebt],
    ) -> List[NarrativeDebt]:
        """
        Check which active debts are fulfilled in this chapter.

        Args:
            chapter_id: Current chapter ID
            content: Chapter text content
            active_debts: List of currently active debts

        Returns:
            List of debts that appear to be fulfilled
        """
        if not content or not active_debts:
            return []

        fulfilled = []

        for debt in active_debts:
            if debt.status != DebtStatus.ACTIVE:
                continue

            # Check fulfillment indicators
            for pattern in self.fulfillment_indicators:
                if re.search(pattern, content):
                    # Check if related to this debt
                    if any(kw in content for kw in debt.keywords):
                        debt.status = DebtStatus.FULFILLED
                        debt.resolved_chapter_id = chapter_id
                        debt.resolved_at = datetime.utcnow().isoformat()
                        fulfilled.append(debt)
                        break

            # Also check if debt keywords appear near fulfillment words
            if debt.status == DebtStatus.ACTIVE:
                for keyword in debt.keywords:
                    if self._check_keyword_fulfillment(keyword, content):
                        debt.status = DebtStatus.FULFILLED
                        debt.resolved_chapter_id = chapter_id
                        debt.resolved_at = datetime.utcnow().isoformat()
                        fulfilled.append(debt)
                        break

        return fulfilled

    # ------------------------------------------------------------------
    # Public API: Reporting
    # ------------------------------------------------------------------

    def generate_report(
        self,
        debts: List[NarrativeDebt],
        current_chapter_id: Optional[int] = None,
    ) -> DebtReport:
        """
        Generate a comprehensive debt report.

        Args:
            debts: All debts for the project
            current_chapter_id: Current chapter (for overdue calculation)

        Returns:
            DebtReport with analysis and suggestions
        """
        if not debts:
            return DebtReport(
                total_debts=0,
                debt_health_score=100.0,
                risk_assessment="无叙事债务，故事处于初始阶段。",
                suggestions=["可以适当增加伏笔和悬念，为后续剧情铺垫。"],
            )

        active = [d for d in debts if d.status == DebtStatus.ACTIVE]
        fulfilled = [d for d in debts if d.status == DebtStatus.FULFILLED]
        overdue = [d for d in debts if d.status == DebtStatus.OVERDUE]
        abandoned = [d for d in debts if d.status == DebtStatus.ABANDONED]

        # Calculate overdue chapters
        if current_chapter_id:
            for debt in active:
                if debt.expected_chapter_id:
                    debt.overdue_chapters = max(0, current_chapter_id - debt.expected_chapter_id)
                    if debt.overdue_chapters > 5:
                        debt.status = DebtStatus.OVERDUE
                        overdue.append(debt)

        # Count by type
        debts_by_type = {}
        for debt in debts:
            t = debt.type.value
            debts_by_type[t] = debts_by_type.get(t, 0) + 1

        # Count by priority
        debts_by_priority = {}
        for debt in active:
            p = debt.priority.value
            debts_by_priority[p] = debts_by_priority.get(p, 0) + 1

        # Critical overdue
        critical_overdue = [
            d for d in overdue
            if d.priority in (DebtPriority.CRITICAL, DebtPriority.HIGH)
        ]

        # High priority active
        high_priority_active = [
            d for d in active
            if d.priority in (DebtPriority.CRITICAL, DebtPriority.HIGH)
        ]

        # Health score
        total = len(debts)
        if total == 0:
            health_score = 100.0
        else:
            fulfillment_ratio = len(fulfilled) / total
            overdue_ratio = len(overdue) / total
            active_ratio = len(active) / total

            health_score = (
                fulfillment_ratio * 40 +
                (1 - overdue_ratio) * 30 +
                min(active_ratio * 20, 20) +
                10  # base
            )
            health_score = min(health_score, 100.0)

        # Risk assessment
        if len(overdue) > len(active) * 0.3:
            risk = "高风险：过多超期债务可能导致读者流失和剧情崩坏。"
        elif len(active) > 20:
            risk = "中高风险：活跃债务过多，建议加快兑现节奏。"
        elif health_score > 80:
            risk = "低风险：叙事债务管理良好，兑现节奏合理。"
        elif health_score > 60:
            risk = "中等风险：部分债务需要关注，建议检查兑现计划。"
        else:
            risk = "高风险：叙事债务管理不善，需要系统性整改。"

        suggestions = self._generate_report_suggestions(
            active, overdue, critical_overdue, health_score
        )

        return DebtReport(
            total_debts=len(debts),
            active_debts=len(active),
            fulfilled_debts=len(fulfilled),
            overdue_debts=len(overdue),
            abandoned_debts=len(abandoned),
            debts_by_type=debts_by_type,
            debts_by_priority=debts_by_priority,
            critical_overdue=critical_overdue,
            high_priority_active=high_priority_active,
            debt_health_score=round(health_score, 1),
            risk_assessment=risk,
            suggestions=suggestions,
        )

    # ------------------------------------------------------------------
    # Serialization helpers for JSON storage
    # ------------------------------------------------------------------

    @staticmethod
    def debt_to_json(debt: NarrativeDebt) -> Dict[str, Any]:
        """Convert NarrativeDebt to JSON dict."""
        return {
            "id": debt.id,
            "type": debt.type.value,
            "status": debt.status.value,
            "priority": debt.priority.value,
            "title": debt.title,
            "description": debt.description,
            "created_chapter_id": debt.created_chapter_id,
            "created_chapter_title": debt.created_chapter_title,
            "expected_chapter_id": debt.expected_chapter_id,
            "resolved_chapter_id": debt.resolved_chapter_id,
            "keywords": debt.keywords,
            "related_character_ids": debt.related_character_ids,
            "created_at": debt.created_at,
            "resolved_at": debt.resolved_at,
            "overdue_chapters": debt.overdue_chapters,
        }

    @staticmethod
    def debt_from_json(data: Dict[str, Any]) -> NarrativeDebt:
        """Create NarrativeDebt from JSON dict."""
        return NarrativeDebt(
            id=data.get("id"),
            type=DebtType(data.get("type", "plot_promise")),
            status=DebtStatus(data.get("status", "active")),
            priority=DebtPriority(data.get("priority", "medium")),
            title=data.get("title", ""),
            description=data.get("description", ""),
            created_chapter_id=data.get("created_chapter_id"),
            created_chapter_title=data.get("created_chapter_title"),
            expected_chapter_id=data.get("expected_chapter_id"),
            resolved_chapter_id=data.get("resolved_chapter_id"),
            keywords=data.get("keywords", []),
            related_character_ids=data.get("related_character_ids", []),
            created_at=data.get("created_at"),
            resolved_at=data.get("resolved_at"),
            overdue_chapters=data.get("overdue_chapters", 0),
        )

    @staticmethod
    def debts_to_json(debts: List[NarrativeDebt]) -> str:
        """Serialize list of debts to JSON string."""
        return json.dumps(
            [DebtTracker.debt_to_json(d) for d in debts],
            ensure_ascii=False,
        )

    @staticmethod
    def debts_from_json(json_str: str) -> List[NarrativeDebt]:
        """Deserialize JSON string to list of debts."""
        if not json_str:
            return []
        data = json.loads(json_str)
        return [DebtTracker.debt_from_json(d) for d in data]

    @staticmethod
    def report_to_json(report: DebtReport) -> Dict[str, Any]:
        """Convert DebtReport to JSON dict."""
        return {
            "project_id": report.project_id,
            "total_debts": report.total_debts,
            "active_debts": report.active_debts,
            "fulfilled_debts": report.fulfilled_debts,
            "overdue_debts": report.overdue_debts,
            "abandoned_debts": report.abandoned_debts,
            "debts_by_type": report.debts_by_type,
            "debts_by_priority": report.debts_by_priority,
            "critical_overdue": [DebtTracker.debt_to_json(d) for d in report.critical_overdue],
            "high_priority_active": [DebtTracker.debt_to_json(d) for d in report.high_priority_active],
            "debt_health_score": report.debt_health_score,
            "risk_assessment": report.risk_assessment,
            "suggestions": report.suggestions,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _infer_priority(
        self, content: str, position: int, debt_type: DebtType
    ) -> DebtPriority:
        """Infer debt priority from context."""
        context = self._extract_context(content, position, 60)

        # Critical indicators
        critical_markers = ["核心", "主线", "关键", "终极", "宿命", "必须"]
        if any(m in context for m in critical_markers):
            return DebtPriority.CRITICAL

        # High indicators
        high_markers = ["重要", "重大", "深远", "巨大", "强烈"]
        if any(m in context for m in high_markers):
            return DebtPriority.HIGH

        # Type-based defaults
        if debt_type == DebtType.PLOT_PROMISE:
            return DebtPriority.HIGH
        if debt_type == DebtType.MYSTERY:
            return DebtPriority.MEDIUM

        return DebtPriority.MEDIUM

    def _check_keyword_fulfillment(self, keyword: str, content: str) -> bool:
        """Check if a keyword appears near fulfillment words."""
        fulfillment_words = [
            "实现", "完成", "达成", "兑现", "履行", "解决", "揭晓",
            "揭开", "大白", "化解", "消除", "结束", "终结",
        ]

        # Find keyword positions
        for match in re.finditer(re.escape(keyword), content):
            start = max(0, match.start() - 50)
            end = min(len(content), match.end() + 50)
            context = content[start:end]
            if any(fw in context for fw in fulfillment_words):
                return True
        return False

    def _extract_context(self, content: str, pos: int, radius: int = 40) -> str:
        """Extract surrounding context."""
        start = max(0, pos - radius)
        end = min(len(content), pos + radius)
        return content[start:end]

    def _generate_report_suggestions(
        self,
        active: List[NarrativeDebt],
        overdue: List[NarrativeDebt],
        critical_overdue: List[NarrativeDebt],
        health_score: float,
    ) -> List[str]:
        """Generate suggestions from report data."""
        suggestions = []

        if critical_overdue:
            titles = [d.title[:20] for d in critical_overdue[:3]]
            suggestions.append(
                f"紧急：{len(critical_overdue)}个关键债务已超期，"
                f"包括：{', '.join(titles)}... 建议尽快安排兑现。"
            )

        if len(overdue) > 5:
            suggestions.append(
                f"超期债务过多（{len(overdue)}个）：读者耐心有限，"
                "长期不兑现会导致追读率下降。"
            )

        if len(active) > 20:
            suggestions.append(
                f"活跃债务过多（{len(active)}个）：建议控制同时进行的线索数量，"
                "避免剧情过于分散。"
            )

        if health_score < 50:
            suggestions.append(
                "叙事债务健康度较低：建议制定系统的兑现计划，"
                "优先处理核心债务。"
            )
        elif health_score > 80 and not overdue:
            suggestions.append(
                "叙事债务管理优秀：当前兑现节奏合理，可以适当增加新伏笔。"
            )

        if not suggestions:
            suggestions.append("叙事债务状况良好，继续保持当前的兑现节奏。")

        return suggestions

    # ------------------------------------------------------------------
    # Type inference helpers (used by routes)
    # ------------------------------------------------------------------

    def _infer_type_from_title(self, title: str) -> DebtType:
        """Infer debt type from title text."""
        title_lower = title.lower()
        type_keywords = {
            DebtType.MYSTERY: ["谜", "秘密", "真相", "身世", "来历"],
            DebtType.FORESHADOWING: ["伏笔", "暗示", "预示", "铺垫"],
            DebtType.RELATIONSHIP: ["感情", "情愫", "恩怨", "羁绊", "缘分"],
            DebtType.WORLD_BUILDING: ["传说", "秘境", "遗迹", "法则", "天机"],
            DebtType.CHARACTER_ARC: ["成长", "蜕变", "心结", "执念", "梦想"],
            DebtType.PLOT_PROMISE: ["约定", "承诺", "誓言", "目标", "报仇"],
        }
        for debt_type, keywords in type_keywords.items():
            if any(kw in title_lower for kw in keywords):
                return debt_type
        return DebtType.PLOT_PROMISE

    def _status_from_string(self, status_str: str) -> DebtStatus:
        """Convert string status to DebtStatus enum."""
        status_map = {
            "active": DebtStatus.ACTIVE,
            "resolved": DebtStatus.FULFILLED,
            "fulfilled": DebtStatus.FULFILLED,
            "overdue": DebtStatus.OVERDUE,
            "abandoned": DebtStatus.ABANDONED,
        }
        return status_map.get(status_str.lower(), DebtStatus.ACTIVE)


# Module-level singleton
debt_tracker = DebtTracker()
