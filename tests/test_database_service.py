"""
Tests for database service CRUD operations.
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime


class TestDatabaseServiceCharacters:
    """Test character CRUD operations."""

    @pytest.fixture
    def mock_session(self):
        """Create a mock async session."""
        session = AsyncMock()
        session.execute = AsyncMock()
        session.flush = AsyncMock()
        session.refresh = AsyncMock()
        session.delete = AsyncMock()
        return session

    @pytest.fixture
    def mock_session_maker(self, mock_session):
        """Create a mock async_session_maker."""
        with patch('backend.services.database_service.async_session_maker') as mock:
            mock.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock.return_value.__aexit__ = AsyncMock()
            yield mock

    @pytest.mark.asyncio
    async def test_get_character_found(self, mock_session_maker, mock_session):
        """Test get_character returns character when found."""
        mock_character = MagicMock()
        mock_character.id = 1
        mock_character.name = "Test Character"
        mock_character.__dict__ = {
            'id': 1,
            'name': 'Test Character',
            'gender': 'male',
            'personality': 'brave',
            '_sa_instance_state': MagicMock(),
        }

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_character
        mock_session.execute.return_value = mock_result

        from backend.services.database_service import get_character
        result = await get_character(1)

        assert result is not None
        assert result['id'] == 1

    @pytest.mark.asyncio
    async def test_get_character_not_found(self, mock_session_maker, mock_session):
        """Test get_character returns None when not found."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        from backend.services.database_service import get_character
        result = await get_character(999)

        assert result is None

    @pytest.mark.asyncio
    async def test_create_character(self, mock_session_maker, mock_session):
        """Test create_character returns new character ID."""
        mock_character = MagicMock()
        mock_character.id = 42

        def mock_refresh(obj):
            obj.id = 42

        mock_session.refresh.side_effect = mock_refresh
        mock_session.add = MagicMock()

        from backend.services.database_service import create_character
        result = await create_character({
            'name': 'New Character',
            'gender': 'female',
        })

        assert result == 42
        mock_session.add.assert_called_once()
        mock_session.flush.assert_called_once()


class TestDatabaseServiceChapters:
    """Test chapter CRUD operations."""

    @pytest.mark.asyncio
    async def test_get_chapter(self):
        """Test get_chapter by ID."""
        with patch('backend.services.database_service.async_session_maker') as mock:
            session = AsyncMock()
            mock.return_value.__aenter__ = AsyncMock(return_value=session)
            mock.return_value.__aexit__ = AsyncMock()

            mock_chapter = MagicMock()
            mock_chapter.__dict__ = {
                'id': 1,
                'title': 'Chapter 1',
                'status': 'pending',
                '_sa_instance_state': MagicMock(),
            }

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_chapter
            session.execute.return_value = mock_result

            from backend.services.database_service import get_chapter
            result = await get_chapter(1)

            assert result is not None
            assert result['id'] == 1
            assert result['title'] == 'Chapter 1'


class TestDatabaseServiceItems:
    """Test item CRUD operations."""

    @pytest.mark.asyncio
    async def test_get_item(self):
        """Test get_item by ID."""
        with patch('backend.services.database_service.async_session_maker') as mock:
            session = AsyncMock()
            mock.return_value.__aenter__ = AsyncMock(return_value=session)
            mock.return_value.__aexit__ = AsyncMock()

            mock_item = MagicMock()
            mock_item.__dict__ = {
                'id': 1,
                'name': 'Magic Sword',
                'description': 'A powerful sword',
                '_sa_instance_state': MagicMock(),
            }

            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_item
            session.execute.return_value = mock_result

            from backend.services.database_service import get_item
            result = await get_item(1)

            assert result is not None
            assert result['name'] == 'Magic Sword'


class TestToDict:
    """Test _to_dict helper function."""

    def test_to_dict_with_none(self):
        """Test _to_dict returns None for None input."""
        from backend.services.database_service import _to_dict
        result = _to_dict(None)
        assert result is None

    def test_to_dict_with_model(self):
        """Test _to_dict converts model to dict."""
        from backend.services.database_service import _to_dict

        mock_model = MagicMock()
        mock_model.__dict__ = {
            'id': 1,
            'name': 'Test',
            '_sa_instance_state': MagicMock(),
            '_private': 'hidden',
        }

        result = _to_dict(mock_model)

        assert result is not None
        assert result['id'] == 1
        assert result['name'] == 'Test'
        assert '_sa_instance_state' not in result
        assert '_private' not in result

    def test_to_dict_with_datetime(self):
        """Test _to_dict converts datetime to ISO format."""
        from backend.services.database_service import _to_dict

        test_time = datetime(2024, 1, 1, 12, 0, 0)

        mock_model = MagicMock()
        mock_model.__dict__ = {
            'id': 1,
            'created_at': test_time,
            '_sa_instance_state': MagicMock(),
        }

        result = _to_dict(mock_model)

        assert result is not None
        assert result['created_at'] == '2024-01-01T12:00:00'
