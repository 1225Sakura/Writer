"""013_add_sprint_data_to_writing_settings

Revision ID: 013_sprint_data
Revises: 012_ai_review_history
Create Date: 2026-05-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '013_sprint_data'
down_revision: Union[str, Sequence[str], None] = '012_ai_review_history'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add sprint_data_json column to writing_settings table."""
    op.add_column('writing_settings', sa.Column('sprint_data_json', sa.Text(), nullable=True))


def downgrade() -> None:
    """Remove sprint_data_json column from writing_settings table."""
    op.drop_column('writing_settings', 'sprint_data_json')
