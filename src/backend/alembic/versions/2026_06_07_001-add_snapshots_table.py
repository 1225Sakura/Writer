"""add snapshots table

Revision ID: a1b2c3d4e5f6
Revises: 013_sprint_data, 013_chapter_note_meta
Create Date: 2026-06-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = ("013_sprint_data", "013_chapter_note_meta")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the snapshots table."""
    op.create_table(
        "snapshots",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("chapter_id", sa.Integer(), sa.ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("is_marked", sa.Boolean(), nullable=True, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_snapshots_chapter_id", "snapshots", ["chapter_id"])
    op.create_index("ix_snapshots_chapter_created", "snapshots", ["chapter_id", "created_at"])


def downgrade() -> None:
    """Drop the snapshots table."""
    op.drop_index("ix_snapshots_chapter_created", table_name="snapshots")
    op.drop_index("ix_snapshots_chapter_id", table_name="snapshots")
    op.drop_table("snapshots")
