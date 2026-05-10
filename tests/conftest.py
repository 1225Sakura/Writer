"""
Pytest configuration and shared fixtures for the Auto Novel Writer test suite.

Provides:
- Database engine/session fixtures (async SQLite in-memory)
- HTTP client fixture (httpx AsyncClient + FastAPI app)
- Authentication fixture
- AI service mock fixture
- Event loop fixture
"""

import asyncio
import os
import sys
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import sessionmaker

# Ensure src/backend is importable as 'backend' package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src", "backend"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

# Pre-import database and entities to prevent SQLAlchemy "Table already defined"
# errors when backend code imports both `database` and `backend.database`.
import backend.infrastructure.database as _database_module
import core.domain.entities as _entities_module

sys.modules["backend.database"] = _database_module
sys.modules["database"] = _database_module
sys.modules["backend.models.entities"] = _entities_module
sys.modules["backend.core.domain.entities"] = _entities_module

import core.domain.extensions as _extensions_module
sys.modules["backend.core.domain.extensions"] = _extensions_module

# ---------------------------------------------------------------------------
# Database fixtures
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def db_engine():
    """Create a shared async engine pointing to an in-memory SQLite database."""
    from backend.infrastructure.database import Base

    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        future=True,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """
    Provide an async database session for a single test.

    Each test runs inside a transaction that is rolled back on teardown,
    ensuring test isolation.
    """
    async with db_engine.connect() as connection:
        trans = await connection.begin()
        session_factory = async_sessionmaker(
            bind=connection,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        async with session_factory() as session:
            yield session
        await trans.rollback()


# ---------------------------------------------------------------------------
# HTTP client fixture
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def client(db_session) -> AsyncGenerator[AsyncClient, None]:
    """
    Provide an httpx AsyncClient wired to the FastAPI app.

    Database dependency is overridden to use the test session.
    """
    from backend.database import get_db
    from backend.main import app

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Authentication fixture
# ---------------------------------------------------------------------------


@pytest.fixture
def auth_headers() -> dict:
    """Return headers with a test API key for authenticated endpoints."""
    return {"X-API-Key": "test-api-key-12345"}


@pytest.fixture
def mock_auth():
    """Patch authentication to always succeed in tests."""
    with patch("backend.middleware.auth.verify_api_key", return_value=True):
        with patch("backend.config.settings.auth_skip_localhost", True):
            yield


# ---------------------------------------------------------------------------
# AI service mock fixture
# ---------------------------------------------------------------------------


@pytest.fixture
def ai_mock():
    """
    Provide a mocked AIService.generate method.

    Usage::

        async def test_something(ai_mock):
            ai_mock.return_value = "Generated text"
            result = await some_function_that_calls_ai()
            assert result == "Generated text"
    """
    from backend.core.services.ai.ai_service import AIService

    with patch.object(AIService, "generate", new_callable=AsyncMock) as mock_generate:
        mock_generate.return_value = "这是一段测试生成的文本内容。"
        yield mock_generate


@pytest.fixture
def ai_stream_mock():
    """Provide a mocked AIService.generate_stream async iterator."""
    from backend.core.services.ai.ai_service import AIService

    async def _fake_stream(*args, **kwargs):
        chunks = ["这是", "一段", "测试", "流式", "输出。"]
        for chunk in chunks:
            yield chunk

    with patch.object(AIService, "generate_stream", side_effect=_fake_stream):
        yield


# ---------------------------------------------------------------------------
# Cache service mock fixture
# ---------------------------------------------------------------------------


@pytest.fixture
def cache_mock():
    """Mock the cache service to avoid disk I/O in tests."""
    from backend.services import cache_service

    with patch.object(cache_service, "get_cached_ai_result", return_value=None):
        with patch.object(cache_service, "set_cached_ai_result", new_callable=AsyncMock):
            yield
