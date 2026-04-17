"""
Tests for context agent and data agent.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestContextAgent:
    """Test ContextAgent for generating writing execution packages."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database service."""
        db = MagicMock()
        return db

    def test_context_agent_initialization(self):
        """Test ContextAgent initializes with database service."""
        with patch('backend.agents.context_agent.DatabaseService'):
            from backend.agents.context_agent import ContextAgent

            agent = ContextAgent()
            assert agent is not None

    @pytest.mark.asyncio
    async def test_build_execution_package(self, mock_db):
        """Test building an execution package for a chapter."""
        mock_db.get_chapter = AsyncMock(return_value={
            'id': 1,
            'title': '第一章',
            'summary': '故事开始',
            'status': 'pending',
        })
        mock_db.get_character = AsyncMock(return_value={
            'id': 1,
            'name': '主角',
            'tier': '核心',
        })
        mock_db.get_all_characters = AsyncMock(return_value=[
            {'id': 1, 'name': '主角', 'tier': '核心'},
            {'id': 2, 'name': '配角', 'tier': '支线'},
        ])
        mock_db.get_all_world_settings = AsyncMock(return_value=[])

        with patch('backend.agents.context_agent.DatabaseService', return_value=mock_db):
            from backend.agents.context_agent import ContextAgent

            agent = ContextAgent()
            pkg = await agent.build_execution_package(chapter_id=1)

            assert pkg is not None
            assert 'chapter' in pkg
            assert 'characters' in pkg


class TestDataAgent:
    """Test DataAgent for entity extraction from chapter content."""

    def test_data_agent_initialization(self):
        """Test DataAgent initializes."""
        from backend.agents.data_agent import DataAgent

        agent = DataAgent()
        assert agent is not None

    @pytest.mark.asyncio
    async def test_extract_entities_from_content(self):
        """Test extracting entities from chapter content."""
        from backend.agents.data_agent import DataAgent

        agent = DataAgent()

        content = """
        主角李云来到青云山，在这里遇到了他的好友张峰。
        张峰告诉他，山下出现了一把神秘的宝剑。
        李云决定下山寻找这把宝剑。
        """

        result = await agent.extract_entities(content)

        assert result is not None
        assert 'entities' in result or isinstance(result, list)

    @pytest.mark.asyncio
    async def test_extract_relationships(self):
        """Test extracting character relationships from content."""
        from backend.agents.data_agent import DataAgent

        agent = DataAgent()

        content = """
        李云是张峰的好友，两人经常一起修炼。
        但是李云的敌人王魔一直在暗中观察他们。
        """

        result = await agent.extract_relationships(content)

        assert result is not None


class TestCheckerAgents:
    """Test AI checker agents."""

    def test_consistency_checker_exists(self):
        """Test consistency checker is importable."""
        from backend.agents.checkers.consistency_checker import ConsistencyChecker

        checker = ConsistencyChecker()
        assert checker is not None

    def test_pacing_checker_exists(self):
        """Test pacing checker is importable."""
        from backend.agents.checkers.pacing_checker import PacingChecker

        checker = PacingChecker()
        assert checker is not None

    def test_ooc_checker_exists(self):
        """Test OOC (out of character) checker is importable."""
        from backend.agents.checkers.ooc_checker import OOCChecker

        checker = OOCChecker()
        assert checker is not None

    def test_continuity_checker_exists(self):
        """Test continuity checker is importable."""
        from backend.agents.checkers.continuity_checker import ContinuityChecker

        checker = ContinuityChecker()
        assert checker is not None

    def test_high_point_checker_exists(self):
        """Test high point checker is importable."""
        from backend.agents.checkers.high_point_checker import HighPointChecker

        checker = HighPointChecker()
        assert checker is not None

    def test_reader_pull_checker_exists(self):
        """Test reader pull checker is importable."""
        from backend.agents.checkers.reader_pull_checker import ReaderPullChecker

        checker = ReaderPullChecker()
        assert checker is not None
