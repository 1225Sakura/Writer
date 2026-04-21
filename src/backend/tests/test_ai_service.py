"""Tests for AIService with mocked MiniMax API calls."""

import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from typing import AsyncIterator

import httpx

from backend.services.ai_service import AIService, STYLE_PROMPTS


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def ai_service():
    """Create an AIService instance with a test API key."""
    return AIService(api_key="test-api-key", base_url="https://api.minimax.chat/v1")


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
# Generate Stream Tests (Mocked)
# =============================================================================

class TestGenerateStream:
    """Test AI content generation with mocked API."""

    @pytest.mark.asyncio
    async def test_generate_yields_content_chunks(self, ai_service):
        """Generate yields content chunks from streamed response."""
        mock_chunks = [
            'data: {"choices": [{"delta": {"content": "Hello"}}]}',
            'data: {"choices": [{"delta": {"content": " world"}}]}',
            'data: [DONE]',
        ]

        mock_response = MagicMock()
        mock_response.aiter_lines = AsyncMock(return_value=mock_chunks)
        mock_response.raise_for_status = MagicMock()

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.stream = MagicMock(return_value=mock_response)
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=None)

        with patch('httpx.AsyncClient', return_value=mock_client):
            chunks = []
            async for chunk in ai_service.generate("test prompt", "continue"):
                chunks.append(chunk)

        assert chunks == ["Hello", " world"]

    @pytest.mark.asyncio
    async def test_generate_with_different_operations(self, ai_service):
        """Generate works with all valid operations."""
        mock_response = MagicMock()
        mock_response.aiter_lines = AsyncMock(return_value=['data: [DONE]'])
        mock_response.raise_for_status = MagicMock()
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=None)

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.stream = MagicMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            for op in ["continue", "expand", "condense", "rewrite", "polish", "optimize"]:
                chunks = []
                async for chunk in ai_service.generate("test", op):
                    chunks.append(chunk)
                assert chunks == []

    @pytest.mark.asyncio
    async def test_generate_with_custom_style(self, ai_service):
        """Generate uses correct style prompt."""
        captured_json = {}

        mock_response = MagicMock()
        mock_response.aiter_lines = AsyncMock(return_value=['data: [DONE]'])
        mock_response.raise_for_status = MagicMock()
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=None)

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        def capture_stream(*args, **kwargs):
            captured_json.update(kwargs.get('json', {}))
            return mock_response

        mock_client.stream = capture_stream

        with patch('httpx.AsyncClient', return_value=mock_client):
            async for _ in ai_service.generate("test", "continue", style="江南"):
                pass

        assert "messages" in captured_json
        assert STYLE_PROMPTS["江南"] in captured_json["messages"][0]["content"]

    @pytest.mark.asyncio
    async def test_generate_ignores_invalid_json_lines(self, ai_service):
        """Generate skips lines with invalid JSON."""
        mock_chunks = [
            'data: {"choices": [{"delta": {"content": "Valid"}}]}',
            'data: invalid json here',
            'data: {"choices": [{"delta": {}}]}',
            'data: [DONE]',
        ]

        mock_response = MagicMock()
        mock_response.aiter_lines = AsyncMock(return_value=mock_chunks)
        mock_response.raise_for_status = MagicMock()
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=None)

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.stream = MagicMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            chunks = []
            async for chunk in ai_service.generate("test", "continue"):
                chunks.append(chunk)

        assert chunks == ["Valid"]

    @pytest.mark.asyncio
    async def test_generate_handles_http_error(self, ai_service):
        """Generate raises HTTPStatusError on API failure."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock(
            side_effect=httpx.HTTPStatusError(
                "Server error",
                request=MagicMock(),
                response=MagicMock(status_code=500)
            )
        )
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=None)

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.stream = MagicMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
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
        mock_response = MagicMock()
        mock_response.json = MagicMock(return_value={
            "choices": [{"message": {"content": "Settings look consistent."}}]
        })
        mock_response.raise_for_status = MagicMock()

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            result = await ai_service.review_settings({"characters": [], "world": []})

        assert "review_content" in result
        assert result["review_content"] == "Settings look consistent."
        assert "raw_response" in result

    @pytest.mark.asyncio
    async def test_review_settings_uses_cache(self, ai_service):
        """Review settings caches identical requests."""
        mock_response = MagicMock()
        mock_response.json = MagicMock(return_value={
            "choices": [{"message": {"content": "Cached result."}}]
        })
        mock_response.raise_for_status = MagicMock()

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            # First call
            result1 = await ai_service.review_settings({"test": "data"})
            # Second call with same data should use cache
            result2 = await ai_service.review_settings({"test": "data"})

        assert result1 == result2
        # API should only be called once due to caching
        assert mock_client.post.call_count == 1

    @pytest.mark.asyncio
    async def test_review_settings_handles_empty_response(self, ai_service):
        """Review settings handles empty API response gracefully."""
        mock_response = MagicMock()
        mock_response.json = MagicMock(return_value={"choices": []})
        mock_response.raise_for_status = MagicMock()

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
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
        mock_response = MagicMock()
        mock_response.json = MagicMock(return_value={
            "choices": [{"message": {"content": '[{"name": "张三", "type": "character"}]'}}]
        })
        mock_response.raise_for_status = MagicMock()

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            result = await ai_service.extract_entities([{"role": "user", "content": "test"}])

        assert len(result) == 1
        assert result[0]["name"] == "张三"
        assert result[0]["type"] == "character"

    @pytest.mark.asyncio
    async def test_extract_entities_handles_invalid_json(self, ai_service):
        """Extract entities wraps invalid JSON in raw_content."""
        mock_response = MagicMock()
        mock_response.json = MagicMock(return_value={
            "choices": [{"message": {"content": "not valid json"}}]
        })
        mock_response.raise_for_status = MagicMock()

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            result = await ai_service.extract_entities([{"role": "user", "content": "test"}])

        assert len(result) == 1
        assert "raw_content" in result[0]

    @pytest.mark.asyncio
    async def test_extract_entities_uses_cache(self, ai_service):
        """Extract entities caches identical requests."""
        mock_response = MagicMock()
        mock_response.json = MagicMock(return_value={
            "choices": [{"message": {"content": '[{"name": "Test"}]'}}]
        })
        mock_response.raise_for_status = MagicMock()

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            messages = [{"role": "user", "content": "test"}]
            result1 = await ai_service.extract_entities(messages)
            result2 = await ai_service.extract_entities(messages)

        assert result1 == result2
        assert mock_client.post.call_count == 1


# =============================================================================
# Edge Case Tests
# =============================================================================

class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_api_key(self):
        """AIService accepts empty API key (fails at request time)."""
        service = AIService(api_key="")
        assert service.api_key == ""

    def test_base_url_trailing_slash_removed(self):
        """Base URL trailing slash is removed."""
        service = AIService(api_key="test", base_url="https://api.example.com/")
        assert service.base_url == "https://api.example.com"

    def test_very_long_prompt(self, ai_service):
        """Very long prompt is handled."""
        long_prompt = "x" * 10000
        # Should not raise
        assert len(long_prompt) == 10000

    @pytest.mark.asyncio
    async def test_generate_with_empty_prompt(self, ai_service):
        """Generate with empty prompt still makes request."""
        mock_response = MagicMock()
        mock_response.aiter_lines = AsyncMock(return_value=['data: [DONE]'])
        mock_response.raise_for_status = MagicMock()
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=None)

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.stream = MagicMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            chunks = []
            async for chunk in ai_service.generate("", "continue"):
                chunks.append(chunk)
            assert chunks == []
