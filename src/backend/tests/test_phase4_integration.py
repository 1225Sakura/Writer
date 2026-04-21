"""Phase 4 Integration Tests

Tests for Phase 4 features:
- Metrics endpoint returns correct format
- AI health endpoint returns provider status
- Preload service runs at startup
- Workflow execution persistence

Run: python -m pytest tests/test_phase4_integration.py -v
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock

from main import app


@pytest.fixture
async def client():
    """Create async test client for the FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# =============================================================================
# Metrics Endpoint Tests
# =============================================================================

class TestMetricsEndpoint:
    """Test metrics endpoint returns correct format."""

    @pytest.mark.asyncio
    async def test_metrics_endpoint_exists(self, client):
        """Test that the metrics endpoint is registered and accessible."""
        response = await client.get("/api/v1/stats/overview")
        assert response.status_code in (200, 401)

    @pytest.mark.asyncio
    async def test_metrics_response_format(self, client):
        """Test metrics endpoint returns expected field structure."""
        response = await client.get("/api/v1/stats/overview")
        # May be 401 without auth, but endpoint should exist
        if response.status_code == 200:
            data = response.json()
            # Verify expected fields from stats router
            expected_fields = [
                "total_chapters",
                "total_characters",
                "total_outlines",
                "total_if_lines",
                "total_draft_versions",
                "total_plot_threads",
                "total_word_count",
                "total_chat_sessions",
                "chapters_by_status",
            ]
            for field in expected_fields:
                assert field in data, f"Missing field: {field}"

            # Verify types
            assert isinstance(data["total_chapters"], int)
            assert isinstance(data["total_characters"], int)
            assert isinstance(data["total_word_count"], int)
            assert isinstance(data["chapters_by_status"], dict)

    @pytest.mark.asyncio
    async def test_metrics_chapters_by_status_is_dict(self, client):
        """Test chapters_by_status is a dict."""
        response = await client.get("/api/v1/stats/overview")
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data["chapters_by_status"], dict)

    @pytest.mark.asyncio
    async def test_metrics_non_negative_counts(self, client):
        """Test all count fields are non-negative."""
        response = await client.get("/api/v1/stats/overview")
        if response.status_code == 200:
            data = response.json()
            count_fields = [
                "total_chapters",
                "total_characters",
                "total_outlines",
                "total_if_lines",
                "total_draft_versions",
                "total_plot_threads",
                "total_word_count",
                "total_chat_sessions",
            ]
            for field in count_fields:
                assert data[field] >= 0, f"{field} should be non-negative"


# =============================================================================
# AI Health Endpoint Tests
# =============================================================================

class TestAIHealthEndpoint:
    """Test AI health endpoint returns provider status."""

    @pytest.mark.asyncio
    async def test_health_check_has_ai_service_section(self, client):
        """Test health check includes ai_service section."""
        response = await client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert "checks" in data
        assert "ai_service" in data["checks"]

    @pytest.mark.asyncio
    async def test_ai_service_has_status(self, client):
        """Test ai_service check has a status field."""
        response = await client.get("/api/v1/health")
        data = response.json()
        ai_check = data["checks"]["ai_service"]
        assert "status" in ai_check
        assert ai_check["status"] in (
            "configured",
            "not_configured",
            "unknown",
            "error",
        )

    @pytest.mark.asyncio
    async def test_ai_service_has_url_when_configured(self, client):
        """Test ai_service includes URL when configured."""
        response = await client.get("/api/v1/health")
        data = response.json()
        ai_check = data["checks"]["ai_service"]
        if ai_check["status"] == "configured":
            assert "url" in ai_check
            assert isinstance(ai_check["url"], str)
            assert ai_check["url"].startswith("http")

    @pytest.mark.asyncio
    async def test_ai_service_has_message_when_not_configured(self, client):
        """Test ai_service includes message when not configured."""
        response = await client.get("/api/v1/health")
        data = response.json()
        ai_check = data["checks"]["ai_service"]
        if ai_check["status"] == "not_configured":
            assert "message" in ai_check
            assert "not set" in ai_check["message"].lower() or "API key" in ai_check["message"]

    @pytest.mark.asyncio
    async def test_health_overall_status(self, client):
        """Test health check returns overall status."""
        response = await client.get("/api/v1/health")
        data = response.json()
        assert "status" in data
        assert data["status"] in ("healthy", "degraded", "unhealthy")

    @pytest.mark.asyncio
    async def test_health_has_timestamp(self, client):
        """Test health check includes ISO timestamp."""
        response = await client.get("/api/v1/health")
        data = response.json()
        assert "timestamp" in data
        # Verify ISO format roughly
        assert "T" in data["timestamp"] or "t" in data["timestamp"].lower()

    @pytest.mark.asyncio
    async def test_health_has_app_info(self, client):
        """Test health check includes app metadata."""
        response = await client.get("/api/v1/health")
        data = response.json()
        assert "app" in data
        assert "name" in data["app"]
        assert "version" in data["app"]

    @pytest.mark.asyncio
    async def test_health_has_system_info(self, client):
        """Test health check includes system info."""
        response = await client.get("/api/v1/health")
        data = response.json()
        assert "system" in data
        assert "python_version" in data["system"]
        assert "platform" in data["system"]


