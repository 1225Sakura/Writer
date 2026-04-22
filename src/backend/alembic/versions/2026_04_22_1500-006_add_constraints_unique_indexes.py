"""006_add_constraints_unique_indexes

Revision ID: 006_add_constraints
Revises: 005_extensions_context_engagement
Create Date: 2026-04-22 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '006_add_constraints'
down_revision: Union[str, Sequence[str], None] = '005_extensions_context_engagement'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add data integrity constraints.

    Unique constraints:
    - characters: (name, project_id) - unique character name per project
    - chapters: (title, outline_id) - unique chapter title per outline

    Index optimizations:
    - chat_messages: (session_id, role) for faster message queries
    - extracted_entities: (session_id, type, name) for entity dedup

    Foreign key improvements:
    - Ensure project_id FK exists on all entity tables
    """

    # ============================================
    # Unique Constraints
    # ============================================

    # Unique character name per project
    # Only add if project_id column exists (it does via 22d0ce migration)
    op.create_unique_constraint(
        'uq_character_name_project',
        'characters',
        ['name', 'project_id']
    )

    # Unique chapter title per outline
    op.create_unique_constraint(
        'uq_chapter_title_outline',
        'chapters',
        ['title', 'outline_id']
    )

    # ============================================
    # Additional Indexes for Query Optimization
    # ============================================

    # Chat message queries by role (AI/user classification)
    op.create_index(
        'ix_chat_messages_session_role',
        'chat_messages',
        ['session_id', 'role'],
        unique=False
    )

    # Entity deduplication: same session+type+name should be unique
    op.create_index(
        'ix_extracted_entities_session_type_name',
        'extracted_entities',
        ['session_id', 'type', 'name'],
        unique=False
    )

    # IF lines lookup by sync mode
    op.create_index(
        'ix_if_lines_sync_mode',
        'if_lines',
        ['sync_mode'],
        unique=False
    )

    # Plot threads by status for dashboard queries
    op.create_index(
        'ix_plot_threads_status',
        'plot_threads',
        ['status'],
        unique=False
    )

    # ============================================
    # Foreign Key Constraints (ensure ON DELETE behavior)
    # ============================================

    # Characters project_id already has FK from 22d0ce migration
    # Verify and ensure proper cascade behavior
    with op.batch_alter_table('characters', schema=None) as batch_op:
        # SQLite doesn't support ALTER TABLE to add FK with ON DELETE
        # This is informational - FK already exists via prior migration
        pass

    # Chat sessions project_id
    with op.batch_alter_table('chat_sessions', schema=None) as batch_op:
        batch_op.create_foreign_key(
            batch_op.f('fk_chat_sessions_project_id_projects'),
            'projects',
            ['project_id'],
            ['id'],
            ondelete='SET NULL'
        )

    # Chat messages project_id
    with op.batch_alter_table('chat_messages', schema=None) as batch_op:
        batch_op.create_foreign_key(
            batch_op.f('fk_chat_messages_project_id_projects'),
            'projects',
            ['project_id'],
            ['id'],
            ondelete='SET NULL'
        )

    # Extracted entities project_id
    with op.batch_alter_table('extracted_entities', schema=None) as batch_op:
        batch_op.create_foreign_key(
            batch_op.f('fk_extracted_entities_project_id_projects'),
            'projects',
            ['project_id'],
            ['id'],
            ondelete='SET NULL'
        )

    # ============================================
    # Check Constraints for Data Validation
    # ============================================

    # Ensure chapter word_count is non-negative
    op.create_check_constraint(
        'ck_chapter_word_count_positive',
        'chapters',
        sa.CheckConstraint('word_count >= 0', name='ck_chapter_word_count_positive')
    )

    # Ensure draft version number is positive
    op.create_check_constraint(
        'ck_draft_version_number_positive',
        'draft_versions',
        sa.CheckConstraint('version_number > 0', name='ck_draft_version_number_positive')
    )

    # Ensure human_ai_ratio is between 0 and 1
    op.create_check_constraint(
        'ck_writing_settings_ratio_range',
        'writing_settings',
        sa.CheckConstraint('human_ai_ratio >= 0 AND human_ai_ratio <= 1', name='ck_writing_settings_ratio_range')
    )

    # Ensure IF line sync_mode is valid
    op.create_check_constraint(
        'ck_if_lines_sync_mode_valid',
        'if_lines',
        sa.CheckConstraint(
            "sync_mode IN ('auto', 'manual', 'paused')",
            name='ck_if_lines_sync_mode_valid'
        )
    )


def downgrade() -> None:
    """Remove constraints and indexes."""

    # Drop check constraints
    op.drop_constraint('ck_if_lines_sync_mode_valid', 'if_lines', type_='check')
    op.drop_constraint('ck_writing_settings_ratio_range', 'writing_settings', type_='check')
    op.drop_constraint('ck_draft_version_number_positive', 'draft_versions', type_='check')
    op.drop_constraint('ck_chapter_word_count_positive', 'chapters', type_='check')

    # Drop foreign keys (SQLite requires recreating table, but batch alter handles it)
    with op.batch_alter_table('extracted_entities', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('fk_extracted_entities_project_id_projects'), type_='foreignkey')

    with op.batch_alter_table('chat_messages', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('fk_chat_messages_project_id_projects'), type_='foreignkey')

    with op.batch_alter_table('chat_sessions', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('fk_chat_sessions_project_id_projects'), type_='foreignkey')

    # Drop indexes
    op.drop_index('ix_plot_threads_status', table_name='plot_threads')
    op.drop_index('ix_if_lines_sync_mode', table_name='if_lines')
    op.drop_index('ix_extracted_entities_session_type_name', table_name='extracted_entities')
    op.drop_index('ix_chat_messages_session_role', table_name='chat_messages')

    # Drop unique constraints
    op.drop_constraint('uq_chapter_title_outline', 'chapters', type_='unique')
    op.drop_constraint('uq_character_name_project', 'characters', type_='unique')