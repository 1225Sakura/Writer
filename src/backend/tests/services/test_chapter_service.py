"""Tests for ChapterService with mocked dependencies."""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime

from backend.core.services.chapter.chapter_service import ChapterService
from backend.core.domain.entities import Chapter, DraftVersion
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
    cache.ainvalidate_tag = AsyncMock()
    return cache


@pytest_asyncio.fixture
async def chapter_service(db_session, mock_event_bus, mock_cache):
    """Create a ChapterService with mocked dependencies."""
    service = ChapterService.__new__(ChapterService)
    service.db = db_session
    service.event_bus = mock_event_bus
    service.cache = mock_cache
    service.repo = MagicMock()
    service.repo.create = AsyncMock()
    service.repo.update = AsyncMock()
    service.repo.get_by_id = AsyncMock()
    service.repo.list = AsyncMock()
    service.repo.delete = AsyncMock()
    service.repo.get_by_outline = AsyncMock()
    service.repo.get_draft_versions = AsyncMock()
    service.repo.create_draft_version = AsyncMock()
    service.repo.get_draft_version = AsyncMock()
    return service


# =============================================================================
# Chapter CRUD Tests
# =============================================================================

class TestChapterServiceCreate:
    """Test chapter creation."""

    @pytest.mark.asyncio
    async def test_create_chapter_publishes_event(self, chapter_service, mock_event_bus, mock_cache):
        """Creating a chapter publishes ENTITY_CREATED event."""
        chapter_data = {"title": "第一章", "summary": "概述"}
        mock_chapter = MagicMock()
        mock_chapter.id = 1
        mock_chapter.title = "第一章"
        chapter_service.repo.create = AsyncMock(return_value=mock_chapter)

        result = await chapter_service.create(chapter_data)

        assert result.title == "第一章"
        chapter_service.repo.create.assert_called_once_with(chapter_data)
        mock_cache.ainvalidate_tag.assert_called_once_with("chapters")
        mock_event_bus.publish.assert_called_once_with(
            ENTITY_CREATED,
            {"entity_type": "chapter", "id": 1, "data": chapter_data},
        )


class TestChapterServiceUpdate:
    """Test chapter updates."""

    @pytest.mark.asyncio
    async def test_update_chapter_publishes_event(self, chapter_service, mock_event_bus, mock_cache):
        """Updating a chapter publishes ENTITY_UPDATED event."""
        chapter_data = {"title": "第一章（修订）"}
        mock_chapter = MagicMock()
        mock_chapter.id = 1
        mock_chapter.title = "第一章（修订）"
        chapter_service.repo.update = AsyncMock(return_value=mock_chapter)

        result = await chapter_service.update(1, chapter_data)

        assert result.title == "第一章（修订）"
        mock_cache.ainvalidate_tag.assert_called_once_with("chapters")
        mock_event_bus.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_chapter_returns_none_when_not_found(self, chapter_service, mock_cache):
        """update returns None when chapter doesn't exist."""
        chapter_service.repo.update = AsyncMock(return_value=None)

        result = await chapter_service.update(999, {"title": "test"})

        assert result is None
        mock_cache.ainvalidate_tag.assert_not_called()


class TestChapterServiceGet:
    """Test chapter retrieval."""

    @pytest.mark.asyncio
    async def test_get_chapter_returns_chapter(self, chapter_service):
        """get returns the chapter from repository."""
        mock_chapter = MagicMock()
        mock_chapter.id = 1
        mock_chapter.title = "第一章"
        chapter_service.repo.get_by_id = AsyncMock(return_value=mock_chapter)

        result = await chapter_service.get(1)

        assert result == mock_chapter
        chapter_service.repo.get_by_id.assert_called_once_with(1)

    @pytest.mark.asyncio
    async def test_get_chapter_returns_none_for_missing(self, chapter_service):
        """get returns None when not found."""
        chapter_service.repo.get_by_id = AsyncMock(return_value=None)

        result = await chapter_service.get(999)

        assert result is None


