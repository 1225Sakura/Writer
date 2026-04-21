# Auto Novel Writer - Database Configuration
# Python 3.11+
#
# Connection Pool Settings:
#   pool_size: 5 - Base number of persistent connections maintained
#   max_overflow: 10 - Additional connections allowed under load (total max: 15)
#   pool_recycle: 3600 - Recycle connections after 1 hour to prevent stale connections
#   pool_pre_ping: True - Validate connections before use to handle MySQL "server gone away"
#   pool_timeout: 30 - Seconds to wait for a connection from pool
#
# For desktop app with moderate concurrency, these settings balance resource usage
# with connection availability. Adjust pool_size higher (10-20) for multi-user scenarios.

import os

from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool

from config import settings

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

# Base class for models
Base = declarative_base()


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
