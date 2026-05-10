"""
Tests for AI service with mocked MiniMax API.
"""

import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch, Mock
from contextlib import asynccontextmanager

from backend.core.services.ai.ai_service import AIService, STYLE_PROMPTS


@pytest.fixture
def ai_service():
    """Create an AIService instance with a test API key."""
    return AIService(api_key="test-api-key", base_url="https://test.api/v1")


class TestAIServiceInitialization:
    """Test AIService initialization."""

    def test_init_with_defaults(self):
        """Test initialization with default base_url."""
        service = AIService(api_key="key123")
        assert service.api_key == "key123"
        assert service.base_url == "https://api.minimax.chat/v1"

    def test_init_with_custom_url(self):
        """Test initialization with custom base_url."""
        service = AIService(api_key="key123", base_url="https://custom.api/")
        assert service.base_url == "https://custom.api"

    def test_init_trailing_slash_removed(self):
        """Test trailing slash is removed from base_url."""
        service = AIService(api_key="key", base_url="https://api.test/")
        assert service.base_url == "https://api.test"


class TestStylePrompts:
    """Test style prompt retrieval."""

    def test_get_system_prompt_jiangnan(self, ai_service):
        """Test 江南 style prompt."""
        prompt = ai_service._get_system_prompt("江南")
        assert "东方玄幻" in prompt
        assert prompt == STYLE_PROMPTS["江南"]

    def test_get_system_prompt_kafka(self, ai_service):
        """Test 卡夫卡 style prompt."""
        prompt = ai_service._get_system_prompt("卡夫卡")
        assert "表现主义" in prompt

    def test_get_system_prompt_camus(self, ai_service):
        """Test 加缪 style prompt."""
        prompt = ai_service._get_system_prompt("加缪")
        assert "存在主义" in prompt

    def test_get_system_prompt_default(self, ai_service):
        """Test default style prompt."""
        prompt = ai_service._get_system_prompt("default")
        assert "网络小说作家" in prompt

    def test_get_system_prompt_unknown(self, ai_service):
        """Test unknown style falls back to default."""
        prompt = ai_service._get_system_prompt("nonexistent")
        assert prompt == STYLE_PROMPTS["default"]


class TestOperationInstructions:
    """Test operation instruction retrieval."""

    def test_get_operation_continue(self, ai_service):
        """Test continue operation instruction."""
        instruction = ai_service._get_operation_instruction("continue")
        assert "续写" in instruction

    def test_get_operation_expand(self, ai_service):
        """Test expand operation instruction."""
        instruction = ai_service._get_operation_instruction("expand")
        assert "扩写" in instruction

    def test_get_operation_condense(self, ai_service):
        """Test condense operation instruction."""
        instruction = ai_service._get_operation_instruction("condense")
        assert "缩写" in instruction

    def test_get_operation_rewrite(self, ai_service):
        """Test rewrite operation instruction."""
        instruction = ai_service._get_operation_instruction("rewrite")
        assert "改写" in instruction

    def test_get_operation_polish(self, ai_service):
        """Test polish operation instruction."""
        instruction = ai_service._get_operation_instruction("polish")
        assert "润色" in instruction

    def test_get_operation_optimize(self, ai_service):
        """Test optimize operation instruction."""
        instruction = ai_service._get_operation_instruction("optimize")
        assert "优化" in instruction

    def test_get_operation_unknown(self, ai_service):
        """Test unknown operation falls back."""
        instruction = ai_service._get_operation_instruction("unknown")
        assert instruction == "继续写作。"


class TestTemperatureCalculation:
    """Test temperature calculation based on human_ai_ratio."""

    def test_calculate_temperature_full_ai(self, ai_service):
        """Test temperature at 0 (full AI) = 1.0."""
        temp = ai_service._calculate_temperature(0)
        assert temp == pytest.approx(1.0, abs=0.01)

    def test_calculate_temperature_full_human(self, ai_service):
        """Test temperature at 100 (full human) = 0.3."""
        temp = ai_service._calculate_temperature(100)
        assert temp == pytest.approx(0.3, abs=0.01)

    def test_calculate_temperature_midpoint(self, ai_service):
        """Test temperature at 50 = 0.65."""
        temp = ai_service._calculate_temperature(50)
        assert temp == pytest.approx(0.65, abs=0.01)

    def test_calculate_temperature_70(self, ai_service):
        """Test temperature at 70 (default) = 0.51."""
        temp = ai_service._calculate_temperature(70)
        assert temp == pytest.approx(0.51, abs=0.01)

    def test_calculate_temperature_bounds(self, ai_service):
        """Test temperature stays within bounds."""
        assert ai_service._calculate_temperature(-10) <= 1.0
        assert ai_service._calculate_temperature(110) >= 0.3


