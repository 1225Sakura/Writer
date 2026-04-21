"""
Tests for all 6 AI checker agents.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))

from agents.checkers import (
    ConsistencyChecker,
    PacingChecker,
    OOCChecker,
    ContinuityChecker,
    HighPointChecker,
    ReaderPullChecker,
)


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
    """Test ConsistencyChecker."""

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

        mock_response = AsyncMock()
        mock_response.json = Mock(return_value={
            "choices": [{"message": {"content": '{"issues": ["issue1"], "suggestions": ["suggestion1"], "score": 85}'}}]
        })
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
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

        mock_response = AsyncMock()
        mock_response.json = Mock(return_value={
            "choices": [{"message": {"content": "not valid json"}}]
        })
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
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

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=Exception("Network error"))

        with patch('httpx.AsyncClient', return_value=mock_client):
            result = await checker.check(1, mock_db)

        assert result["score"] == 0
        assert "失败" in result["issues"][0]


class TestPacingChecker:
    """Test PacingChecker."""

    @pytest.fixture
    def checker(self, mock_ai_service):
        return PacingChecker(mock_ai_service)

    def test_strand_ratios_constant(self):
        """Test strand ratios are correctly defined."""
        assert PacingChecker.STRAND_RATIOS["quest"] == 0.60
        assert PacingChecker.STRAND_RATIOS["fire"] == 0.20
        assert PacingChecker.STRAND_RATIOS["constellation"] == 0.20

    @pytest.mark.asyncio
    async def test_check_no_chapter(self, checker, mock_db):
        """Test check returns default when chapter not found."""
        result = await checker.check(999, mock_db)

        assert result["score"] == 100
        assert result["strand_ratios"] == {}

    @pytest.mark.asyncio
    async def test_check_success(self, checker, mock_db, mock_chapter, mock_draft):
        """Test successful pacing check."""
        mock_db.execute = AsyncMock(side_effect=[
            _make_async_result(mock_chapter),
            _make_async_result(mock_draft),
        ])

        mock_response = AsyncMock()
        mock_response.json = Mock(return_value={
            "choices": [{"message": {"content": '{"issues": [], "suggestions": [], "score": 90, "strand_ratios": {"quest": 0.6, "fire": 0.2, "constellation": 0.2}, "analysis": "Good pacing"}'}}]
        })
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            result = await checker.check(1, mock_db)

        assert result["score"] == 90
        assert result["strand_ratios"]["quest"] == 0.6
        assert result["analysis"] == "Good pacing"

    @pytest.mark.asyncio
    async def test_check_json_error(self, checker, mock_db, mock_chapter, mock_draft):
        """Test check handles invalid JSON response."""
        mock_db.execute = AsyncMock(side_effect=[
            _make_async_result(mock_chapter),
            _make_async_result(mock_draft),
        ])

        mock_response = AsyncMock()
        mock_response.json = Mock(return_value={
            "choices": [{"message": {"content": "invalid"}}]
        })
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            result = await checker.check(1, mock_db)

        assert result["score"] == 70
        assert result["strand_ratios"]["quest"] == 0.6


class TestOOCChecker:
    """Test OOCChecker."""

    @pytest.fixture
    def checker(self, mock_ai_service):
        return OOCChecker(mock_ai_service)

    @pytest.mark.asyncio
    async def test_check_no_character(self, checker, mock_db):
        """Test check returns default when character not found."""
        result = await checker.check(1, 999, mock_db)

        assert result["score"] == 100
        assert result["violations"] == []

    @pytest.mark.asyncio
    async def test_check_no_chapter(self, checker, mock_db, mock_character):
        mock_db.execute = AsyncMock(side_effect=[
            _make_async_result(mock_character),
            _make_async_result(None),
        ])

        result = await checker.check(1, 1, mock_db)
        assert result["score"] == 100

    @pytest.mark.asyncio
    async def test_check_success(self, checker, mock_db, mock_character, mock_chapter, mock_draft):
        """Test successful OOC check."""
        mock_db.execute = AsyncMock(side_effect=[
            _make_async_result(mock_character),
            _make_async_result(mock_chapter),
            _make_async_result(mock_draft),
        ])

        mock_response = AsyncMock()
        mock_response.json = Mock(return_value={
            "choices": [{"message": {"content": '{"issues": [], "suggestions": [], "score": 95, "violations": []}'}}]
        })
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            result = await checker.check(1, 1, mock_db)

        assert result["score"] == 95
        assert "violations" in result

    @pytest.mark.asyncio
    async def test_check_api_error(self, checker, mock_db, mock_character, mock_chapter, mock_draft):
        """Test OOC check handles API errors."""
        mock_db.execute = AsyncMock(side_effect=[
            _make_async_result(mock_character),
            _make_async_result(mock_chapter),
            _make_async_result(mock_draft),
        ])

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=Exception("API Error"))

        with patch('httpx.AsyncClient', return_value=mock_client):
            result = await checker.check(1, 1, mock_db)

        assert result["score"] == 0
        assert "失败" in result["issues"][0]


class TestContinuityChecker:
    """Test ContinuityChecker."""

    @pytest.fixture
    def checker(self, mock_ai_service):
        return ContinuityChecker(mock_ai_service)

    @pytest.mark.asyncio
    async def test_check_no_chapter(self, checker, mock_db):
        """Test check returns default when chapter not found."""
        result = await checker.check(999, mock_db)

        assert result["score"] == 100
        assert result["plot_thread_status"] == {}

    @pytest.mark.asyncio
    async def test_check_success(self, checker, mock_db, mock_chapter, mock_draft):
        """Test successful continuity check."""
        mock_db.execute = AsyncMock(side_effect=[
            _make_async_result(mock_chapter),
            _make_async_result(mock_draft),
            _make_async_result_list([]),
            _make_async_result_list([]),
        ])

        mock_response = AsyncMock()
        mock_response.json = Mock(return_value={
            "choices": [{"message": {"content": '{"issues": [], "suggestions": [], "score": 88, "plot_thread_status": {"fulfilled": [], "continued": [], "new_setup": []}}'}}]
        })
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            result = await checker.check(1, mock_db)

        assert result["score"] == 88
        assert "plot_thread_status" in result


class TestHighPointChecker:
    """Test HighPointChecker."""

    @pytest.fixture
    def checker(self, mock_ai_service):
        return HighPointChecker(mock_ai_service)

    @pytest.mark.asyncio
    async def test_check_no_chapter(self, checker, mock_db):
        """Test check returns default when chapter not found."""
        result = await checker.check(999, mock_db)

        assert result["score"] == 100
        assert result["high_points"] == []

    @pytest.mark.asyncio
    async def test_check_success(self, checker, mock_db, mock_chapter, mock_draft):
        """Test successful high point check."""
        mock_db.execute = AsyncMock(side_effect=[
            _make_async_result(mock_chapter),
            _make_async_result(mock_draft),
        ])

        mock_response = AsyncMock()
        mock_response.json = Mock(return_value={
            "choices": [{"message": {"content": '{"issues": [], "suggestions": [], "score": 92, "high_points": [{"location": "middle", "type": "战斗", "intensity": 8}], "excitement_density": "适中", "ending_hook": "strong"}'}}]
        })
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            result = await checker.check(1, mock_db)

        assert result["score"] == 92
        assert len(result["high_points"]) == 1
        assert result["excitement_density"] == "适中"
        assert result["ending_hook"] == "strong"

    @pytest.mark.asyncio
    async def test_check_json_error(self, checker, mock_db, mock_chapter, mock_draft):
        """Test check handles invalid JSON."""
        mock_db.execute = AsyncMock(side_effect=[
            _make_async_result(mock_chapter),
            _make_async_result(mock_draft),
        ])

        mock_response = AsyncMock()
        mock_response.json = Mock(return_value={
            "choices": [{"message": {"content": "bad json"}}]
        })
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            result = await checker.check(1, mock_db)

        assert result["score"] == 70
        assert result["excitement_density"] == "适中"


class TestReaderPullChecker:
    """Test ReaderPullChecker."""

    @pytest.fixture
    def checker(self, mock_ai_service):
        return ReaderPullChecker(mock_ai_service)

    @pytest.mark.asyncio
    async def test_check_no_chapter(self, checker, mock_db):
        """Test check returns default when chapter not found."""
        result = await checker.check(999, mock_db)

        assert result["score"] == 100
        assert result["hooks"] == []

    @pytest.mark.asyncio
    async def test_check_success(self, checker, mock_db, mock_chapter, mock_draft):
        """Test successful reader pull check."""
        mock_db.execute = AsyncMock(side_effect=[
            _make_async_result(mock_chapter),
            _make_async_result(mock_draft),
            _make_async_result(None),
        ])

        mock_response = AsyncMock()
        mock_response.json = Mock(return_value={
            "choices": [{"message": {"content": '{"issues": [], "suggestions": [], "score": 87, "hooks": [{"location": "ending", "type": "悬念", "description": " cliffhanger", "effectiveness": 9}], "opening_hook": "good", "ending_hook": "excellent", "curiosity_gaps": ["What happens next?"]}'}}]
        })
        mock_response.raise_for_status = Mock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch('httpx.AsyncClient', return_value=mock_client):
            result = await checker.check(1, mock_db)

        assert result["score"] == 87
        assert len(result["hooks"]) == 1
        assert result["opening_hook"] == "good"
        assert result["ending_hook"] == "excellent"
        assert len(result["curiosity_gaps"]) == 1

    @pytest.mark.asyncio
    async def test_check_api_error(self, checker, mock_db, mock_chapter, mock_draft):
        """Test reader pull check handles API errors."""
        mock_db.execute = AsyncMock(side_effect=[
            _make_async_result(mock_chapter),
            _make_async_result(mock_draft),
            _make_async_result(None),
        ])

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=Exception("API Error"))

        with patch('httpx.AsyncClient', return_value=mock_client):
            result = await checker.check(1, mock_db)

        assert result["score"] == 0
        assert "失败" in result["issues"][0]


class TestCheckerImports:
    """Test that all checkers can be imported from the package."""

    def test_all_checkers_importable(self):
        """Test all 6 checkers are importable."""
        from agents.checkers import __all__

        assert "ConsistencyChecker" in __all__
        assert "PacingChecker" in __all__
        assert "OOCChecker" in __all__
        assert "ContinuityChecker" in __all__
        assert "HighPointChecker" in __all__
        assert "ReaderPullChecker" in __all__
        assert len(__all__) == 6
