"""0004_chapter_rich_fields

Phase 0 commit 13 (US-013): add rich fields to the chapters table —
sections (JSON list), pacing_notes, character_dynamics, foreshadowing
(all Text). Used by US-019 (polish) and later outline work; nullable so
existing rows survive without backfill.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "533e9c5d9e10"
down_revision: Union[str, Sequence[str], None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add sections / pacing_notes / character_dynamics / foreshadowing to chapters."""
    with op.batch_alter_table("chapters") as batch:
        batch.add_column(sa.Column("sections", sa.JSON(), nullable=True))
        batch.add_column(sa.Column("pacing_notes", sa.Text(), nullable=True))
        batch.add_column(sa.Column("character_dynamics", sa.Text(), nullable=True))
        batch.add_column(sa.Column("foreshadowing", sa.Text(), nullable=True))


def downgrade() -> None:
    """Drop the four rich-field columns from chapters."""
    with op.batch_alter_table("chapters") as batch:
        batch.drop_column("foreshadowing")
        batch.drop_column("character_dynamics")
        batch.drop_column("pacing_notes")
        batch.drop_column("sections")