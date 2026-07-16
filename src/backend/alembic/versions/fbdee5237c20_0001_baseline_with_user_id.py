"""0001_baseline_with_user_id

Combines US-001 (Alembic init + replace Base.metadata.create_all) with US-002
(user_id baseline on Project/AIProvider/WritingSettings) into a single baseline
migration so we do not need two separate revises for what is logically one
"first schema" step.

Spec reference: deep-interview-backend-rebuild-for-completion.md
Plan reference: ralplan-e2e-full-flow-v3.md line 142-156 (Phase 0 commit 1+2)

Revision ID: fbdee5237c20
Revises:
Create Date: 2026-07-16 20:52:05.164648
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "fbdee5237c20"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# user_id default — Phase 0 has no auth; everything is owned by this single user.
DEFAULT_USER_ID = "default-user"


def upgrade() -> None:
    """Create all 11 tables, embedding user_id on Project/AIProvider/WritingSettings."""

    # 1. projects — root entity; includes user_id (US-002)
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=255), nullable=False, server_default="我的小说"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("genre", sa.String(length=100), nullable=True),
        sa.Column(
            "user_id",
            sa.String(length=64),
            nullable=False,
            server_default=sa.text(f"'{DEFAULT_USER_ID}'"),
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_projects_user_id", "projects", ["user_id"])

    # 2. ai_providers — includes user_id (US-002)
    op.create_table(
        "ai_providers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("api_key_encrypted", sa.Text(), nullable=True),
        sa.Column("base_url", sa.Text(), nullable=True),
        sa.Column("model_name", sa.String(length=255), nullable=False),
        sa.Column("max_tokens", sa.Integer(), nullable=False, server_default="4096"),
        sa.Column("temperature", sa.REAL(), nullable=False, server_default="0.7"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "user_id",
            sa.String(length=64),
            nullable=False,
            server_default=sa.text(f"'{DEFAULT_USER_ID}'"),
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_ai_providers_user_id", "ai_providers", ["user_id"])

    # 3. writing_settings — 1:1 with projects; includes user_id (US-002)
    op.create_table(
        "writing_settings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("human_ai_ratio", sa.REAL(), nullable=False, server_default="0.5"),
        sa.Column("writing_style", sa.String(length=100), nullable=False, server_default="default"),
        sa.Column("target_word_count", sa.Integer(), nullable=True),
        sa.Column("sprint_data_json", sa.Text(), nullable=True),
        sa.Column(
            "user_id",
            sa.String(length=64),
            nullable=False,
            server_default=sa.text(f"'{DEFAULT_USER_ID}'"),
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_writing_settings_user_id", "writing_settings", ["user_id"])

    # 4. outlines
    op.create_table(
        "outlines",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False, server_default="未命名大纲"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # 5. chapters
    op.create_table(
        "chapters",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "outline_id",
            sa.Integer(),
            sa.ForeignKey("outlines.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(length=255), nullable=True, server_default="未命名章节"),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            server_default="planning",
        ),
        sa.Column("word_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("chapter_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("note_category", sa.String(length=100), nullable=True),
        sa.Column("note_pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("battle_station_data", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # 6. locations
    op.create_table(
        "locations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "importance",
            sa.String(length=50),
            nullable=False,
            server_default="normal",
        ),
        sa.Column("tags", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # 7. items
    op.create_table(
        "items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("owner", sa.String(length=255), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("tags", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # 8. characters
    op.create_table(
        "characters",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("gender", sa.String(length=50), nullable=True),
        sa.Column("personality", sa.Text(), nullable=True),
        sa.Column("desires", sa.Text(), nullable=True),
        sa.Column("flaws", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "tier",
            sa.String(length=50),
            nullable=False,
            server_default="supporting",
        ),
        sa.Column("cultivation_realm", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # 9. character_relationships
    op.create_table(
        "character_relationships",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "character_id",
            sa.Integer(),
            sa.ForeignKey("characters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "target_id",
            sa.Integer(),
            sa.ForeignKey("characters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # 10. character_storylines
    op.create_table(
        "character_storylines",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "character_id",
            sa.Integer(),
            sa.ForeignKey("characters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("arc", sa.Text(), nullable=True),
        sa.Column("progress", sa.REAL(), nullable=False, server_default="0.0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # 11. drafts — uses own id (not BaseModel) per draft.py
    op.create_table(
        "drafts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "chapter_id",
            sa.Integer(),
            sa.ForeignKey("chapters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # 12. ai_inspection_results (depends on chapters, projects)
    op.create_table(
        "ai_inspection_results",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "chapter_id",
            sa.Integer(),
            sa.ForeignKey("chapters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("inspection_type", sa.String(length=100), nullable=False),
        sa.Column("issues_json", sa.Text(), nullable=True),
        sa.Column("suggestions_json", sa.Text(), nullable=True),
        sa.Column("auto_fixed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    """Drop all 11 tables in reverse-FK order."""
    # Drop child tables first to satisfy FK constraints.
    op.drop_table("ai_inspection_results")
    op.drop_table("drafts")
    op.drop_table("character_storylines")
    op.drop_table("character_relationships")
    op.drop_table("characters")
    op.drop_table("items")
    op.drop_table("locations")
    op.drop_table("chapters")
    op.drop_table("outlines")
    op.drop_table("writing_settings")
    op.drop_table("ai_providers")
    op.drop_index("ix_projects_user_id", table_name="projects")
    op.drop_table("projects")
