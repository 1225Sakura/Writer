"""OpenAI-compatible AI provider implementation.

Uses httpx directly (no openai SDK dependency) so it works with:
- OpenAI API
- DeepSeek API
- Local models (Ollama, vLLM, etc.)
- Any other OpenAI-compatible endpoint
"""

from __future__ import annotations

import json
from typing import AsyncIterator

import httpx

from .provider import AIProvider
from backend.services.cache_service import (
    get_cached_ai_result,
    set_cached_ai_result,
    cache_service,
)

# Writing style system prompts (mirrors minimax.py)
STYLE_PROMPTS = {
    "江南": "你是一位擅长东方玄幻风格的作家，文笔细腻柔美，擅长情感描写和意境营造。",
    "卡夫卡": "你是一位表现主义作家，文风荒诞抽象，善于揭示人性的异化和社会的荒谬。",
    "加缪": "你是一位存在主义作家，文风冷峻深刻，擅长哲学思辨和对生命意义的探索。",
    "default": "你是一位专业的中文网络小说作家，文笔流畅，情节紧凑，可读性强。",
}

AI_CACHE_TTL = 3600  # 1 hour


class OpenAICompatibleProvider(AIProvider):
    """OpenAI-compatible provider using raw HTTP + SSE parsing."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.openai.com/v1",
        model: str = "gpt-4o",
        timeout: float = 60.0,
    ):
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._timeout = timeout

    # ------------------------------------------------------------------
    # Provider metadata
    # ------------------------------------------------------------------

    @property
    def name(self) -> str:
        return "openai_compatible"

    @property
    def supports_streaming(self) -> bool:
        return True

    @property
    def max_tokens(self) -> int:
        return 8192

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_system_prompt(self, style: str) -> str:
        return STYLE_PROMPTS.get(style, STYLE_PROMPTS["default"])

    def _get_operation_instruction(self, operation: str) -> str:
        instructions = {
            "continue": "续写后续内容，保持原文风格和叙事节奏。",
            "expand": "扩写当前内容，增加细节描写和情节丰富度。",
            "condense": "缩写当前内容，精简表达但保留核心信息。",
            "rewrite": "改写当前内容，保持相同信息但换一种表达方式。",
            "polish": "润色当前内容，提升文笔但保持原意。",
            "optimize": "优化当前内容，提升整体质量。",
        }
        return instructions.get(operation, "继续写作。")

    def _build_messages(self, prompt: str, style: str, operation: str) -> list[dict]:
        system_prompt = self._get_system_prompt(style)
        operation_instruction = self._get_operation_instruction(operation)
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"{operation_instruction}\n\n{prompt}"},
        ]

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    def _parse_sse_chunk(self, line: str) -> str | None:
        """Parse a single SSE line and return the content delta, if any."""
        if not line.startswith("data: "):
            return None
        data = line[6:]
        if data == "[DONE]":
            return None
        try:
            chunk = json.loads(data)
            choices = chunk.get("choices", [])
            if choices:
                delta = choices[0].get("delta", {})
                return delta.get("content")
        except (json.JSONDecodeError, KeyError):
            pass
        return None

    # ------------------------------------------------------------------
    # Core generation
    # ------------------------------------------------------------------

    async def generate(
        self,
        prompt: str,
        style: str = "default",
        operation: str = "continue",
    ) -> str:
        """Non-streaming generation."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/chat/completions",
                headers=self._headers(),
                json={
                    "model": self._model,
                    "messages": self._build_messages(prompt, style, operation),
                    "stream": False,
                },
            )
            response.raise_for_status()
            result = response.json()
            return (
                result.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )

    async def generate_stream(
        self,
        prompt: str,
        style: str = "default",
        operation: str = "continue",
    ) -> AsyncIterator[str]:
        """Streaming generation via SSE."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            async with client.stream(
                "POST",
                f"{self._base_url}/chat/completions",
                headers=self._headers(),
                json={
                    "model": self._model,
                    "messages": self._build_messages(prompt, style, operation),
                    "stream": True,
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    content = self._parse_sse_chunk(line)
                    if content:
                        yield content

    # ------------------------------------------------------------------
    # Review
    # ------------------------------------------------------------------

    async def review(
        self,
        content: dict,
        settings: dict | None = None,
    ) -> dict:
        """Review settings for consistency using AI."""
        prompt_hash = cache_service.hash_prompt(
            str(content), "review_settings", "default", 50
        )
        cached = get_cached_ai_result(prompt_hash)
        if cached is not None:
            return cached

        system_prompt = (
            "你是一位专业的小说设定审核专家。仔细审查以下设定数据，"
            "检查世界观、角色、势力、地点等之间的一致性和逻辑性。"
            "指出潜在的矛盾之处，并提供优化建议。"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": str(content)},
        ]

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/chat/completions",
                headers=self._headers(),
                json={
                    "model": self._model,
                    "messages": messages,
                    "temperature": 0.5,
                    "stream": False,
                },
            )
            response.raise_for_status()
            result = response.json()

        review_result = {
            "review_content": (
                result.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            ),
            "raw_response": result,
        }

        set_cached_ai_result(prompt_hash, review_result, ttl=AI_CACHE_TTL)
        return review_result

    # ------------------------------------------------------------------
    # Entity extraction
    # ------------------------------------------------------------------

    async def extract_entities(self, content: str | list) -> list:
        """Extract entities from text or chat messages."""
        prompt_hash = cache_service.hash_prompt(
            str(content), "extract_entities", "default", 50
        )
        cached = get_cached_ai_result(prompt_hash)
        if cached is not None and "entities" in cached:
            return cached["entities"]

        system_prompt = (
            "你是一位实体提取专家。从以下对话中提取所有实体信息，"
            "包括角色、地点、物品、势力等。以JSON数组格式返回。"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": str(content)},
        ]

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/chat/completions",
                headers=self._headers(),
                json={
                    "model": self._model,
                    "messages": messages,
                    "temperature": 0.3,
                    "stream": False,
                },
            )
            response.raise_for_status()
            result = response.json()

        text = (
            result.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )

        try:
            entities = json.loads(text)
            entities = entities if isinstance(entities, list) else []
        except json.JSONDecodeError:
            entities = [{"raw_content": text}]

        set_cached_ai_result(prompt_hash, {"entities": entities}, ttl=AI_CACHE_TTL)
        return entities
