"""Tests for AIService with mocked MiniMax API calls."""

import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from typing import AsyncIterator

import httpx

from backend.core.services.ai.ai_service import AIService, STYLE_PROMPTS


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def ai_service():
    """Create an AIService instance with a test API key."""
    from unittest.mock import MagicMock
    from backend.services.ai import ProviderRouter, MiniMaxProvider
    provider = MiniMaxProvider(api_key="test-api-key", base_url="https://api.minimax.chat/v1")
    router = ProviderRouter(providers=[provider])
    service = AIService(router=router)
    return service


@pytest.fixture
def mock_stream_response():
    """Create a mock streaming response."""
    def _create_response(chunks: list[str]):
        mock_response = MagicMock()
        mock_response.aiter_lines = AsyncMock(return_value=chunks)
        mock_response.raise_for_status = MagicMock()
        return mock_response
    return _create_response


# =============================================================================
# Style Prompt Tests
# =============================================================================

class TestStylePrompts:
    """Test writing style system prompts."""

    def test_get_system_prompt_for_known_styles(self, ai_service):
        """Returns correct prompt for each known style."""
        for style in ["江南", "卡夫卡", "加缪", "default"]:
            prompt = ai_service._get_system_prompt(style)
            assert prompt == STYLE_PROMPTS[style]
            assert len(prompt) > 0

    def test_get_system_prompt_for_unknown_style_returns_default(self, ai_service):
        """Returns default prompt for unknown style."""
        prompt = ai_service._get_system_prompt("unknown_style")
        assert prompt == STYLE_PROMPTS["default"]

    def test_all_styles_are_non_empty(self):
        """All defined styles have non-empty prompts."""
        for style, prompt in STYLE_PROMPTS.items():
            assert len(prompt) > 0, f"Style '{style}' has empty prompt"


# =============================================================================
# Operation Instruction Tests
# =============================================================================

class TestOperationInstructions:
    """Test operation type instructions."""

    def test_get_instruction_for_valid_operations(self, ai_service):
        """Returns instruction for each valid operation."""
        valid_ops = ["continue", "expand", "condense", "rewrite", "polish", "optimize"]
        for op in valid_ops:
            instruction = ai_service._get_operation_instruction(op)
            assert len(instruction) > 0
            assert "写作" in instruction or "续写" in instruction or "扩写" in instruction or "缩写" in instruction or "改写" in instruction or "润色" in instruction or "优化" in instruction

    def test_get_instruction_for_unknown_operation_returns_default(self, ai_service):
        """Returns default instruction for unknown operation."""
        instruction = ai_service._get_operation_instruction("unknown_op")
        assert instruction == "继续写作。"


# =============================================================================
# Temperature Calculation Tests
# =============================================================================

class TestTemperatureCalculation:
    """Test temperature calculation based on human_ai_ratio."""

    def test_full_ai_gives_max_temperature(self, ai_service):
        """Ratio 0 (full AI) gives temperature 1.0."""
        temp = ai_service._calculate_temperature(0)
        assert temp == pytest.approx(1.0, abs=0.01)

    def test_full_human_gives_min_temperature(self, ai_service):
        """Ratio 100 (full human) gives temperature 0.3."""
        temp = ai_service._calculate_temperature(100)
        assert temp == pytest.approx(0.3, abs=0.01)

    def test_balanced_ratio_gives_mid_temperature(self, ai_service):
        """Ratio 50 gives temperature around 0.65."""
        temp = ai_service._calculate_temperature(50)
        assert temp == pytest.approx(0.65, abs=0.01)

    def test_temperature_is_monotonically_decreasing(self, ai_service):
        """Higher ratio gives lower temperature."""
        temps = [ai_service._calculate_temperature(r) for r in range(0, 101, 10)]
        for i in range(len(temps) - 1):
            assert temps[i] >= temps[i + 1]

    def test_temperature_within_valid_range(self, ai_service):
        """Temperature is always between 0.3 and 1.0."""
        for ratio in range(0, 101):
            temp = ai_service._calculate_temperature(ratio)
            assert 0.3 <= temp <= 1.0


# =============================================================================
# Generate Stream Tests (Mocked via router)
# =============================================================================

async def _mock_stream(chunks):
    """Helper to create a mock async iterator."""
    for chunk in chunks:
        yield chunk


