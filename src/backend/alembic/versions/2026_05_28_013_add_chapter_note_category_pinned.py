"""013_add_chapter_note_category_pinned

Revision ID: 013_chapter_note_meta
Revises: 012_ai_review_history
Create Date: 2026-05-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '013_chapter_note_meta'
down_revision: Union[str, Sequence[str], None] = '013_battle_station_data'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add note_category and note_pinned columns to chapters table."""
    with op.batch_alter_table('chapters', schema=None) as batch_op:
        batch_op.add_column(sa.Column('note_category', sa.String(50), nullable=True, server_default='note'))
        batch_op.add_column(sa.Column('note_pinned', sa.Boolean(), nullable=False, server_default=sa.text('0')))


def downgrade() -> None:
    """Remove note_category and note_pinned columns from chapters table."""
    with op.batch_alter_table('chapters', schema=None) as batch_op:
        batch_op.drop_column('note_pinned')
        batch_op.drop_column('note_category')
