"""0002_user_id_baseline

Revision ID: 058908879dd8
Revises: db1188343db9
Create Date: 2026-07-18 16:57:54.359462

The first baseline revision already owns user_id on projects, ai_providers,
and writing_settings. This revision completes the v3 baseline on the remaining
six core tables.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "058908879dd8"
down_revision: Union[str, Sequence[str], None] = "db1188343db9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_TABLES = ("outlines", "chapters", "characters", "items", "locations", "drafts")


def upgrade() -> None:
    """Add and backfill user ownership on the remaining core tables."""
    for table_name in _TABLES:
        op.add_column(
            table_name,
            sa.Column(
                "user_id",
                sa.String(length=64),
                nullable=False,
                server_default="default-user",
            ),
        )


def downgrade() -> None:
    """Remove user ownership from the remaining core tables."""
    for table_name in reversed(_TABLES):
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.drop_column("user_id")