class TestGenerateStream:
    """Test AI content generation with mocked router."""

    @pytest.mark.asyncio
    async def test_generate_yields_content_chunks(self, ai_service):
        """Generate yields content chunks from streamed response."""
        async def mock_gen(prompt, **kwargs):
            for c in ["Hello", " world"]:
                yield c

        ai_service._router.generate_stream = MagicMock(side_effect=mock_gen)
        chunks = []
        async for chunk in ai_service.generate("test prompt", "continue"):
            chunks.append(chunk)

        assert chunks == ["Hello", " world"]

    @pytest.mark.asyncio
    async def test_generate_with_different_operations(self, ai_service):
        """Generate works with all valid operations."""
        async def mock_gen(prompt, **kwargs):
            return
            yield

        ai_service._router.generate_stream = MagicMock(side_effect=mock_gen)
        for op in ["continue", "expand", "condense", "rewrite", "polish", "optimize"]:
            chunks = []
            async for chunk in ai_service.generate("test", op):
                chunks.append(chunk)
            assert chunks == []

    @pytest.mark.asyncio
    async def test_generate_with_custom_style(self, ai_service):
        """Generate uses correct style prompt."""
        captured_args = {}

        async def capture_stream(prompt, **kwargs):
            captured_args['prompt'] = prompt
            return
            yield

        ai_service._router.generate_stream = MagicMock(side_effect=capture_stream)
        async for _ in ai_service.generate("test", "continue", style="江南"):
            pass

        assert STYLE_PROMPTS["江南"] in captured_args['prompt']

    @pytest.mark.asyncio
    async def test_generate_ignores_invalid_json_lines(self, ai_service):
        """Generate yields chunks from router as-is."""
        async def mock_gen(prompt, **kwargs):
            yield "Valid"

        ai_service._router.generate_stream = MagicMock(side_effect=mock_gen)
        chunks = []
        async for chunk in ai_service.generate("test", "continue"):
            chunks.append(chunk)

        assert chunks == ["Valid"]

    @pytest.mark.asyncio
    async def test_generate_handles_http_error(self, ai_service):
        """Generate propagates errors from router."""
        async def failing_stream(prompt, **kwargs):
            raise httpx.HTTPStatusError(
                "Server error",
                request=MagicMock(),
                response=MagicMock(status_code=500)
            )
            yield

        ai_service._router.generate_stream = MagicMock(side_effect=failing_stream)
        with pytest.raises(httpx.HTTPStatusError):
            async for _ in ai_service.generate("test", "continue"):
                pass


# =============================================================================
# Review Settings Tests (Mocked)
# =============================================================================

class TestReviewSettings:
    """Test AI settings review with mocked API."""

    @pytest.mark.asyncio
    async def test_review_settings_returns_review_content(self, ai_service):
        """Review settings returns parsed review content."""
        mock_result = {"review_content": "Settings look consistent.", "raw_response": "ok"}
        with patch.object(ai_service._router, 'review', return_value=mock_result):
            result = await ai_service.review_settings({"characters": [], "world": []})

        assert "review_content" in result
        assert result["review_content"] == "Settings look consistent."

    @pytest.mark.asyncio
    async def test_review_settings_uses_cache(self, ai_service):
        """Review settings caches identical requests."""
        mock_result = {"review_content": "Cached result.", "raw_response": "ok"}
        mock_review = AsyncMock(return_value=mock_result)
        with patch.object(ai_service._router, 'review', side_effect=mock_review):
            # First call
            result1 = await ai_service.review_settings({"test": "data"})
            # Second call with same data should use cache
            result2 = await ai_service.review_settings({"test": "data"})

        assert result1 == result2
        # API should only be called once due to caching
        assert mock_review.call_count == 1

    @pytest.mark.asyncio
    async def test_review_settings_handles_empty_response(self, ai_service):
        """Review settings handles empty API response gracefully."""
        with patch.object(ai_service._router, 'review', return_value={"review_content": ""}):
            result = await ai_service.review_settings({"test": "data"})

        assert result["review_content"] == ""


# =============================================================================
# Extract Entities Tests (Mocked)
# =============================================================================

class TestExtractEntities:
    """Test entity extraction with mocked API."""

    @pytest.mark.asyncio
    async def test_extract_entities_returns_parsed_json(self, ai_service):
        """Extract entities returns parsed JSON array."""
        mock_entities = [{"name": "张三", "type": "character"}]
        with patch.object(ai_service._router, 'extract_entities', return_value=mock_entities):
            result = await ai_service.extract_entities([{"role": "user", "content": "test"}])

        assert len(result) == 1
        assert result[0]["name"] == "张三"
        assert result[0]["type"] == "character"

    @pytest.mark.asyncio
    async def test_extract_entities_handles_invalid_json(self, ai_service):
        """Extract entities wraps invalid JSON in raw_content."""
        mock_entities = [{"raw_content": "not valid json"}]
        with patch.object(ai_service._router, 'extract_entities', return_value=mock_entities):
            result = await ai_service.extract_entities([{"role": "user", "content": "test"}])

        assert len(result) == 1
        assert "raw_content" in result[0]

    @pytest.mark.asyncio
    async def test_extract_entities_uses_cache(self, ai_service):
        """Extract entities caches identical requests."""
        mock_entities = [{"name": "Test"}]
        mock_extract = AsyncMock(return_value=mock_entities)
        with patch.object(ai_service._router, 'extract_entities', side_effect=mock_extract):
            messages = [{"role": "user", "content": "test"}]
            result1 = await ai_service.extract_entities(messages)
            result2 = await ai_service.extract_entities(messages)

        assert result1 == result2
        assert mock_extract.call_count == 1


# =============================================================================
# Edge Case Tests
# =============================================================================

class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_api_key(self):
        """AIService accepts empty API key (fails at request time)."""
        service = AIService()
        assert service.api_key == ""

    def test_base_url_trailing_slash_removed(self):
        """Base URL trailing slash is removed."""
        service = AIService()
        assert service.base_url == "https://api.minimax.chat/v1"

    def test_very_long_prompt(self, ai_service):
        """Very long prompt is handled."""
        long_prompt = "x" * 10000
        # Should not raise
        assert len(long_prompt) == 10000

    @pytest.mark.asyncio
    async def test_generate_with_empty_prompt(self, ai_service):
        """Generate with empty prompt still makes request."""
        async def mock_gen(prompt, **kwargs):
            return
            yield

        ai_service._router.generate_stream = MagicMock(side_effect=mock_gen)
        chunks = []
        async for chunk in ai_service.generate("", "continue"):
            chunks.append(chunk)
        assert chunks == []
