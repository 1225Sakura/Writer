"""Tests for entity graph API endpoints.

Covers:
- GET  /graph/entities
- GET  /graph/relationships
- GET  /graph/visualization/{project_id}
- POST /graph/link-entities
- POST /graph/resolve-ambiguous
- POST /graph/multi-hop
- POST /graph/shortest-path
- GET  /graph/centrality
- GET  /graph/clusters
- GET  /graph/duplicates
- GET  /graph/neighborhood
"""

import pytest
from httpx import AsyncClient


# ===========================================================================
# Entity Listing Tests
# ===========================================================================

class TestEntityListingEndpoints:

    @pytest.mark.asyncio
    async def test_list_entities_all(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/graph/entities")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_list_entities_by_type(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get(
            "/api/v1/graph/entities",
            params={"entity_type": "character"},
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_list_entities_invalid_type(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get(
            "/api/v1/graph/entities",
            params={"entity_type": "invalid_type"},
        )
        assert response.status_code == 400


# ===========================================================================
# Relationship Tests
# ===========================================================================

class TestRelationshipEndpoints:

    @pytest.mark.asyncio
    async def test_get_relationships(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get(
            "/api/v1/graph/relationships",
            params={"entity_id": 1, "entity_type": "character"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "entity_id" in data
        assert "entity_type" in data
        assert "relationships" in data
        assert "total" in data


# ===========================================================================
# Visualization Tests
# ===========================================================================

class TestVisualizationEndpoints:

    @pytest.mark.asyncio
    async def test_get_visualization(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/graph/visualization/1")
        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data
        assert "edges" in data
        assert "node_count" in data
        assert "edge_count" in data


# ===========================================================================
# Entity Linking Tests
# ===========================================================================

class TestEntityLinkingEndpoints:

    @pytest.mark.asyncio
    async def test_link_entities(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/graph/link-entities",
            json={
                "entity_id": 1,
                "entity_type": "character",
                "aliases": ["Hero", "Protagonist"],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["entity_id"] == 1
        assert "registered_aliases" in data
        assert "failed" in data


# ===========================================================================
# Ambiguous Resolution Tests
# ===========================================================================

class TestAmbiguousResolutionEndpoints:

    @pytest.mark.asyncio
    async def test_resolve_ambiguous_empty_mentions(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/graph/resolve-ambiguous",
            json={"mentions": []},
        )
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert "warnings" in data
        assert "auto_resolved" in data
        assert "needs_review" in data

    @pytest.mark.asyncio
    async def test_resolve_ambiguous_with_mentions(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/graph/resolve-ambiguous",
            json={
                "mentions": [
                    {"mention": "Hero", "context": "The hero fought bravely"},
                    {"mention": "Dark Forest", "context": "They entered the dark forest"},
                ],
                "project_id": 1,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["results"]) == 2


# ===========================================================================
# Multi-hop Query Tests
# ===========================================================================

class TestMultiHopEndpoints:

    @pytest.mark.asyncio
    async def test_multi_hop_query(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/graph/multi-hop",
            json={
                "start_entity_id": 1,
                "start_entity_type": "character",
                "max_hops": 2,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "start_entity_id" in data
        assert "paths" in data
        assert "total_paths" in data

    @pytest.mark.asyncio
    async def test_multi_hop_with_end_entity(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/graph/multi-hop",
            json={
                "start_entity_id": 1,
                "start_entity_type": "character",
                "end_entity_id": 2,
                "end_entity_type": "character",
                "max_hops": 3,
            },
        )
        assert response.status_code == 200


# ===========================================================================
# Shortest Path Tests
# ===========================================================================

class TestShortestPathEndpoints:

    @pytest.mark.asyncio
    async def test_shortest_path(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/graph/shortest-path",
            json={
                "start_entity_id": 1,
                "start_entity_type": "character",
                "end_entity_id": 2,
                "end_entity_type": "character",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "found" in data
        assert "start_entity_id" in data
        assert "end_entity_id" in data


# ===========================================================================
# Centrality Tests
# ===========================================================================

class TestCentralityEndpoints:

    @pytest.mark.asyncio
    async def test_get_centrality_degree(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get(
            "/api/v1/graph/centrality",
            params={"metric": "degree"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["metric"] == "degree"
        assert "scores" in data

    @pytest.mark.asyncio
    async def test_get_centrality_invalid_metric(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get(
            "/api/v1/graph/centrality",
            params={"metric": "invalid"},
        )
        assert response.status_code == 400


# ===========================================================================
# Cluster Tests
# ===========================================================================

class TestClusterEndpoints:

    @pytest.mark.asyncio
    async def test_get_clusters(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/graph/clusters")
        assert response.status_code == 200
        data = response.json()
        assert "clusters" in data
        assert "total_clusters" in data


# ===========================================================================
# Duplicate Detection Tests
# ===========================================================================

class TestDuplicateDetectionEndpoints:

    @pytest.mark.asyncio
    async def test_find_duplicates(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get(
            "/api/v1/graph/duplicates",
            params={"entity_type": "character"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["entity_type"] == "character"
        assert "duplicates" in data
        assert "total" in data

    @pytest.mark.asyncio
    async def test_find_duplicates_with_threshold(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get(
            "/api/v1/graph/duplicates",
            params={"entity_type": "character", "threshold": 0.9},
        )
        assert response.status_code == 200


# ===========================================================================
# Neighborhood Tests
# ===========================================================================

class TestNeighborhoodEndpoints:

    @pytest.mark.asyncio
    async def test_get_neighborhood(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get(
            "/api/v1/graph/neighborhood",
            params={"entity_id": 1, "entity_type": "character", "depth": 1},
        )
        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data
        assert "edges" in data
