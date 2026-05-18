"""Shared utilities for AI agents.

This module provides:
- retry_with_exponential_backoff: decorator/function for retry logic
- extract_json_from_response: robust JSON extraction from AI responses
- validate_context_response: validation for structured AI responses
- BaseAgent: base class with common agent functionality
- MiniMaxAPIClient: reusable API client with retry and error handling
"""

import asyncio
import functools
import json
import logging
from typing import Any, Callable, TypeVar

import httpx

from backend.config import settings
from backend.core.services.ai.ai_service import AIService

logger = logging.getLogger(__name__)

# Retry configuration defaults
DEFAULT_MAX_RETRIES = 3
DEFAULT_INITIAL_RETRY_DELAY = 1.0
DEFAULT_MAX_RETRY_DELAY = 10.0
DEFAULT_RETRY_MULTIPLIER = 2.0

T = TypeVar("T")


async def retry_with_exponential_backoff(
    func: Callable[..., Any],
    *args: Any,
    max_retries: int = DEFAULT_MAX_RETRIES,
    initial_delay: float = DEFAULT_INITIAL_RETRY_DELAY,
    max_delay: float = DEFAULT_MAX_RETRY_DELAY,
    multiplier: float = DEFAULT_RETRY_MULTIPLIER,
    **kwargs: Any,
) -> Any:
    """Execute async function with exponential backoff retry logic.

    Args:
        func: Async function to retry
        *args: Positional arguments for func
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay in seconds
        max_delay: Maximum delay cap in seconds
        multiplier: Exponential multiplier for delay growth
        **kwargs: Keyword arguments for func

    Returns:
        Result from successful function execution

    Raises:
        Last exception if all retries fail
    """
    last_exception = None
    delay = initial_delay

    for attempt in range(max_retries + 1):
        try:
            return await func(*args, **kwargs)
        except (httpx.HTTPStatusError, httpx.ConnectError, httpx.TimeoutException) as e:
            last_exception = e
            if attempt < max_retries:
                logger.warning(
                    f"Attempt {attempt + 1}/{max_retries + 1} failed: {e}. "
                    f"Retrying in {delay}s..."
                )
                await asyncio.sleep(delay)
                delay = min(delay * multiplier, max_delay)
            else:
                logger.error(f"All {max_retries + 1} attempts failed for {func.__name__}")
        except json.JSONDecodeError as e:
            # Don't retry JSON parsing errors
            raise ValueError(f"Invalid JSON response: {e}") from e

    raise last_exception


def retry_decorator(
    max_retries: int = DEFAULT_MAX_RETRIES,
    initial_delay: float = DEFAULT_INITIAL_RETRY_DELAY,
    max_delay: float = DEFAULT_MAX_RETRY_DELAY,
    multiplier: float = DEFAULT_RETRY_MULTIPLIER,
) -> Callable:
    """Decorator version of retry_with_exponential_backoff.

    Usage:
        @retry_decorator(max_retries=3)
        async def my_async_func():
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            return await retry_with_exponential_backoff(
                func,
                *args,
                max_retries=max_retries,
                initial_delay=initial_delay,
                max_delay=max_delay,
                multiplier=multiplier,
                **kwargs,
            )
        return wrapper
    return decorator


def extract_json_from_response(content: str) -> Any:
    """Extract JSON from AI response content, handling markdown code blocks.

    Args:
        content: Raw response content string

    Returns:
        Parsed JSON (dict, list, or other valid JSON type)

    Raises:
        ValueError if JSON cannot be extracted or parsed
    """
    content = content.strip()

    # Handle markdown code blocks: ```json ... ``` or ``` ...
    if content.startswith("```"):
        lines = content.split("\n")
        if lines[0].strip().startswith("```"):
            content = "\n".join(lines[1:])
        if content.strip().endswith("```"):
            content = content.strip()[:-3]

    content = content.strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        # Try to extract JSON array or object
        json_start = content.find("[")
        if json_start == -1:
            json_start = content.find("{")

        if json_start >= 0:
            if content[json_start] == "[":
                # Array - find matching closing bracket
                depth = 0
                for i, c in enumerate(content[json_start:], json_start):
                    if c == "[":
                        depth += 1
                    elif c == "]":
                        depth -= 1
                        if depth == 0:
                            try:
                                return json.loads(content[json_start:i + 1])
                            except json.JSONDecodeError:
                                pass
                            break
            else:
                # Object
                json_end = content.rfind("}") + 1
                if json_end > json_start:
                    try:
                        return json.loads(content[json_start:json_end])
                    except json.JSONDecodeError:
                        pass

        raise ValueError(f"Cannot parse JSON from response: {e}") from e


def validate_context_response(data: Any, required_fields: list[str]) -> bool:
    """Validate that response data contains required fields.

    Args:
        data: Parsed JSON response data
        required_fields: List of required field names

    Returns:
        True if all required fields present

    Raises:
        ValueError if validation fails
    """
    if not isinstance(data, dict):
        raise ValueError(f"Expected dict response, got {type(data).__name__}")

    missing = [f for f in required_fields if f not in data]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")

    return True


def validate_list_response(
    data: Any,
    required_keys: list[str],
    container_keys: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Validate and normalize a list-of-dicts AI response.

    Args:
        data: Parsed JSON response
        required_keys: Keys that each item must have
        container_keys: Optional list of dict keys to check for nested lists

    Returns:
        List of validated item dictionaries

    Raises:
        ValueError if response format is completely invalid
    """
    if not isinstance(data, list):
        if isinstance(data, dict) and container_keys:
            for key in container_keys:
                if key in data and isinstance(data[key], list):
                    return validate_list_response(data[key], required_keys, None)
        raise ValueError(f"Expected list response, got {type(data).__name__}")

    validated = []
    for item in data:
        if not isinstance(item, dict):
            continue
        if not all(k in item for k in required_keys):
            continue
        validated.append({k: item.get(k, "") for k in required_keys})

    return validated


