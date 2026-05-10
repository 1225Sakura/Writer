# Infrastructure - Alembic Configuration Helper
# Wires Alembic to use infrastructure.database for DB URL and metadata.

from backend.config import settings
from backend.infrastructure.database import Base


def get_database_url() -> str:
    """Get database URL from application config."""
    return settings.database_url


def get_target_metadata():
    """Get SQLAlchemy metadata for autogenerate support."""
    return Base.metadata
