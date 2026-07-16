"""AI entity generation service (US-008).

Calls MiniMax via the Anthropic SDK to generate a single settings entity
(character / item / location / faction / world_setting / rule) based on a
user-provided hint. Re-uses the AI invocation pattern from
``app/services/ai_chat.py`` for consistency.
"""
from __future__ import annotations

import json
import time
from typing import Any

from anthropic import Anthropic

from app.config import get_settings
from app.core.exceptions import ValidationException, WriterException
from app.services.ai_chat import AIChatTimeout
from fastapi import status


ENTITY_PROMPTS: dict[str, str] = {
    "character": (
        "你是一个中文网络小说设定助手。根据用户的提示生成一个角色。\n"
        "严格输出 JSON 对象（不要 markdown 代码块，不要解释文字），字段：\n"
        "- name (str): 角色名\n"
        "- gender (str | null): 性别\n"
        "- personality (str | null): 性格特点\n"
        "- desires (str | null): 欲望/动机\n"
        "- flaws (str | null): 缺陷\n"
        "- description (str | null): 外貌/背景描述\n"
        "- tier (str): 主角/protagonist、配角/supporting、反派/antagonist\n"
        "- cultivation_realm (str | null): 修为境界\n\n"
        "用户提示：\n\"\"\"\n{hint}\n\"\"\"\n"
    ),
    "item": (
        "你是一个中文网络小说设定助手。根据用户的提示生成一个物品/法宝/金手指。\n"
        "严格输出 JSON 对象，字段：\n"
        "- name (str): 名称\n"
        "- description (str | null): 描述/来历/效果\n"
        "- owner (str | null): 当前持有者\n"
        "- location (str | null): 所在地点\n"
        "- tags (list[str] | null): 标签\n\n"
        "用户提示：\n\"\"\"\n{hint}\n\"\"\"\n"
    ),
    "location": (
        "你是一个中文网络小说设定助手。根据用户的提示生成一个地点。\n"
        "严格输出 JSON 对象，字段：\n"
        "- name (str): 地点名\n"
        "- description (str | null): 地理/风貌/氛围描述\n"
        "- importance (str): 核心/core、普通/normal、次要/minor\n"
        "- tags (list[str] | null): 标签\n\n"
        "用户提示：\n\"\"\"\n{hint}\n\"\"\"\n"
    ),
    "faction": (
        "你是一个中文网络小说设定助手。根据用户的提示生成一个势力/门派/组织。\n"
        "严格输出 JSON 对象，字段：\n"
        "- name (str): 名称\n"
        "- description (str | null): 描述/宗旨\n"
        "- type (str | null): 门派/sect、宗族/clan、组织/organization、帝国/empire\n"
        "- tags (list[str] | null): 标签\n\n"
        "用户提示：\n\"\"\"\n{hint}\n\"\"\"\n"
    ),
    "world_setting": (
        "你是一个中文网络小说设定助手。根据用户的提示生成一条世界观/世界规则设定。\n"
        "严格输出 JSON 对象，字段：\n"
        "- name (str): 设定名\n"
        "- description (str | null): 详细描述\n"
        "- category (str | null): 地理/geography、历史/history、神话/mythology、力量体系/power、文化/culture\n\n"
        "用户提示：\n\"\"\"\n{hint}\n\"\"\"\n"
    ),
    "rule": (
        "你是一个中文网络小说设定助手。根据用户的提示生成一条修炼/魔法/竞技体系规则。\n"
        "严格输出 JSON 对象，字段：\n"
        "- name (str): 规则名\n"
        "- description (str | null): 规则描述/限制\n"
        "- rule_type (str | null): 修炼/cultivation、魔法/magic、竞技/competition、科技/tech\n\n"
        "用户提示：\n\"\"\"\n{hint}\n\"\"\"\n"
    ),
}


SUPPORTED_TYPES = tuple(ENTITY_PROMPTS.keys())


def _parse_entity_payload(raw: str) -> dict[str, Any]:
    """Parse a single-entity JSON object from the AI, tolerating fences."""
    text = raw.strip()
    if text.startswith("```"):
        newline = text.find("\n")
        if newline != -1:
            text = text[newline + 1 :]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return {}
        try:
            data = json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return {}
    if isinstance(data, dict):
        # Some models wrap as {"entity": {...}}
        inner = data.get("entity")
        if isinstance(inner, dict):
            return inner
        return data
    return {}


class EntityGeneratorService:
    """Generate a single settings entity from a user hint via MiniMax."""

    def __init__(self) -> None:
        self._prompts = ENTITY_PROMPTS

    def generate(
        self,
        entity_type: str,
        hint: str,
        project_id: int,
        *,
        timeout_s: float = 30.0,
    ) -> dict[str, Any]:
        if entity_type not in self._prompts:
            raise ValidationException(
                f"unsupported entity type: {entity_type} "
                f"(supported: {', '.join(self._prompts)})"
            )

        settings = get_settings()
        if not settings.anthropic_api_key:
            raise WriterException(
                "AI_NOT_CONFIGURED",
                "AI provider API key is not configured; set ANTHROPIC_API_KEY",
                status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        client = Anthropic(
            api_key=settings.anthropic_api_key,
            base_url=settings.anthropic_base_url,
        )
        prompt = self._prompts[entity_type].format(hint=(hint or "").strip()[:1000])

        last_exc: Exception | None = None
        for _attempt in range(2):
            try:
                start = time.monotonic()
                response = client.messages.create(
                    model=settings.anthropic_model,
                    max_tokens=1024,
                    messages=[{"role": "user", "content": prompt}],
                    timeout=timeout_s,
                )
                elapsed = time.monotonic() - start
                if elapsed > timeout_s:
                    raise AIChatTimeout(f"elapsed {elapsed:.1f}s > {timeout_s}s")
                parts: list[str] = []
                for block in getattr(response, "content", []) or []:
                    text = getattr(block, "text", None)
                    if text:
                        parts.append(text)
                raw = "".join(parts) if parts else ""
                entity = _parse_entity_payload(raw)
                if not entity:
                    raise WriterException(
                        "AI_BAD_RESPONSE",
                        "AI provider returned no parseable entity JSON",
                        status.HTTP_502_BAD_GATEWAY,
                    )
                # project_id is required at persistence time, not in the AI dict
                entity.pop("project_id", None)
                entity.pop("id", None)
                return {"entity": entity}
            except AIChatTimeout:
                raise
            except WriterException:
                raise
            except Exception as exc:
                last_exc = exc
                continue
        raise AIChatTimeout(f"AI provider failed after retries: {last_exc}")