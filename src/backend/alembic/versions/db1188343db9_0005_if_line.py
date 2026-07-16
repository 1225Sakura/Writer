"""0005_if_line — create alternate story timeline storage."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "db1188343db9"
down_revision: Union[str, Sequence[str], None] = "533e9c5d9e10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the if_lines table and project/tree lookup indexes."""
    op.create_table(
        "if_lines",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.String(length=64),
            nullable=False,
            server_default="default-user",
        ),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "parent_line_id",
            sa.Integer(),
            sa.ForeignKey("if_lines.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "fork_chapter_id",
            sa.Integer(),
            sa.ForeignKey("chapters.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("content", sa.JSON(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_if_lines_user_id", "if_lines", ["user_id"])
    op.create_index("ix_if_lines_project_id", "if_lines", ["project_id"])
    op.create_index(
        "ix_if_lines_parent_line_id", "if_lines", ["parent_line_id"]
    )


def downgrade() -> None:
    """Drop alternate story timeline storage."""
    op.drop_index("ix_if_lines_parent_line_id", table_name="if_lines")
    op.drop_index("ix_if_lines_project_id", table_name="if_lines")
    op.drop_index("ix_if_lines_user_id", table_name="if_lines")
    op.drop_table("if_lines")