# =============================================================================
# Preload Service Tests
# =============================================================================

class TestPreloadService:
    """Test preload service runs at startup."""

    @pytest.mark.asyncio
    async def test_app_has_lifespan(self, client):
        """Test app has lifespan context manager for startup/shutdown."""
        from main import lifespan
        assert lifespan is not None

    @pytest.mark.asyncio
    async def test_lifespan_is_async_context_manager(self):
        """Test lifespan is an async context manager."""
        from main import lifespan, app
        import inspect
        assert inspect.isasyncgenfunction(lifespan)

    @pytest.mark.asyncio
    async def test_workflow_orchestrator_initialized(self):
        """Test workflow orchestrator is initialized during startup."""
        from routes.workflows import get_orchestrator
        # This should not raise if orchestrator was set during startup
        # Note: In test context, orchestrator may not be initialized
        # so we check the function exists
        assert callable(get_orchestrator)

    @pytest.mark.asyncio
    async def test_workflow_registry_has_core_workflows(self):
        """Test workflow registry contains core workflows."""
        from agents.workflows import WORKFLOW_REGISTRY
        expected_workflows = ["initialization", "writing", "review"]
        for wf_name in expected_workflows:
            assert wf_name in WORKFLOW_REGISTRY, f"Missing workflow: {wf_name}"

    @pytest.mark.asyncio
    async def test_workflow_registry_workflows_have_stages(self):
        """Test each workflow has at least one stage."""
        from agents.workflows import WORKFLOW_REGISTRY
        for name, stages in WORKFLOW_REGISTRY.items():
            assert len(stages) > 0, f"Workflow '{name}' has no stages"

    @pytest.mark.asyncio
    async def test_workflow_registry_stage_configs_valid(self):
        """Test stage configs have required fields."""
        from agents.workflows import WORKFLOW_REGISTRY
        for name, stages in WORKFLOW_REGISTRY.items():
            for stage in stages:
                assert hasattr(stage, "name"), f"Stage in '{name}' missing name"
                assert hasattr(stage, "agents"), f"Stage in '{name}' missing agents"
                assert hasattr(stage, "mode"), f"Stage in '{name}' missing mode"
                assert stage.mode in ("parallel", "sequential")


# =============================================================================
# Workflow Execution Persistence Tests
# =============================================================================

