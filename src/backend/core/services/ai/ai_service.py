"""MiniMax AI Service for novel writing assistant with result caching."""

import hashlib
import httpx
from typing import AsyncIterator, Optional

from backend.services.ai import ProviderRouter, MiniMaxProvider, OpenAICompatibleProvider
from backend.infrastructure.cache.cache_service import (
    get_cached_ai_result,
    set_cached_ai_result,
    get_cache_service,
)
from backend.config import settings


def hash_prompt(prompt: str, operation: str, style: str = "default", human_ai_ratio: int = 70) -> str:
    """Create a hash key for an AI prompt."""
    return get_cache_service().hash_prompt(prompt, operation, style, human_ai_ratio)


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
    """Service for interacting with AI providers via ProviderRouter.

    Supports multiple backends with automatic failover, health tracking,
    and latency metrics collection.
    """

    def __init__(self, router: Optional[ProviderRouter] = None):
        self._router = router
        self._api_key: str = ""
        self._base_url: str = "https://api.minimax.chat/v1"

    # ------------------------------------------------------------------
    # Provider router lifecycle
    # ------------------------------------------------------------------

    def set_router(self, router: ProviderRouter) -> None:
        """Set the provider router (called from app lifespan)."""
        self._router = router

    @property
    def router(self) -> Optional[ProviderRouter]:
        """Get the current provider router."""
        return self._router

    def _ensure_router(self) -> ProviderRouter:
        """Ensure router is available, falling back to a single-provider router."""
        if self._router is not None:
            return self._router
        # Fallback: create a single-provider router with current config
        if not self._api_key:
            raise RuntimeError("No AI provider configured. Set MINIMAX_API_KEY or configure a provider.")
        provider = MiniMaxProvider(api_key=self._api_key, base_url=self._base_url)
        self._router = ProviderRouter(providers=[provider])
        return self._router

    # ------------------------------------------------------------------
    # Provider health
    # ------------------------------------------------------------------

    def get_provider_health(self) -> dict:
        """Return health status and metrics for all AI providers."""
        router = self._router
        if router is None:
            return {
                "status": "uninitialized",
                "providers": [],
                "message": "Provider router not initialized",
            }

        health = router.health_status()
        metrics = router.get_metrics()
        recommended = router.get_recommended_provider()

        providers = []
        for name in health:
            h = health[name]
            m = metrics.get(name, {})
            providers.append({
                "name": name,
                "is_degraded": h["is_degraded"],
                "error_rate": round(h["error_rate"], 4),
                "recent_requests": h["recent_requests"],
                "total_calls": m.get("total_calls", 0),
                "success_rate": m.get("success_rate", 1.0),
                "avg_latency_ms": m.get("avg_latency_ms", 0.0),
                "is_recommended": name == recommended.name,
            })

        return {
            "status": "healthy" if any(not p["is_degraded"] for p in providers) else "degraded",
            "recommended_provider": recommended.name,
            "providers": providers,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

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

    # ------------------------------------------------------------------
    # Core generation (delegated to router)
    # ------------------------------------------------------------------

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

        router = self._ensure_router()
        async for chunk in router.generate_stream(
            prompt=full_prompt,
            style="default",
            operation="continue",
        ):
            yield chunk

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

        router = self._ensure_router()
        review_result = await router.review(content=settings_data)

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

        router = self._ensure_router()
        entities = await router.extract_entities(content=chat_messages)

        # Cache the result
        set_cached_ai_result(prompt_hash, {"entities": entities}, ttl=AI_CACHE_TTL)
        return entities


# Module-level singleton instance
ai_service = AIService()
