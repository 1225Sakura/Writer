"""add_performance_indexes

Add indexes for frequently queried columns to improve query performance.
Indexes on:
- chapters.chapter_order (ORDER BY in list_chapters)
- chapters.status (filtering in list_chapters)
- if_lines.linked_character_id (JOIN with character filtering)
- Various type columns used in WHERE clauses

Revision ID: add_performance_indexes
Revises: c49c8a9a22f2
Create Date: 2026-04-21 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_performance_indexes'
down_revision: Union[str, Sequence[str], None] = 'c49c8a9a22f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add performance indexes for frequently queried columns."""
    # Chapter indexes - chapter_order used in ORDER BY, status in WHERE
    op.create_index('idx_chapters_chapter_order', 'chapters', ['chapter_order'])
    op.create_index('idx_chapters_status', 'chapters', ['status'])

    # IF Lines - linked_character_id used in JOINs and WHERE
    op.create_index('idx_if_lines_linked_character_id', 'if_lines', ['linked_character_id'])

    # Character filtering by tier
    op.create_index('idx_characters_tier', 'characters', ['tier'])

    # Item filtering by owner
    op.create_index('idx_items_owner', 'items', ['owner'])

    # Location filtering by importance
    op.create_index('idx_locations_importance', 'locations', ['importance'])

    # Faction filtering by type
    op.create_index('idx_factions_type', 'factions', ['type'])

    # Rule filtering by type
    op.create_index('idx_rules_type', 'rules', ['type'])

    # Plot thread filtering by status
    op.create_index('idx_plot_threads_status', 'plot_threads', ['status'])

    # Chat messages - created_at for ordering
    op.create_index('idx_chat_messages_created_at', 'chat_messages', ['created_at'])


def downgrade() -> None:
    """Remove performance indexes."""
    op.drop_index('idx_chat_messages_created_at', table_name='chat_messages')
    op.drop_index('idx_plot_threads_status', table_name='plot_threads')
    op.drop_index('idx_rules_type', table_name='rules')
    op.drop_index('idx_factions_type', table_name='factions')
    op.drop_index('idx_locations_importance', table_name='locations')
    op.drop_index('idx_items_owner', table_name='items')
    op.drop_index('idx_characters_tier', table_name='characters')
    op.drop_index('idx_if_lines_linked_character_id', table_name='if_lines')
    op.drop_index('idx_chapters_status', table_name='chapters')
    op.drop_index('idx_chapters_chapter_order', table_name='chapters')
