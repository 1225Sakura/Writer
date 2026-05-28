"""012_add_ai_review_history

Revision ID: 012_ai_review_history
Revises: 011_temporal_kg_quads
Create Date: 2026-05-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '012_ai_review_history'
down_revision: Union[str, Sequence[str], None] = '011_temporal_kg_quads'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create ai_review_history table for persisting AI review iterations."""
    op.create_table(
        'ai_review_history',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=True),
        sa.Column('iteration_id', sa.String(100), nullable=False, unique=True),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('issue_count', sa.Integer(), server_default='0'),
        sa.Column('severity_counts_json', sa.Text(), nullable=True),
        sa.Column('suggestions_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
    )

    op.create_index('idx_arh_project', 'ai_review_history', ['project_id'])
    op.create_index('idx_arh_iteration_id', 'ai_review_history', ['iteration_id'], unique=True)
    op.create_index('idx_arh_created_at', 'ai_review_history', ['created_at'])


def downgrade() -> None:
    """Drop ai_review_history table and indexes."""
    op.drop_index('idx_arh_created_at', table_name='ai_review_history')
    op.drop_index('idx_arh_iteration_id', table_name='ai_review_history')
    op.drop_index('idx_arh_project', table_name='ai_review_history')
    op.drop_table('ai_review_history')
