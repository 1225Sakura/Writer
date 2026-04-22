"""add_missing_tables_projects_genre_workflow_agent_background_tasks

Revision ID: 22d0ce106c9a
Revises: 7e3ddba82dcb
Create Date: 2026-04-22 11:17:15.833026

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '22d0ce106c9a'
down_revision: Union[str, Sequence[str], None] = '7e3ddba82dcb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add missing project_id FKs and content_storage_id columns.

    The database already has all core tables from the initial schema.
    This migration adds:
      - project_id (nullable FK to projects) on entity tables
      - content_storage_id on chapters and draft_versions
    """
    # Tables that need project_id added
    tables_needing_project_id = [
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

    for table in tables_needing_project_id:
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.add_column(sa.Column('project_id', sa.Integer(), nullable=True))
            batch_op.create_index(
                batch_op.f(f'ix_{table}_project_id'),
                ['project_id'],
                unique=False
            )
            batch_op.create_foreign_key(
                batch_op.f(f'fk_{table}_project_id_projects'),
                'projects',
                ['project_id'],
                ['id']
            )

    # Add content_storage_id columns
    with op.batch_alter_table('chapters', schema=None) as batch_op:
        batch_op.add_column(sa.Column('content_storage_id', sa.String(length=64), nullable=True))

    with op.batch_alter_table('draft_versions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('content_storage_id', sa.String(length=64), nullable=True))

    # Drop old schema_migrations table (replaced by Alembic)
    op.drop_table('schema_migrations')


def downgrade() -> None:
    """Reverse the migration."""
    # Recreate schema_migrations
    op.create_table(
        'schema_migrations',
        sa.Column('id', sa.INTEGER(), nullable=True),
        sa.Column('version', sa.INTEGER(), nullable=False),
        sa.Column('name', sa.TEXT(), nullable=False),
        sa.Column('applied_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('version')
    )

    # Drop content_storage_id
    with op.batch_alter_table('draft_versions', schema=None) as batch_op:
        batch_op.drop_column('content_storage_id')

    with op.batch_alter_table('chapters', schema=None) as batch_op:
        batch_op.drop_column('content_storage_id')

    # Drop project_id from all tables (reverse order)
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
            batch_op.drop_index(batch_op.f(f'ix_{table}_project_id'))
            batch_op.drop_column('project_id')
