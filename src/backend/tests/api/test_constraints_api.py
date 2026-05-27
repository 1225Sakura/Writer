"""Tests for constraint engine API endpoints.

Covers:
- POST /constraints/check
- POST /constraints/enforce
- GET  /constraints/rules
- POST /constraints/rules
- DELETE /constraints/rules/{rule_id}
- GET  /constraints/violations
- POST /constraints/style-check
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient


# ===========================================================================
# Constraint Check Tests
# ===========================================================================

class TestConstraintCheckEndpoint:

    @pytest.mark.asyncio
    async def test_check_constraints_empty_content_rejected(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/constraints/check",
            json={"content": ""},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_check_constraints_invalid_mode_rejected(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/constraints/check",
            json={"content": "Some text", "mode": "invalid"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_check_constraints_valid_quick(self, authenticated_client: AsyncClient):
        """Quick mode check should return a valid response structure."""
        response = await authenticated_client.post(
            "/api/v1/constraints/check",
            json={"content": "The protagonist walked through the ancient forest.", "mode": "quick"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "passed" in data
        assert "overall_score" in data
        assert "violations" in data
        assert "rules_checked" in data
        assert "summary" in data

    @pytest.mark.asyncio
    async def test_enforce_constraints_alias(self, authenticated_client: AsyncClient):
        """POST /enforce should behave the same as /check."""
        response = await authenticated_client.post(
            "/api/v1/constraints/enforce",
            json={"content": "Some valid content for testing.", "mode": "quick"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "passed" in data
        assert "overall_score" in data


# ===========================================================================
# Constraint Rules Tests
# ===========================================================================

class TestConstraintRulesEndpoints:

    @pytest.mark.asyncio
    async def test_list_rules(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/constraints/rules")
        assert response.status_code == 200
        data = response.json()
        assert "rules" in data
        assert "total" in data
        assert isinstance(data["rules"], list)

    @pytest.mark.asyncio
    async def test_list_rules_filter_by_law_type(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get(
            "/api/v1/constraints/rules",
            params={"law_type": "outline_law"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "rules" in data

    @pytest.mark.asyncio
    async def test_list_rules_filter_by_status(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get(
            "/api/v1/constraints/rules",
            params={"status": "active"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "rules" in data

    @pytest.mark.asyncio
    async def test_add_rule(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/constraints/rules",
            json={
                "law_type": "outline_law",
                "name": "Test Rule",
                "description": "A test constraint rule",
                "severity": "high",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Rule"
        assert data["law_type"] == "outline_law"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_add_rule_invalid_law_type(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/constraints/rules",
            json={
                "law_type": "bad_type",
                "name": "Bad Rule",
                "description": "desc",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_add_rule_invalid_severity(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/constraints/rules",
            json={
                "law_type": "outline_law",
                "name": "Bad Rule",
                "description": "desc",
                "severity": "invalid",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_delete_rule_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.delete("/api/v1/constraints/rules/nonexistent-id")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_add_then_delete_rule(self, authenticated_client: AsyncClient):
        # Add a rule
        add_resp = await authenticated_client.post(
            "/api/v1/constraints/rules",
            json={
                "law_type": "setting_physics",
                "name": "Deletable Rule",
                "description": "Will be deleted",
                "severity": "medium",
            },
        )
        assert add_resp.status_code == 201
        rule_id = add_resp.json()["id"]

        # Delete it
        del_resp = await authenticated_client.delete(f"/api/v1/constraints/rules/{rule_id}")
        assert del_resp.status_code == 204


# ===========================================================================
# Violations Tests
# ===========================================================================

class TestViolationEndpoints:

    @pytest.mark.asyncio
    async def test_get_violations(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/constraints/violations")
        assert response.status_code == 200
        data = response.json()
        assert "violations" in data
        assert "total" in data
        assert "filters" in data

    @pytest.mark.asyncio
    async def test_get_violations_invalid_law_type(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get(
            "/api/v1/constraints/violations",
            params={"law_type": "invalid"},
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_get_violations_invalid_severity(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get(
            "/api/v1/constraints/violations",
            params={"severity": "invalid"},
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_get_violations_with_filters(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get(
            "/api/v1/constraints/violations",
            params={"chapter_id": 1, "law_type": "outline_law", "severity": "high", "limit": 10},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["filters"]["chapter_id"] == 1
        assert data["filters"]["law_type"] == "outline_law"


# ===========================================================================
# Style Check Tests
# ===========================================================================

class TestStyleCheckEndpoint:

    @pytest.mark.asyncio
    async def test_style_check_empty_content_rejected(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/constraints/style-check",
            json={"content": ""},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_style_check_valid(self, authenticated_client: AsyncClient):
        with patch(
            "backend.api.v1.endpoints.constraints.StyleConstraintEnforcer"
        ) as mock_enforcer_cls, patch(
            "backend.services.constraints.ConstraintEngine"
        ) as MockEngine:
            mock_enforcer = AsyncMock()
            mock_enforcer.enforce.return_value = []
            mock_enforcer_cls.return_value = mock_enforcer

            MockEngine._compute_score.__func__ = MagicMock(return_value=100)
            MockEngine.PASS_THRESHOLD = 70

            response = await authenticated_client.post(
                "/api/v1/constraints/style-check",
                json={"content": "The moonlight bathed the courtyard in silver."},
            )
            assert response.status_code == 200
            data = response.json()
            assert "passed" in data
            assert "overall_score" in data
            assert "violations" in data