class BaseAgent:
    """Base class for AI agents with common functionality."""

    def __init__(self, ai_service: AIService):
        self.ai_service = ai_service


class MiniMaxAPIClient:
    """Reusable MiniMax API client with built-in retry logic."""

    DEFAULT_MODEL = settings.minimax_model
    DEFAULT_TIMEOUT = 60.0
    DEFAULT_MAX_CONTENT_LENGTH = 8000

    def __init__(
        self,
        ai_service: AIService,
        model: str = DEFAULT_MODEL,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        initial_retry_delay: float = DEFAULT_INITIAL_RETRY_DELAY,
        max_retry_delay: float = DEFAULT_MAX_RETRY_DELAY,
        retry_multiplier: float = DEFAULT_RETRY_MULTIPLIER,
    ):
        self.ai_service = ai_service
        self.model = model
        self.timeout = timeout
        self.max_retries = max_retries
        self.initial_retry_delay = initial_retry_delay
        self.max_retry_delay = max_retry_delay
        self.retry_multiplier = retry_multiplier

    async def call(
        self,
        system_prompt: str,
        user_content: str,
        temperature: float = 0.5,
        max_content_length: int | None = None,
    ) -> str:
        """Call MiniMax API with retry logic and content truncation.

        Args:
            system_prompt: System prompt for the AI
            user_content: User message content (will be truncated if too long)
            temperature: Sampling temperature
            max_content_length: Maximum content length before truncation

        Returns:
            Raw response content string

        Raises:
            ValueError if response cannot be parsed after retries
            httpx errors if all retries fail
        """
        max_len = max_content_length or self.DEFAULT_MAX_CONTENT_LENGTH
        truncated = (
            user_content[:max_len]
            if len(user_content) > max_len
            else user_content
        )

        async def _make_request() -> str:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.ai_service.base_url}{self.ai_service.endpoint_path}",
                    headers={
                        "Authorization": f"Bearer {self.ai_service.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": truncated},
                        ],
                        "temperature": temperature,
                    },
                )
                response.raise_for_status()
                result = response.json()

                content = (
                    result.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                )
                if not content:
                    raise ValueError("Empty response content from API")
                return content

        return await retry_with_exponential_backoff(
            _make_request,
            max_retries=self.max_retries,
            initial_delay=self.initial_retry_delay,
            max_delay=self.max_retry_delay,
            multiplier=self.retry_multiplier,
        )

    async def call_and_parse_json(
        self,
        system_prompt: str,
        user_content: str,
        temperature: float = 0.5,
        max_content_length: int | None = None,
    ) -> Any:
        """Call API and parse the response as JSON.

        Args:
            system_prompt: System prompt for the AI
            user_content: User message content
            temperature: Sampling temperature
            max_content_length: Maximum content length before truncation

        Returns:
            Parsed JSON data

        Raises:
            ValueError if response is empty or not valid JSON
        """
        raw = await self.call(
            system_prompt=system_prompt,
            user_content=user_content,
            temperature=temperature,
            max_content_length=max_content_length,
        )
        return extract_json_from_response(raw)
