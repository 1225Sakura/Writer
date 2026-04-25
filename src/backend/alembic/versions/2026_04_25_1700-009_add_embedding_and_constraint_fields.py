"""009_add_embedding_vec_and_constraint_extensions

Revision ID: 009_add_embedding_constraint_ext
Revises: 008_constraint_rules
Create Date: 2026-04-25 17:00:00.000000

This migration adds:
- embedding_vec column to context_chunks table for vector storage
- extension fields to constraint_rule_records for metadata extensions
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '009_add_embedding_constraint_ext'
down_revision: Union[str, Sequence[str], None] = '008_constraint_rules'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add embedding_vec and constraint extension fields."""
    # Add embedding_vec to context_chunks
    # This column stores the embedding vector for similarity search
    # Using Text to store base64-encoded or serialized vector data
    with op.batch_alter_table('context_chunks', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('embedding_vec', sa.Text(), nullable=True)
        )
        batch_op.add_column(
            sa.Column('embedding_model', sa.String(100), nullable=True)
        )
        batch_op.add_column(
            sa.Column('embedding_updated_at', sa.DateTime(), nullable=True)
        )

    # Add extension fields to constraint_rule_records
    # These allow storing additional metadata for constraint rules
    with op.batch_alter_table('constraint_rule_records', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('extension_json', sa.Text(), nullable=True)
        )
        batch_op.add_column(
            sa.Column('source_file', sa.String(255), nullable=True)
        )
        batch_op.add_column(
            sa.Column('line_number', sa.Integer(), nullable=True)
        )

    # Add extension fields to constraint_violation_records for tracking
    with op.batch_alter_table('constraint_violation_records', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('extension_json', sa.Text(), nullable=True)
        )

    # Create indexes for new columns
    op.create_index(
        'ix_context_chunks_embedding_updated',
        'context_chunks',
        ['embedding_updated_at']
    )


def downgrade() -> None:
    """Remove embedding_vec and constraint extension fields."""
    # Drop indexes first
    op.drop_index('ix_context_chunks_embedding_updated', table_name='context_chunks')

    # Remove from constraint_violation_records
    with op.batch_alter_table('constraint_violation_records', schema=None) as batch_op:
        batch_op.drop_column('extension_json')

    # Remove from constraint_rule_records
    with op.batch_alter_table('constraint_rule_records', schema=None) as batch_op:
        batch_op.drop_column('line_number')
        batch_op.drop_column('source_file')
        batch_op.drop_column('extension_json')

    # Remove from context_chunks
    with op.batch_alter_table('context_chunks', schema=None) as batch_op:
        batch_op.drop_column('embedding_updated_at')
        batch_op.drop_column('embedding_model')
        batch_op.drop_column('embedding_vec')
