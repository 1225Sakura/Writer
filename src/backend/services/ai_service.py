"""MiniMax AI Service for novel writing assistant with result caching."""

import hashlib
import httpx
from typing import AsyncIterator

from .cache_service import (
    get_cached_ai_result,
    set_cached_ai_result,
    cache_service,
)


def hash_prompt(prompt: str, operation: str, style: str = "default", human_ai_ratio: int = 70) -> str:
    """Create a hash key for an AI prompt."""
    return cache_service.hash_prompt(prompt, operation, style, human_ai_ratio)

# Writing style system prompts
STYLE_PROMPTS = {
    "江南": "你是一位擅长东方玄幻风格的作家，文笔细腻柔美，擅长情感描写和意境营造。",
    "卡夫卡": "你是一位表现主义作家，文风荒诞抽象，善于揭示人性的异化和社会的荒谬。",
    "加缪": "你是一位存在主义作家，文风冷峻深刻，擅长哲学思辨和对生命意义的探索。",
    "default": "你是一位专业的中文网络小说作家，文笔流畅，情节紧凑，可读性强。",
}

# Cache AI non-streaming results to avoid duplicate API calls
AI_CACHE_TTL = 3600  # 1 hour


class AIService:
    """Service for interacting with MiniMax AI API."""

    def __init__(self, api_key: str, base_url: str = "https://api.minimax.chat/v1"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    def _get_system_prompt(self, style: str) -> str:
        """Get system prompt based on writing style."""
        return STYLE_PROMPTS.get(style, STYLE_PROMPTS["default"])

    def _get_operation_instruction(self, operation: str) -> str:
        """Get instruction based on operation type."""
        instructions = {
            "continue": "续写后续内容，保持原文风格和叙事节奏。",
            "expand": "扩写当前内容，增加细节描写和情节丰富度。",
            "condense": "缩写当前内容，精简表达但保留核心信息。",
            "rewrite": "改写当前内容，保持相同信息但换一种表达方式。",
            "polish": "润色当前内容，提升文笔但保持原意。",
            "optimize": "优化当前内容，提升整体质量。",
        }
        return instructions.get(operation, "继续写作。")

    def _calculate_temperature(self, human_ai_ratio: int) -> float:
        """Calculate temperature based on human_ai_ratio.

        Lower ratio (more AI) = higher temperature for creativity
        Higher ratio (more human) = lower temperature for consistency
        """
        # Map 0-100 to 0.3-1.0 temperature range
        # 0 (full AI) -> 1.0 (max creativity)
        # 100 (full human) -> 0.3 (max consistency)
        return 0.3 + (1.0 - 0.3) * (1 - human_ai_ratio / 100)

    async def generate(
        self,
        prompt: str,
        operation: str,
        human_ai_ratio: int = 70,
        style: str = "default"
    ) -> AsyncIterator[str]:
        """Stream AI response for writing operations.

        Args:
            prompt: The user's text/prompt to process
            operation: One of continue, expand, condense, rewrite, polish, optimize
            human_ai_ratio: 0-100, controls creativity vs consistency
            style: Writing style (江南, 卡夫卡, 加缪, default)

        Yields:
            String chunks of the AI response
        """
        system_prompt = self._get_system_prompt(style)
        operation_instruction = self._get_operation_instruction(operation)
        temperature = self._calculate_temperature(human_ai_ratio)

        full_prompt = f"{system_prompt}\n\n{operation_instruction}\n\n{prompt}"

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/text/chatcompletion_v2",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "MiniMax-Text-01",
                    "messages": [
                        {"role": "user", "content": full_prompt}
                    ],
                    "temperature": temperature,
                    "stream": True,
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            import json
                            chunk = json.loads(data)
                            if "choices" in chunk and len(chunk["choices"]) > 0:
                                delta = chunk["choices"][0].get("delta", {})
                                if "content" in delta:
                                    yield delta["content"]
                        except (json.JSONDecodeError, KeyError):
                            continue

    async def review_settings(self, settings_data: dict) -> dict:
        """Review settings for consistency using AI.

        Args:
            settings_data: Dictionary containing world settings, characters, etc.

        Returns:
            Dictionary with review results including consistency issues and suggestions
        """
        # Check cache for identical review requests
        prompt_hash = hash_prompt(
            str(settings_data), "review_settings", "default", 50
        )
        cached = get_cached_ai_result(prompt_hash)
        if cached is not None:
            return cached

        system_prompt = (
            "你是一位专业的小说设定审核专家。仔细审查以下设定数据，"
            "检查世界观、角色、势力、地点等之间的一致性和逻辑性。"
            "指出潜在的矛盾之处，并提供优化建议。"
        )

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/text/chatcompletion_v2",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "MiniMax-Text-01",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": str(settings_data)},
                    ],
                    "temperature": 0.5,
                },
            )
            response.raise_for_status()
            result = response.json()

            review_result = {
                "review_content": result.get("choices", [{}])[0].get("message", {}).get("content", ""),
                "raw_response": result,
            }

            # Cache the result
            set_cached_ai_result(prompt_hash, review_result, ttl=AI_CACHE_TTL)
            return review_result

    async def extract_entities(self, chat_messages: list) -> list:
        """Extract entities from chat messages.

        Args:
            chat_messages: List of conversation messages

        Returns:
            List of extracted entities (characters, locations, items, etc.)
        """
        # Check cache for identical extraction requests
        prompt_hash = hash_prompt(
            str(chat_messages), "extract_entities", "default", 50
        )
        cached = get_cached_ai_result(prompt_hash)
        if cached is not None and "entities" in cached:
            return cached["entities"]

        system_prompt = (
            "你是一位实体提取专家。从以下对话中提取所有实体信息，"
            "包括角色、地点、物品、势力等。以JSON数组格式返回。"
        )

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/text/chatcompletion_v2",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "MiniMax-Text-01",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": str(chat_messages)},
                    ],
                    "temperature": 0.3,
                },
            )
            response.raise_for_status()
            result = response.json()

            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")

            # Try to parse as JSON
            import json
            try:
                entities = json.loads(content)
                entities = entities if isinstance(entities, list) else []
            except json.JSONDecodeError:
                entities = [{"raw_content": content}]

            # Cache the result
            set_cached_ai_result(prompt_hash, {"entities": entities}, ttl=AI_CACHE_TTL)
            return entities
