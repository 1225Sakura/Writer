"""Tests for health check endpoints."""

import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health_check_basic(client):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "timestamp" in data
    assert "app" in data
    assert "checks" in data


@pytest.mark.asyncio
async def test_health_check_has_database_check(client):
    response = await client.get("/api/v1/health")
    data = response.json()
    assert "database" in data["checks"]
    db_check = data["checks"]["database"]
    assert "status" in db_check


@pytest.mark.asyncio
async def test_health_check_has_ai_service_check(client):
    response = await client.get("/api/v1/health")
    data = response.json()
    assert "ai_service" in data["checks"]


@pytest.mark.asyncio
async def test_health_check_has_disk_space_check(client):
    response = await client.get("/api/v1/health")
    data = response.json()
    assert "disk_space" in data["checks"]
    disk_check = data["checks"]["disk_space"]
    assert "status" in disk_check
    assert "free_gb" in disk_check
    assert "total_gb" in disk_check
    assert "used_percent" in disk_check


@pytest.mark.asyncio
async def test_health_check_has_dependencies_check(client):
    response = await client.get("/api/v1/health")
    data = response.json()
    assert "dependencies" in data["checks"]
    deps = data["checks"]["dependencies"]
    assert "FastAPI" in deps


@pytest.mark.asyncio
async def test_health_check_has_system_info(client):
    response = await client.get("/api/v1/health")
    data = response.json()
    assert "system" in data
    assert "python_version" in data["system"]
    assert "platform" in data["system"]


@pytest.mark.asyncio
async def test_health_check_has_app_info(client):
    response = await client.get("/api/v1/health")
    data = response.json()
    assert data["app"]["name"] == "Writer API"
    assert "version" in data["app"]


@pytest.mark.asyncio
async def test_readiness_check(client):
    response = await client.get("/api/v1/health/ready")
    assert response.status_code in (200, 503)
    data = response.json()
    assert "status" in data


@pytest.mark.asyncio
async def test_liveness_check(client):
    response = await client.get("/api/v1/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "alive"


@pytest.mark.asyncio
async def test_legacy_health_check(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
