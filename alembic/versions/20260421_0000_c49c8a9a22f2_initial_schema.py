"""initial_schema

Baseline migration for the existing database schema.
This migration creates all tables as defined in the SQLAlchemy models.
For existing databases, stamp this revision with:
    alembic stamp c49c8a9a22f2

Revision ID: c49c8a9a22f2
Revises:
Create Date: 2026-04-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c49c8a9a22f2'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all initial tables."""
    # Characters & Relationships
    op.create_table(
        'characters',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
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
    )

    op.create_table(
        'character_relationships',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('character_id', sa.Integer(), sa.ForeignKey('characters.id', ondelete='CASCADE'), nullable=False),
        sa.Column('target_id', sa.Integer(), sa.ForeignKey('characters.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
    )
    op.create_index('idx_character_relationships_character_id', 'character_relationships', ['character_id'])
    op.create_index('idx_character_relationships_target_id', 'character_relationships', ['target_id'])

    op.create_table(
        'character_storylines',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('character_id', sa.Integer(), sa.ForeignKey('characters.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('arc', sa.Text(), nullable=True),
        sa.Column('progress', sa.Integer(), default=0),
    )
    op.create_index('idx_character_storylines_character_id', 'character_storylines', ['character_id'])

    # World Entities
    op.create_table(
        'items',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('owner', sa.String(), nullable=True),
        sa.Column('location', sa.String(), nullable=True),
    )

    op.create_table(
        'locations',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('importance', sa.String(), nullable=True),
    )

    op.create_table(
        'factions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('type', sa.String(), nullable=True),
    )

    op.create_table(
        'world_settings',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('details_json', sa.Text(), nullable=True),
    )

    op.create_table(
        'rules',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('type', sa.String(), nullable=True),
    )

    # Story Structure
    op.create_table(
        'outlines',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
    )

    op.create_table(
        'chapters',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('outline_id', sa.Integer(), sa.ForeignKey('outlines.id', ondelete='SET NULL'), nullable=True),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), default='pending'),
        sa.Column('word_count', sa.Integer(), default=0),
        sa.Column('chapter_order', sa.Integer(), default=0),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('idx_chapters_outline_id', 'chapters', ['outline_id'])

    op.create_table(
        'if_lines',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('linked_character_id', sa.Integer(), sa.ForeignKey('characters.id', ondelete='SET NULL'), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('sync_mode', sa.String(), default='auto'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )

    # Chat / Conversation
    op.create_table(
        'chat_sessions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )

    op.create_table(
        'chat_messages',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('chat_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('idx_chat_messages_session_id', 'chat_messages', ['session_id'])

    op.create_table(
        'extracted_entities',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('chat_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('confirmed', sa.Integer(), default=0),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('idx_extracted_entities_session_id', 'extracted_entities', ['session_id'])

    # Writing & Versioning
    op.create_table(
        'draft_versions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('chapter_id', sa.Integer(), sa.ForeignKey('chapters.id', ondelete='CASCADE'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('idx_draft_versions_chapter_id', 'draft_versions', ['chapter_id'])

    op.create_table(
        'plot_threads',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), default='active'),
        sa.Column('created_chapter_id', sa.Integer(), sa.ForeignKey('chapters.id', ondelete='SET NULL'), nullable=True),
        sa.Column('reveal_chapter_id', sa.Integer(), sa.ForeignKey('chapters.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('idx_plot_threads_created_chapter_id', 'plot_threads', ['created_chapter_id'])
    op.create_index('idx_plot_threads_reveal_chapter_id', 'plot_threads', ['reveal_chapter_id'])

    op.create_table(
        'ai_inspection_results',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('chapter_id', sa.Integer(), sa.ForeignKey('chapters.id', ondelete='CASCADE'), nullable=False),
        sa.Column('inspection_type', sa.String(), nullable=False),
        sa.Column('issues_json', sa.Text(), nullable=True),
        sa.Column('suggestions_json', sa.Text(), nullable=True),
        sa.Column('auto_fixed', sa.Integer(), default=0),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('idx_ai_inspection_results_chapter_id', 'ai_inspection_results', ['chapter_id'])

    op.create_table(
        'writing_settings',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('human_ai_ratio', sa.Float(), default=0.5),
        sa.Column('writing_style', sa.String(), default='default'),
        sa.Column('target_word_count', sa.Integer(), default=3000),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    """Drop all tables in reverse order."""
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
