"""Shared pytest fixtures for backend tests."""

import pytest
import pytest_asyncio
import tempfile
import os
import sys

# Add src directory to path so 'backend' can be imported as a package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

# Set up environment for tests
os.environ.setdefault("MINIMAX_API_KEY", "test-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("API_KEY", "test_api_key_for_tests")

# Use the same import style as existing tests
from backend.infrastructure.database import Base, get_db
from backend.interface.web.main import app
from backend.middleware.auth import set_api_key, clear_api_key_cache


# =============================================================================
# Database Fixtures
# =============================================================================

@pytest_asyncio.fixture
async def async_engine():
    """Create a fresh async engine for each test session."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        future=True,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(async_engine):
    """Create a fresh database session for each test."""
    async_session = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session):
    """Create async test client with overridden DB dependency."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def authenticated_client(client):
    """Create authenticated test client."""
    clear_api_key_cache()
    set_api_key("test_api_key_for_tests")

    # Add API key header to all requests
    original_request = client.request

    async def auth_request(method, url, **kwargs):
        headers = kwargs.pop("headers", {}) or {}
        headers["X-API-Key"] = "test_api_key_for_tests"
        kwargs["headers"] = headers
        return await original_request(method, url, **kwargs)

    client.request = auth_request
    yield client
    clear_api_key_cache()


# =============================================================================
# Cache Fixture
# =============================================================================

@pytest.fixture(autouse=True)
def clear_cache():
    """Clear all caches before each test."""
    cache_service.clear_all()
    yield
    cache_service.clear_all()


# =============================================================================
# Auth Fixtures
# =============================================================================

@pytest.fixture(autouse=True)
def reset_auth():
    """Reset auth cache before each test."""
    clear_api_key_cache()
    yield
    clear_api_key_cache()


# =============================================================================
# Temporary Directory Fixture
# =============================================================================

@pytest.fixture
def temp_dir():
    """Create a temporary directory for test files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir
