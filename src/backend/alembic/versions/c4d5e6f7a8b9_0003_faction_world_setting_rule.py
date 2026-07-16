"""0003_faction_world_setting_rule

Phase 0 commit 5 (US-005): setting entity persistence for factions,
world settings, and rules.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, Sequence[str], None] = "b3e4f5a6c7d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DEFAULT_USER_ID = "default-user"


def _create_setting_table(
    table_name: str,
    discriminator_name: str,
    discriminator_length: int,
    *,
    include_tags: bool = False,
) -> None:
    columns = [
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.String(length=64),
            nullable=False,
            server_default=sa.text(f"'{DEFAULT_USER_ID}'"),
        ),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(discriminator_name, sa.String(length=discriminator_length), nullable=True),
    ]
    if include_tags:
        columns.append(sa.Column("tags", sa.Text(), nullable=True))
    columns.extend(
        [
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
            ),
        ]
    )
    op.create_table(table_name, *columns)
    op.create_index(f"ix_{table_name}_user_id", table_name, ["user_id"])
    op.create_index(f"ix_{table_name}_project_id", table_name, ["project_id"])


def upgrade() -> None:
    """Create faction, world-setting, and rule tables."""
    _create_setting_table("factions", "type", 50, include_tags=True)
    _create_setting_table("world_settings", "category", 50)
    _create_setting_table("rules", "rule_type", 50)


def downgrade() -> None:
    """Drop setting entity tables and their indexes."""
    for table_name in ("rules", "world_settings", "factions"):
        op.drop_index(f"ix_{table_name}_project_id", table_name=table_name)
        op.drop_index(f"ix_{table_name}_user_id", table_name=table_name)
        op.drop_table(table_name)
