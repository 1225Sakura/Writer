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

    Note: All constraint-creating operations are wrapped in batch_alter_table
    because SQLite does not support ALTER TABLE for adding constraints
    outside of batch mode.
    """

    # ============================================
    # Unique Constraints (SQLite requires batch mode)
    # ============================================

    with op.batch_alter_table('characters', schema=None) as batch_op:
        batch_op.create_unique_constraint(
            'uq_character_name_project',
            ['name', 'project_id']
        )

    with op.batch_alter_table('chapters', schema=None) as batch_op:
        batch_op.create_unique_constraint(
            'uq_chapter_title_outline',
            ['title', 'outline_id']
        )

    # ============================================
    # Additional Indexes for Query Optimization
    # ============================================

    op.create_index(
        'ix_chat_messages_session_role',
        'chat_messages',
        ['session_id', 'role'],
        unique=False
    )

    op.create_index(
        'ix_extracted_entities_session_type_name',
        'extracted_entities',
        ['session_id', 'type', 'name'],
        unique=False
    )

    op.create_index(
        'ix_if_lines_sync_mode',
        'if_lines',
        ['sync_mode'],
        unique=False
    )

    op.create_index(
        'ix_plot_threads_status',
        'plot_threads',
        ['status'],
        unique=False
    )

    # ============================================
    # Foreign Key Constraints (batch mode required)
    # ============================================

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
    # Check Constraints for Data Validation (batch mode required)
    # ============================================

    with op.batch_alter_table('chapters', schema=None) as batch_op:
        batch_op.create_check_constraint(
            'ck_chapter_word_count_positive',
            sa.text('word_count >= 0')
        )

    with op.batch_alter_table('draft_versions', schema=None) as batch_op:
        batch_op.create_check_constraint(
            'ck_draft_version_number_positive',
            sa.text('version_number > 0')
        )

    with op.batch_alter_table('writing_settings', schema=None) as batch_op:
        batch_op.create_check_constraint(
            'ck_writing_settings_ratio_range',
            sa.text('human_ai_ratio >= 0 AND human_ai_ratio <= 1')
        )

    with op.batch_alter_table('if_lines', schema=None) as batch_op:
        batch_op.create_check_constraint(
            'ck_if_lines_sync_mode_valid',
            sa.text("sync_mode IN ('auto', 'manual', 'paused')")
        )


def downgrade() -> None:
    """Remove constraints and indexes."""

    # ============================================
    # Drop Check Constraints (batch mode required)
    # ============================================

    with op.batch_alter_table('if_lines', schema=None) as batch_op:
        batch_op.drop_constraint('ck_if_lines_sync_mode_valid', type_='check')

    with op.batch_alter_table('writing_settings', schema=None) as batch_op:
        batch_op.drop_constraint('ck_writing_settings_ratio_range', type_='check')

    with op.batch_alter_table('draft_versions', schema=None) as batch_op:
        batch_op.drop_constraint('ck_draft_version_number_positive', type_='check')

    with op.batch_alter_table('chapters', schema=None) as batch_op:
        batch_op.drop_constraint('ck_chapter_word_count_positive', type_='check')

    # ============================================
    # Drop Foreign Keys (batch mode required)
    # ============================================

    with op.batch_alter_table('extracted_entities', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('fk_extracted_entities_project_id_projects'), type_='foreignkey')

    with op.batch_alter_table('chat_messages', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('fk_chat_messages_project_id_projects'), type_='foreignkey')

    with op.batch_alter_table('chat_sessions', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('fk_chat_sessions_project_id_projects'), type_='foreignkey')

    # ============================================
    # Drop Indexes
    # ============================================

    op.drop_index('ix_plot_threads_status', table_name='plot_threads')
    op.drop_index('ix_if_lines_sync_mode', table_name='if_lines')
    op.drop_index('ix_extracted_entities_session_type_name', table_name='extracted_entities')
    op.drop_index('ix_chat_messages_session_role', table_name='chat_messages')

    # ============================================
    # Drop Unique Constraints (batch mode required)
    # ============================================

    with op.batch_alter_table('chapters', schema=None) as batch_op:
        batch_op.drop_constraint('uq_chapter_title_outline', type_='unique')

    with op.batch_alter_table('characters', schema=None) as batch_op:
        batch_op.drop_constraint('uq_character_name_project', type_='unique')
