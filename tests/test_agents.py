"""
Tests for context agent and data agent.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestContextAgent:
    """Test ContextAgent for generating writing execution packages."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock async database session."""
        db = AsyncMock()
        return db

    def test_context_agent_initialization(self):
        """Test ContextAgent is a valid agent class."""
        from backend.agents.context_agent import ContextAgent
        from backend.agents.base import BaseAgent

        assert issubclass(ContextAgent, BaseAgent)
        assert hasattr(ContextAgent, 'generate_chapter_context')


class TestDataAgent:
    """Test DataAgent for entity extraction from chapter content."""

    def test_data_agent_initialization(self):
        """Test DataAgent is a valid agent class."""
        from backend.agents.data_agent import DataAgent
        from backend.agents.base import BaseAgent

        assert issubclass(DataAgent, BaseAgent)
        assert hasattr(DataAgent, 'process_chapter')


class TestCheckerAgents:
    """Test AI checker agents."""

    def test_consistency_checker_exists(self):
        """Test consistency checker is importable."""
        from backend.agents.checkers.consistency_checker import ConsistencyChecker
        from backend.core.services.ai.ai_service import AIService

        ai_service = MagicMock(spec=AIService)
        checker = ConsistencyChecker(ai_service)
        assert checker is not None

    def test_pacing_checker_exists(self):
        """Test pacing checker is importable."""
        from backend.agents.checkers.pacing_checker import PacingChecker
        from backend.core.services.ai.ai_service import AIService

        ai_service = MagicMock(spec=AIService)
        checker = PacingChecker(ai_service)
        assert checker is not None

    def test_ooc_checker_exists(self):
        """Test OOC (out of character) checker is importable."""
        from backend.agents.checkers.ooc_checker import OOCChecker
        from backend.core.services.ai.ai_service import AIService

        ai_service = MagicMock(spec=AIService)
        checker = OOCChecker(ai_service)
        assert checker is not None

    def test_continuity_checker_exists(self):
        """Test continuity checker is importable."""
        from backend.agents.checkers.continuity_checker import ContinuityChecker
        from backend.core.services.ai.ai_service import AIService

        ai_service = MagicMock(spec=AIService)
        checker = ContinuityChecker(ai_service)
        assert checker is not None

    def test_high_point_checker_exists(self):
        """Test high point checker is importable."""
        from backend.agents.checkers.high_point_checker import HighPointChecker
        from backend.core.services.ai.ai_service import AIService

        ai_service = MagicMock(spec=AIService)
        checker = HighPointChecker(ai_service)
        assert checker is not None

    def test_reader_pull_checker_exists(self):
        """Test reader pull checker is importable."""
        from backend.agents.checkers.reader_pull_checker import ReaderPullChecker
        from backend.core.services.ai.ai_service import AIService

        ai_service = MagicMock(spec=AIService)
        checker = ReaderPullChecker(ai_service)
        assert checker is not None
