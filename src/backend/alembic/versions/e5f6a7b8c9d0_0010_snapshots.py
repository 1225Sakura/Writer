"""0010_snapshots — create snapshot + snapshot_tags tables."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.String(length=64),
            nullable=False,
            server_default="default-user",
        ),
        sa.Column(
            "chapter_id",
            sa.Integer(),
            sa.ForeignKey("chapters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=True),
        sa.Column(
            "parent_snapshot_id",
            sa.Integer(),
            sa.ForeignKey("snapshots.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("word_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.Column("meta", sa.JSON(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_snapshots_user_id", "snapshots", ["user_id"])
    op.create_index("ix_snapshots_chapter_id", "snapshots", ["chapter_id"])
    op.create_index("ix_snapshots_fingerprint", "snapshots", ["fingerprint"])

    op.create_table(
        "snapshot_tags",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "snapshot_id",
            sa.Integer(),
            sa.ForeignKey("snapshots.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tag", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("snapshot_id", "tag", name="uq_snapshot_tag"),
    )
    op.create_index("ix_snapshot_tags_snapshot_id", "snapshot_tags", ["snapshot_id"])


def downgrade() -> None:
    op.drop_table("snapshot_tags")
    op.drop_index("ix_snapshots_fingerprint", table_name="snapshots")
    op.drop_index("ix_snapshots_chapter_id", table_name="snapshots")
    op.drop_index("ix_snapshots_user_id", table_name="snapshots")
    op.drop_table("snapshots")
