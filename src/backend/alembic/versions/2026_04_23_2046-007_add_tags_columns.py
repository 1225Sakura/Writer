"""007_add_tags_columns

Revision ID: 007_add_tags
Revises: 006_add_constraints
Create Date: 2026-04-23 20:46:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '007_add_tags'
down_revision: Union[str, Sequence[str], None] = '006_add_constraints'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Tables that need a tags column added (JSON-encoded list of tag strings)
TABLES_WITH_TAGS = [
    'items',
    'locations',
    'factions',
    'world_settings',
    'rules',
]


def upgrade() -> None:
    """Add tags column to entity tables."""
    for table in TABLES_WITH_TAGS:
        op.add_column(table, sa.Column('tags', sa.Text(), nullable=True))


def downgrade() -> None:
    """Remove tags column from entity tables."""
    for table in TABLES_WITH_TAGS:
        op.drop_column(table, 'tags')
