"""Provider router with failover and health-check support."""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from typing import AsyncIterator

from .provider import AIProvider

logger = logging.getLogger(__name__)

# Health-check thresholds
_ERROR_RATE_THRESHOLD = 0.5          # 50% errors -> degraded
_ERROR_WINDOW_SECONDS = 300          # 5-minute sliding window
_MIN_REQUESTS_FOR_THRESHOLD = 5      # Need at least 5 requests before auto-failover
_DEGRADED_COOLDOWN_SECONDS = 60      # Stay degraded for 60s before retry


class _ProviderHealth:
    """Tracks recent request outcomes for a single provider."""

    def __init__(self) -> None:
        self._results: deque[tuple[float, bool]] = deque()
        self.degraded_until: float | None = None

    def record(self, success: bool) -> None:
        now = time.time()
        self._results.append((now, success))
        self._prune(now)

    def _prune(self, now: float) -> None:
        cutoff = now - _ERROR_WINDOW_SECONDS
        while self._results and self._results[0][0] < cutoff:
            self._results.popleft()

    @property
    def error_rate(self) -> float:
        if not self._results:
            return 0.0
        failures = sum(1 for _, ok in self._results if not ok)
        return failures / len(self._results)

    @property
    def is_degraded(self) -> bool:
        if self.degraded_until is not None:
            if time.time() < self.degraded_until:
                return True
            self.degraded_until = None
        if len(self._results) < _MIN_REQUESTS_FOR_THRESHOLD:
            return False
        return self.error_rate >= _ERROR_RATE_THRESHOLD

    def mark_degraded(self) -> None:
        self.degraded_until = time.time() + _DEGRADED_COOLDOWN_SECONDS


class ProviderRouter:
    """Routes AI requests across multiple providers with automatic failover.

    - Primary provider is used by default.
    - If the primary fails, the request is retried on the next healthy provider.
    - Health is tracked via a sliding window of recent request outcomes.
    - Providers that exceed the error-rate threshold are temporarily skipped.
    """

    def __init__(
        self,
        providers: list[AIProvider],
        primary_index: int = 0,
    ):
        if not providers:
            raise ValueError("At least one provider is required")
        self._providers = providers
        self._primary_index = primary_index
        self._health: dict[str, _ProviderHealth] = {
            p.name: _ProviderHealth() for p in providers
        }

    # ------------------------------------------------------------------
    # Provider selection
    # ------------------------------------------------------------------

    def _ordered_providers(self, task: str = "generate") -> list[AIProvider]:
        """Return providers ordered by preference for the given task."""
        primary = self._providers[self._primary_index]
        rest = [p for i, p in enumerate(self._providers) if i != self._primary_index]
        # Put non-degraded providers first
        healthy = [p for p in [primary, *rest] if not self._health[p.name].is_degraded]
        degraded = [p for p in [primary, *rest] if self._health[p.name].is_degraded]
        return healthy + degraded

    # ------------------------------------------------------------------
    # Core generation with failover
    # ------------------------------------------------------------------

    async def generate(
        self,
        prompt: str,
        style: str = "default",
        operation: str = "continue",
    ) -> str:
        """Generate text, failing over to the next provider on error."""
        last_error: Exception | None = None
        for provider in self._ordered_providers("generate"):
            try:
                result = await provider.generate(prompt, style, operation)
                self._health[provider.name].record(success=True)
                return result
            except Exception as exc:
                logger.warning(
                    "Provider %s failed for generate: %s",
                    provider.name,
                    exc,
                )
                self._health[provider.name].record(success=False)
                last_error = exc

        # All providers failed
        raise last_error or RuntimeError("All AI providers failed")

    async def generate_stream(
        self,
        prompt: str,
        style: str = "default",
        operation: str = "continue",
    ) -> AsyncIterator[str]:
        """Stream generation with failover.

        Because streaming is an async iterator, failover is handled by
        yielding from the first successful provider. If a provider yields
        an error mid-stream we cannot transparently retry, so we treat
        any exception during setup as a failover trigger.
        """
        last_error: Exception | None = None
        for provider in self._ordered_providers("generate"):
            try:
                # Eagerly start the stream to catch setup errors
                stream = provider.generate_stream(prompt, style, operation)
                # Pull the first chunk to validate the connection
                first_chunk = await stream.__anext__()
                self._health[provider.name].record(success=True)

                async def _with_fallback() -> AsyncIterator[str]:
                    yield first_chunk
                    async for chunk in stream:
                        yield chunk

                return _with_fallback()
            except StopAsyncIteration:
                # Empty stream but provider worked
                self._health[provider.name].record(success=True)
                return
            except Exception as exc:
                logger.warning(
                    "Provider %s failed for generate_stream: %s",
                    provider.name,
                    exc,
                )
                self._health[provider.name].record(success=False)
                last_error = exc

        raise last_error or RuntimeError("All AI providers failed")

    # ------------------------------------------------------------------
    # Review with failover
    # ------------------------------------------------------------------

    async def review(
        self,
        content: dict,
        settings: dict | None = None,
    ) -> dict:
        """Review content, failing over on error."""
        last_error: Exception | None = None
        for provider in self._ordered_providers("review"):
            try:
                result = await provider.review(content, settings)
                self._health[provider.name].record(success=True)
                return result
            except Exception as exc:
                logger.warning(
                    "Provider %s failed for review: %s",
                    provider.name,
                    exc,
                )
                self._health[provider.name].record(success=False)
                last_error = exc

        raise last_error or RuntimeError("All AI providers failed")

    # ------------------------------------------------------------------
    # Entity extraction with failover
    # ------------------------------------------------------------------

    async def extract_entities(self, content: str | list) -> list:
        """Extract entities, failing over on error."""
        last_error: Exception | None = None
        for provider in self._ordered_providers("extract_entities"):
            try:
                result = await provider.extract_entities(content)
                self._health[provider.name].record(success=True)
                return result
            except Exception as exc:
                logger.warning(
                    "Provider %s failed for extract_entities: %s",
                    provider.name,
                    exc,
                )
                self._health[provider.name].record(success=False)
                last_error = exc

        raise last_error or RuntimeError("All AI providers failed")

    # ------------------------------------------------------------------
    # Health introspection
    # ------------------------------------------------------------------

    def health_status(self) -> dict[str, dict]:
        """Return health status for all registered providers."""
        return {
            name: {
                "error_rate": h.error_rate,
                "is_degraded": h.is_degraded,
                "recent_requests": len(h._results),
            }
            for name, h in self._health.items()
        }

    def reset_health(self, provider_name: str | None = None) -> None:
        """Reset health tracking for one or all providers."""
        if provider_name is None:
            for h in self._health.values():
                h._results.clear()
                h.degraded_until = None
        elif provider_name in self._health:
            self._health[provider_name]._results.clear()
            self._health[provider_name].degraded_until = None
