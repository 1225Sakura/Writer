"""
Tests for AI service with mocked ProviderRouter.
"""

import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch, Mock

from backend.core.services.ai.ai_service import AIService, STYLE_PROMPTS


@pytest.fixture
def mock_router():
    """Create a mock ProviderRouter."""
    router = MagicMock()
    router.generate_stream = AsyncMock(return_value=iter([]))
    router.review = AsyncMock(return_value={"review_content": "ok"})
    router.extract_entities = AsyncMock(return_value=[])
    router.health_status = MagicMock(return_value={})
    router.get_metrics = MagicMock(return_value={})
    router.get_recommended_provider = MagicMock()
    return router


@pytest.fixture
def ai_service(mock_router):
    """Create an AIService instance with a mock router."""
    return AIService(router=mock_router)


class TestAIServiceInitialization:
    """Test AIService initialization."""

    def test_init_with_defaults(self):
        """Test initialization with no router."""
        service = AIService()
        assert service.router is None
        assert service.api_key == ""
        assert service.base_url == "https://api.minimax.chat/v1"

    def test_init_with_router(self, mock_router):
        """Test initialization with router."""
        service = AIService(router=mock_router)
        assert service.router is mock_router

    def test_set_router(self):
        """Test setting router after init."""
        service = AIService()
        router = MagicMock()
        service.set_router(router)
        assert service.router is router


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
        instruction = ai_service._get_operation_instruction("continue")
        assert "续写" in instruction

    def test_get_operation_expand(self, ai_service):
        instruction = ai_service._get_operation_instruction("expand")
        assert "扩写" in instruction

    def test_get_operation_condense(self, ai_service):
        instruction = ai_service._get_operation_instruction("condense")
        assert "缩写" in instruction

    def test_get_operation_rewrite(self, ai_service):
        instruction = ai_service._get_operation_instruction("rewrite")
        assert "改写" in instruction

    def test_get_operation_polish(self, ai_service):
        instruction = ai_service._get_operation_instruction("polish")
        assert "润色" in instruction

    def test_get_operation_optimize(self, ai_service):
        instruction = ai_service._get_operation_instruction("optimize")
        assert "优化" in instruction

    def test_get_operation_unknown(self, ai_service):
        instruction = ai_service._get_operation_instruction("unknown")
        assert instruction == "继续写作。"


class TestTemperatureCalculation:
    """Test temperature calculation based on human_ai_ratio."""

    def test_calculate_temperature_full_ai(self, ai_service):
        temp = ai_service._calculate_temperature(0)
        assert temp == pytest.approx(1.0, abs=0.01)

    def test_calculate_temperature_full_human(self, ai_service):
        temp = ai_service._calculate_temperature(100)
        assert temp == pytest.approx(0.3, abs=0.01)

    def test_calculate_temperature_midpoint(self, ai_service):
        temp = ai_service._calculate_temperature(50)
        assert temp == pytest.approx(0.65, abs=0.01)

    def test_calculate_temperature_70(self, ai_service):
        temp = ai_service._calculate_temperature(70)
        assert temp == pytest.approx(0.51, abs=0.01)

    def test_calculate_temperature_out_of_range(self, ai_service):
        # Out-of-range inputs produce out-of-range temps (no clamping)
        assert ai_service._calculate_temperature(-10) > 1.0
        assert ai_service._calculate_temperature(110) < 0.3


class TestGenerateStreaming:
    """Test AI generate streaming method."""

    @pytest.mark.asyncio
    async def test_generate_yields_chunks(self, ai_service, mock_router):
        """Test generate yields content chunks from streaming response."""

        async def fake_stream(*args, **kwargs):
            yield "Hello"
            yield " World"

        mock_router.generate_stream = fake_stream

        chunks = []
        async for chunk in ai_service.generate("Test prompt", "continue"):
            chunks.append(chunk)

        assert chunks == ["Hello", " World"]

    @pytest.mark.asyncio
    async def test_generate_empty_stream(self, ai_service, mock_router):
        """Test generate handles empty stream."""

        async def fake_stream(*args, **kwargs):
            return
            yield  # make it an async generator

        mock_router.generate_stream = fake_stream

        chunks = []
        async for chunk in ai_service.generate("Test prompt", "continue"):
            chunks.append(chunk)

        assert chunks == []

    @pytest.mark.asyncio
    async def test_generate_calls_router(self, ai_service, mock_router):
        """Test generate delegates to router.generate_stream."""
        call_args = {}

        async def capture_stream(prompt, style, operation):
            call_args["prompt"] = prompt
            call_args["style"] = style
            call_args["operation"] = operation
            yield "result"

        mock_router.generate_stream = capture_stream

        async for _ in ai_service.generate("Test", "expand", style="江南", human_ai_ratio=30):
            pass

        assert "东方玄幻" in call_args["prompt"]
        assert "扩写" in call_args["prompt"]


class TestReviewSettings:
    """Test review_settings method."""

    @pytest.fixture(autouse=True)
    def _no_cache(self):
        """Disable AI cache so each test hits the router mock."""
        with patch("backend.core.services.ai.ai_service.get_cached_ai_result", return_value=None):
            yield

    @pytest.mark.asyncio
    async def test_review_settings_success(self, ai_service, mock_router):
        """Test review_settings delegates to router."""
        expected = {"review_content": "Looks good", "issues": []}
        mock_router.review = AsyncMock(return_value=expected)

        result = await ai_service.review_settings({"world": "test"})
        assert result == expected

    @pytest.mark.asyncio
    async def test_review_settings_api_error(self, ai_service, mock_router):
        """Test review_settings propagates API errors."""
        mock_router.review = AsyncMock(side_effect=Exception("API Error"))

        with pytest.raises(Exception, match="API Error"):
            await ai_service.review_settings({"world": "test"})


class TestExtractEntities:
    """Test extract_entities method."""

    @pytest.fixture(autouse=True)
    def _no_cache(self):
        """Disable AI cache so each test hits the router mock."""
        with patch("backend.core.services.ai.ai_service.get_cached_ai_result", return_value=None):
            yield

    @pytest.mark.asyncio
    async def test_extract_entities_success(self, ai_service, mock_router):
        """Test extract_entities delegates to router."""
        entities = [{"name": "Hero", "type": "character"}]
        mock_router.extract_entities = AsyncMock(return_value=entities)

        result = await ai_service.extract_entities([{"role": "user", "content": "test"}])
        assert result == entities

    @pytest.mark.asyncio
    async def test_extract_entities_empty(self, ai_service, mock_router):
        """Test extract_entities with empty result."""
        mock_router.extract_entities = AsyncMock(return_value=[])

        result = await ai_service.extract_entities([{"role": "user", "content": "test"}])
        assert result == []

    @pytest.mark.asyncio
    async def test_extract_entities_api_error(self, ai_service, mock_router):
        """Test extract_entities propagates API errors."""
        mock_router.extract_entities = AsyncMock(side_effect=Exception("API Error"))

        with pytest.raises(Exception, match="API Error"):
            await ai_service.extract_entities([{"role": "user", "content": "test"}])
