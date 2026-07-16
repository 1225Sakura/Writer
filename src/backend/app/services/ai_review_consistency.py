"""AI consistency review service (US-009).

Reads all entities of the target types for a project, then asks the AI to find
cross-entity consistency issues (e.g. contradictions, dangling references,
name collisions) and propose suggestions.

Mirrors the AI call pattern from ``app/services/ai_generate_entity.py``:
sync ``Anthropic`` client + 30s timeout + 1 retry + lenient JSON parser.
"""
from __future__ import annotations

import json
import time
from typing import Any

from fastapi import status

from app.config import get_settings
from app.core.exceptions import WriterException
from app.services.ai_chat import AIChatTimeout


SUPPORTED_TYPES: tuple[str, ...] = (
    "character",
    "item",
    "location",
    "faction",
    "world_setting",
    "rule",
)


REVIEW_PROMPT = """你是一个中文网络小说设定一致性审校助手。
请基于以下"项目设定清单"，找出实体之间的不一致/矛盾/悬空引用/命名冲突等问题，并给出修改建议。

要求：
- 严格输出 JSON 对象（不要 markdown 代码块，不要解释文字），字段：
  - issues: 数组，每项 {{"severity": "low|medium|high|critical",
    "location": "<entityType>:<entityName>",
    "description": "<问题描述>"}}
  - suggestions: 数组，元素是字符串（修改建议）
- 若无问题返回空数组 issues: []
- 仅在 suggestions 中返回"添加更多设定以增强一致性"这类提示当设定数量过少

项目 ID：{project_id}

项目设定清单：
\"\"\"
{entities_block}
\"\"\"
"""


def _parse_review_payload(raw: str) -> dict[str, Any]:
    """Parse the AI response, tolerating fences and wrapper keys.

    Returns ``{"issues": [...], "suggestions": [...]}`` on success, else ``{}``.
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

    # Some models wrap the payload as {"result": {...}} or {"review": {...}}
    for wrapper in ("result", "review", "data"):
        inner = data.get(wrapper)
        if isinstance(inner, dict) and ("issues" in inner or "suggestions" in inner):
            data = inner
            break

    issues = data.get("issues")
    suggestions = data.get("suggestions")
    if not isinstance(issues, list):
        issues = []
    if not isinstance(suggestions, list):
        suggestions = []

    cleaned_issues: list[dict[str, Any]] = []
    for issue in issues:
        if not isinstance(issue, dict):
            continue
        severity = issue.get("severity")
        location = issue.get("location")
        description = issue.get("description")
        if not (isinstance(severity, str) and isinstance(location, str) and isinstance(description, str)):
            continue
        cleaned_issues.append(
            {
                "severity": severity,
                "location": location,
                "description": description,
            }
        )
    cleaned_suggestions = [s for s in suggestions if isinstance(s, str)]
    return {"issues": cleaned_issues, "suggestions": cleaned_suggestions}


def _format_entities_block(entities_by_type: dict[str, list[Any]]) -> str:
    """Format the entity dump fed to the AI prompt.

    Empty list -> short hint so the AI can suggest "add more settings".
    """
    lines: list[str] = []
    for entity_type in SUPPORTED_TYPES:
        entities = entities_by_type.get(entity_type) or []
        if not entities:
            continue
        lines.append(f"[{entity_type}]")
        for ent in entities:
            name = getattr(ent, "name", None) or f"<{entity_type}-no-name>"
            ent_id = getattr(ent, "id", None)
            extras: list[str] = []
            for field in (
                "tier",
                "gender",
                "personality",
                "desires",
                "flaws",
                "description",
                "cultivation_realm",
                "owner",
                "location",
                "importance",
                "category",
                "rule_type",
                "type",
                "tags",
            ):
                val = getattr(ent, field, None)
                if val:
                    extras.append(f"{field}={val}")
            head = f"- {ent_type_marker(entity_type)} id={ent_id} name={name}"
            if extras:
                head += " " + " ".join(extras)
            lines.append(head)
        lines.append("")
    if not lines:
        return "(项目暂无论相关设定，建议先添加角色/物品/地点/势力/世界观/规则)"
    return "\n".join(lines).rstrip()


def ent_type_marker(entity_type: str) -> str:
    return f"[{entity_type}]"


class ConsistencyReviewService:
    """Review a project's entities for cross-entity consistency issues."""

    def __init__(self, ai_client: Any, entity_repos: dict[str, Any]) -> None:
        self._ai = ai_client
        self._repos = entity_repos

    def review(
        self,
        project_id: int,
        target_types: list[str] | None = None,
        *,
        timeout_s: float = 30.0,
    ) -> dict[str, Any]:
        if self._ai is None:
            settings = get_settings()
            if not settings.anthropic_api_key:
                raise WriterException(
                    "AI_NOT_CONFIGURED",
                    "AI provider API key is not configured; set ANTHROPIC_API_KEY",
                    status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            # If ai_client was explicitly None but config has a key, that's a misconfig.
            raise WriterException(
                "AI_NOT_CONFIGURED",
                "AI client is not configured",
                status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        types_to_check = list(target_types) if target_types else list(SUPPORTED_TYPES)
        unknown = [t for t in types_to_check if t not in SUPPORTED_TYPES]
        if unknown:
            raise WriterException(
                "VALIDATION_ERROR",
                f"unsupported entity types: {', '.join(unknown)}",
                status.HTTP_400_BAD_REQUEST,
            )

        entities_by_type: dict[str, list[Any]] = {}
        for entity_type in types_to_check:
            repo = self._repos.get(entity_type)
            if repo is None:
                continue
            entities_by_type[entity_type] = list(repo.list(project_id=project_id))

        entities_block = _format_entities_block(entities_by_type)
        total_entities = sum(len(v) for v in entities_by_type.values())

        if total_entities == 0:
            return {
                "issues": [],
                "suggestions": [
                    "项目暂无任何设定，先添加一些角色/物品/地点/势力/世界观/规则再做一致性审查"
                ],
            }

        prompt = REVIEW_PROMPT.format(
            project_id=project_id,
            entities_block=entities_block,
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
                parsed = _parse_review_payload(raw)
                if not parsed:
                    raise WriterException(
                        "AI_BAD_RESPONSE",
                        "AI provider returned no parseable review JSON",
                        status.HTTP_502_BAD_GATEWAY,
                    )
                return parsed
            except AIChatTimeout:
                raise
            except WriterException:
                raise
            except Exception as exc:
                last_exc = exc
                continue
        raise AIChatTimeout(f"AI provider failed after retries: {last_exc}")