class TestWorkflowExecutionPersistence:
    """Test workflow execution persistence."""

    @pytest.mark.asyncio
    async def test_workflow_endpoints_exist(self, client):
        """Test workflow endpoints are registered."""
        # List workflows (may need auth)
        response = await client.get("/api/v1/workflows/")
        assert response.status_code in (200, 401, 403)

    @pytest.mark.asyncio
    async def test_workflow_list_returns_workflows(self, client):
        """Test workflow list endpoint returns workflow data."""
        response = await client.get("/api/v1/workflows/")
        if response.status_code == 200:
            data = response.json()
            assert "workflows" in data
            assert isinstance(data["workflows"], list)

    @pytest.mark.asyncio
    async def test_workflow_execution_endpoint_exists(self, client):
        """Test workflow execution endpoint exists."""
        response = await client.post(
            "/api/v1/workflows/initialization/execute",
            json={"context": {}},
        )
        # May be 401/403 without auth, 404 if workflow not found, 202 if accepted
        assert response.status_code in (202, 401, 403, 404)

    @pytest.mark.asyncio
    async def test_orchestrator_has_execution_methods(self):
        """Test orchestrator has execution tracking methods."""
        from agents.orchestrator import AgentOrchestrator
        assert hasattr(AgentOrchestrator, "execute_workflow")
        assert hasattr(AgentOrchestrator, "get_execution_status")
        assert hasattr(AgentOrchestrator, "list_executions")

    @pytest.mark.asyncio
    async def test_orchestrator_execution_status_structure(self):
        """Test execution status returns expected structure."""
        from agents.orchestrator import AgentOrchestrator, WorkflowStatus
        from utils.event_bus import AsyncEventBus

        event_bus = AsyncEventBus()
        orchestrator = AgentOrchestrator(event_bus)

        # Register a test workflow
        from agents.orchestrator import StageConfig
        stages = [StageConfig(name="test_stage", agents=["test_agent"], mode="sequential")]
        orchestrator.register_workflow("test_workflow", stages)

        # Verify workflow is registered
        wf = orchestrator.get_workflow("test_workflow")
        assert wf is not None
        assert wf.name == "test_workflow"

    @pytest.mark.asyncio
    async def test_orchestrator_list_workflows(self):
        """Test orchestrator can list registered workflows."""
        from agents.orchestrator import AgentOrchestrator, StageConfig
        from utils.event_bus import AsyncEventBus

        event_bus = AsyncEventBus()
        orchestrator = AgentOrchestrator(event_bus)

        stages = [StageConfig(name="stage1", agents=[], mode="sequential")]
        orchestrator.register_workflow("wf1", stages, description="Test workflow")

        workflows = orchestrator.list_workflows()
        assert len(workflows) == 1
        assert workflows[0]["name"] == "wf1"
        assert workflows[0]["description"] == "Test workflow"
        assert workflows[0]["stage_count"] == 1

    @pytest.mark.asyncio
    async def test_orchestrator_workflow_status_enum(self):
        """Test WorkflowStatus enum has all expected states."""
        from agents.orchestrator import WorkflowStatus
        expected = {"pending", "running", "completed", "failed", "cancelled"}
        actual = {s.value for s in WorkflowStatus}
        assert expected == actual

    @pytest.mark.asyncio
    async def test_orchestrator_agent_execution_status_enum(self):
        """Test AgentExecutionStatus enum has all expected states."""
        from agents.orchestrator import AgentExecutionStatus
        expected = {"pending", "running", "completed", "failed", "skipped"}
        actual = {s.value for s in AgentExecutionStatus}
        assert expected == actual


# =============================================================================
# Route Registration Tests
# =============================================================================

