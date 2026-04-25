"""008_add_wiki_tables

Revision ID: 008_add_wiki
Revises: 007_add_tags
Create Date: 2026-04-25 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '008_add_wiki'
down_revision: Union[str, Sequence[str], None] = '007_add_tags'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create wiki_pages, wiki_versions, and wiki_entity_links tables."""
    # Create wiki_pages table
    op.create_table(
        'wiki_pages',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=True),
        sa.Column('entity_type', sa.String(50), nullable=True),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False, default=''),
        sa.Column('version', sa.Integer(), default=1),
        sa.Column('is_draft', sa.Integer(), default=0),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('idx_wiki_pages_project_id', 'wiki_pages', ['project_id'])
    op.create_index('idx_wiki_pages_entity', 'wiki_pages', ['entity_type', 'entity_id'])

    # Create wiki_versions table
    op.create_table(
        'wiki_versions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('page_id', sa.Integer(), sa.ForeignKey('wiki_pages.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('change_summary', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('idx_wiki_versions_page_id', 'wiki_versions', ['page_id'])

    # Create wiki_entity_links table
    op.create_table(
        'wiki_entity_links',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('wiki_page_id', sa.Integer(), sa.ForeignKey('wiki_pages.id', ondelete='CASCADE'), nullable=False),
        sa.Column('linked_entity_type', sa.String(50), nullable=False),
        sa.Column('linked_entity_id', sa.Integer(), nullable=False),
        sa.Column('link_type', sa.String(50), nullable=False),
    )
    op.create_index('idx_wiki_entity_links_page_id', 'wiki_entity_links', ['wiki_page_id'])
    op.create_index('idx_wiki_entity_links_entity', 'wiki_entity_links', ['linked_entity_type', 'linked_entity_id'])


def downgrade() -> None:
    """Drop wiki tables."""
    op.drop_table('wiki_entity_links')
    op.drop_table('wiki_versions')
    op.drop_table('wiki_pages')
