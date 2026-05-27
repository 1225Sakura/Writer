"""Tests for context (RAG) and context-rank API endpoints.

Covers:
- POST /context/build/{chapter_id}
- POST /context/index/{chapter_id}
- POST /context/query
- GET  /context/chunks/{chapter_id}
- DELETE /context/chunks/{chapter_id}
- GET  /context/stats
- POST /context-rank/rank
- GET  /context-rank/weights
- POST /context-rank/weights
- POST /context-rank/weights/entity
- POST /context-rank/weights/template
- POST /context-rank/weights/resolve
- POST /context-rank/weights/reset
- POST /context-rank/route
- POST /context-rank/route/intent
- POST /context-rank/rank/items
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from httpx import AsyncClient


# ===========================================================================
# Context Build Tests
# ===========================================================================

class TestContextBuildEndpoint:

    @pytest.mark.asyncio
    async def test_build_context_chapter_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/context/build/9999",
            json={"max_chars": 8000},
        )
        assert response.status_code == 404


# ===========================================================================
# Context Index Tests
# ===========================================================================

class TestContextIndexEndpoint:

    @pytest.mark.asyncio
    async def test_index_chapter(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/context/index/1",
            json={
                "content": "The hero ventured into the dark forest. Trees loomed overhead.",
                "summary": "Hero enters forest",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "chapter_id" in data
        assert "stored" in data
        assert "total_chunks" in data


# ===========================================================================
# Context Query Tests
# ===========================================================================

class TestContextQueryEndpoint:

    @pytest.mark.asyncio
    async def test_query_context(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/context/query",
            json={"query": "hero forest", "strategy": "bm25_fallback", "top_k": 5},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "hero forest"
        assert "results" in data
        assert "total" in data

    @pytest.mark.asyncio
    async def test_query_context_invalid_strategy(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/context/query",
            json={"query": "test", "strategy": "invalid_strategy"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_query_context_empty_query_rejected(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/context/query",
            json={"query": ""},
        )
        assert response.status_code == 422


# ===========================================================================
# Context Chunks Tests
# ===========================================================================

class TestContextChunksEndpoints:

    @pytest.mark.asyncio
    async def test_get_chunks_empty(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/context/chunks/9999")
        assert response.status_code == 200
        data = response.json()
        assert data["chapter_id"] == 9999
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_delete_chunks(self, authenticated_client: AsyncClient):
        response = await authenticated_client.delete("/api/v1/context/chunks/9999")
        assert response.status_code == 200
        data = response.json()
        assert data["chapter_id"] == 9999


# ===========================================================================
# Context Stats Tests
# ===========================================================================

class TestContextStatsEndpoint:

    @pytest.mark.asyncio
    async def test_get_stats(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/context/stats")
        assert response.status_code == 200
        data = response.json()
        assert "vectors" in data
        assert "terms" in data
        assert "max_chapter" in data


# ===========================================================================
# Context Rank Tests
# ===========================================================================

def _mock_success_response(data=None, message=None, request_id=None):
    """Return a plain dict instead of a Pydantic SuccessResponse to avoid
    ResponseValidationError when the endpoint declares -> Dict[str, Any]."""
    return {"data": data, "message": message, "request_id": request_id}


class TestContextRankEndpoints:

    @pytest.mark.asyncio
    async def test_rank_context_pack(self, authenticated_client: AsyncClient):
        with patch("backend.api.v1.endpoints.context_rank.ContextRanker") as MockRanker:
            mock_instance = MockRanker.return_value
            mock_instance.rank_pack.return_value = {"core": [{"content": "test"}]}
            response = await authenticated_client.post(
                "/api/v1/context-rank/rank",
                json={"pack": {"core": [{"content": "test"}]}, "chapter": 1, "debug": False},
            )
            assert response.status_code == 200
            data = response.json()
            assert "ranked_pack" in data
            assert "meta" in data

    @pytest.mark.asyncio
    async def test_get_all_weights(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/context-rank/weights")
        assert response.status_code == 200
        data = response.json()
        assert "entity_weights" in data
        assert "template_weights" in data

    @pytest.mark.asyncio
    async def test_update_weights(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/context-rank/weights",
            json={"entity_weights": {"character": 1.5}},
        )
        assert response.status_code == 200
        data = response.json()
        assert "entity_weights" in data

    @pytest.mark.asyncio
    async def test_set_entity_weight(self, authenticated_client: AsyncClient):
        from backend.services.context_weights import ContextWeights
        with patch("backend.api.v1.endpoints.context_rank.context_weights", ContextWeights()):
            response = await authenticated_client.post(
                "/api/v1/context-rank/weights/entity",
                json={"entity_type": "item", "weight": 1.2},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["entity_type"] == "item"
            assert data["weight"] == 1.2

    @pytest.mark.asyncio
    async def test_set_template_weight(self, authenticated_client: AsyncClient):
        from backend.services.context_weights import ContextWeights
        with patch("backend.api.v1.endpoints.context_rank.context_weights", ContextWeights()):
            response = await authenticated_client.post(
                "/api/v1/context-rank/weights/template",
                json={"template": "core", "weights": {"scene": 0.8, "global": 0.5}},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["template"] == "core"

    @pytest.mark.asyncio
    async def test_resolve_weights(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/context-rank/weights/resolve",
            json={"template": "core", "stage": "early"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_reset_weights(self, authenticated_client: AsyncClient):
        from backend.services.context_weights import ContextWeights
        with patch("backend.api.v1.endpoints.context_rank.context_weights", ContextWeights()):
            response = await authenticated_client.post("/api/v1/context-rank/weights/reset")
            assert response.status_code == 200
            data = response.json()
            assert data["reset"] is True

    @pytest.mark.asyncio
    async def test_route_query(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/context-rank/route",
            json={"query": "What happened to the hero in chapter 3?"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "intent" in data
        assert "entities" in data
        assert "subqueries" in data

    @pytest.mark.asyncio
    async def test_detect_intent(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/context-rank/route/intent",
            json={"query": "Tell me about the dark forest"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "intent" in data

    @pytest.mark.asyncio
    async def test_rank_generic_items(self, authenticated_client: AsyncClient):
        with patch("backend.api.v1.endpoints.context_rank.ContextRanker") as MockRanker:
            mock_instance = MockRanker.return_value
            mock_instance.rank_generic_items.return_value = [
                {"chapter": 1, "content": "First chapter content"},
                {"chapter": 5, "content": "Fifth chapter content"},
            ]
            response = await authenticated_client.post(
                "/api/v1/context-rank/rank/items",
                json=[
                    {"chapter": 1, "content": "First chapter content"},
                    {"chapter": 5, "content": "Fifth chapter content"},
                ],
                params={"current_chapter": 3},
            )
            assert response.status_code == 200
