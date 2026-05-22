"""010_add_ai_provider_configs_table

Revision ID: 010_ai_provider_configs
Revises: 009_embedding_fields
Create Date: 2026-05-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '010_ai_provider_configs'
down_revision: Union[str, Sequence[str], None] = '009_add_embedding_constraint_ext'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create ai_provider_configs table for database-driven AI provider configuration."""
    op.create_table(
        'ai_provider_configs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=True, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('api_key', sa.String(500), nullable=False),
        sa.Column('base_url', sa.String(500), nullable=False),
        sa.Column('model_name', sa.String(100), nullable=False),
        sa.Column('max_tokens', sa.Integer(), nullable=True, server_default='4096'),
        sa.Column('temperature', sa.Float(), nullable=True, server_default='0.7'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='0', index=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True, onupdate=sa.func.now()),
    )


def downgrade() -> None:
    """Drop ai_provider_configs table."""
    op.drop_table('ai_provider_configs')