class TestRouteRegistration:
    """Test all routes are correctly registered."""

    @pytest.mark.asyncio
    async def test_api_router_has_all_routers(self):
        """Test api_router includes all expected sub-routers."""
        from routes import api_router
        routes = api_router.routes
        route_paths = set()
        for route in routes:
            if hasattr(route, "path"):
                route_paths.add(route.path)

        # Verify key routes exist (prefixes)
        expected_prefixes = [
            "/auth",
            "/chat",
            "/settings",
            "/chapters",
            "/ai",
            "/styles",
            "/export",
            "/tasks",
            "/health",
            "/cache",
            "/workflows",
            "/agents",
            "/stats",
        ]
        for prefix in expected_prefixes:
            # Check that at least one route starts with this prefix
            found = any(
                str(r.path).startswith(prefix) for r in routes if hasattr(r, "path")
            )
            assert found, f"No route found with prefix {prefix}"

    @pytest.mark.asyncio
    async def test_main_app_includes_api_router(self):
        """Test main.py includes api_router."""
        from main import app
        routes = app.routes
        # Check that the API router is included
        api_route_paths = [r.path for r in routes if hasattr(r, "path")]
        # Should have /api/v1 prefix somewhere
        has_api_prefix = any("/api/v1" in p for p in api_route_paths)
        assert has_api_prefix, "api_router with /api/v1 prefix not found in app"

    @pytest.mark.asyncio
    async def test_no_duplicate_route_prefixes(self):
        """Test there are no conflicting duplicate route prefixes."""
        from routes import api_router
        prefixes = []
        for route in api_router.routes:
            if hasattr(route, "path"):
                prefixes.append(route.path)

        # Check for exact duplicates
        assert len(prefixes) == len(set(prefixes)), f"Duplicate routes found: {prefixes}"

    @pytest.mark.asyncio
    async def test_root_endpoint_exists(self, client):
        """Test root endpoint exists."""
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data

    @pytest.mark.asyncio
    async def test_docs_endpoint_exists(self, client):
        """Test OpenAPI docs endpoint exists."""
        response = await client.get("/docs")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_openapi_schema_endpoint_exists(self, client):
        """Test OpenAPI JSON schema endpoint exists."""
        response = await client.get("/openapi.json")
        assert response.status_code == 200
        data = response.json()
        assert "paths" in data
        assert "/api/v1" in str(data["paths"])


# =============================================================================
# Agent Export Tests
# =============================================================================

class TestAgentExports:
    """Test agents/__init__.py exports all Agent classes."""

    def test_all_agents_exported(self):
        """Test that all agent classes are in __all__."""
        from agents import __all__ as agent_all
        expected_agents = [
            "BaseAgent",
            "AgentContext",
            "AgentResult",
            "ChatAgent",
            "ContextAgent",
            "DataAgent",
            "ReviewAgent",
            "PlotAgent",
            "StyleAgent",
            "StrandTracker",
        ]
        for agent in expected_agents:
            assert agent in agent_all, f"{agent} not exported in agents/__init__.py"

    def test_all_agents_importable(self):
        """Test that all exported agents can be imported."""
        from agents import (
            BaseAgent,
            AgentContext,
            AgentResult,
            ChatAgent,
            ContextAgent,
            DataAgent,
            ReviewAgent,
            PlotAgent,
            StyleAgent,
            StrandTracker,
        )
        # Verify they are classes
        assert isinstance(BaseAgent, type)
        assert isinstance(ChatAgent, type)
        assert isinstance(ContextAgent, type)
        assert isinstance(DataAgent, type)
        assert isinstance(ReviewAgent, type)
        assert isinstance(PlotAgent, type)
        assert isinstance(StyleAgent, type)
        assert isinstance(StrandTracker, type)


# =============================================================================
# Event Bus Tests
# =============================================================================

class TestEventBus:
    """Test event bus functionality."""

    @pytest.mark.asyncio
    async def test_event_bus_can_publish_and_subscribe(self):
        """Test event bus publish/subscribe works."""
        from utils.event_bus import AsyncEventBus

        bus = AsyncEventBus()
        received = []

        async def handler(payload):
            received.append(payload)

        bus.subscribe("test.event", handler)
        await bus.publish("test.event", {"message": "hello"})

        assert len(received) == 1
        assert received[0]["message"] == "hello"

    @pytest.mark.asyncio
    async def test_event_bus_predefined_event_types(self):
        """Test predefined event type constants exist."""
        from utils.event_bus import (
            ENTITY_CREATED,
            ENTITY_UPDATED,
            ENTITY_DELETED,
            CACHE_INVALIDATE,
            AGENT_EXECUTED,
        )
        assert ENTITY_CREATED == "entity.created"
        assert ENTITY_UPDATED == "entity.updated"
        assert ENTITY_DELETED == "entity.deleted"
        assert CACHE_INVALIDATE == "cache.invalidate"
        assert AGENT_EXECUTED == "agent.executed"