class TestChapterServiceList:
    """Test chapter listing."""

    @pytest.mark.asyncio
    async def test_list_chapters_without_filters(self, chapter_service):
        """list returns all chapters."""
        mock_chapters = [MagicMock(id=1, title="第一章"), MagicMock(id=2, title="第二章")]
        chapter_service.repo.list = AsyncMock(return_value=mock_chapters)

        result = await chapter_service.list_chapters()

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_list_chapters_filtered_by_outline(self, chapter_service):
        """list_chapters filters by outline_id."""
        mock_chapters = [MagicMock(id=1, title="第一章")]
        chapter_service.repo.get_by_outline = AsyncMock(return_value=mock_chapters)

        result = await chapter_service.list_chapters(outline_id=1)

        assert len(result) == 1
        chapter_service.repo.get_by_outline.assert_called_once_with(1, skip=0, limit=100)

    @pytest.mark.asyncio
    async def test_list_chapters_filtered_by_status(self, chapter_service):
        """list_chapters filters by status."""
        mock_chapters = [MagicMock(id=1, title="第一章")]
        chapter_service.repo.list = AsyncMock(return_value=mock_chapters)

        result = await chapter_service.list_chapters(status="published")

        chapter_service.repo.list.assert_called_once_with(skip=0, limit=100, status="published")


class TestChapterServiceDelete:
    """Test chapter deletion."""

    @pytest.mark.asyncio
    async def test_delete_chapter_publishes_event(self, chapter_service, mock_event_bus, mock_cache):
        """Deleting a chapter publishes ENTITY_DELETED event."""
        chapter_service.repo.delete = AsyncMock(return_value=True)

        result = await chapter_service.delete(1)

        assert result is True
        mock_cache.ainvalidate_tag.assert_called_once_with("chapters")
        mock_event_bus.publish.assert_called_once_with(
            ENTITY_DELETED,
            {"entity_type": "chapter", "id": 1},
        )

    @pytest.mark.asyncio
    async def test_delete_chapter_returns_false_when_not_found(self, chapter_service, mock_cache):
        """delete returns False when chapter doesn't exist."""
        chapter_service.repo.delete = AsyncMock(return_value=False)

        result = await chapter_service.delete(999)

        assert result is False
        mock_cache.ainvalidate_tag.assert_not_called()


# =============================================================================
# Draft Version Tests
# =============================================================================

class TestDraftVersions:
    """Test draft version operations."""

    @pytest.mark.asyncio
    async def test_list_draft_versions(self, chapter_service):
        """list_draft_versions returns drafts from repository."""
        mock_drafts = [
            MagicMock(id=1, chapter_id=1, version_number=1),
            MagicMock(id=2, chapter_id=1, version_number=2),
        ]
        chapter_service.repo.get_draft_versions = AsyncMock(return_value=mock_drafts)

        result = await chapter_service.list_draft_versions(1)

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_create_draft_version(self, chapter_service, mock_event_bus, mock_cache):
        """Creating a draft version publishes event and invalidates cache."""
        draft_data = {"chapter_id": 1, "version_number": 1, "content": "版本内容"}
        mock_draft = MagicMock()
        mock_draft.id = 1
        chapter_service.repo.create_draft_version = AsyncMock(return_value=mock_draft)

        result = await chapter_service.create_draft_version(draft_data)

        assert result.id == 1
        mock_cache.ainvalidate_tag.assert_called_once_with("drafts")
        mock_event_bus.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_draft_version(self, chapter_service):
        """get_draft_version queries specific version."""
        mock_draft = MagicMock(id=1, chapter_id=1, version_number=1)
        chapter_service.repo.get_draft_version = AsyncMock(return_value=mock_draft)

        result = await chapter_service.get_draft_version(1, 1)

        assert result == mock_draft
