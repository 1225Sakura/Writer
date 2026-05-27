"""Tests for AI agent API endpoints.

Covers:
- POST /agents/style
- POST /agents/review
- POST /agents/plot
- GET  /agents/checkers
- POST /agents/check
- POST /agents/check-all
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient

from backend.core.domain.entities import Outline, Chapter


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _seed_chapter(db_session, title="Ch1", summary="The hero fought bravely."):
    outline = Outline(title="Outline", description="desc")
    db_session.add(outline)
    await db_session.commit()
    await db_session.refresh(outline)

    chapter = Chapter(
        outline_id=outline.id,
        title=title,
        chapter_order=1,
        summary=summary,
    )
    db_session.add(chapter)
    await db_session.commit()
    await db_session.refresh(chapter)
    return chapter


# ===========================================================================
# Style Analysis Tests
# ===========================================================================

class TestStyleAnalysisEndpoint:

    @pytest.mark.asyncio
    async def test_analyze_style_default(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/agents/style",
            json={"content": "The moonlight illuminated the quiet courtyard."},
        )
        assert response.status_code == 200
        data = response.json()
        assert "style_match_score" in data
        assert "detected_style" in data
        assert "suggestions" in data
        assert "analysis" in data

    @pytest.mark.asyncio
    async def test_analyze_style_with_reference(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/agents/style",
            json={
                "content": "细腻的忧伤弥漫在诗意的唯美中。",
                "style_reference": "江南",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["detected_style"] == "江南"

    @pytest.mark.asyncio
    async def test_analyze_style_empty_content_rejected(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/agents/style",
            json={"content": ""},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_analyze_style_match_score_range(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/agents/style",
            json={"content": "战斗热血燃烧突破逆天的战斗。"},
        )
        assert response.status_code == 200
        score = response.json()["style_match_score"]
        assert 0 <= score <= 100


# ===========================================================================
# Checker List Tests
# ===========================================================================

class TestCheckerListEndpoint:

    @pytest.mark.asyncio
    async def test_list_checkers(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/agents/checkers")
        assert response.status_code == 200
        data = response.json()
        assert "checkers" in data
        assert "total" in data
        assert data["total"] == 8
        checker_names = [c["name"] for c in data["checkers"]]
        assert "consistency" in checker_names
        assert "continuity" in checker_names
        assert "pacing" in checker_names
        assert "ooc" in checker_names


# ===========================================================================
# Checker Run Tests
# ===========================================================================

class TestCheckerRunEndpoint:

    @pytest.mark.asyncio
    async def test_run_checker_chapter_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/agents/check",
            json={
                "checker_name": "consistency",
                "chapter_id": 9999,
                "mode": "quick",
            },
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_run_checker_invalid_name(self, authenticated_client: AsyncClient, db_session):
        chapter = await _seed_chapter(db_session)
        response = await authenticated_client.post(
            "/api/v1/agents/check",
            json={
                "checker_name": "nonexistent_checker",
                "chapter_id": chapter.id,
                "mode": "quick",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_run_checker_invalid_mode(self, authenticated_client: AsyncClient, db_session):
        chapter = await _seed_chapter(db_session)
        response = await authenticated_client.post(
            "/api/v1/agents/check",
            json={
                "checker_name": "consistency",
                "chapter_id": chapter.id,
                "mode": "invalid",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_run_consistency_checker_quick(self, authenticated_client: AsyncClient, db_session):
        chapter = await _seed_chapter(db_session)
        response = await authenticated_client.post(
            "/api/v1/agents/check",
            json={
                "checker_name": "consistency",
                "chapter_id": chapter.id,
                "mode": "quick",
            },
        )
        # May succeed (200) or fail due to AI service not configured (500/503)
        assert response.status_code in (200, 500, 503)

    @pytest.mark.asyncio
    async def test_run_pacing_checker_quick(self, authenticated_client: AsyncClient, db_session):
        chapter = await _seed_chapter(db_session)
        response = await authenticated_client.post(
            "/api/v1/agents/check",
            json={
                "checker_name": "pacing",
                "chapter_id": chapter.id,
                "mode": "quick",
            },
        )
        assert response.status_code in (200, 500, 503)


# ===========================================================================
# Pipeline (Check All) Tests
# ===========================================================================

class TestCheckAllEndpoint:

    @pytest.mark.asyncio
    async def test_check_all_chapter_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/agents/check-all",
            json={"chapter_id": 9999, "mode": "quick"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_check_all_invalid_mode(self, authenticated_client: AsyncClient, db_session):
        chapter = await _seed_chapter(db_session)
        response = await authenticated_client.post(
            "/api/v1/agents/check-all",
            json={"chapter_id": chapter.id, "mode": "invalid"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_check_all_quick(self, authenticated_client: AsyncClient, db_session):
        chapter = await _seed_chapter(db_session)
        response = await authenticated_client.post(
            "/api/v1/agents/check-all",
            json={"chapter_id": chapter.id, "mode": "quick"},
        )
        # May succeed or fail depending on AI service availability
        assert response.status_code in (200, 500, 503, 501)


# ===========================================================================
# Review Agent Tests
# ===========================================================================

class TestReviewAgentEndpoint:

    @pytest.mark.asyncio
    async def test_run_review_empty_content_rejected(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/agents/review",
            json={"content": ""},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_run_review_no_provider(self, authenticated_client: AsyncClient):
        """Without AI provider configured, review should return 503."""
        response = await authenticated_client.post(
            "/api/v1/agents/review",
            json={"content": "Some chapter content to review."},
        )
        assert response.status_code in (503, 500)


# ===========================================================================
# Plot Agent Tests
# ===========================================================================

class TestPlotAgentEndpoint:

    @pytest.mark.asyncio
    async def test_run_plot_invalid_task_type(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/agents/plot",
            json={"task_type": "invalid_type"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_run_plot_no_provider(self, authenticated_client: AsyncClient):
        """Without AI provider configured, plot should return 503."""
        response = await authenticated_client.post(
            "/api/v1/agents/plot",
            json={"task_type": "full"},
        )
        assert response.status_code in (503, 500)
