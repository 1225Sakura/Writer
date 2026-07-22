"""Pytest fixtures: in-memory SQLite engine, db_session, TestClient.

v0.5 Blocker A: P0-Sec1a added `verify_api_key` dependency to all routers, causing
73 tests to 503 AUTH_NOT_INITIALIZED.

Strategy (方案 A-improved — module-level override):
- This conftest is loaded BEFORE any test module imports its app.routers.* code.
- We monkey-patch `app.core.security.verify_api_key` to a no-op accept-all BEFORE
  any router import. All `Depends(verify_api_key)` in routers then capture our
  patched reference, so EVERY request passes auth without needing X-API-Key.
- The original `verify_api_key` is preserved as `_original_verify_api_key` for
  tests that want to verify auth-specific behavior.
- We also set WRITER_API_KEY env var for tests that re-read settings directly.

Why not 方案 B (env-based):
  verify_api_key also requires `api_key_header` (X-API-Key header) to be present
  AND match `settings.api_key`. Tests don't send X-API-Key, so even with a valid
  key in settings, requests get 401.

Why not just `app.dependency_overrides`:
  Multiple test files have LOCAL fixtures that call `app.dependency_overrides.clear()`
  after their test (e.g., test_settings_entities.entities_client). Clearing wipes
  our override. Module-level monkey-patch survives fixture clearing.
"""
import os
import pytest

# Fixed test API key (in case any test reads it directly).
TEST_API_KEY = "test-api-key-do-not-use-in-prod"


# ---------------------------------------------------------------------------
# Module-level patch — MUST run before any router import.
# pytest loads conftest.py before collecting test modules, so this runs early.
# ---------------------------------------------------------------------------

def _patch_verify_api_key():
    """Replace `app.core.security.verify_api_key` with a no-op accept-all.

    Routers import verify_api_key via `from app.core.security import verify_api_key`
    and reference it via `Depends(verify_api_key)`. FastAPI captures the function
    reference at route-registration time. Patching the module attribute is NOT
    enough — we must patch BEFORE routers register.

    Since conftest.py is loaded before any test module's import statements execute,
    and routers are only imported (and registered) when test modules import them,
    this patch is effective for all subsequently-imported routers.
    """
    from app.core import security

    # Save original for tests that want to verify auth-specific behavior.
    security._original_verify_api_key = security.verify_api_key

    async def _accept_all_verify_api_key(api_key=None):
        """No-op auth: accept any request (or no request). Returns a stable key."""
        return TEST_API_KEY

    security.verify_api_key = _accept_all_verify_api_key


# Run patch immediately on conftest import (before any test module is collected).
_patch_verify_api_key()


@pytest.fixture(autouse=True, scope="session")
def _set_test_env():
    """Set env vars for tests that bypass our patch and read settings directly."""
    os.environ["WRITER_API_KEY"] = TEST_API_KEY
    yield


@pytest.fixture
def engine():
    from sqlalchemy import create_engine
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    # NOTE: PRAGMA journal_mode=WAL is a no-op on :memory:; parity validated by manual_smoke.sh
    from app.models import Base
    Base.metadata.create_all(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture
def db_session(engine):
    from sqlalchemy.orm import sessionmaker
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def client(db_session):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.database import get_db

    def _get_db_override():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = _get_db_override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
