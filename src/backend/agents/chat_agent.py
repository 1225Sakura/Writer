"""ChatAgent - AI agent for chat-based setting collection.

Uses an information-entropy strategy to proactively ask questions and
collect world-building settings (worldview, characters, golden fingers,
villains, etc.) through natural conversation.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from .base import AgentContext, AgentResult, BaseAgent

import yaml
from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent / "prompts"

def _load_prompts(name: str) -> dict:
    path = _PROMPTS_DIR / f"{name}.yaml"
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

_CHAT_PROMPTS = _load_prompts("chat_agent")
from ..utils.event_bus import AGENT_EXECUTED

logger = logging.getLogger(__name__)

# Setting categories to collect, ordered by dependency
SETTING_CATEGORIES = [
    "genre",
    "worldview",
    "power_system",
    "protagonist",
    "golden_finger",
    "villain",
    "supporting_characters",
    "key_items",
    "key_locations",
    "factions",
    "rules",
    "plot_direction",
]

# Question templates for each category (in Chinese, for web novel authors)
QUESTION_TEMPLATES: dict[str, list[str]] = {
    "genre": [
        "您想写什么类型的小说？（如：玄幻、修仙、都市、科幻、悬疑等）",
        "您希望小说的整体基调是轻松爽文、黑暗沉重、还是热血励志？",
    ],
    "worldview": [
        "故事发生在什么样的世界？（古代、现代、异世界、未来等）",
        "这个世界有什么独特的文化或社会结构？",
        "世界中有哪些主要的地理区域或势力分布？",
    ],
    "power_system": [
        "这个世界有修炼/升级体系吗？如果有，大致是怎样的等级划分？",
        "力量的来源是什么？（灵气、魔法、科技、血脉等）",
    ],
    "protagonist": [
        "主角是什么样的人？性格、年龄、身份背景？",
        "主角有什么特殊的身世或秘密吗？",
        "主角的目标或追求是什么？",
    ],
    "golden_finger": [
        "主角有什么特殊能力或金手指吗？（系统、重生、特殊体质等）",
        "这个金手指有什么限制或副作用？",
    ],
    "villain": [
        "主要的反派是谁？与主角有什么恩怨？",
        "反派的动机是什么？他/她认为自己在做正确的事吗？",
    ],
    "supporting_characters": [
        "有哪些重要的配角？他们与主角的关系如何？",
        "有没有特别重要的红颜知己/兄弟/导师角色？",
    ],
    "key_items": [
        "故事中有哪些重要的物品或法宝？",
        "这些物品有什么特殊功能或来历？",
    ],
    "key_locations": [
        "故事主要在哪些地点展开？",
        "有没有特别重要的场景（如宗门、秘境、城市）？",
    ],
    "factions": [
        "有哪些主要势力？它们之间的关系如何？",
        "主角属于哪个势力？或者独立于各方？",
    ],
    "rules": [
        "这个世界有什么特殊的规则或禁忌？",
        "有没有天道规则、因果律之类的设定？",
    ],
    "plot_direction": [
        "您希望故事大致走向如何？（复仇、成长、探索、争霸等）",
        "有没有特别想写的经典场景或情节？",
    ],
}

# System prompt for the chat agent (loaded from YAML)
CHAT_AGENT_SYSTEM_PROMPT = _CHAT_PROMPTS["system_prompt"]


class ChatAgent(BaseAgent):
    """Agent that drives chat-based setting collection via information entropy.

    The agent maintains a state of which setting categories have been
    sufficiently collected, and strategically asks the next most informative
    question to maximize setting completeness.
    """

    def __init__(self, provider, event_bus) -> None:
        super().__init__(provider, event_bus)
        self._categories = list(SETTING_CATEGORIES)
        self._templates = QUESTION_TEMPLATES

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def execute(self, context: AgentContext) -> AgentResult:
        """Execute the chat agent to determine the next action.

        Args:
            context: Contains task description, collected settings so far,
                     conversation history, and any constraints.

        Returns:
            AgentResult with:
                - content: dict with next_question, extracted_settings,
                           completed_categories
                - confidence: 0.0-1.0 based on setting completeness
                - metadata: additional info about agent state
        """
        history = context.history
        settings_so_far = context.settings.get("collected_settings", {})
        current_category = context.settings.get("current_category", "genre")

        # Build the prompt for the AI provider
        prompt = self._build_prompt(history, settings_so_far, current_category)

        try:
            raw_response = await self.provider.generate(
                prompt=prompt,
                style="default",
                operation="continue",
            )
        except Exception as exc:
            logger.exception("ChatAgent AI generation failed")
            # Fallback: use next question from templates
            next_q = self._fallback_question(current_category, settings_so_far)
            return AgentResult(
                content={
                    "next_question": next_q,
                    "extracted_settings": {},
                    "completed_categories": [],
                },
                confidence=0.3,
                metadata={"fallback": True, "error": str(exc)},
                warnings=["AI provider failed, using fallback question"],
            )

        # Parse the AI response
        parsed = self._parse_response(raw_response)

        # Calculate confidence based on setting completeness
        completed = parsed.get("completed_categories", [])
        confidence = len(completed) / len(self._categories)

        # Determine next category
        next_category = self._determine_next_category(completed, current_category)

        result_content = {
            "next_question": parsed.get("next_question", "请告诉我更多关于您小说的设定。"),
            "extracted_settings": parsed.get("extracted_settings", {}),
            "completed_categories": completed,
            "next_category": next_category,
            "all_categories": self._categories,
        }

        # Publish event
        await self.event_bus.publish(
            AGENT_EXECUTED,
            {
                "agent": "ChatAgent",
                "task": context.task,
                "category": next_category,
                "confidence": confidence,
                "completed_count": len(completed),
                "total_categories": len(self._categories),
            },
        )

        return AgentResult(
            content=result_content,
            confidence=confidence,
            metadata={
                "raw_response": raw_response,
                "current_category": current_category,
                "next_category": next_category,
            },
        )

    async def extract_settings_from_message(
        self,
        message: str,
        current_category: str,
    ) -> dict[str, Any]:
        """Extract structured settings from a user message.

        Args:
            message: The user's message text.
            current_category: The category we're currently collecting.

        Returns:
            Dictionary of extracted settings for the category.
        """
        prompt = _CHAT_PROMPTS["extract_settings_prompt"].format(
            current_category=current_category, message=message
        )

        try:
            raw = await self.provider.generate(
                prompt=prompt,
                style="default",
                operation="continue",
            )
            # Try to extract JSON from the response
            extracted = self._extract_json(raw)
            if extracted:
                return {current_category: extracted}
        except Exception:
            logger.exception("Setting extraction failed")

        return {}

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_prompt(
        self,
        history: list[dict[str, Any]],
        settings_so_far: dict[str, Any],
        current_category: str,
    ) -> str:
        """Build the prompt for the AI provider."""
        tpl = _CHAT_PROMPTS
        lines = [CHAT_AGENT_SYSTEM_PROMPT, "", tpl["build_prompt_state_header"], ""]

        # Show collected settings
        if settings_so_far:
            lines.append(tpl["build_prompt_collected_label"])
            for cat, data in settings_so_far.items():
                lines.append(f"  [{cat}]: {json.dumps(data, ensure_ascii=False)}")
        else:
            lines.append(tpl["build_prompt_none_collected"])

        lines.extend(["", tpl["build_prompt_current_category"].format(current_category=current_category), ""])

        # Show conversation history
        if history:
            lines.append(tpl["build_prompt_history_header"])
            for msg in history[-10:]:  # Last 10 messages for context
                role = msg.get("role", "unknown")
                content = msg.get("content", "")
                lines.append(f"{role}: {content}")
            lines.append("")

        lines.extend([
            tpl["build_prompt_task_section"],
            json.dumps({
                "next_question": "下一个要问的问题（中文）",
                "extracted_settings": {"类别": {"字段": "值"}},
                "completed_categories": ["已完成的类别"],
            }, ensure_ascii=False, indent=2),
        ])

        return "\n".join(lines)

    def _parse_response(self, raw: str) -> dict[str, Any]:
        """Parse the AI response to extract structured data."""
        parsed = self._extract_json(raw)
        if parsed:
            return parsed

        # Fallback: try to extract question from plain text
        return {"next_question": raw.strip()[:500]}

    def _extract_json(self, text: str) -> dict[str, Any] | None:
        """Extract JSON object from text (handles markdown code blocks)."""
        # Try to find JSON in markdown code blocks
        import re

        # Look for ```json ... ```
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                logger.debug("Failed to parse JSON from AI response markdown block, trying next pattern")

        # Look for raw JSON object
        match = re.search(r"(\{.*\})", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                logger.debug("Failed to parse JSON from AI response raw object, trying next pattern")

        return None

    def _determine_next_category(
        self,
        completed: list[str],
        current: str,
    ) -> str:
        """Determine which category to collect next."""
        if current not in completed:
            return current

        # Find first uncompleted category
        for cat in self._categories:
            if cat not in completed:
                return cat

        return "complete"

    def _fallback_question(
        self,
        category: str,
        settings_so_far: dict[str, Any],
    ) -> str:
        """Get a fallback question when AI provider fails."""
        templates = self._templates.get(category, ["请告诉我更多关于您小说的设定。"])

        # Pick a question that hasn't been asked yet
        asked = settings_so_far.get(category, {})
        idx = len(asked) % len(templates)
        return templates[idx]

    def get_setting_summary(self, settings: dict[str, Any]) -> str:
        """Generate a human-readable summary of collected settings."""
        lines = ["=== 已收集设定汇总 ===", ""]
        for cat in self._categories:
            if cat in settings:
                lines.append(f"【{cat}】")
                data = settings[cat]
                if isinstance(data, dict):
                    for k, v in data.items():
                        lines.append(f"  {k}: {v}")
                else:
                    lines.append(f"  {data}")
                lines.append("")
        return "\n".join(lines)
