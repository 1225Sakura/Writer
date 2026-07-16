"""AI chat helpers: entity extraction via MiniMax with timeout + retry."""
from __future__ import annotations

import json
import time
from typing import Any

from anthropic import Anthropic

from app.config import get_settings
from app.core.exceptions import WriterException
from fastapi import status


EXTRACT_PROMPT_TEMPLATE = """你是一个中文网络小说设定提取助手。
请从以下用户对话中提取最多 12 个实体，覆盖以下 6 类：
- world: 世界观背景
- character: 角色
- item: 物品/法宝/金手指
- location: 地点
- faction: 势力/门派/组织
- rule: 修炼/魔法/竞技体系规则

要求：
- 仅输出 JSON 数组，不要任何解释文字，不要 markdown 代码块
- 每项形如 {{"type": "<6类之一>", "name": "<实体名>", "attrs": {{<自由键值对>}}}}
- 如某类无实体可省略该 type，不要编造

对话内容：
\"\"\"
{content}
\"\"\"
"""


class AIChatTimeout(WriterException):
    def __init__(self, detail: str = "AI timeout"):
        super().__init__(
            "AI_TIMEOUT", f"AI provider timeout: {detail}", status.HTTP_504_GATEWAY_TIMEOUT
        )


def _parse_entities_payload(raw: str) -> list[dict[str, Any]]:
    """Robustly parse the AI JSON output, tolerating markdown fences."""
    text = raw.strip()
    if text.startswith("```"):
        # strip the first fence line
        newline = text.find("\n")
        if newline != -1:
            text = text[newline + 1 :]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Try to find the first '[' and last ']'
        start = text.find("[")
        end = text.rfind("]")
        if start == -1 or end == -1 or end <= start:
            return []
        try:
            data = json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return []
    if isinstance(data, dict):
        # Sometimes model wraps as {"entities": [...]}
        data = data.get("entities", [])
    if not isinstance(data, list):
        return []
    return [e for e in data if isinstance(e, dict) and "type" in e and "name" in e]


def extract_entities(content: str, *, timeout_s: float = 30.0) -> list[dict[str, Any]]:
    """Call MiniMax via Anthropic SDK. 30s timeout with 1 retry."""
    settings = get_settings()
    client = Anthropic(
        api_key=settings.anthropic_api_key,
        base_url=settings.anthropic_base_url,
    )
    prompt = EXTRACT_PROMPT_TEMPLATE.format(content=content[:6000])
    last_exc: Exception | None = None
    for attempt in range(2):
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
            raw = "".join(parts) if parts else (
                response.content[0].text if getattr(response, "content", None) else ""
            )
            return _parse_entities_payload(raw)
        except AIChatTimeout:
            raise
        except Exception as exc:
            last_exc = exc
            continue
    raise AIChatTimeout(f"AI provider failed after retries: {last_exc}")
