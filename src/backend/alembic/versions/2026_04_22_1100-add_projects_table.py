"""add_projects_table

Revision ID: add_projects_table
Revises: 7e3ddba82dcb
Create Date: 2026-04-22 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_projects_table'
down_revision: Union[str, Sequence[str], None] = '7e3ddba82dcb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create projects table.

    This table is referenced by project_id foreign keys in all entity tables.
    It must exist before any migration that adds project_id FKs (22d0ce106c9a
    and later) can run successfully.
    """
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
    op.create_index('ix_projects_name', 'projects', ['name'], unique=False)
    op.create_index('ix_projects_genre', 'projects', ['genre'], unique=False)


def downgrade() -> None:
    """Drop projects table."""
    op.drop_index('ix_projects_genre', table_name='projects')
    op.drop_index('ix_projects_name', table_name='projects')
    op.drop_table('projects')
