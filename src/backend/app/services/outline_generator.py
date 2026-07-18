"""AI outline generation service (US-012/US-013).

Generates and persists an outline with rich chapter planning fields via MiniMax.
"""
from __future__ import annotations

import json
import time
from typing import Any

from fastapi import status

from app.config import get_settings
from app.core.exceptions import NotFoundException, ValidationException, WriterException
from app.models import Chapter, Outline
from app.services.ai_chat import AIChatTimeout


ENTITY_TYPES: tuple[str, ...] = (
    "character",
    "item",
    "location",
    "faction",
    "world_setting",
    "rule",
)

OUTLINE_PROMPT_TEMPLATE = """你是一个中文网络小说大纲生成器。请基于下方项目设定生成 {chapter_count} 章大纲。

严格要求：
- 严格输出 JSON 对象（不要 markdown 代码块，不要解释文字）
- JSON 格式：{{"chapters": [{{"title": "章节标题", "summary": "章节剧情摘要", "sections": ["情节段落"], "pacingNotes": "节奏说明", "characterDynamics": "人物动态", "foreshadowing": "伏笔说明"}}]}}
- chapters 必须恰好包含 {chapter_count} 项
- 每章必须返回 sections (string[]) / pacingNotes (string) / characterDynamics (string) / foreshadowing (string)
- 标题应简洁有吸引力，摘要应说明本章核心事件、冲突与推进
- 输出语言为简体中文

项目上下文：
{context}
"""


def _parse_outline_payload(raw: str) -> list[dict[str, Any]]:
    """Parse chapter planning fields, tolerating fences, prose, and wrappers."""
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
        object_start = text.find("{")
        object_end = text.rfind("}")
        list_start = text.find("[")
        list_end = text.rfind("]")
        candidates: list[str] = []
        if object_start != -1 and object_end > object_start:
            candidates.append(text[object_start : object_end + 1])
        if list_start != -1 and list_end > list_start:
            candidates.append(text[list_start : list_end + 1])
        data = None
        for candidate in candidates:
            try:
                data = json.loads(candidate)
                break
            except json.JSONDecodeError:
                continue

    if isinstance(data, dict):
        for wrapper in ("result", "data", "outline"):
            inner = data.get(wrapper)
            if isinstance(inner, dict):
                data = inner
                break
        chapters = data.get("chapters") if isinstance(data, dict) else None
    elif isinstance(data, list):
        chapters = data
    else:
        chapters = None

    if not isinstance(chapters, list):
        return []

    cleaned: list[dict[str, Any]] = []
    for chapter in chapters:
        if not isinstance(chapter, dict):
            continue
        title = chapter.get("title")
        summary = chapter.get("summary")
        if not isinstance(title, str) or not isinstance(summary, str):
            continue
        title = title.strip()
        summary = summary.strip()
        if not title or not summary:
            continue

        item: dict[str, Any] = {"title": title, "summary": summary}
        sections = chapter.get("sections")
        if isinstance(sections, list):
            item["sections"] = [
                section.strip()
                for section in sections
                if isinstance(section, str) and section.strip()
            ]
        for field in ("pacingNotes", "characterDynamics", "foreshadowing"):
            value = chapter.get(field)
            if isinstance(value, str):
                item[field] = value.strip()
        cleaned.append(item)
    return cleaned


