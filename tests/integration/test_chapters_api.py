"""
Integration tests for Chapters API endpoints.

Tests outline, chapter, and draft version CRUD operations via HTTP.
Each test runs in a transaction that is rolled back automatically.
"""

import pytest
from factories import OutlineFactory, ChapterFactory, DraftVersionFactory
from backend.infrastructure.cache.cache_service import cache_service

pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def clear_cache():
    """Clear global cache before each test to prevent stale data."""
    cache_service.clear_all()


# ---------------------------------------------------------------------------
# Outline CRUD
# ---------------------------------------------------------------------------

class TestOutlineCRUD:
    """Test outline CRUD operations via API."""

    async def test_create_outline_returns_outline_data(self, client, auth_headers):
        """POST /api/v1/chapters/outlines creates a new outline."""
        payload = {
            "title": "第一章大纲",
            "description": "主角踏上修仙之路",
        }
        response = await client.post(
            "/api/v1/chapters/outlines", json=payload, headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "第一章大纲"
        assert data["description"] == "主角踏上修仙之路"
        assert "id" in data

    async def test_list_outlines_returns_created_outlines(self, client, auth_headers, db_session):
        """GET /api/v1/chapters/outlines returns list of outlines."""
        outline = OutlineFactory(title="测试大纲")
        db_session.add(outline)
        await db_session.flush()

        response = await client.get("/api/v1/chapters/outlines", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert any(o["title"] == "测试大纲" for o in data)

    async def test_get_outline_by_id_returns_outline(self, client, auth_headers, db_session):
        """GET /api/v1/chapters/outlines/{id} returns a specific outline."""
        outline = OutlineFactory(title="详细大纲")
        db_session.add(outline)
        await db_session.flush()
        await db_session.refresh(outline)

        response = await client.get(
            f"/api/v1/chapters/outlines/{outline.id}", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "详细大纲"

    async def test_update_outline_returns_updated_data(self, client, auth_headers, db_session):
        """PATCH /api/v1/chapters/outlines/{id} updates an outline."""
        outline = OutlineFactory(title="旧标题", description="旧描述")
        db_session.add(outline)
        await db_session.flush()
        await db_session.refresh(outline)

        response = await client.patch(
            f"/api/v1/chapters/outlines/{outline.id}",
            json={"title": "新标题"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "新标题"
        assert data["description"] == "旧描述"

    async def test_delete_outline_returns_success_message(self, client, auth_headers, db_session):
        """DELETE /api/v1/chapters/outlines/{id} removes an outline."""
        outline = OutlineFactory(title="待删除大纲")
        db_session.add(outline)
        await db_session.flush()
        await db_session.refresh(outline)

        response = await client.delete(
            f"/api/v1/chapters/outlines/{outline.id}", headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Outline deleted"

    async def test_get_nonexistent_outline_returns_404(self, client, auth_headers):
        """GET /api/v1/chapters/outlines/99999 returns 404 for missing outline."""
        response = await client.get("/api/v1/chapters/outlines/99999", headers=auth_headers)
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# Chapter CRUD
# ---------------------------------------------------------------------------

class TestChapterCRUD:
    """Test chapter CRUD operations via API."""

    async def test_create_chapter_returns_chapter_data(self, client, auth_headers):
        """POST /api/v1/chapters/ creates a new chapter."""
        payload = {
            "title": "第一章 初入江湖",
            "summary": "主角离开山村",
            "status": "pending",
            "word_count": 0,
            "chapter_order": 1,
        }
        response = await client.post("/api/v1/chapters/", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "第一章 初入江湖"
        assert data["status"] == "pending"
        assert "id" in data

    async def test_list_chapters_returns_created_chapters(self, client, auth_headers, db_session):
        """GET /api/v1/chapters/ returns list of chapters."""
        chapter = ChapterFactory(title="测试章节")
        db_session.add(chapter)
        await db_session.flush()

        response = await client.get("/api/v1/chapters/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert any(c["title"] == "测试章节" for c in data)

    async def test_get_chapter_by_id_returns_chapter(self, client, auth_headers, db_session):
        """GET /api/v1/chapters/{id} returns a specific chapter."""
        chapter = ChapterFactory(title="具体章节")
        db_session.add(chapter)
        await db_session.flush()
        await db_session.refresh(chapter)

        response = await client.get(
            f"/api/v1/chapters/{chapter.id}", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "具体章节"

    async def test_update_chapter_returns_updated_data(self, client, auth_headers, db_session):
        """PATCH /api/v1/chapters/{id} updates a chapter."""
        chapter = ChapterFactory(title="旧章节", status="pending")
        db_session.add(chapter)
        await db_session.flush()
        await db_session.refresh(chapter)

        response = await client.patch(
            f"/api/v1/chapters/{chapter.id}",
            json={"status": "writing", "word_count": 1500},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "writing"
        assert data["word_count"] == 1500

    async def test_delete_chapter_returns_success_message(self, client, auth_headers, db_session):
        """DELETE /api/v1/chapters/{id} removes a chapter."""
        chapter = ChapterFactory(title="待删除章节")
        db_session.add(chapter)
        await db_session.flush()
        await db_session.refresh(chapter)

        response = await client.delete(
            f"/api/v1/chapters/{chapter.id}", headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Chapter deleted"

    async def test_filter_chapters_by_status_returns_matching(self, client, auth_headers, db_session):
        """GET /api/v1/chapters/?status=xxx filters chapters by status."""
        ch1 = ChapterFactory(title="章节1", status="completed")
        ch2 = ChapterFactory(title="章节2", status="pending")
        db_session.add_all([ch1, ch2])
        await db_session.flush()

        response = await client.get(
            "/api/v1/chapters/?status=completed", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert all(c["status"] == "completed" for c in data)

    async def test_create_chapter_with_invalid_status_returns_422(self, client, auth_headers):
        """POST /api/v1/chapters/ with invalid status returns 422."""
        payload = {
            "title": "错误章节",
            "status": "invalid_status",
        }
        response = await client.post("/api/v1/chapters/", json=payload, headers=auth_headers)
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Draft Versions
# ---------------------------------------------------------------------------

class TestDraftVersionCRUD:
    """Test draft version CRUD operations via API."""

    async def test_create_draft_version_returns_draft_data(self, client, auth_headers, db_session):
        """POST /api/v1/chapters/{id}/drafts creates a new draft version."""
        chapter = ChapterFactory(title="草稿章节")
        db_session.add(chapter)
        await db_session.flush()
        await db_session.refresh(chapter)

        payload = {
            "chapter_id": chapter.id,
            "content": "这是第一章的草稿内容。",
            "version_number": 1,
        }
        response = await client.post(
            f"/api/v1/chapters/{chapter.id}/drafts",
            json=payload,
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "这是第一章的草稿内容。"
        assert data["version_number"] == 1
        assert data["chapter_id"] == chapter.id

    async def test_list_draft_versions_returns_drafts(self, client, auth_headers, db_session):
        """GET /api/v1/chapters/{id}/drafts returns list of draft versions."""
        chapter = ChapterFactory(title="多草稿章节")
        db_session.add(chapter)
        await db_session.flush()
        await db_session.refresh(chapter)

        draft = DraftVersionFactory(chapter_id=chapter.id, version_number=1)
        db_session.add(draft)
        await db_session.flush()

        response = await client.get(
            f"/api/v1/chapters/{chapter.id}/drafts", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert any(d["version_number"] == 1 for d in data)

    async def test_get_draft_version_by_number_returns_draft(self, client, auth_headers, db_session):
        """GET /api/v1/chapters/{id}/drafts/{version} returns a specific draft."""
        chapter = ChapterFactory(title="指定草稿章节")
        db_session.add(chapter)
        await db_session.flush()
        await db_session.refresh(chapter)

        draft = DraftVersionFactory(chapter_id=chapter.id, version_number=2)
        db_session.add(draft)
        await db_session.flush()

        response = await client.get(
            f"/api/v1/chapters/{chapter.id}/drafts/2", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["version_number"] == 2

    async def test_create_draft_with_mismatched_chapter_id_returns_400(self, client, auth_headers, db_session):
        """POST /api/v1/chapters/{id}/drafts with mismatched chapter_id returns 400."""
        chapter = ChapterFactory(title="草稿测试")
        db_session.add(chapter)
        await db_session.flush()
        await db_session.refresh(chapter)

        payload = {
            "chapter_id": chapter.id + 999,  # Mismatched
            "content": "内容",
            "version_number": 1,
        }
        response = await client.post(
            f"/api/v1/chapters/{chapter.id}/drafts",
            json=payload,
            headers=auth_headers,
        )
        assert response.status_code == 400

    async def test_get_nonexistent_draft_returns_404(self, client, auth_headers, db_session):
        """GET /api/v1/chapters/{id}/drafts/999 returns 404 for missing draft."""
        chapter = ChapterFactory(title="无草稿章节")
        db_session.add(chapter)
        await db_session.flush()
        await db_session.refresh(chapter)

        response = await client.get(
            f"/api/v1/chapters/{chapter.id}/drafts/999", headers=auth_headers
        )
        assert response.status_code == 404
