"""add_missing_tables_projects_genre_workflow_agent_background_tasks

Revision ID: 22d0ce106c9a
Revises: add_projects_table
Create Date: 2026-04-22 11:17:15.833026

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '22d0ce106c9a'
down_revision: Union[str, Sequence[str], None] = 'add_projects_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add missing project_id FKs and content_storage_id columns.

    The database already has all core tables from the initial schema.
    This migration adds:
      - project_id (nullable FK to projects) on entity tables
      - content_storage_id on chapters and draft_versions

    Note: SQLite requires batch_alter_table for adding constraints
    (FK, unique), but plain op.add_column works for simple column adds.
    We split operations to avoid conflicts.
    """
    # Tables that need project_id added
    tables_needing_project_id = [
        'characters',
        'character_relationships',
        'character_storylines',
        'items',
        'locations',
        'factions',
        'world_settings',
        'rules',
        'outlines',
        'chapters',
        'if_lines',
        'chat_sessions',
        'chat_messages',
        'extracted_entities',
        'draft_versions',
        'plot_threads',
        'ai_inspection_results',
        'writing_settings',
    ]

    # Step 1: Add project_id columns (plain op.add_column is reliable in SQLite)
    for table in tables_needing_project_id:
        op.add_column(table, sa.Column('project_id', sa.Integer(), nullable=True))

    # Step 2: Add indexes on project_id
    for table in tables_needing_project_id:
        op.create_index(
            f'ix_{table}_project_id',
            table,
            ['project_id'],
            unique=False
        )

    # Step 3: Add FKs using batch_alter_table (required for FK constraints)
    tables_for_fk = [
        'character_relationships',
        'character_storylines',
        'items',
        'locations',
        'factions',
        'world_settings',
        'rules',
        'outlines',
        'chapters',
        'if_lines',
        'chat_sessions',
        'chat_messages',
        'extracted_entities',
        'draft_versions',
        'plot_threads',
        'ai_inspection_results',
        'writing_settings',
    ]

    for table in tables_for_fk:
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.create_foreign_key(
                batch_op.f(f'fk_{table}_project_id_projects'),
                'projects',
                ['project_id'],
                ['id']
            )

    # Step 4: Add content_storage_id columns
    with op.batch_alter_table('chapters', schema=None) as batch_op:
        batch_op.add_column(sa.Column('content_storage_id', sa.String(length=64), nullable=True))

    with op.batch_alter_table('draft_versions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('content_storage_id', sa.String(length=64), nullable=True))


def downgrade() -> None:
    """Reverse the migration."""
    # Drop content_storage_id
    with op.batch_alter_table('draft_versions', schema=None) as batch_op:
        batch_op.drop_column('content_storage_id')

    with op.batch_alter_table('chapters', schema=None) as batch_op:
        batch_op.drop_column('content_storage_id')

    # Drop project_id FKs
    tables = [
        'writing_settings', 'ai_inspection_results', 'plot_threads',
        'draft_versions', 'extracted_entities', 'chat_messages',
        'chat_sessions', 'if_lines', 'chapters', 'outlines',
        'rules', 'world_settings', 'factions', 'locations',
        'items', 'character_storylines', 'character_relationships',
    ]
    for table in tables:
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.drop_constraint(batch_op.f(f'fk_{table}_project_id_projects'), type_='foreignkey')

    # Drop indexes
    for table in tables:
        op.drop_index(f'ix_{table}_project_id', table_name=table)

    # Drop project_id columns
    for table in tables:
        op.drop_column(table, 'project_id')
