"""
Tests for all 6 AI checker agents.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, Mock, patch

from backend.agents.checkers import (
    ConsistencyChecker,
    PacingChecker,
    OOCChecker,
    ContinuityChecker,
    HighPointChecker,
    ReaderPullChecker,
    OutlineLawEnforcer,
    SettingPhysicsEnforcer,
)
from backend.agents.checkers.base import CheckerResult


def _make_async_result(value):
    """Helper to create an async query result mock."""
    result = MagicMock()
    result.scalar_one_or_none = Mock(return_value=value)
    result.scalars = Mock(return_value=MagicMock(all=Mock(return_value=[])))
    return result


def _make_async_result_list(values):
    """Helper to create an async query result mock that returns a list."""
    result = MagicMock()
    result.scalar_one_or_none = Mock(return_value=None)
    result.scalars = Mock(return_value=MagicMock(all=Mock(return_value=values)))
    return result


@pytest.fixture
def mock_ai_service():
    """Create a mock AI service."""
    service = MagicMock()
    service.api_key = "test-key"
    service.base_url = "https://test.api/v1"
    return service


@pytest.fixture
def mock_db():
    """Create a mock async database session."""
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_make_async_result(None))
    return db


@pytest.fixture
def mock_chapter():
    """Create a mock chapter."""
    chapter = MagicMock()
    chapter.id = 1
    chapter.title = "Test Chapter"
    chapter.summary = "Test summary"
    chapter.outline_id = 1
    chapter.chapter_order = 1
    return chapter


@pytest.fixture
def mock_draft():
    """Create a mock draft version."""
    draft = MagicMock()
    draft.content = "Test chapter content"
    draft.version_number = 1
    return draft


@pytest.fixture
def mock_character():
    """Create a mock character."""
    char = MagicMock()
    char.id = 1
    char.name = "Hero"
    char.gender = "male"
    char.personality = "Brave and kind"
    char.desires = "Save the world"
    char.flaws = "Overconfident"
    char.description = "Main protagonist"
    char.cultivation_realm = "Foundation"
    return char


class TestConsistencyChecker:
    """Test ConsistencyChecker (has check + deep_analyze)."""

    @pytest.fixture
    def checker(self, mock_ai_service):
        return ConsistencyChecker(mock_ai_service)

    @pytest.mark.asyncio
    async def test_check_no_chapter(self, checker, mock_db):
        """Test check returns default when chapter not found."""
        result = await checker.check(999, mock_db)
        assert result == {"issues": [], "suggestions": [], "score": 100}

    @pytest.mark.asyncio
    async def test_check_with_chapter(self, checker, mock_db, mock_chapter, mock_draft):
        """Test check with valid chapter and draft."""
        mock_db.execute = AsyncMock(side_effect=[
            _make_async_result(mock_chapter),
            _make_async_result(mock_draft),
            _make_async_result_list([]),
            _make_async_result_list([]),
            _make_async_result_list([]),
            _make_async_result_list([]),
        ])

        checker._api_client = AsyncMock()
        checker._api_client.call = AsyncMock(
            return_value='{"issues": ["issue1"], "suggestions": ["suggestion1"], "score": 85}'
        )

        result = await checker.check(1, mock_db)
        assert result["score"] == 85
        assert "issue1" in result["issues"]

    @pytest.mark.asyncio
    async def test_check_json_decode_error(self, checker, mock_db, mock_chapter, mock_draft):
        """Test check handles JSON decode error gracefully."""
        mock_db.execute = AsyncMock(side_effect=[
            _make_async_result(mock_chapter),
            _make_async_result(mock_draft),
            _make_async_result_list([]),
            _make_async_result_list([]),
            _make_async_result_list([]),
            _make_async_result_list([]),
        ])

        checker._api_client = AsyncMock()
        checker._api_client.call = AsyncMock(return_value="not valid json")

        result = await checker.check(1, mock_db)
        assert result["score"] == 70
        assert "格式错误" in result["issues"][0]

    @pytest.mark.asyncio
    async def test_check_api_error(self, checker, mock_db, mock_chapter, mock_draft):
        """Test check handles API error gracefully."""
        mock_db.execute = AsyncMock(side_effect=[
            _make_async_result(mock_chapter),
            _make_async_result(mock_draft),
            _make_async_result_list([]),
            _make_async_result_list([]),
            _make_async_result_list([]),
            _make_async_result_list([]),
        ])

        checker._api_client = AsyncMock()
        checker._api_client.call = AsyncMock(side_effect=Exception("Network error"))

        result = await checker.check(1, mock_db)
        assert result["score"] == 0
        assert "失败" in result["issues"][0]

    @pytest.mark.asyncio
    async def test_deep_analyze_success(self, checker):
        """Test deep_analyze returns CheckerResult."""
        checker._api_client = AsyncMock()
        checker._api_client.call = AsyncMock(
            return_value='{"issues": [], "suggestions": [], "score": 90}'
        )

        result = await checker.deep_analyze("test content", {"world_settings": {}})
        assert isinstance(result, CheckerResult)
        assert result.score == 90


class TestPacingChecker:
    """Test PacingChecker (deep_analyze only)."""

    @pytest.fixture
    def checker(self, mock_ai_service):
        return PacingChecker(mock_ai_service)

    def test_strand_ratios_constant(self):
        """Test strand ratios are correctly defined."""
        assert PacingChecker.STRAND_RATIOS["quest"] == 0.60
        assert PacingChecker.STRAND_RATIOS["fire"] == 0.20
        assert PacingChecker.STRAND_RATIOS["constellation"] == 0.20

    @pytest.mark.asyncio
    async def test_quick_scan_basic(self, checker):
        """Test quick_scan returns a CheckerResult."""
        result = await checker.quick_scan("这是一段测试内容，主角开始修炼。")
        assert isinstance(result, CheckerResult)
        assert 0 <= result.score <= 100

    @pytest.mark.asyncio
    async def test_deep_analyze_success(self, checker):
        """Test deep_analyze with mocked AI response."""
        checker._api_client = AsyncMock()
        checker._api_client.call = AsyncMock(
            return_value='{"issues": [], "suggestions": [], "score": 90}'
        )

        result = await checker.deep_analyze("test content", {"genre": "玄幻"})
        assert isinstance(result, CheckerResult)
        assert result.score == 90

    @pytest.mark.asyncio
    async def test_deep_analyze_json_error(self, checker):
        """Test deep_analyze handles invalid JSON."""
        checker._api_client = AsyncMock()
        checker._api_client.call = AsyncMock(return_value="invalid json")

        result = await checker.deep_analyze("test content", {})
        assert isinstance(result, CheckerResult)
        assert result.score == 70

    @pytest.mark.asyncio
    async def test_deep_analyze_no_client(self, checker):
        """Test deep_analyze returns error when no AI client."""
        checker._api_client = None
        result = await checker.deep_analyze("test content", {})
        assert result.score == 0


class TestOOCChecker:
    """Test OOCChecker (deep_analyze only)."""

    @pytest.fixture
    def checker(self, mock_ai_service):
        return OOCChecker(mock_ai_service)

    @pytest.mark.asyncio
    async def test_quick_scan_basic(self, checker):
        """Test quick_scan returns a CheckerResult."""
        result = await checker.quick_scan("Hero spoke bravely.")
        assert isinstance(result, CheckerResult)
        assert 0 <= result.score <= 100

    @pytest.mark.asyncio
    async def test_deep_analyze_success(self, checker):
        """Test deep_analyze with mocked AI response."""
        checker._api_client = AsyncMock()
        checker._api_client.call = AsyncMock(
            return_value='{"issues": [], "suggestions": [], "score": 95, "violations": []}'
        )

        result = await checker.deep_analyze("test content", {
            "character": {"name": "Hero", "personality": "Brave"}
        })
        assert isinstance(result, CheckerResult)
        assert result.score == 95

    @pytest.mark.asyncio
    async def test_deep_analyze_api_error(self, checker):
        """Test deep_analyze handles API errors."""
        checker._api_client = AsyncMock()
        checker._api_client.call = AsyncMock(side_effect=Exception("API Error"))

        result = await checker.deep_analyze("test content", {
            "character": {"name": "Hero"}
        })
        assert result.score == 0

    @pytest.mark.asyncio
    async def test_deep_analyze_no_client(self, checker):
        """Test deep_analyze returns error when no AI client."""
        checker._api_client = None
        result = await checker.deep_analyze("test content", {})
        assert result.score == 0


class TestContinuityChecker:
    """Test ContinuityChecker (has check + deep_analyze)."""

    @pytest.fixture
    def checker(self, mock_ai_service):
        return ContinuityChecker(mock_ai_service)

    @pytest.mark.asyncio
    async def test_check_no_chapter(self, checker, mock_db):
        """Test check returns default when chapter not found."""
        result = await checker.check(999, mock_db)
        assert result["score"] == 100
        assert result["issues"] == []

    @pytest.mark.asyncio
    async def test_check_success(self, checker, mock_db, mock_chapter, mock_draft):
        """Test successful continuity check."""
        mock_db.execute = AsyncMock(side_effect=[
            _make_async_result(mock_chapter),
            _make_async_result(mock_draft),
            _make_async_result_list([]),
            _make_async_result_list([]),
        ])

        checker._api_client = AsyncMock()
        checker._api_client.call = AsyncMock(
            return_value='{"issues": [], "suggestions": [], "score": 88, "plot_thread_status": {"fulfilled": [], "continued": [], "new_setup": []}}'
        )

        result = await checker.check(1, mock_db)
        assert result["score"] == 88
        assert "plot_thread_status" in result

    @pytest.mark.asyncio
    async def test_deep_analyze_success(self, checker):
        """Test deep_analyze returns CheckerResult."""
        checker._api_client = AsyncMock()
        checker._api_client.call = AsyncMock(
            return_value='{"issues": [], "suggestions": [], "score": 85}'
        )

        result = await checker.deep_analyze("test content", {})
        assert isinstance(result, CheckerResult)
        assert result.score == 85


class TestHighPointChecker:
    """Test HighPointChecker (deep_analyze only)."""

    @pytest.fixture
    def checker(self, mock_ai_service):
        return HighPointChecker(mock_ai_service)

    @pytest.mark.asyncio
    async def test_quick_scan_basic(self, checker):
        """Test quick_scan returns a CheckerResult."""
        result = await checker.quick_scan("战斗爆发了，主角使出绝招。")
        assert isinstance(result, CheckerResult)
        assert 0 <= result.score <= 100

    @pytest.mark.asyncio
    async def test_deep_analyze_success(self, checker):
        """Test deep_analyze with mocked AI response."""
        checker._api_client = AsyncMock()
        checker._api_client.call = AsyncMock(
            return_value='{"issues": [], "suggestions": [], "score": 92}'
        )

        result = await checker.deep_analyze("test content", {})
        assert isinstance(result, CheckerResult)
        assert result.score == 92

    @pytest.mark.asyncio
    async def test_deep_analyze_json_error(self, checker):
        """Test deep_analyze handles invalid JSON."""
        checker._api_client = AsyncMock()
        checker._api_client.call = AsyncMock(return_value="bad json")

        result = await checker.deep_analyze("test content", {})
        assert isinstance(result, CheckerResult)
        assert result.score == 70

    @pytest.mark.asyncio
    async def test_deep_analyze_no_client(self, checker):
        """Test deep_analyze returns error when no AI client."""
        checker._api_client = None
        result = await checker.deep_analyze("test content", {})
        assert result.score == 0


class TestReaderPullChecker:
    """Test ReaderPullChecker (deep_analyze only)."""

    @pytest.fixture
    def checker(self, mock_ai_service):
        return ReaderPullChecker(mock_ai_service)

    @pytest.mark.asyncio
    async def test_quick_scan_basic(self, checker):
        """Test quick_scan returns a CheckerResult."""
        result = await checker.quick_scan("突然，门外传来一阵脚步声。")
        assert isinstance(result, CheckerResult)
        assert 0 <= result.score <= 100

    @pytest.mark.asyncio
    async def test_deep_analyze_success(self, checker):
        """Test deep_analyze with mocked AI response."""
        checker._api_client = AsyncMock()
        checker._api_client.call = AsyncMock(
            return_value='{"issues": [], "suggestions": [], "score": 87}'
        )

        result = await checker.deep_analyze("test content", {})
        assert isinstance(result, CheckerResult)
        assert result.score == 87

    @pytest.mark.asyncio
    async def test_deep_analyze_api_error(self, checker):
        """Test deep_analyze handles API errors."""
        checker._api_client = AsyncMock()
        checker._api_client.call = AsyncMock(side_effect=Exception("API Error"))

        result = await checker.deep_analyze("test content", {})
        assert result.score == 0

    @pytest.mark.asyncio
    async def test_deep_analyze_no_client(self, checker):
        """Test deep_analyze returns error when no AI client."""
        checker._api_client = None
        result = await checker.deep_analyze("test content", {})
        assert result.score == 0


class TestCheckerImports:
    """Test that all checkers can be imported from the package."""

    def test_all_checkers_importable(self):
        """Test all 8 checkers are importable."""
        from backend.agents.checkers import __all__

        assert "ConsistencyChecker" in __all__
        assert "PacingChecker" in __all__
        assert "OOCChecker" in __all__
        assert "ContinuityChecker" in __all__
        assert "HighPointChecker" in __all__
        assert "ReaderPullChecker" in __all__
        assert "OutlineLawEnforcer" in __all__
        assert "SettingPhysicsEnforcer" in __all__
