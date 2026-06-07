"""Alembic environment configuration for async SQLAlchemy."""

import asyncio
import sys
from pathlib import Path
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# Add backend directory and its parent to path so imports work
backend_dir = Path(__file__).parent.parent
parent_dir = backend_dir.parent
sys.path.insert(0, str(backend_dir))
sys.path.insert(0, str(parent_dir))

from backend.infrastructure.database import Base
from backend.core.domain.entities import (
    Project,
    GenreConfiguration,
    BackgroundTask,
    Character,
    CharacterRelationship,
    CharacterStoryline,
    Item,
    Location,
    Faction,
    WorldSetting,
    Rule,
    Outline,
    Chapter,
    IFLine,
    DraftVersion,
    PlotThread,
    Snapshot,
    ChatSession,
    ChatMessage,
    ExtractedEntity,
    AIReviewHistory,
    WritingSettings,
    AIInspectionResult,
    WorkflowExecution,
    AgentExecutionLog,
)
from backend.core.domain.extensions import (
    WikiPage,
    WikiVersion,
    WikiEntityLink,
)

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here for 'autogenerate' support
target_metadata = Base.metadata

# Import settings to get the real database URL
from backend.config import settings


def get_database_url() -> str:
    """Get database URL from application config."""
    return settings.database_url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.
    """
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Run migrations with the given connection."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in async mode."""
    url = get_database_url()
    connectable = create_async_engine(url, poolclass=pool.NullPool)

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
