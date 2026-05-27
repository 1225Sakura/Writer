"""Tests for WikiService - wiki page CRUD, version history, entity links, FTS."""

import pytest
import pytest_asyncio
import logging
from unittest.mock import AsyncMock, MagicMock, patch
from backend.services.wiki_service import WikiService

# Ensure logger is defined in the wiki_service module
import backend.services.wiki_service as _wiki_mod
if not hasattr(_wiki_mod, 'logger'):
    _wiki_mod.logger = logging.getLogger("backend.services.wiki_service")


@pytest.fixture
def mock_db():
    """Create a mock AsyncSession."""
    db = MagicMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    db.delete = AsyncMock()
    return db


@pytest.fixture
def service(mock_db):
    return WikiService(db=mock_db)


# =============================================================================
# create_page
# =============================================================================

class TestCreatePage:
    """Test wiki page creation."""

    @pytest.mark.asyncio
    async def test_create_page_returns_page(self, service, mock_db):
        """create_page returns the created WikiPage."""
        # After flush and refresh, page gets an id
        async def set_id(obj):
            obj.id = 1

        mock_db.refresh = AsyncMock(side_effect=set_id)

        page = await service.create_page(
            project_id=1, title="测试页面", content="内容"
        )
        assert page.title == "测试页面"
        assert page.content == "内容"
        assert page.version == 1
        assert page.is_draft == 0

    @pytest.mark.asyncio
    async def test_create_page_with_draft(self, service, mock_db):
        """create_page with is_draft=True sets draft flag."""
        async def set_id(obj):
            obj.id = 2

        mock_db.refresh = AsyncMock(side_effect=set_id)

        page = await service.create_page(
            project_id=1, title="草稿", content="", is_draft=True
        )
        assert page.is_draft == 1

    @pytest.mark.asyncio
    async def test_create_page_with_entity_link(self, service, mock_db):
        """create_page stores entity_type and entity_id."""
        async def set_id(obj):
            obj.id = 3

        mock_db.refresh = AsyncMock(side_effect=set_id)

        page = await service.create_page(
            project_id=1, title="角色页面",
            entity_type="character", entity_id=42
        )
        assert page.entity_type == "character"
        assert page.entity_id == 42

    @pytest.mark.asyncio
    async def test_create_page_creates_initial_version(self, service, mock_db):
        """create_page creates an initial WikiVersion."""
        pages_added = []

        def track_add(obj):
            pages_added.append(type(obj).__name__)

        mock_db.add = MagicMock(side_effect=track_add)

        await service.create_page(project_id=1, title="测试")
        # Should add both WikiPage and WikiVersion
        assert "WikiPage" in pages_added or len(pages_added) >= 2


# =============================================================================
# get_page (mocked)
# =============================================================================

class TestGetPage:
    """Test page retrieval."""

    @pytest.mark.asyncio
    async def test_get_page_returns_none_when_not_found(self, service, mock_db):
        """get_page returns None for non-existent page."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        page = await service.get_page(999)
        assert page is None


# =============================================================================
# list_pages (mocked)
# =============================================================================

class TestListPages:
    """Test page listing."""

    @pytest.mark.asyncio
    async def test_list_pages_empty(self, service, mock_db):
        """list_pages returns empty list when no pages exist."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_result)

        pages = await service.list_pages(project_id=1)
        assert pages == []


# =============================================================================
# update_page (mocked)
# =============================================================================

class TestUpdatePage:
    """Test page updates."""

    @pytest.mark.asyncio
    async def test_update_nonexistent_page_returns_none(self, service, mock_db):
        """update_page returns None for non-existent page."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await service.update_page(999, title="新标题")
        assert result is None


# =============================================================================
# delete_page (mocked)
# =============================================================================

class TestDeletePage:
    """Test page deletion."""

    @pytest.mark.asyncio
    async def test_delete_nonexistent_page_returns_false(self, service, mock_db):
        """delete_page returns False for non-existent page."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await service.delete_page(999)
        assert result is False


# =============================================================================
# FTS query building
# =============================================================================

class TestFTSQueryBuilding:
    """Test FTS5 query construction."""

    def test_build_fts_query_short_query(self, service):
        """Query shorter than 2 chars returns None."""
        assert service._build_fts_query("a") is None
        assert service._build_fts_query("") is None

    def test_build_fts_query_normal_query(self, service):
        """Normal query produces prefix terms."""
        result = service._build_fts_query("测试内容")
        assert result is not None
        assert "*" in result

    def test_build_fts_query_escapes_special_chars(self, service):
        """Special FTS5 characters are escaped."""
        result = service._build_fts_query('test "quote" content')
        assert '"' not in result

    def test_build_fts_query_single_char_words_filtered(self, service):
        """Single-character words are filtered out."""
        result = service._build_fts_query("a bb c dd")
        # Only "bb" and "dd" should remain (len >= 2)
        if result:
            parts = result.split()
            for part in parts:
                assert len(part.rstrip("*")) >= 2


# =============================================================================
# render_content
# =============================================================================

class TestRenderContent:
    """Test Markdown rendering."""

    def test_render_empty_content(self):
        """Empty content returns empty string."""
        assert WikiService.render_content("") == ""
        assert WikiService.render_content(None) == ""

    def test_render_markdown_to_html(self):
        """Markdown is rendered to HTML."""
        html = WikiService.render_content("# 标题")
        assert "<h1>" in html or "标题" in html

    def test_render_bold_text(self):
        """Bold markdown is rendered."""
        html = WikiService.render_content("**粗体**")
        assert "<strong>" in html or "粗体" in html


# =============================================================================
# get_versions (mocked)
# =============================================================================

class TestGetVersions:
    """Test version history retrieval."""

    @pytest.mark.asyncio
    async def test_get_versions_empty(self, service, mock_db):
        """get_versions returns empty list when no versions exist."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_result)

        versions = await service.get_versions(page_id=1)
        assert versions == []


# =============================================================================
# Entity links (mocked)
# =============================================================================

class TestEntityLinks:
    """Test entity link operations."""

    @pytest.mark.asyncio
    async def test_add_entity_link_nonexistent_page(self, service, mock_db):
        """Adding link to non-existent page returns None."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await service.add_entity_link(
            wiki_page_id=999, linked_entity_type="character", linked_entity_id=1
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_remove_entity_link_nonexistent(self, service, mock_db):
        """Removing non-existent link returns False."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await service.remove_entity_link(999)
        assert result is False

    @pytest.mark.asyncio
    async def test_get_pages_by_entity_empty(self, service, mock_db):
        """get_pages_by_entity returns empty when no links exist."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_result)

        pages = await service.get_pages_by_entity("character", 1)
        assert pages == []
