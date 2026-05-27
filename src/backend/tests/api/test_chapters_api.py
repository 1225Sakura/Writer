"""Tests for chapters API endpoints.

Covers:
- Outline CRUD (list, create, get, update, delete)
- Chapter CRUD (list, create, get, update, delete)
- IF Line CRUD and sync
- Plot Thread CRUD
- Draft versions
- AI inspection results
"""

import pytest
from httpx import AsyncClient

from backend.core.domain.entities import (
    Outline, Chapter, IFLine, PlotThread, DraftVersion,
)


# ---------------------------------------------------------------------------
# Helper: seed an outline into the DB via the session
# ---------------------------------------------------------------------------

async def _seed_outline(db_session, title="Test Outline", description="A test outline"):
    outline = Outline(title=title, description=description)
    db_session.add(outline)
    await db_session.commit()
    await db_session.refresh(outline)
    return outline


async def _seed_chapter(db_session, outline_id, title="Chapter 1", chapter_order=1):
    chapter = Chapter(
        outline_id=outline_id,
        title=title,
        chapter_order=chapter_order,
        summary="A test chapter summary",
    )
    db_session.add(chapter)
    await db_session.commit()
    await db_session.refresh(chapter)
    return chapter


async def _seed_if_line(db_session, title="IF Line 1"):
    if_line = IFLine(title=title, description="An IF line")
    db_session.add(if_line)
    await db_session.commit()
    await db_session.refresh(if_line)
    return if_line


async def _seed_plot_thread(db_session, title="Plot Thread 1"):
    thread = PlotThread(title=title, description="A plot thread", status="active")
    db_session.add(thread)
    await db_session.commit()
    await db_session.refresh(thread)
    return thread


# ===========================================================================
# Outline Tests
# ===========================================================================

