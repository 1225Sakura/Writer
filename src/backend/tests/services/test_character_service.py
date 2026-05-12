"""Tests for CharacterService with mocked dependencies."""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timezone

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
def mock_cache():
    """Create a mock cache service."""
    cache = MagicMock()
    cache.ainvalidate_tag = AsyncMock(return_value=0)
    return cache


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
    repo.create_relationship = AsyncMock()
    repo.delete_relationship = AsyncMock()
    repo.create_storyline = AsyncMock()
    repo.update_storyline = AsyncMock()
    repo.delete_storyline = AsyncMock()
    repo.list_all_relationships = AsyncMock()
    repo.list_all_storylines = AsyncMock()
    return repo


@pytest_asyncio.fixture
async def character_service(db_session, mock_event_bus, mock_cache, mock_repo):
    """Create a CharacterService with mocked dependencies."""
    service = CharacterService.__new__(CharacterService)
    service.db = db_session
    service.event_bus = mock_event_bus
    service.cache = mock_cache
    service.repo = mock_repo
    service._cache_tag = "characters"
    service._entity_type = "character"
    return service


# =============================================================================
# Character CRUD Tests
# =============================================================================

class TestCharacterServiceCreate:
    """Test character creation."""

    @pytest.mark.asyncio
    async def test_create_character_publishes_event(self, character_service, mock_event_bus, mock_cache):
        """Creating a character publishes ENTITY_CREATED event."""
        character_data = {"name": "张三", "tier": "main"}
        mock_char = Character(id=1, name="张三", tier="main", created_at=datetime.now(timezone.utc))
        character_service.repo.create = AsyncMock(return_value=mock_char)

        result = await character_service.create_character(character_data)

        assert result.name == "张三"
        character_service.repo.create.assert_called_once_with(character_data)
        mock_cache.ainvalidate_tag.assert_called_once_with("characters")
        mock_event_bus.publish.assert_called_once_with(
            ENTITY_CREATED,
            {"entity_type": "character", "id": 1, "data": character_data},
        )


