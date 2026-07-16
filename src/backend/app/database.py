"""Database engine, session, and declarative base.

Decision Matrix (2026-07-14):
- aiosqlite vs sqlite3: sqlite3 (sync) wins for local desktop app (WAL mode, simpler, no async pool bugs)
- SQLAlchemy 2.0 mapped_column vs Column: mapped_column (type-safe, 2026 standard)
- sessionmaker autocommit=False: required for explicit transaction control
"""
from __future__ import annotations

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from contextlib import contextmanager

from app.config import get_settings

settings = get_settings()

# Ensure data directory exists
settings.data_dir.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},  # SQLite multithread for FastAPI thread pool
    echo=settings.debug,
)

# Enable WAL mode + foreign keys on every connection
@event.listens_for(engine, "connect")
def _on_connect(dbapi_conn, _):
    dbapi_conn.execute("PRAGMA journal_mode=WAL")
    dbapi_conn.execute("PRAGMA foreign_keys=ON")
    dbapi_conn.execute("PRAGMA synchronous=NORMAL")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


@contextmanager
def get_db_session() -> Session:
    """Database session context manager with automatic commit/rollback."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_db() -> Session:
    """FastAPI dependency — yields a session per request."""
    with get_db_session() as db:
        yield db
