"""013_add_battle_station_data

Revision ID: 013_battle_station_data
Revises: 012_ai_review_history
Create Date: 2026-05-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '013_battle_station_data'
down_revision: Union[str, Sequence[str], None] = '012_ai_review_history'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add battle_station_data column to chapters table."""
    op.add_column('chapters', sa.Column('battle_station_data', sa.Text(), nullable=True))


def downgrade() -> None:
    """Remove battle_station_data column from chapters table."""
    op.drop_column('chapters', 'battle_station_data')
