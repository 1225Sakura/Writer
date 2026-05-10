"""Tests for CharacterService with mocked dependencies."""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from backend.core.services.character.character_service import CharacterService
from backend.core.domain.entities import Character, CharacterRelationship, CharacterStoryline
from backend.utils.event_bus import AsyncEventBus, ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def mock_event_bus():
    """Create a mock event bus."""
    bus = MagicMock(spec=AsyncEventBus)
    bus.publish = AsyncMock(return_value=None)
    return bus


@pytest.fixture
def mock_repo():
    """Create a mock character repository."""
    repo = MagicMock()
    repo.create = AsyncMock()
    repo.update = AsyncMock()
    repo.get_by_id = AsyncMock()
    repo.list = AsyncMock()
    repo.delete = AsyncMock()
    repo.get_relationships = AsyncMock()
    repo.get_storylines = AsyncMock()
    return repo


@pytest_asyncio.fixture
async def character_service(db_session, mock_event_bus):
    """Create a CharacterService with mocked dependencies."""
    service = CharacterService.__new__(CharacterService)
    service.db = db_session
    service.event_bus = mock_event_bus
    service.repo = MagicMock()
    return service


# =============================================================================
# Character CRUD Tests
# =============================================================================

class TestCharacterServiceCreate:
    """Test character creation."""

    @pytest.mark.asyncio
    async def test_create_character_publishes_event(self, character_service, mock_event_bus):
        """Creating a character publishes ENTITY_CREATED event."""
        character_data = {"name": "张三", "tier": "main"}
        mock_char = Character(id=1, name="张三", tier="main", created_at=datetime.utcnow())
        character_service.repo.create = AsyncMock(return_value=mock_char)

        with patch("core.services.character.character_service.cache_service") as mock_cache:
            result = await character_service.create_character(character_data)

        assert result.name == "张三"
        character_service.repo.create.assert_called_once_with(character_data)
        mock_cache.clear_entity_cache.assert_called_once_with("character")
        mock_event_bus.publish.assert_called_once_with(
            ENTITY_CREATED,
            {"entity_type": "character", "id": 1, "data": character_data},
        )


class TestCharacterServiceUpdate:
    """Test character updates."""

    @pytest.mark.asyncio
    async def test_update_character_publishes_event(self, character_service, mock_event_bus):
        """Updating a character publishes ENTITY_UPDATED event."""
        character_data = {"name": "张三 updated"}
        mock_char = Character(id=1, name="张三 updated", tier="main", updated_at=datetime.utcnow())
        character_service.repo.update = AsyncMock(return_value=mock_char)

        with patch("core.services.character.character_service.cache_service") as mock_cache:
            result = await character_service.update_character(1, character_data)

        assert result.name == "张三 updated"
        mock_cache.clear_entity_cache.assert_called_once_with("character")
        mock_event_bus.publish.assert_called_once()


class TestCharacterServiceGet:
    """Test character retrieval."""

    @pytest.mark.asyncio
    async def test_get_character_returns_character(self, character_service):
        """get_character returns the character from repository."""
        mock_char = Character(id=1, name="张三", tier="main")
        character_service.repo.get_by_id = AsyncMock(return_value=mock_char)

        result = await character_service.get_character(1)

        assert result == mock_char
        character_service.repo.get_by_id.assert_called_once_with(1)

    @pytest.mark.asyncio
    async def test_get_character_returns_none_for_missing(self, character_service):
        """get_character returns None when not found."""
        character_service.repo.get_by_id = AsyncMock(return_value=None)

        result = await character_service.get_character(999)

        assert result is None


class TestCharacterServiceList:
    """Test character listing."""

    @pytest.mark.asyncio
    async def test_list_characters_without_filter(self, character_service):
        """list_characters returns all characters."""
        mock_chars = [
            Character(id=1, name="张三", tier="main"),
            Character(id=2, name="李四", tier="supporting"),
        ]
        character_service.repo.list = AsyncMock(return_value=mock_chars)

        result = await character_service.list_characters()

        assert len(result) == 2
        character_service.repo.list.assert_called_once_with(skip=0, limit=100)

    @pytest.mark.asyncio
    async def test_list_characters_with_tier_filter(self, character_service):
        """list_characters filters by tier when provided."""
        mock_chars = [Character(id=1, name="张三", tier="main")]
        character_service.repo.get_by_tier = AsyncMock(return_value=mock_chars)

        result = await character_service.list_characters(tier="main")

        assert len(result) == 1
        character_service.repo.get_by_tier.assert_called_once_with("main", skip=0, limit=100)