class TestCharacterServiceUpdate:
    """Test character updates."""

    @pytest.mark.asyncio
    async def test_update_character_publishes_event(self, character_service, mock_event_bus, mock_cache):
        """Updating a character publishes ENTITY_UPDATED event."""
        character_data = {"name": "张三 updated"}
        mock_char = Character(id=1, name="张三 updated", tier="main", updated_at=datetime.now(timezone.utc))
        character_service.repo.update = AsyncMock(return_value=mock_char)

        result = await character_service.update_character(1, character_data)

        assert result.name == "张三 updated"
        mock_cache.ainvalidate_tag.assert_called_once_with("characters")
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
    async def test_delete_character_publishes_event(self, character_service, mock_event_bus, mock_cache):
        """Deleting a character publishes ENTITY_DELETED event."""
        character_service.repo.delete = AsyncMock(return_value=True)

        result = await character_service.delete_character(1)

        assert result is True
        mock_cache.ainvalidate_tag.assert_called_once_with("characters")
        mock_event_bus.publish.assert_called_once_with(
            ENTITY_DELETED,
            {"entity_type": "character", "id": 1},
        )

    @pytest.mark.asyncio
    async def test_delete_character_returns_false_when_not_found(self, character_service):
        """delete_character returns False when character doesn't exist."""
        character_service.repo.delete = AsyncMock(return_value=False)

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
            CharacterRelationship(id=1, character_id=1, target_id=2, type="friend"),
        ]
        character_service.repo.get_relationships = AsyncMock(return_value=mock_rels)

        result = await character_service.get_relationships(1)

        assert len(result) == 1
        assert result[0].type == "friend"

    @pytest.mark.asyncio
    async def test_create_relationship_delegates_to_repo(self, character_service, mock_event_bus, mock_cache):
        """Creating a relationship delegates to repo and publishes event."""
        rel_data = {"character_id": 1, "target_id": 2, "type": "friend"}
        mock_rel = CharacterRelationship(id=1, **rel_data)
        character_service.repo.create_relationship = AsyncMock(return_value=mock_rel)

        result = await character_service.create_relationship(rel_data)

        assert result.id == 1
        character_service.repo.create_relationship.assert_called_once_with(rel_data)
        mock_cache.ainvalidate_tag.assert_called_once_with("characters")
        mock_event_bus.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_relationship_delegates_to_repo(self, character_service, mock_event_bus, mock_cache):
        """Deleting a relationship delegates to repo and publishes event."""
        character_service.repo.delete_relationship = AsyncMock(return_value=True)

        result = await character_service.delete_relationship(1, 10)

        assert result is True
        character_service.repo.delete_relationship.assert_called_once_with(1, 10)
        mock_cache.ainvalidate_tag.assert_called_once_with("characters")
        mock_event_bus.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_relationship_returns_false_when_not_found(self, character_service):
        """delete_relationship returns False when not found."""
        character_service.repo.delete_relationship = AsyncMock(return_value=False)

        result = await character_service.delete_relationship(1, 999)

        assert result is False


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
    async def test_create_storyline_delegates_to_repo(self, character_service, mock_event_bus, mock_cache):
        """Creating a storyline delegates to repo and publishes event."""
        story_data = {"character_id": 1, "title": "新的故事线"}
        mock_story = CharacterStoryline(id=1, **story_data)
        character_service.repo.create_storyline = AsyncMock(return_value=mock_story)

        result = await character_service.create_storyline(story_data)

        assert result.id == 1
        character_service.repo.create_storyline.assert_called_once_with(story_data)
        mock_cache.ainvalidate_tag.assert_called_once_with("characters")
        mock_event_bus.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_storyline_delegates_to_repo(self, character_service, mock_event_bus, mock_cache):
        """Updating a storyline delegates to repo and publishes event."""
        update_data = {"title": "更新的标题"}
        mock_story = CharacterStoryline(id=5, character_id=1, title="更新的标题")
        character_service.repo.update_storyline = AsyncMock(return_value=mock_story)

        result = await character_service.update_storyline(1, 5, update_data)

        assert result.title == "更新的标题"
        character_service.repo.update_storyline.assert_called_once_with(1, 5, update_data)
        mock_cache.ainvalidate_tag.assert_called_once_with("characters")
        mock_event_bus.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_storyline_returns_none_when_not_found(self, character_service):
        """update_storyline returns None when not found."""
        character_service.repo.update_storyline = AsyncMock(return_value=None)

        result = await character_service.update_storyline(1, 999, {"title": "x"})

        assert result is None

    @pytest.mark.asyncio
    async def test_delete_storyline_delegates_to_repo(self, character_service, mock_event_bus, mock_cache):
        """Deleting a storyline delegates to repo and publishes event."""
        character_service.repo.delete_storyline = AsyncMock(return_value=True)

        result = await character_service.delete_storyline(1, 5)

        assert result is True
        character_service.repo.delete_storyline.assert_called_once_with(1, 5)
        mock_cache.ainvalidate_tag.assert_called_once_with("characters")
        mock_event_bus.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_storyline_returns_false_when_not_found(self, character_service):
        """delete_storyline returns False when not found."""
        character_service.repo.delete_storyline = AsyncMock(return_value=False)

        result = await character_service.delete_storyline(1, 999)

        assert result is False


# =============================================================================
# List-all Tests (export helpers)
# =============================================================================

class TestListAll:
    """Test list_all_* methods for export."""

    @pytest.mark.asyncio
    async def test_list_all_characters(self, character_service):
        """list_all_characters delegates to repo.list with large limit."""
        mock_chars = [Character(id=i, name=f"c{i}") for i in range(5)]
        character_service.repo.list = AsyncMock(return_value=mock_chars)

        result = await character_service.list_all_characters()

        assert len(result) == 5
        character_service.repo.list.assert_called_once_with(skip=0, limit=100000)

    @pytest.mark.asyncio
    async def test_list_all_relationships(self, character_service):
        """list_all_relationships delegates to repo."""
        mock_rels = [CharacterRelationship(id=1, character_id=1, target_id=2, type="rival")]
        character_service.repo.list_all_relationships = AsyncMock(return_value=mock_rels)

        result = await character_service.list_all_relationships()

        assert len(result) == 1
        character_service.repo.list_all_relationships.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_all_storylines(self, character_service):
        """list_all_storylines delegates to repo."""
        mock_stories = [CharacterStoryline(id=1, character_id=1, title="arc1")]
        character_service.repo.list_all_storylines = AsyncMock(return_value=mock_stories)

        result = await character_service.list_all_storylines()

        assert len(result) == 1
        character_service.repo.list_all_storylines.assert_called_once()
