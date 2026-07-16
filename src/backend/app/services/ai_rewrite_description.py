"""AI rewrite-description service (US-011).

Rewrites the ``description`` field of an existing entity (character / item /
location / faction / world_setting / rule) in a chosen stylistic register
(concise / literary / classical / humorous / mysterious) via MiniMax.

Mirrors the AI invocation pattern from ``app/services/ai_fill_fields.py``:
sync Anthropic client + 30s timeout + 1 retry + lenient JSON parser.
"""
from __future__ import annotations

import json
import time
from typing import Any

from fastapi import status

from app.config import get_settings
from app.core.exceptions import NotFoundException, ValidationException, WriterException
from app.services.ai_chat import AIChatTimeout
from app.services.ai_generate_entity import SUPPORTED_TYPES


# Reuse the canonical 6 entity-type list from US-008 for compatibility.


# Supported rewriting styles. Keys must match exactly what the caller sends.
# Each prompt is appended to the per-entity instruction block.
STYLE_PROMPTS: dict[str, str] = {
    "concise": (
        "请用最简洁、精炼的中文重写下面的描述，保留所有核心信息（人物/物品/地点/设定/规则的关键要素），"
        "去除冗余修饰与重复表述，整体控制在 60 字以内。"
    ),
    "literary": (
        "请用华丽文学化的中文重写下面的描述，加入修辞手法（比喻/拟人/排比/意象）、节奏感与画面感，"
        "保留原文所有核心信息，但语言更生动、富有文采，适合正式出版级网文正文段落的引子。"
    ),
    "classical": (
        "请用半文言/仿古白话小说的笔法重写下面的描述，仿《三国》《水浒》《聊斋》行文风格，"
        "可适度使用四字短句、对仗、典故暗示，保留原文所有核心信息，篇幅 80-160 字。"
    ),
    "humorous": (
        "请用幽默诙谐的方式重写下面的描述，加入吐槽、夸张比喻、自嘲或反差萌的描写，"
        "形成轻松的网文风格，保留原文所有核心信息（不可省略关键事实）。"
    ),
    "mysterious": (
        "请用神秘悬疑的风格重写下面的描述，营造悬念、氛围与暗示感，多用短句、问句、"
        "未知的暗示描写，保留原文所有核心信息，让读者有想要继续阅读的冲动。"
    ),
}


REWRITE_PROMPT_TEMPLATE = """你是一个中文网络小说设定润色助手。请基于下方"原始描述"，按照指定的"风格指令"进行重写。

严格要求：
- 严格输出 JSON 对象（不要 markdown 代码块，不要任何解释文字），字段：
  - description (str): 重写后的中文描述
- 必须保留原文所有核心信息（人物/物品/地点/设定/规则的关键事实、名称、属性），不可省略或编造
- 输出语言：简体中文
- 输出长度：根据风格自然调整，但应不少于 30 字

实体类型: {entity_type}
实体 ID: {entity_id}
实体名称: {entity_name}

风格指令:
\"\"\"
{style_instruction}
\"\"\"

原始描述:
\"\"\"
{original_description}
\"\"\"
"""


def _entity_to_dict(entity: Any) -> dict[str, Any]:
    """Serialize the entity to a string-friendly dict for the prompt."""
    if entity is None:
        return {}
    out: dict[str, Any] = {}
    for field in (
        "name",
        "gender",
        "personality",
        "desires",
        "flaws",
        "description",
        "tier",
        "cultivation_realm",
        "owner",
        "location",
        "importance",
        "category",
        "rule_type",
        "type",
        "tags",
    ):
        val = getattr(entity, field, None)
        if val not in (None, "", [], {}):
            out[field] = val
    return out


def _format_context_block(entity_dict: dict[str, Any]) -> str:
    """Other fields of the entity — give the AI extra context if present."""
    if not entity_dict:
        return "(无附加信息)"
    extra = {k: v for k, v in entity_dict.items() if k != "description"}
    if not extra:
        return "(无附加信息)"
    lines = [f"- {k}: {v}" for k, v in extra.items()]
    return "\n".join(lines)