class TestCharacterServiceDelete:
    """Test character deletion."""

    @pytest.mark.asyncio
    async def test_delete_character_publishes_event(self, character_service, mock_event_bus):
        """Deleting a character publishes ENTITY_DELETED event."""
        character_service.repo.delete = AsyncMock(return_value=True)

        with patch("core.services.character.character_service.cache_service") as mock_cache:
            result = await character_service.delete_character(1)

        assert result is True
        mock_cache.clear_entity_cache.assert_called_once_with("character")
        mock_event_bus.publish.assert_called_once_with(
            ENTITY_DELETED,
            {"entity_type": "character", "id": 1},
        )

    @pytest.mark.asyncio
    async def test_delete_character_returns_false_when_not_found(self, character_service):
        """delete_character returns False when character doesn't exist."""
        character_service.repo.delete = AsyncMock(return_value=False)

        with patch("core.services.character.character_service.cache_service"):
            result = await character_service.delete_character(999)

        assert result is False


# =============================================================================
# Relationship Tests
# =============================================================================

class TestCharacterRelationships:
    """Test character relationship operations."""

    @pytest.mark.asyncio
    async def test_get_relationships_returns_list(self, character_service):
        """get_relationships returns relationships from repository."""
        mock_rels = [
            CharacterRelationship(id=1, character_id=1, related_character_id=2, relationship_type="friend"),
        ]
        character_service.repo.get_relationships = AsyncMock(return_value=mock_rels)

        result = await character_service.get_relationships(1)

        assert len(result) == 1
        assert result[0].relationship_type == "friend"

    @pytest.mark.asyncio
    async def test_create_relationship_publishes_event(self, character_service, mock_event_bus):
        """Creating a relationship publishes ENTITY_CREATED event."""
        rel_data = {"character_id": 1, "related_character_id": 2, "relationship_type": "friend"}
        mock_rel = CharacterRelationship(id=1, **rel_data)

        with patch("core.services.character.character_service.cache_service") as mock_cache:
            # Mock db.add and flush
            character_service.db.add = MagicMock()
            character_service.db.flush = AsyncMock()
            character_service.db.refresh = AsyncMock(side_effect=lambda x: setattr(x, 'id', 1))

            result = await character_service.create_relationship(rel_data)

        mock_cache.clear_entity_cache.assert_called_once_with("character")
        mock_event_bus.publish.assert_called_once()


# =============================================================================
# Storyline Tests
# =============================================================================

class TestCharacterStorylines:
    """Test character storyline operations."""

    @pytest.mark.asyncio
    async def test_get_storylines_returns_list(self, character_service):
        """get_storylines returns storylines from repository."""
        mock_stories = [
            CharacterStoryline(id=1, character_id=1, title="主线的开始"),
        ]
        character_service.repo.get_storylines = AsyncMock(return_value=mock_stories)

        result = await character_service.get_storylines(1)

        assert len(result) == 1
        assert result[0].title == "主线的开始"

    @pytest.mark.asyncio
    async def test_create_storyline_publishes_event(self, character_service, mock_event_bus):
        """Creating a storyline publishes ENTITY_CREATED event."""
        story_data = {"character_id": 1, "title": "新的故事线"}

        with patch("core.services.character.character_service.cache_service") as mock_cache:
            character_service.db.add = MagicMock()
            character_service.db.flush = AsyncMock()
            character_service.db.refresh = AsyncMock(side_effect=lambda x: setattr(x, 'id', 1))

            result = await character_service.create_storyline(story_data)

        mock_cache.clear_entity_cache.assert_called_once_with("character")
        mock_event_bus.publish.assert_called_once()