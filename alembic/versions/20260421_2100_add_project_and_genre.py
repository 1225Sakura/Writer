"""add_project_and_genre

Add Project and GenreConfiguration tables, and add project_id
foreign key to all existing entity tables for multi-project support.

Revision ID: add_project_and_genre
Revises: add_performance_indexes
Create Date: 2026-04-21 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_project_and_genre'
down_revision: Union[str, Sequence[str], None] = 'add_performance_indexes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create project tables and add project_id to existing tables."""
    # Create projects table
    op.create_table(
        'projects',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('genre', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create genre_configurations table
    op.create_table(
        'genre_configurations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('genre', sa.String(length=100), nullable=False),
        sa.Column('config_json', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('genre')
    )

    # Add project_id to all existing entity tables
    tables_with_project_id = [
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

    for table in tables_with_project_id:
        op.add_column(
            table,
            sa.Column('project_id', sa.Integer(), nullable=True)
        )
        op.create_index(
            f'idx_{table}_project_id',
            table,
            ['project_id']
        )
        op.create_foreign_key(
            f'fk_{table}_project_id',
            table,
            'projects',
            ['project_id'],
            ['id']
        )


def downgrade() -> None:
    """Remove project_id columns and drop project tables."""
    tables_with_project_id = [
        'writing_settings',
        'ai_inspection_results',
        'plot_threads',
        'draft_versions',
        'extracted_entities',
        'chat_messages',
        'chat_sessions',
        'if_lines',
        'chapters',
        'outlines',
        'rules',
        'world_settings',
        'factions',
        'locations',
        'items',
        'character_storylines',
        'character_relationships',
        'characters',
    ]

    for table in tables_with_project_id:
        op.drop_constraint(f'fk_{table}_project_id', table, type_='foreignkey')
        op.drop_index(f'idx_{table}_project_id', table_name=table)
        op.drop_column(table, 'project_id')

    op.drop_table('genre_configurations')
    op.drop_table('projects')
