# Auto Novel Writer - Database Engine & Session (Infrastructure Layer)
# Moved from database.py to follow DDD infrastructure pattern.

import os

from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool

from backend.config import settings

# Determine if running in production (adjust pool based on environment)
is_production = os.getenv("ENVIRONMENT", "development") == "production"

# Create async engine with optimized connection pool settings
if is_production:
    engine = create_async_engine(
        settings.database_url,
        echo=False,
        future=True,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_timeout=30,
        pool_size=5,
        max_overflow=10,
    )
else:
    engine = create_async_engine(
        settings.database_url,
        echo=False,
        future=True,
        poolclass=NullPool,
    )


# ---------------------------------------------------------------------------
# WAL mode — enables better concurrency for SQLite desktop apps
# ---------------------------------------------------------------------------
@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_wal(dbapi_connection, connection_record):  # noqa: ARG001
    """Enable WAL journal mode on every new SQLite connection."""
    # aiosqlite wraps the raw sqlite3 connection; we need the real one.
    raw = getattr(dbapi_connection, "driver_connection", dbapi_connection)
    # For aiosqlite the driver_connection is an aiosqlite Connection whose
    # ._conn attribute is the actual sqlite3.Connection.
    sqlite_conn = getattr(raw, "_conn", raw)
    try:
        sqlite_conn.execute("PRAGMA journal_mode=WAL")
    except Exception:
        # Best-effort: WAL may not be available on all filesystems
        pass


# Create async session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base class for models — singleton so re-imports under different names
# (e.g. 'database' vs 'backend.database') share the same metadata.
# CRITICAL: This singleton hack MUST be preserved. Without it, SQLAlchemy
# creates duplicate metadata registries when the same module is imported
# under different names.
import sys as _sys

if "_writer_base_singleton" in _sys.modules:
    Base = _sys.modules["_writer_base_singleton"].Base
else:
    Base = declarative_base()
    _mod = type(_sys)("_writer_base_singleton")
    _mod.Base = Base
    _sys.modules["_writer_base_singleton"] = _mod


async def get_db() -> AsyncSession:
    """Dependency for getting async database sessions."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
