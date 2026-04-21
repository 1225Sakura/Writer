"""add_workflow_execution

Add WorkflowExecution and AgentExecutionLog tables for
workflow execution tracking.

Revision ID: add_workflow_execution
Revises: add_project_and_genre
Create Date: 2026-04-21 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_workflow_execution'
down_revision: Union[str, Sequence[str], None] = 'add_project_and_genre'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create workflow execution tracking tables."""
    op.create_table(
        'workflow_executions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('workflow_name', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('results_json', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_workflow_executions_status', 'workflow_executions', ['status'])
    op.create_index('idx_workflow_executions_name', 'workflow_executions', ['workflow_name'])

    op.create_table(
        'agent_execution_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('workflow_execution_id', sa.Integer(), sa.ForeignKey('workflow_executions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('agent_name', sa.String(), nullable=False),
        sa.Column('stage_name', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('result_json', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_agent_logs_workflow_id', 'agent_execution_logs', ['workflow_execution_id'])
    op.create_index('idx_agent_logs_agent_name', 'agent_execution_logs', ['agent_name'])


def downgrade() -> None:
    """Drop workflow execution tracking tables."""
    op.drop_index('idx_agent_logs_agent_name', table_name='agent_execution_logs')
    op.drop_index('idx_agent_logs_workflow_id', table_name='agent_execution_logs')
    op.drop_table('agent_execution_logs')
    op.drop_index('idx_workflow_executions_name', table_name='workflow_executions')
    op.drop_index('idx_workflow_executions_status', table_name='workflow_executions')
    op.drop_table('workflow_executions')