class TestOutlineEndpoints:

    @pytest.mark.asyncio
    async def test_list_outlines_empty(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/chapters/outlines")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_create_outline(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/chapters/outlines",
            json={"title": "New Outline", "description": "desc"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "New Outline"

    @pytest.mark.asyncio
    async def test_get_outline(self, authenticated_client: AsyncClient, db_session):
        outline = await _seed_outline(db_session)
        response = await authenticated_client.get(f"/api/v1/chapters/outlines/{outline.id}")
        assert response.status_code == 200
        assert response.json()["id"] == outline.id

    @pytest.mark.asyncio
    async def test_get_outline_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/chapters/outlines/9999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_outline(self, authenticated_client: AsyncClient, db_session):
        outline = await _seed_outline(db_session)
        response = await authenticated_client.patch(
            f"/api/v1/chapters/outlines/{outline.id}",
            json={"title": "Updated Title"},
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Updated Title"

    @pytest.mark.asyncio
    async def test_update_outline_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.patch(
            "/api/v1/chapters/outlines/9999",
            json={"title": "Nope"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_outline(self, authenticated_client: AsyncClient, db_session):
        outline = await _seed_outline(db_session)
        response = await authenticated_client.delete(f"/api/v1/chapters/outlines/{outline.id}")
        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()

    @pytest.mark.asyncio
    async def test_delete_outline_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.delete("/api/v1/chapters/outlines/9999")
        assert response.status_code == 404


# ===========================================================================
# Chapter Tests
# ===========================================================================

class TestChapterEndpoints:

    @pytest.mark.asyncio
    async def test_list_chapters_empty(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/chapters/")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_create_chapter(self, authenticated_client: AsyncClient, db_session):
        outline = await _seed_outline(db_session)
        response = await authenticated_client.post(
            "/api/v1/chapters/",
            json={
                "outline_id": outline.id,
                "title": "New Chapter",
                "chapter_order": 1,
            },
        )
        assert response.status_code == 200
        assert response.json()["title"] == "New Chapter"

    @pytest.mark.asyncio
    async def test_get_chapter(self, authenticated_client: AsyncClient, db_session):
        outline = await _seed_outline(db_session)
        chapter = await _seed_chapter(db_session, outline.id)
        response = await authenticated_client.get(f"/api/v1/chapters/{chapter.id}")
        assert response.status_code == 200
        assert response.json()["id"] == chapter.id

    @pytest.mark.asyncio
    async def test_get_chapter_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/chapters/9999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_chapter(self, authenticated_client: AsyncClient, db_session):
        outline = await _seed_outline(db_session)
        chapter = await _seed_chapter(db_session, outline.id)
        response = await authenticated_client.patch(
            f"/api/v1/chapters/{chapter.id}",
            json={"title": "Updated Chapter"},
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Updated Chapter"

    @pytest.mark.asyncio
    async def test_delete_chapter(self, authenticated_client: AsyncClient, db_session):
        outline = await _seed_outline(db_session)
        chapter = await _seed_chapter(db_session, outline.id)
        response = await authenticated_client.delete(f"/api/v1/chapters/{chapter.id}")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_chapter_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.delete("/api/v1/chapters/9999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_chapters_with_filter(self, authenticated_client: AsyncClient, db_session):
        outline = await _seed_outline(db_session)
        await _seed_chapter(db_session, outline.id, title="Ch1", chapter_order=1)
        await _seed_chapter(db_session, outline.id, title="Ch2", chapter_order=2)
        response = await authenticated_client.get(
            "/api/v1/chapters/",
            params={"outline_id": outline.id},
        )
        assert response.status_code == 200
        chapters = response.json()
        assert len(chapters) >= 2


# ===========================================================================
# IF Line Tests
# ===========================================================================

class TestIFLineEndpoints:

    @pytest.mark.asyncio
    async def test_list_if_lines_empty(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/chapters/if-lines")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_create_if_line(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/chapters/if-lines",
            json={"title": "IF Test", "description": "An IF line"},
        )
        assert response.status_code == 200
        assert response.json()["title"] == "IF Test"

    @pytest.mark.asyncio
    async def test_get_if_line(self, authenticated_client: AsyncClient, db_session):
        if_line = await _seed_if_line(db_session)
        response = await authenticated_client.get(f"/api/v1/chapters/if-lines/{if_line.id}")
        assert response.status_code == 200
        assert response.json()["id"] == if_line.id

    @pytest.mark.asyncio
    async def test_get_if_line_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/chapters/if-lines/9999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_if_line(self, authenticated_client: AsyncClient, db_session):
        if_line = await _seed_if_line(db_session)
        response = await authenticated_client.patch(
            f"/api/v1/chapters/if-lines/{if_line.id}",
            json={"title": "Updated IF"},
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Updated IF"

    @pytest.mark.asyncio
    async def test_delete_if_line(self, authenticated_client: AsyncClient, db_session):
        if_line = await _seed_if_line(db_session)
        response = await authenticated_client.delete(f"/api/v1/chapters/if-lines/{if_line.id}")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_if_line_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.delete("/api/v1/chapters/if-lines/9999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_sync_if_line(self, authenticated_client: AsyncClient, db_session):
        if_line = await _seed_if_line(db_session)
        response = await authenticated_client.post(f"/api/v1/chapters/if-lines/{if_line.id}/sync")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "synced"
        assert "conflicts" in data

    @pytest.mark.asyncio
    async def test_sync_if_line_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post("/api/v1/chapters/if-lines/9999/sync")
        assert response.status_code == 404


# ===========================================================================
# Plot Thread Tests
# ===========================================================================

class TestPlotThreadEndpoints:

    @pytest.mark.asyncio
    async def test_list_plot_threads_empty(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/chapters/plot-threads")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_create_plot_thread(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/chapters/plot-threads",
            json={"title": "Thread Test", "description": "desc", "status": "active"},
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Thread Test"

    @pytest.mark.asyncio
    async def test_get_plot_thread(self, authenticated_client: AsyncClient, db_session):
        thread = await _seed_plot_thread(db_session)
        response = await authenticated_client.get(f"/api/v1/chapters/plot-threads/{thread.id}")
        assert response.status_code == 200
        assert response.json()["id"] == thread.id

    @pytest.mark.asyncio
    async def test_get_plot_thread_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/chapters/plot-threads/9999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_plot_thread(self, authenticated_client: AsyncClient, db_session):
        thread = await _seed_plot_thread(db_session)
        response = await authenticated_client.patch(
            f"/api/v1/chapters/plot-threads/{thread.id}",
            json={"title": "Updated Thread"},
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Updated Thread"

    @pytest.mark.asyncio
    async def test_delete_plot_thread(self, authenticated_client: AsyncClient, db_session):
        thread = await _seed_plot_thread(db_session)
        response = await authenticated_client.delete(f"/api/v1/chapters/plot-threads/{thread.id}")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_plot_thread_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.delete("/api/v1/chapters/plot-threads/9999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_plot_threads_with_status_filter(self, authenticated_client: AsyncClient):
        # Create one, then list with status filter
        await authenticated_client.post(
            "/api/v1/chapters/plot-threads",
            json={"title": "Active Thread", "description": "d", "status": "active"},
        )
        response = await authenticated_client.get(
            "/api/v1/chapters/plot-threads",
            params={"status": "active"},
        )
        assert response.status_code == 200


# ===========================================================================
# Draft Version Tests
# ===========================================================================

class TestDraftVersionEndpoints:

    @pytest.mark.asyncio
    async def test_list_drafts_empty(self, authenticated_client: AsyncClient, db_session):
        outline = await _seed_outline(db_session)
        chapter = await _seed_chapter(db_session, outline.id)
        response = await authenticated_client.get(f"/api/v1/chapters/{chapter.id}/drafts")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_create_draft_version(self, authenticated_client: AsyncClient, db_session):
        outline = await _seed_outline(db_session)
        chapter = await _seed_chapter(db_session, outline.id)
        response = await authenticated_client.post(
            f"/api/v1/chapters/{chapter.id}/drafts",
            json={"chapter_id": chapter.id, "content": "Draft content v1", "version_number": 1},
        )
        assert response.status_code == 200
        assert response.json()["content"] == "Draft content v1"

    @pytest.mark.asyncio
    async def test_create_draft_version_id_mismatch(self, authenticated_client: AsyncClient, db_session):
        outline = await _seed_outline(db_session)
        chapter = await _seed_chapter(db_session, outline.id)
        response = await authenticated_client.post(
            f"/api/v1/chapters/{chapter.id}/drafts",
            json={"chapter_id": chapter.id + 999, "content": "x", "version_number": 1},
        )
        assert response.status_code in (422, 500)  # ValidationError raised

    @pytest.mark.asyncio
    async def test_get_draft_version(self, authenticated_client: AsyncClient, db_session):
        outline = await _seed_outline(db_session)
        chapter = await _seed_chapter(db_session, outline.id)
        await authenticated_client.post(
            f"/api/v1/chapters/{chapter.id}/drafts",
            json={"chapter_id": chapter.id, "content": "Draft v1", "version_number": 1},
        )
        response = await authenticated_client.get(
            f"/api/v1/chapters/{chapter.id}/drafts/1",
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_get_draft_version_not_found(self, authenticated_client: AsyncClient, db_session):
        outline = await _seed_outline(db_session)
        chapter = await _seed_chapter(db_session, outline.id)
        response = await authenticated_client.get(
            f"/api/v1/chapters/{chapter.id}/drafts/999",
        )
        assert response.status_code == 404
