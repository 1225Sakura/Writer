"""AI fill-fields service (US-010).

Fills empty fields on an existing entity (character/item/location/faction/
world_setting/rule) via MiniMax. Mirrors the AI invocation pattern from
``app/services/ai_review_consistency.py``: sync Anthropic client + 30s
timeout + 1 retry + lenient JSON parser.
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


FILLABLE_FIELDS: dict[str, tuple[str, ...]] = {
    "character": (
        "gender",
        "personality",
        "desires",
        "flaws",
        "description",
        "tier",
        "cultivation_realm",
    ),
    "item": ("description", "owner", "location", "tags"),
    "location": ("description", "importance", "tags"),
    "faction": ("description", "type", "tags"),
    "world_setting": ("description", "category"),
    "rule": ("description", "rule_type"),
}


FILL_PROMPT_TEMPLATE = """你是一个中文网络小说设定助手。请基于以下"已存在实体"的内容，为以下列出的"待填充字段"填写合适的值。

要求：
- 严格输出 JSON 对象（不要 markdown 代码块，不要解释文字），字段严格对应"待填充字段"列表
- 字符串字段填写中文短句（30-100 字），列表字段填写 1-4 个简短字符串
- 与已有字段保持一致风格，不要重复已有内容
- 如果某个字段确实无法推断，给出空字符串 ""（不要编造无关内容）

实体类型: {entity_type}
实体 ID: {entity_id}

已有实体内容：
\"\"\"
{entity_block}
\"\"\"

待填充字段：
{fields_block}

请只输出 JSON 对象，键为待填充字段名。
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


def _format_fields_block(fields: list[str]) -> str:
    return ", ".join(fields)


def _format_entity_block(entity_dict: dict[str, Any]) -> str:
    if not entity_dict:
        return "(空)"
    lines = []
    for k, v in entity_dict.items():
        lines.append(f"- {k}: {v}")
    return "\n".join(lines)


def _parse_fill_payload(
    raw: str, allowed_fields: list[str]
) -> dict[str, Any]:
    """Parse the AI response, tolerating fences and wrapper keys.

    Only return fields that were requested (i.e. ``allowed_fields``) and have
    a non-empty value.
    """
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
    if not isinstance(data, dict):
        return {}

    # Some models wrap as {"filled": {...}} or {"result": {...}}
    for wrapper in ("filled", "result", "data", "fields"):
        inner = data.get(wrapper)
        if isinstance(inner, dict):
            data = inner
            break

    cleaned: dict[str, Any] = {}
    for field in allowed_fields:
        if field not in data:
            continue
        val = data[field]
        if isinstance(val, str):
            text_val = val.strip()
            if not text_val:
                continue
            cleaned[field] = text_val
        elif isinstance(val, list):
            list_val = [str(item).strip() for item in val if str(item).strip()]
            if not list_val:
                continue
            cleaned[field] = list_val
        elif val is None or val == "":
            continue
        else:
            cleaned[field] = val
    return cleaned


class FieldFillerService:
    """Fill empty fields on an existing entity via MiniMax."""

    def __init__(self, ai_client: Any, entity_repos: dict[str, Any]) -> None:
        self._ai = ai_client
        self._repos = entity_repos

    def fill(
        self,
        entity_type: str,
        entity_id: int,
        empty_fields: list[str],
        *,
        timeout_s: float = 30.0,
    ) -> dict[str, Any]:
        if entity_type not in SUPPORTED_TYPES:
            raise ValidationException(
                f"unsupported entity type: {entity_type} "
                f"(supported: {', '.join(SUPPORTED_TYPES)})"
            )

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

        # Fast-path: no empty fields -> return empty mapping immediately.
        if not empty_fields:
            return {"filled": {}}

        repo = self._repos.get(entity_type)
        if repo is None:
            raise ValidationException(
                f"no repository configured for entity type: {entity_type}"
            )
        entity = repo.get(entity_id)
        if entity is None:
            raise NotFoundException(entity_type, entity_id)

        # Filter empty_fields down to fields valid for this entity type,
        # preserving the caller's order while de-duplicating.
        fillable = FILLABLE_FIELDS[entity_type]
        seen: set[str] = set()
        requested_fields: list[str] = []
        for f in empty_fields:
            if not isinstance(f, str):
                raise ValidationException(
                    f"emptyFields entries must be strings (got: {type(f).__name__})"
                )
            if f in fillable and f not in seen:
                requested_fields.append(f)
                seen.add(f)

        if not requested_fields:
            return {"filled": {}}

        entity_dict = _entity_to_dict(entity)
        prompt = FILL_PROMPT_TEMPLATE.format(
            entity_type=entity_type,
            entity_id=entity_id,
            entity_block=_format_entity_block(entity_dict),
            fields_block=_format_fields_block(requested_fields),
        )

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
                filled = _parse_fill_payload(raw, requested_fields)
                # If the AI returned nothing usable, surface a 502 so the
                # caller can retry / correct.
                if not filled:
                    raise WriterException(
                        "AI_BAD_RESPONSE",
                        "AI provider returned no parseable fill-fields JSON",
                        status.HTTP_502_BAD_GATEWAY,
                    )
                return {"filled": filled}
            except AIChatTimeout:
                raise
            except WriterException:
                raise
            except Exception as exc:
                last_exc = exc
                continue
        raise AIChatTimeout(f"AI provider failed after retries: {last_exc}")
