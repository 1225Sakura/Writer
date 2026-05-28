"""011_add_temporal_kg_quads

Revision ID: 011_temporal_kg_quads
Revises: 010_ai_provider_configs
Create Date: 2026-05-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '011_temporal_kg_quads'
down_revision: Union[str, Sequence[str], None] = '010_ai_provider_configs'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create temporal_kg_quads table for SVO knowledge graph storage."""
    op.create_table(
        'temporal_kg_quads',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=True),
        sa.Column('chapter_id', sa.Integer(), sa.ForeignKey('chapters.id'), nullable=True),
        sa.Column('chapter_order', sa.Integer(), nullable=False),
        sa.Column('subject', sa.Text(), nullable=False),
        sa.Column('subject_type', sa.Text(), nullable=True),
        sa.Column('subject_id', sa.Integer(), nullable=True),
        sa.Column('verb', sa.Text(), nullable=False),
        sa.Column('object', sa.Text(), nullable=True),
        sa.Column('object_type', sa.Text(), nullable=True),
        sa.Column('object_id', sa.Integer(), nullable=True),
        sa.Column('context_snippet', sa.Text(), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True, server_default='1.0'),
        sa.Column('metadata_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
    )

    op.create_index('idx_tkg_project', 'temporal_kg_quads', ['project_id'])
    op.create_index('idx_tkg_chapter', 'temporal_kg_quads', ['chapter_id'])
    op.create_index('idx_tkg_chapter_order', 'temporal_kg_quads', ['chapter_order'])
    op.create_index('idx_tkg_subject', 'temporal_kg_quads', ['subject'])
    op.create_index('idx_tkg_object', 'temporal_kg_quads', ['object'])
    op.create_index('idx_tkg_verb', 'temporal_kg_quads', ['verb'])
    op.create_index('idx_tkg_subject_id', 'temporal_kg_quads', ['subject_id'])
    op.create_index('idx_tkg_object_id', 'temporal_kg_quads', ['object_id'])


def downgrade() -> None:
    """Drop temporal_kg_quads table and indexes."""
    op.drop_index('idx_tkg_object_id', table_name='temporal_kg_quads')
    op.drop_index('idx_tkg_subject_id', table_name='temporal_kg_quads')
    op.drop_index('idx_tkg_verb', table_name='temporal_kg_quads')
    op.drop_index('idx_tkg_object', table_name='temporal_kg_quads')
    op.drop_index('idx_tkg_subject', table_name='temporal_kg_quads')
    op.drop_index('idx_tkg_chapter_order', table_name='temporal_kg_quads')
    op.drop_index('idx_tkg_chapter', table_name='temporal_kg_quads')
    op.drop_index('idx_tkg_project', table_name='temporal_kg_quads')
    op.drop_table('temporal_kg_quads')