class TestGenerateStreaming:
    """Test AI generate streaming method."""

    @pytest.mark.asyncio
    async def test_generate_yields_chunks(self, ai_service):
        """Test generate yields content chunks from streaming response."""
        mock_response = AsyncMock()
        mock_response.aiter_lines = AsyncMock(return_value=[
            'data: {"choices": [{"delta": {"content": "Hello"}}]}',
            'data: {"choices": [{"delta": {"content": " World"}}]}',
            'data: [DONE]',
        ])
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.stream = MagicMock(return_value=asynccontextmanager(lambda: (yield mock_response))())

        with patch('httpx.AsyncClient', return_value=mock_client):
            chunks = []
            async for chunk in ai_service.generate("Test prompt", "continue"):
                chunks.append(chunk)

        assert chunks == ["Hello", " World"]

    @pytest.mark.asyncio
    async def test_generate_ignores_invalid_json(self, ai_service):
        """Test generate skips invalid JSON lines."""
        mock_response = AsyncMock()
        mock_response.aiter_lines = AsyncMock(return_value=[
            'data: not json',
            'data: {"choices": [{"delta": {"content": "Valid"}}]}',
            'data: [DONE]',
        ])
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.stream = MagicMock(return_value=asynccontextmanager(lambda: (yield mock_response))())

        with patch('httpx.AsyncClient', return_value=mock_client):
            chunks = []
            async for chunk in ai_service.generate("Test prompt", "continue"):
                chunks.append(chunk)

        assert chunks == ["Valid"]

    @pytest.mark.asyncio
    async def test_generate_ignores_missing_choices(self, ai_service):
        """Test generate skips lines without choices."""
        mock_response = AsyncMock()
        mock_response.aiter_lines = AsyncMock(return_value=[
            'data: {"choices": []}',
            'data: {"choices": [{"delta": {"content": "Yes"}}]}',
            'data: [DONE]',
        ])
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.stream = MagicMock(return_value=asynccontextmanager(lambda: (yield mock_response))())

        with patch('httpx.AsyncClient', return_value=mock_client):
            chunks = []
            async for chunk in ai_service.generate("Test prompt", "continue"):
                chunks.append(chunk)

        assert chunks == ["Yes"]

    @pytest.mark.asyncio
    async def test_generate_with_style(self, ai_service):
        """Test generate uses style in prompt."""
        mock_response = AsyncMock()
        mock_response.aiter_lines = AsyncMock(return_value=['data: [DONE]'])
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.stream = MagicMock(return_value=asynccontextmanager(lambda: (yield mock_response))())

        with patch('httpx.AsyncClient', return_value=mock_client):
            async for _ in ai_service.generate("Test", "continue", style="江南"):
                pass

        call_args = mock_client.stream.call_args
        json_payload = call_args[1]['json']
        assert json_payload['temperature'] == pytest.approx(0.51, abs=0.01)

    @pytest.mark.asyncio
    async def test_generate_with_ratio(self, ai_service):
        """Test generate uses human_ai_ratio for temperature."""
        mock_response = AsyncMock()
        mock_response.aiter_lines = AsyncMock(return_value=['data: [DONE]'])
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.stream = MagicMock(return_value=asynccontextmanager(lambda: (yield mock_response))())

        with patch('httpx.AsyncClient', return_value=mock_client):
            async for _ in ai_service.generate("Test", "continue", human_ai_ratio=30):
                pass

        call_args = mock_client.stream.call_args
        json_payload = call_args[1]['json']
        assert json_payload['temperature'] == pytest.approx(0.79, abs=0.01)


class TestReviewSettings:
    """Test review_settings method."""

    @pytest.mark.asyncio
    async def test_review_settings_success(self, ai_service):
        """Test review_settings returns parsed result."""
        mock_response = AsyncMock()
        mock_response.json = Mock(return_value={
            "choices": [{"message": {"content": "Review content here"}}]
        })
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            result = await ai_service.review_settings({"world": "test"})

        assert result["review_content"] == "Review content here"
        assert "raw_response" in result

    @pytest.mark.asyncio
    async def test_review_settings_api_error(self, ai_service):
        """Test review_settings handles API errors."""
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=Exception("API Error"))

        with patch('httpx.AsyncClient', return_value=mock_client):
            with pytest.raises(Exception, match="API Error"):
                await ai_service.review_settings({"world": "test"})


class TestExtractEntities:
    """Test extract_entities method."""

    @pytest.mark.asyncio
    async def test_extract_entities_json_response(self, ai_service):
        """Test extract_entities parses JSON response."""
        entities = [{"name": "Hero", "type": "character"}]
        mock_response = AsyncMock()
        mock_response.json = Mock(return_value={
            "choices": [{"message": {"content": json.dumps(entities)}}]
        })
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            result = await ai_service.extract_entities([{"role": "user", "content": "test"}])

        assert result == entities

    @pytest.mark.asyncio
    async def test_extract_entities_non_json_response(self, ai_service):
        """Test extract_entities handles non-JSON response."""
        mock_response = AsyncMock()
        mock_response.json = Mock(return_value={
            "choices": [{"message": {"content": "Raw text response"}}]
        })
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            result = await ai_service.extract_entities([{"role": "user", "content": "test"}])

        assert len(result) == 1
        assert result[0]["raw_content"] == "Raw text response"

    @pytest.mark.asyncio
    async def test_extract_entities_dict_response(self, ai_service):
        """Test extract_entities handles dict instead of list."""
        mock_response = AsyncMock()
        mock_response.json = Mock(return_value={
            "choices": [{"message": {"content": json.dumps({"name": "Hero"})}}]
        })
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            result = await ai_service.extract_entities([{"role": "user", "content": "test"}])

        assert result == []

    @pytest.mark.asyncio
    async def test_extract_entities_empty_response(self, ai_service):
        """Test extract_entities handles empty content."""
        mock_response = AsyncMock()
        mock_response.json = Mock(return_value={
            "choices": [{"message": {"content": ""}}]
        })
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            result = await ai_service.extract_entities([{"role": "user", "content": "test"}])

        assert len(result) == 1
        assert result[0]["raw_content"] == ""