def _entity_to_context(entity: Any) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for field in (
        "id",
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
        value = getattr(entity, field, None)
        if value not in (None, "", [], {}):
            result[field] = value
    return result


class OutlineGeneratorService:
    """Generate a persisted outline and ordered chapters via MiniMax."""

    def __init__(
        self,
        ai_client: Any,
        project_repo: Any,
        outline_repo: Any,
        chapter_repo: Any,
        entity_repos: dict[str, Any],
    ) -> None:
        self._ai = ai_client
        self._projects = project_repo
        self._outlines = outline_repo
        self._chapters = chapter_repo
        self._repos = entity_repos

    def generate(
        self,
        project_id: int,
        chapter_count: int,
        settings_snapshot: dict[str, Any] | None = None,
        *,
        timeout_s: float = 30.0,
    ) -> dict[str, Any]:
        if not 1 <= chapter_count <= 50:
            raise ValidationException("chapterCount must be between 1 and 50")

        project = self._projects.get(project_id)
        if project is None:
            raise NotFoundException("Project", project_id)

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

        entities: dict[str, list[dict[str, Any]]] = {}
        for entity_type in ENTITY_TYPES:
            repo = self._repos.get(entity_type)
            rows = repo.list(project_id=project_id) if repo is not None else []
            entities[entity_type] = [_entity_to_context(row) for row in rows]

        context = {
            "project": {
                "id": project_id,
                "name": getattr(project, "name", None),
                "description": getattr(project, "description", None),
                "genre": getattr(project, "genre", None),
            },
            "entities": entities,
            "settingsSnapshot": settings_snapshot or {},
        }
        prompt = OUTLINE_PROMPT_TEMPLATE.format(
            chapter_count=chapter_count,
            context=json.dumps(context, ensure_ascii=False, default=str),
        )

        generated = self._call_ai(prompt, chapter_count, timeout_s)
        outline_title = "新大纲"
        if settings_snapshot:
            snapshot_title = settings_snapshot.get("title")
            if isinstance(snapshot_title, str) and snapshot_title.strip():
                outline_title = snapshot_title.strip()

        outline = self._outlines.create(
            Outline(project_id=project_id, title=outline_title)
        )
        chapters: list[Chapter] = []
        for order, item in enumerate(generated, start=1):
            chapter = self._chapters.create(
                Chapter(
                    project_id=project_id,
                    outline_id=outline.id,
                    chapter_order=order,
                    title=item["title"],
                    summary=item["summary"],
                    sections=item.get("sections"),
                    pacing_notes=item.get("pacingNotes"),
                    character_dynamics=item.get("characterDynamics"),
                    foreshadowing=item.get("foreshadowing"),
                )
            )
            chapters.append(chapter)

        return {
            "outlineId": outline.id,
            "chapters": [
                {
                    "id": chapter.id,
                    "title": chapter.title,
                    "summary": chapter.summary,
                    "sections": chapter.sections,
                    "pacingNotes": chapter.pacing_notes,
                    "characterDynamics": chapter.character_dynamics,
                    "foreshadowing": chapter.foreshadowing,
                }
                for chapter in chapters
            ],
        }

    def _call_ai(
        self,
        prompt: str,
        chapter_count: int,
        timeout_s: float,
    ) -> list[dict[str, Any]]:
        last_exc: Exception | None = None
        for _attempt in range(2):
            try:
                started = time.monotonic()
                settings = get_settings()
                response = self._ai.messages.create(
                    model=settings.anthropic_model,
                    max_tokens=settings.max_output_tokens,
                    messages=[{"role": "user", "content": prompt}],
                    timeout=timeout_s,
                )
                elapsed = time.monotonic() - started
                if elapsed > timeout_s:
                    raise AIChatTimeout(f"elapsed {elapsed:.1f}s > {timeout_s}s")

                parts: list[str] = []
                for block in getattr(response, "content", []) or []:
                    text = getattr(block, "text", None)
                    if text:
                        parts.append(text)
                chapters = _parse_outline_payload("".join(parts))
                if len(chapters) != chapter_count:
                    raise WriterException(
                        "AI_BAD_RESPONSE",
                        f"AI provider returned {len(chapters)} valid chapters; expected {chapter_count}",
                        status.HTTP_502_BAD_GATEWAY,
                    )
                return chapters
            except AIChatTimeout:
                raise
            except WriterException:
                raise
            except Exception as exc:
                last_exc = exc
                continue
        raise AIChatTimeout(f"AI provider failed after retries: {last_exc}")
