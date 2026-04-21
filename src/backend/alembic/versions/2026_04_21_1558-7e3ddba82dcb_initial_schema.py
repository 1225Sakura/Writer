"""initial schema

Revision ID: 7e3ddba82dcb
Revises:
Create Date: 2026-04-21 15:58:29.007796

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7e3ddba82dcb'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create initial schema."""
    # Characters
    op.create_table(
        'characters',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('gender', sa.String(), nullable=True),
        sa.Column('personality', sa.Text(), nullable=True),
        sa.Column('desires', sa.Text(), nullable=True),
        sa.Column('flaws', sa.Text(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('tier', sa.String(), nullable=True),
        sa.Column('cultivation_realm', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_characters_tier_realm', 'characters', ['tier', 'cultivation_realm'], unique=False)

    # Character relationships
    op.create_table(
        'character_relationships',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('character_id', sa.Integer(), nullable=False),
        sa.Column('target_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['character_id'], ['characters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['target_id'], ['characters.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_character_relationships_character_id', 'character_relationships', ['character_id'], unique=False)
    op.create_index('idx_character_relationships_target_id', 'character_relationships', ['target_id'], unique=False)

    # Character storylines
    op.create_table(
        'character_storylines',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('character_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('arc', sa.Text(), nullable=True),
        sa.Column('progress', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['character_id'], ['characters.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_character_storylines_character_id', 'character_storylines', ['character_id'], unique=False)

    # Items
    op.create_table(
        'items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('owner', sa.String(), nullable=True),
        sa.Column('location', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_items_owner', 'items', ['owner'], unique=False)
    op.create_index('idx_items_location', 'items', ['location'], unique=False)

    # Locations
    op.create_table(
        'locations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('importance', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_locations_importance', 'locations', ['importance'], unique=False)

    # Factions
    op.create_table(
        'factions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('type', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_factions_type', 'factions', ['type'], unique=False)

    # World settings
    op.create_table(
        'world_settings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('details_json', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_world_settings_name', 'world_settings', ['name'], unique=False)

    # Rules
    op.create_table(
        'rules',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('type', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_rules_type', 'rules', ['type'], unique=False)

    # Outlines
    op.create_table(
        'outlines',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Chapters
    op.create_table(
        'chapters',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('outline_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('word_count', sa.Integer(), nullable=True),
        sa.Column('chapter_order', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['outline_id'], ['outlines.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_chapters_outline_id', 'chapters', ['outline_id'], unique=False)
    op.create_index('idx_chapters_status_order', 'chapters', ['status', 'chapter_order'], unique=False)
    op.create_index('idx_chapters_updated_at', 'chapters', [sa.text('updated_at DESC')], unique=False)

    # IF lines
    op.create_table(
        'if_lines',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('linked_character_id', sa.Integer(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('sync_mode', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['linked_character_id'], ['characters.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_if_lines_character', 'if_lines', ['linked_character_id'], unique=False)
    op.create_index('idx_if_lines_character_sync', 'if_lines', ['linked_character_id', 'sync_mode'], unique=False)

    # Chat sessions
    op.create_table(
        'chat_sessions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Chat messages
    op.create_table(
        'chat_messages',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_chat_messages_session_id', 'chat_messages', ['session_id'], unique=False)
    op.create_index('idx_chat_messages_session_created', 'chat_messages', ['session_id', 'created_at'], unique=False)

    # Extracted entities
    op.create_table(
        'extracted_entities',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('confirmed', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['chat_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_extracted_entities_session_id', 'extracted_entities', ['session_id'], unique=False)
    op.create_index('idx_extracted_entities_session_type', 'extracted_entities', ['session_id', 'type'], unique=False)

    # Draft versions
    op.create_table(
        'draft_versions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('chapter_id', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_draft_versions_chapter_id', 'draft_versions', ['chapter_id'], unique=False)
    op.create_index('idx_draft_versions_chapter_version', 'draft_versions', [sa.text('chapter_id, version_number DESC')], unique=False)

    # Plot threads
    op.create_table(
        'plot_threads',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('created_chapter_id', sa.Integer(), nullable=True),
        sa.Column('reveal_chapter_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['created_chapter_id'], ['chapters.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['reveal_chapter_id'], ['chapters.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_plot_threads_created_chapter_id', 'plot_threads', ['created_chapter_id'], unique=False)
    op.create_index('idx_plot_threads_reveal_chapter_id', 'plot_threads', ['reveal_chapter_id'], unique=False)
    op.create_index('idx_plot_threads_status_created', 'plot_threads', ['status', 'created_chapter_id'], unique=False)

    # AI inspection results
    op.create_table(
        'ai_inspection_results',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('chapter_id', sa.Integer(), nullable=False),
        sa.Column('inspection_type', sa.String(), nullable=False),
        sa.Column('issues_json', sa.Text(), nullable=True),
        sa.Column('suggestions_json', sa.Text(), nullable=True),
        sa.Column('auto_fixed', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_ai_inspection_results_chapter_id', 'ai_inspection_results', ['chapter_id'], unique=False)
    op.create_index('idx_ai_inspection_chapter_type', 'ai_inspection_results', ['chapter_id', 'inspection_type'], unique=False)

    # Writing settings
    op.create_table(
        'writing_settings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('human_ai_ratio', sa.Float(), nullable=True),
        sa.Column('writing_style', sa.String(), nullable=True),
        sa.Column('target_word_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_writing_settings_updated', 'writing_settings', [sa.text('updated_at DESC')], unique=False)


def downgrade() -> None:
    """Drop all tables."""
    op.drop_table('writing_settings')
    op.drop_table('ai_inspection_results')
    op.drop_table('plot_threads')
    op.drop_table('draft_versions')
    op.drop_table('extracted_entities')
    op.drop_table('chat_messages')
    op.drop_table('chat_sessions')
    op.drop_table('if_lines')
    op.drop_table('chapters')
    op.drop_table('outlines')
    op.drop_table('rules')
    op.drop_table('world_settings')
    op.drop_table('factions')
    op.drop_table('locations')
    op.drop_table('items')
    op.drop_table('character_storylines')
    op.drop_table('character_relationships')
    op.drop_table('characters')