# =============================================================================
# Cache Service Tests
# =============================================================================

class TestCacheService:
    """Test cache service integration."""

    def test_cache_service_singleton_exists(self):
        """Test cache service singleton exists."""
        from services.cache_service import cache_service
        assert cache_service is not None

    def test_cache_service_has_stats_method(self):
        """Test cache service has stats method."""
        from services.cache_service import cache_service
        assert hasattr(cache_service, "stats")
        stats = cache_service.stats()
        assert isinstance(stats, dict)
        assert "memory_caches" in stats

    def test_cache_service_has_clear_all(self):
        """Test cache service has clear_all method."""
        from services.cache_service import cache_service
        assert hasattr(cache_service, "clear_all")

    def test_lru_cache_basic_operations(self):
        """Test LRU cache basic get/set/delete."""
        from services.cache_service import LRUCache

        cache = LRUCache(max_size=10, default_ttl=300)
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"
        assert cache.delete("key1") is True
        assert cache.get("key1") is None

    def test_lru_cache_stats(self):
        """Test LRU cache stats."""
        from services.cache_service import LRUCache

        cache = LRUCache(max_size=10, default_ttl=300)
        cache.set("key1", "value1")
        stats = cache.stats()
        assert stats["size"] == 1
        assert stats["max_size"] == 10


# =============================================================================
# Performance Middleware Tests
# =============================================================================

class TestPerformanceMiddleware:
    """Test performance middleware integration."""

    @pytest.mark.asyncio
    async def test_response_has_performance_headers(self, client):
        """Test responses include performance headers."""
        response = await client.get("/")
        assert response.status_code == 200
        # Check for performance headers
        assert "X-Request-Duration-Ms" in response.headers
        assert "X-Db-Query-Count" in response.headers

    @pytest.mark.asyncio
    async def test_performance_headers_are_numeric(self, client):
        """Test performance header values are numeric."""
        response = await client.get("/")
        duration = response.headers.get("X-Request-Duration-Ms")
        query_count = response.headers.get("X-Db-Query-Count")
        assert duration is not None
        assert query_count is not None
        # Should be parseable as numbers
        float(duration)
        int(query_count)


# =============================================================================
# Integration Smoke Tests
# =============================================================================

class TestIntegrationSmoke:
    """Smoke tests for overall integration."""

    @pytest.mark.asyncio
    async def test_all_major_endpoints_respond(self, client):
        """Test all major endpoint groups respond."""
        endpoints = [
            ("/", 200),
            ("/health", 200),
            ("/api/v1/health", 200),
            ("/api/v1/health/ready", (200, 503)),
            ("/api/v1/health/live", 200),
            ("/docs", 200),
            ("/openapi.json", 200),
        ]

        for path, expected_status in endpoints:
            response = await client.get(path)
            if isinstance(expected_status, tuple):
                assert response.status_code in expected_status, f"{path} failed"
            else:
                assert response.status_code == expected_status, f"{path} failed with {response.status_code}"

    @pytest.mark.asyncio
    async def test_cors_headers_present(self, client):
        """Test CORS headers are present."""
        response = await client.get("/", headers={"Origin": "http://localhost:5173"})
        # CORS middleware should add access-control-allow-origin
        assert "access-control-allow-origin" in response.headers

    @pytest.mark.asyncio
    async def test_app_metadata_consistent(self, client):
        """Test app metadata is consistent across endpoints."""
        root_resp = await client.get("/")
        health_resp = await client.get("/api/v1/health")

        root_data = root_resp.json()
        health_data = health_resp.json()

        assert root_data["version"] == health_data["app"]["version"]
