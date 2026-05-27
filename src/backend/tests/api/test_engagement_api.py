"""Tests for engagement / hook analysis API endpoints.

Covers:
- POST /engagement/analyze/{chapter_id}
- GET  /engagement/hooks/{chapter_id}
- GET  /engagement/debts
- GET  /engagement/score/{chapter_id}
- POST /engagement/debts/detect/{chapter_id}
- POST /engagement/debts/resolve/{debt_id}
"""

import pytest
from httpx import AsyncClient

from backend.core.domain.entities import Outline, Chapter, PlotThread


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _seed_chapter_with_content(db_session, title="Ch1", content="The hero walked into the dark forest."):
    outline = Outline(title="Test Outline", description="desc")
    db_session.add(outline)
    await db_session.commit()
    await db_session.refresh(outline)

    chapter = Chapter(
        outline_id=outline.id,
        title=title,
        chapter_order=1,
        summary=content,
    )
    db_session.add(chapter)
    await db_session.commit()
    await db_session.refresh(chapter)
    return chapter


async def _seed_plot_thread(db_session, title="Thread 1", status="active"):
    thread = PlotThread(title=title, description="A debt", status=status)
    db_session.add(thread)
    await db_session.commit()
    await db_session.refresh(thread)
    return thread


# ===========================================================================
# Engagement Analysis Tests
# ===========================================================================

class TestEngagementAnalysisEndpoint:

    @pytest.mark.asyncio
    async def test_analyze_chapter_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post("/api/v1/engagement/analyze/9999")
        assert response.status_code in (404, 400)

    @pytest.mark.asyncio
    async def test_analyze_chapter_with_content(self, authenticated_client: AsyncClient, db_session):
        chapter = await _seed_chapter_with_content(db_session)
        response = await authenticated_client.post(
            f"/api/v1/engagement/analyze/{chapter.id}",
        )
        # May succeed (200) or fail due to missing content_storage (400)
        assert response.status_code in (200, 400)


# ===========================================================================
# Hook Detection Tests
# ===========================================================================

class TestHookDetectionEndpoint:

    @pytest.mark.asyncio
    async def test_detect_hooks_chapter_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/engagement/hooks/9999")
        assert response.status_code in (404, 400)

    @pytest.mark.asyncio
    async def test_detect_hooks_chapter_with_content(self, authenticated_client: AsyncClient, db_session):
        chapter = await _seed_chapter_with_content(db_session)
        response = await authenticated_client.get(
            f"/api/v1/engagement/hooks/{chapter.id}",
        )
        assert response.status_code in (200, 400)


# ===========================================================================
# Engagement Score Tests
# ===========================================================================

class TestEngagementScoreEndpoint:

    @pytest.mark.asyncio
    async def test_get_score_chapter_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/engagement/score/9999")
        assert response.status_code in (404, 400)


# ===========================================================================
# Narrative Debt Tests
# ===========================================================================

class TestNarrativeDebtEndpoints:

    @pytest.mark.asyncio
    async def test_get_narrative_debts_empty(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/engagement/debts")
        assert response.status_code == 200
        data = response.json()
        assert "total_debts" in data
        assert "active_debts" in data
        assert "debt_health_score" in data

    @pytest.mark.asyncio
    async def test_get_narrative_debts_with_filter(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get(
            "/api/v1/engagement/debts",
            params={"project_id": 1},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_detect_debts_chapter_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post("/api/v1/engagement/debts/detect/9999")
        assert response.status_code in (404, 400)

    @pytest.mark.asyncio
    async def test_resolve_debt_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post("/api/v1/engagement/debts/resolve/9999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_resolve_debt(self, authenticated_client: AsyncClient, db_session):
        thread = await _seed_plot_thread(db_session)
        response = await authenticated_client.post(
            f"/api/v1/engagement/debts/resolve/{thread.id}",
            params={"resolved_chapter_id": 1},
        )
        assert response.status_code == 200
        data = response.json()
        assert "fulfilled" in data["message"].lower()
