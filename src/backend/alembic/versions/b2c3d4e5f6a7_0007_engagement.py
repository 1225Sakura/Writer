"""0007_engagement — create engagement scoring tables."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "engagement_scores",
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
        sa.Column("hook_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("engagement_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("predicted_retention", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("overall_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("grade", sa.String(length=8), nullable=False, server_default="N/A"),
        sa.Column("factors", sa.JSON(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_engagement_scores_chapter_id", "engagement_scores", ["chapter_id"])

    op.create_table(
        "cool_points",
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
        sa.Column("point_type", sa.String(length=50), nullable=False, server_default="reveal"),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("intensity", sa.Float(), nullable=False, server_default="0.5"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("context", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_cool_points_chapter_id", "cool_points", ["chapter_id"])

    op.create_table(
        "fulfillments",
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
        sa.Column("size", sa.String(length=20), nullable=False, server_default="medium"),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("context", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_fulfillments_chapter_id", "fulfillments", ["chapter_id"])


def downgrade() -> None:
    op.drop_index("ix_fulfillments_chapter_id", table_name="fulfillments")
    op.drop_table("fulfillments")
    op.drop_index("ix_cool_points_chapter_id", table_name="cool_points")
    op.drop_table("cool_points")
    op.drop_index("ix_engagement_scores_chapter_id", table_name="engagement_scores")
    op.drop_table("engagement_scores")