def _parse_rewrite_payload(raw: str) -> str:
    """Parse the AI response. Returns the rewritten description string, or ""."""
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
            return ""
        try:
            data = json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return ""
    if not isinstance(data, dict):
        return ""

    # Tolerate wrapper keys like {"result": {...}} or {"rewrite": {...}}
    for wrapper in ("result", "rewrite", "data", "filled"):
        inner = data.get(wrapper)
        if isinstance(inner, dict) and "description" in inner:
            data = inner
            break

    description = data.get("description")
    if isinstance(description, str):
        cleaned = description.strip()
        if cleaned:
            return cleaned
    return ""


class DescriptionRewriterService:
    """Rewrite an entity's description in a chosen style via MiniMax."""

    def __init__(self, ai_client: Any, entity_repos: dict[str, Any]) -> None:
        self._ai = ai_client
        self._repos = entity_repos

    def rewrite(
        self,
        entity_type: str,
        entity_id: int,
        style: str,
        *,
        timeout_s: float = 30.0,
    ) -> dict[str, Any]:
        # 1. Validate the entity_type is one of the 6 supported.
        if entity_type not in SUPPORTED_TYPES:
            raise ValidationException(
                f"unsupported entity type: {entity_type} "
                f"(supported: {', '.join(SUPPORTED_TYPES)})"
            )

        # 2. Validate the style is in our prompt map.
        if style not in STYLE_PROMPTS:
            raise ValidationException(
                f"unsupported style: {style} "
                f"(supported: {', '.join(STYLE_PROMPTS)})"
            )

        # 3. Check AI client presence.
        if self._ai is None:
            settings = get_settings()
            if not settings.anthropic_api_key:
                raise WriterException(
                    "AI_NOT_CONFIGURED",
                    "AI provider API key is not configured; set ANTHROPIC_API_KEY",
                    status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            raise WriterException(
                "AI_NOT_CONFIGURED",
                "AI client is not configured",
                status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # 4. Fetch the entity.
        repo = self._repos.get(entity_type)
        if repo is None:
            raise ValidationException(
                f"no repository configured for entity type: {entity_type}"
            )
        entity = repo.get(entity_id)
        if entity is None:
            raise NotFoundException(entity_type, entity_id)

        # 5. Extract the original description.
        original_description = getattr(entity, "description", None)
        if not isinstance(original_description, str) or not original_description.strip():
            raise ValidationException(
                f"entity {entity_type}:{entity_id} has no description to rewrite"
            )

        entity_dict = _entity_to_dict(entity)
        entity_name = entity_dict.get("name") or f"<{entity_type}-no-name>"
        style_instruction = STYLE_PROMPTS[style]

        prompt = REWRITE_PROMPT_TEMPLATE.format(
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            style_instruction=style_instruction,
            original_description=original_description.strip(),
        )

        # 6. Call the AI (threaded + 30s timeout + 1 retry + lenient parser).
        last_exc: Exception | None = None
        for _attempt in range(2):
            try:
                start = time.monotonic()
                response = self._ai.messages.create(
                    model=get_settings().anthropic_model,
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
                rewritten = _parse_rewrite_payload(raw)
                if not rewritten:
                    raise WriterException(
                        "AI_BAD_RESPONSE",
                        "AI provider returned no parseable rewrite JSON",
                        status.HTTP_502_BAD_GATEWAY,
                    )
                return {
                    "description": rewritten,
                    "style": style,
                    "entityType": entity_type,
                    "entityId": entity_id,
                }
            except AIChatTimeout:
                raise
            except WriterException:
                raise
            except Exception as exc:
                last_exc = exc
                continue
        raise AIChatTimeout(f"AI provider failed after retries: {last_exc}")
