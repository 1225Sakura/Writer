"""008_add_constraint_rules_table

Revision ID: 008_constraint_rules
Revises: 007_add_tags
Create Date: 2026-04-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '008_constraint_rules'
down_revision: Union[str, Sequence[str], None] = '007_add_tags'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create dedicated constraint_rules table.

    This table stores constraint rules parsed from DSL with structured fields
    for rule_type, severity, and conditions.

    Note: SQLite does not support ALTER TABLE for adding constraints outside
    of batch mode, so we use batch_alter_table.
    """
    # Create the constraint_rules table
    op.create_table(
        'constraint_rules',
        sa.Column('id', sa.String(255), primary_key=True),
        sa.Column('rule_type', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('pattern', sa.Text(), nullable=True),
        sa.Column('severity', sa.String(20), nullable=False, default='high'),
        sa.Column('status', sa.String(20), nullable=False, default='active'),
        sa.Column('conditions', sa.Text(), nullable=True),  # JSON-encoded list of conditions
        sa.Column('metadata', sa.Text(), nullable=True),  # JSON-encoded additional metadata
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True, onupdate=sa.func.now()),
    )

    # Create indexes for common query patterns
    op.create_index('ix_constraint_rules_rule_type', 'constraint_rules', ['rule_type'])
    op.create_index('ix_constraint_rules_severity', 'constraint_rules', ['severity'])
    op.create_index('ix_constraint_rules_status', 'constraint_rules', ['status'])

    # Add check constraint for severity values
    with op.batch_alter_table('constraint_rules', schema=None) as batch_op:
        batch_op.create_check_constraint(
            'ck_constraint_rules_severity',
            sa.text("severity IN ('critical', 'high', 'medium', 'low', 'info')")
        )

        batch_op.create_check_constraint(
            'ck_constraint_rules_status',
            sa.text("status IN ('active', 'disabled', 'deprecated')")
        )


def downgrade() -> None:
    """Drop constraint_rules table."""
    op.drop_table('constraint_rules')
