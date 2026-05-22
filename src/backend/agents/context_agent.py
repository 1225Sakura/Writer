"""Context Agent - Generates writing execution packages for chapters."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.domain.entities import (
    Chapter,
    Character,
    CharacterStoryline,
    Faction,
    IFLine,
    Item,
    Location,
    Outline,
    PlotThread,
    Rule,
    WorldSetting,
)
from backend.core.services.ai.ai_service import AIService
from .base import BaseAgent, DatabaseMixin, AgentContext, AgentResult

import yaml
from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent / "prompts"

def _load_prompts(name: str) -> dict:
    path = _PROMPTS_DIR / f"{name}.yaml"
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

_CONTEXT_PROMPTS = _load_prompts("context_agent")
from .utils import extract_json_from_response, validate_context_response

logger = logging.getLogger(__name__)


class StrandType(str, Enum):
    """Story strand types for context segmentation."""

    MAIN = "main"          # 主线
    SUB = "sub"            # 副线
    IF = "if"              # IF线


@dataclass
class StrandContext:
    """Context fragment for a single story strand."""

    strand_type: StrandType
    title: str
    description: str
    context_fragment: dict[str, Any] = field(default_factory=dict)
    priority: int = 0  # Higher = more important


@dataclass
class FactCheckItem:
    """Immutable fact item for anti-hallucination."""

    category: str          # e.g. "character", "world", "rule"
    entity_name: str
    attribute: str
    value: Any
    source: str = ""       # Where this fact comes from


@dataclass
class HierarchicalContext:
    """Layered context: world -> scene -> character state."""

    world_layer: dict[str, Any] = field(default_factory=dict)
    scene_layer: dict[str, Any] = field(default_factory=dict)
    character_layer: dict[str, Any] = field(default_factory=dict)

    def to_flat_dict(self) -> dict[str, Any]:
        """Flatten hierarchical context for AI consumption."""
        return {
            "world_context": self.world_layer,
            "scene_context": self.scene_layer,
            "character_context": self.character_layer,
        }


class ContextAgent(BaseAgent, DatabaseMixin):
    """Generates structured context packages for chapter writing.

    A "创作执行包" (writing execution package) contains:
    - 本章核心任务（目标/阻力/代价）
    - 接住上章（钩子、读者期待）
    - 出场角色（状态、动机、情绪底色）
    - 场景与力量约束
    - 时间约束
    - 风格指导
    - 连续性与伏笔
    - 追读力策略

    Enhanced capabilities:
    - Strand-aware context building (主线/副线/IF线)
    - Anti-hallucination fact-check lists
    - Hierarchical context loading (world -> scene -> character)
    """

    # Required top-level fields in response
    REQUIRED_CONTEXT_FIELDS = [
        "core_task",
        "承接上文",
        "active_characters",
        "scene_constraints",
        "time_constraints",
        "style_guidance",
        "continuity",
        "engagement_strategy",
    ]

    def __init__(self, provider: AIProvider, event_bus: AsyncEventBus, ai_service: AIService):
        BaseAgent.__init__(self, provider, event_bus)
        DatabaseMixin.__init__(self, ai_service)

    # ------------------------------------------------------------------
    # Existing public API (backward compatible)
    # ------------------------------------------------------------------

    async def generate_chapter_context(
        self, chapter_id: int, db: AsyncSession
    ) -> dict[str, Any]:
        """Generate a complete writing execution package for a chapter.

        Args:
            chapter_id: The chapter ID to generate context for
            db: Async database session

        Returns:
            Structured context dict containing all writing guidance
        """
        result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
        chapter = result.scalar_one_or_none()
        if not chapter:
            raise ValueError(f"Chapter {chapter_id} not found")

        outline = None
        if chapter.outline_id:
            result = await db.execute(select(Outline).where(Outline.id == chapter.outline_id))
            outline = result.scalar_one_or_none()

        previous_chapter = None
        if chapter.chapter_order > 0:
            result = await db.execute(
                select(Chapter).where(
                    Chapter.outline_id == chapter.outline_id,
                    Chapter.chapter_order == chapter.chapter_order - 1,
                )
            )
            previous_chapter = result.scalar_one_or_none()

        result = await db.execute(
            select(PlotThread).where(
                PlotThread.created_chapter_id <= chapter_id,
                PlotThread.status == "active",
            )
        )
        active_plot_threads = result.scalars().all()

        result = await db.execute(
            select(CharacterStoryline).join(Character)
            .where(Character.id == CharacterStoryline.character_id)
        )
        character_storylines = result.scalars().all()

        result = await db.execute(select(IFLine))
        if_lines = result.scalars().all()

        context = await self._build_context_prompt(
            chapter=chapter,
            outline=outline,
            previous_chapter=previous_chapter,
            active_plot_threads=active_plot_threads,
            character_storylines=character_storylines,
            if_lines=if_lines,
        )

        return context

    async def _build_context_prompt(
        self,
        chapter: Chapter,
        outline: Outline | None,
        previous_chapter: Chapter | None,
        active_plot_threads: list[PlotThread],
        character_storylines: list[CharacterStoryline],
        if_lines: list[IFLine],
    ) -> dict[str, Any]:
        """Build the structured context prompt for AI generation."""
        system_prompt = _CONTEXT_PROMPTS["build_context_system_prompt"]

        context_data = {
            "chapter_title": chapter.title or f"第{chapter.chapter_order + 1}章",
            "chapter_summary": chapter.summary or "待补充",
            "outline_title": outline.title if outline else "未关联大纲",
            "outline_description": outline.description if outline else "",
            "previous_chapter_summary": previous_chapter.summary if previous_chapter else "无",
            "active_plot_threads": [
                {"title": pt.title, "description": pt.description}
                for pt in active_plot_threads
            ],
            "character_storylines": [
                {
                    "character_name": cs.character.name if cs.character else "未知",
                    "title": cs.title,
                    "arc": cs.arc,
                    "progress": cs.progress,
                }
                for cs in character_storylines
            ],
            "if_lines": [
                {"title": ifl.title, "description": ifl.description}
                for ifl in if_lines
            ],
        }

        try:
            content = await self.api_client.call(
                system_prompt=system_prompt,
                user_content=str(context_data),
                temperature=0.6,
            )

            parsed = extract_json_from_response(content)
            validate_context_response(parsed, self.REQUIRED_CONTEXT_FIELDS)

            # Validate nested structure
            if not isinstance(parsed.get("core_task"), dict):
                raise ValueError("core_task must be an object")
            if "goal" not in parsed["core_task"] or "obstacle" not in parsed["core_task"] or "cost" not in parsed["core_task"]:
                raise ValueError("core_task must have goal, obstacle, and cost fields")

            if not isinstance(parsed.get("承接上文"), dict):
                raise ValueError("承接上文 must be an object")

            if not isinstance(parsed.get("active_characters"), list):
                raise ValueError("active_characters must be an array")

            if not isinstance(parsed.get("scene_constraints"), dict):
                raise ValueError("scene_constraints must be an object")

            if not isinstance(parsed.get("continuity"), dict):
                raise ValueError("continuity must be an object")

            context = parsed

        except ValueError as e:
            logger.warning(f"Failed to parse context response: {e}, using fallback")
            context = {
                "core_task": {
                    "goal": "待确定",
                    "obstacle": "待确定",
                    "cost": "待确定",
                },
                "承接上文": {
                    "hooks": [],
                    "reader_expectations": "待确定",
                },
                "active_characters": [],
                "scene_constraints": {
                    "locations": [],
                    "power_limits": "待确定",
                },
                "time_constraints": "待确定",
                "style_guidance": "待确定",
                "continuity": {
                    "foreshadowing": [],
                    "ongoing_threads": [],
                },
                "engagement_strategy": "待确定",
                "parse_error": str(e),
                "raw_ai_response": content if 'content' in dir() else None,
            }

        context["chapter_id"] = chapter.id
        context["chapter_title"] = chapter.title
        return context

    # ------------------------------------------------------------------
    # Enhanced: Strand-aware context building
    # ------------------------------------------------------------------

    async def generate_strand_aware_context(
        self,
        chapter_id: int,
        db: AsyncSession,
        active_strands: list[StrandType] | None = None,
    ) -> dict[str, Any]:
        """Generate context with per-strand fragments.

        Args:
            chapter_id: The chapter ID
            db: Async database session
            active_strands: Which strand types to include (default: all)

        Returns:
            Enhanced context dict with ``strand_contexts`` key
        """
        # Start with base context
        base_context = await self.generate_chapter_context(chapter_id, db)

        active_strands = active_strands or [StrandType.MAIN, StrandType.SUB, StrandType.IF]

        # Fetch strand-specific data
        strands = await self._fetch_strand_data(chapter_id, db, active_strands)

        # Build per-strand context fragments
        strand_contexts: list[dict[str, Any]] = []
        for strand in strands:
            fragment = await self._build_strand_fragment(strand, base_context)
            strand_contexts.append({
                "strand_type": strand.strand_type.value,
                "title": strand.title,
                "description": strand.description,
                "priority": strand.priority,
                "context_fragment": fragment,
            })

        base_context["strand_contexts"] = strand_contexts
        base_context["strand_aware"] = True
        return base_context

    async def _fetch_strand_data(
        self,
        chapter_id: int,
        db: AsyncSession,
        strand_types: list[StrandType],
    ) -> list[StrandContext]:
        """Fetch database entities for each requested strand type."""
        strands: list[StrandContext] = []

        if StrandType.MAIN in strand_types:
            result = await db.execute(
                select(Outline, Chapter)
                .join(Chapter, Chapter.outline_id == Outline.id)
                .where(Chapter.id == chapter_id)
            )
            row = result.first()
            if row:
                outline, chapter = row
                strands.append(StrandContext(
                    strand_type=StrandType.MAIN,
                    title=outline.title if outline else "主线",
                    description=outline.description if outline else "",
                    priority=10,
                ))

        if StrandType.SUB in strand_types:
            result = await db.execute(
                select(CharacterStoryline, Character)
                .join(Character, Character.id == CharacterStoryline.character_id)
                .where(CharacterStoryline.progress < 100)
            )
            for cs, char in result.all():
                strands.append(StrandContext(
                    strand_type=StrandType.SUB,
                    title=cs.title,
                    description=f"{char.name}: {cs.arc or ''}",
                    priority=5,
                ))

        if StrandType.IF in strand_types:
            result = await db.execute(select(IFLine))
            for ifl in result.scalars().all():
                strands.append(StrandContext(
                    strand_type=StrandType.IF,
                    title=ifl.title,
                    description=ifl.description or "",
                    priority=3,
                ))

        # Sort by priority descending
        strands.sort(key=lambda s: s.priority, reverse=True)
        return strands

    async def _build_strand_fragment(
        self, strand: StrandContext, base_context: dict[str, Any]
    ) -> dict[str, Any]:
        """Build a focused context fragment for a single strand."""
        fragment: dict[str, Any] = {
            "focus": strand.title,
            "type": strand.strand_type.value,
        }

        if strand.strand_type == StrandType.MAIN:
            fragment["core_task"] = base_context.get("core_task", {})
            fragment["continuity"] = base_context.get("continuity", {})
        elif strand.strand_type == StrandType.SUB:
            chars = base_context.get("active_characters", [])
            fragment["relevant_characters"] = [
                c for c in chars
                if strand.title in str(c.get("name", "")) or strand.title in str(c.get("current_state", ""))
            ]
        elif strand.strand_type == StrandType.IF:
            fragment["if premise"] = strand.description
            fragment["divergence_points"] = base_context.get("continuity", {}).get("ongoing_threads", [])

        return fragment

    # ------------------------------------------------------------------
    # Enhanced: Anti-hallucination fact-check list
    # ------------------------------------------------------------------

    async def build_fact_check_list(
        self, chapter_id: int, db: AsyncSession
    ) -> list[FactCheckItem]:
        """Build an immutable fact-check list for a chapter.

        These facts are attached to context to prevent AI hallucination.
        """
        facts: list[FactCheckItem] = []

        # World settings (immutable)
        result = await db.execute(select(WorldSetting))
        for ws in result.scalars().all():
            facts.append(FactCheckItem(
                category="world",
                entity_name=ws.name,
                attribute="description",
                value=ws.description,
                source=f"world_settings:{ws.id}",
            ))

        # Rules (immutable constraints)
        result = await db.execute(select(Rule))
        for rule in result.scalars().all():
            facts.append(FactCheckItem(
                category="rule",
                entity_name=rule.name,
                attribute="description",
                value=rule.description,
                source=f"rules:{rule.id}",
            ))

        # Character core attributes
        result = await db.execute(select(Character))
        for char in result.scalars().all():
            facts.append(FactCheckItem(
                category="character",
                entity_name=char.name,
                attribute="gender",
                value=char.gender,
                source=f"characters:{char.id}",
            ))
            if char.cultivation_realm:
                facts.append(FactCheckItem(
                    category="character",
                    entity_name=char.name,
                    attribute="cultivation_realm",
                    value=char.cultivation_realm,
                    source=f"characters:{char.id}",
                ))

        # Items with fixed owners
        result = await db.execute(select(Item).where(Item.owner is not None))
        for item in result.scalars().all():
            if item.owner:
                facts.append(FactCheckItem(
                    category="item",
                    entity_name=item.name,
                    attribute="owner",
                    value=item.owner,
                    source=f"items:{item.id}",
                ))

        # Faction types
        result = await db.execute(select(Faction))
        for faction in result.scalars().all():
            facts.append(FactCheckItem(
                category="faction",
                entity_name=faction.name,
                attribute="type",
                value=faction.type,
                source=f"factions:{faction.id}",
            ))

        return facts

    async def generate_context_with_fact_check(
        self, chapter_id: int, db: AsyncSession
    ) -> dict[str, Any]:
        """Generate chapter context with attached fact-check list.

        Returns:
            Context dict with ``fact_check_list`` and ``hallucination_warning``
        """
        context = await self.generate_chapter_context(chapter_id, db)
        facts = await self.build_fact_check_list(chapter_id, db)

        context["fact_check_list"] = [
            {
                "category": f.category,
                "entity": f.entity_name,
                "attribute": f.attribute,
                "value": f.value,
                "source": f.source,
            }
            for f in facts
        ]
        context["hallucination_warning"] = _CONTEXT_PROMPTS["hallucination_warning"]
        context["fact_count"] = len(facts)
        return context

    # ------------------------------------------------------------------
    # Enhanced: Hierarchical context loading
    # ------------------------------------------------------------------

    async def build_hierarchical_context(
        self, chapter_id: int, db: AsyncSession
    ) -> HierarchicalContext:
        """Build layered context: world -> scene -> character state.

        Avoids loading full database into the prompt.
        """
        hc = HierarchicalContext()

        # World layer: broad immutable settings
        result = await db.execute(select(WorldSetting))
        world_settings = result.scalars().all()
        hc.world_layer = {
            "world_name": getattr(world_settings[0], "name", "") if world_settings else "",
            "settings_summary": [
                {"name": ws.name, "description": ws.description}
                for ws in world_settings[:5]  # Limit to top 5
            ],
            "rules": [],
        }

        result = await db.execute(select(Rule))
        rules = result.scalars().all()
        hc.world_layer["rules"] = [
            {"name": r.name, "description": r.description}
            for r in rules[:5]
        ]

        # Scene layer: chapter-specific context
        result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
        chapter = result.scalar_one_or_none()
        if chapter:
            hc.scene_layer = {
                "chapter_title": chapter.title,
                "chapter_summary": chapter.summary or "",
                "chapter_order": chapter.chapter_order,
            }

            # Related locations for this chapter
            result = await db.execute(select(Location))
            locations = result.scalars().all()
            hc.scene_layer["locations"] = [
                {"name": loc.name, "description": loc.description}
                for loc in locations[:3]
            ]

        # Character layer: active characters and their current states
        result = await db.execute(
            select(Character, CharacterStoryline)
            .outerjoin(
                CharacterStoryline,
                CharacterStoryline.character_id == Character.id,
            )
            .limit(10)
        )
        char_states = []
        for char, cs in result.all():
            char_states.append({
                "name": char.name,
                "gender": char.gender,
                "cultivation_realm": char.cultivation_realm,
                "current_arc": cs.arc if cs else "",
                "progress": cs.progress if cs else 0,
            })
        hc.character_layer = {"active_characters": char_states}

        return hc

    async def generate_hierarchical_chapter_context(
        self, chapter_id: int, db: AsyncSession
    ) -> dict[str, Any]:
        """Generate context using hierarchical loading strategy.

        Returns:
            Context dict with ``hierarchical_context`` key
        """
        base_context = await self.generate_chapter_context(chapter_id, db)
        hc = await self.build_hierarchical_context(chapter_id, db)

        base_context["hierarchical_context"] = hc.to_flat_dict()
        base_context["context_strategy"] = "hierarchical"
        return base_context

    # ------------------------------------------------------------------
    # Convenience: all enhancements combined
    # ------------------------------------------------------------------

    async def generate_enhanced_context(
        self,
        chapter_id: int,
        db: AsyncSession,
        active_strands: list[StrandType] | None = None,
        include_fact_check: bool = True,
        use_hierarchical: bool = True,
    ) -> dict[str, Any]:
        """Generate fully enhanced context with all new features.

        Args:
            chapter_id: Target chapter ID
            db: Database session
            active_strands: Strand types to include
            include_fact_check: Attach anti-hallucination fact list
            use_hierarchical: Use layered context loading

        Returns:
            Enhanced writing execution package
        """
        if use_hierarchical:
            context = await self.generate_hierarchical_chapter_context(chapter_id, db)
        else:
            context = await self.generate_chapter_context(chapter_id, db)

        # Add strand contexts
        strand_contexts = await self.generate_strand_aware_context(
            chapter_id, db, active_strands
        )
        context["strand_contexts"] = strand_contexts.get("strand_contexts", [])
        context["strand_aware"] = True

        # Add fact-check list
        if include_fact_check:
            facts = await self.build_fact_check_list(chapter_id, db)
            context["fact_check_list"] = [
                {
                    "category": f.category,
                    "entity": f.entity_name,
                    "attribute": f.attribute,
                    "value": f.value,
                    "source": f.source,
                }
                for f in facts
            ]
            context["hallucination_warning"] = _CONTEXT_PROMPTS["hallucination_warning"]
            context["fact_count"] = len(facts)

        context["enhanced"] = True
        return context
