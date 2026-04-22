"""005_extensions_context_engagement_strand_quality_debt

Revision ID: 005_extensions_context_engagement
Revises: 22d0ce106c9a
Create Date: 2026-04-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '005_extensions_context_engagement'
down_revision: Union[str, Sequence[str], None] = '22d0ce106c9a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create extension tables for Phase 4 ecosystem integration."""

    # ============================================
    # RAG Context & Chunk Storage
    # ============================================

    op.create_table(
        'context_chunks',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('chunk_id', sa.String(length=64), nullable=False),
        sa.Column('chapter_id', sa.Integer(), nullable=False),
        sa.Column('scene_index', sa.Integer(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('chunk_type', sa.String(length=32), nullable=True),
        sa.Column('parent_chunk_id', sa.String(length=64), nullable=True),
        sa.Column('source_file', sa.String(length=255), nullable=True),
        sa.Column('metadata_json', sa.Text(), nullable=True),
        sa.Column('embedding_blob', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('chunk_id')
    )
    op.create_index('ix_context_chunks_chapter_id', 'context_chunks', ['chapter_id'], unique=False)
    op.create_index('ix_context_chunks_chunk_id', 'context_chunks', ['chunk_id'], unique=False)
    op.create_index('ix_context_chunks_chunk_type', 'context_chunks', ['chunk_type'], unique=False)
    op.create_index('ix_context_chunks_parent_chunk_id', 'context_chunks', ['parent_chunk_id'], unique=False)

    op.create_table(
        'query_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('query', sa.Text(), nullable=False),
        sa.Column('query_type', sa.String(length=32), nullable=False),
        sa.Column('results_count', sa.Integer(), nullable=True),
        sa.Column('hit_sources_json', sa.Text(), nullable=True),
        sa.Column('latency_ms', sa.Integer(), nullable=True),
        sa.Column('chapter_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_query_logs_chapter_id', 'query_logs', ['chapter_id'], unique=False)
    op.create_index('ix_query_logs_created_at', 'query_logs', ['created_at'], unique=False)
    op.create_index('ix_query_logs_query_type', 'query_logs', ['query_type'], unique=False)

    # ============================================
    # Engagement & Hook Analysis
    # ============================================

    op.create_table(
        'engagement_scores',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('chapter_id', sa.Integer(), nullable=False),
        sa.Column('word_count', sa.Integer(), nullable=True),
        sa.Column('cool_point_count', sa.Integer(), nullable=True),
        sa.Column('cool_point_density', sa.Float(), nullable=True),
        sa.Column('cool_point_score', sa.Float(), nullable=True),
        sa.Column('fulfillment_count', sa.Integer(), nullable=True),
        sa.Column('fulfillment_score', sa.Float(), nullable=True),
        sa.Column('predicted_retention', sa.Float(), nullable=True),
        sa.Column('retention_factors_json', sa.Text(), nullable=True),
        sa.Column('overall_engagement_score', sa.Float(), nullable=True),
        sa.Column('pacing_analysis_json', sa.Text(), nullable=True),
        sa.Column('suggestions_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_engagement_scores_chapter_id', 'engagement_scores', ['chapter_id'], unique=False)
    op.create_index('ix_engagement_scores_project_id', 'engagement_scores', ['project_id'], unique=False)

    op.create_table(
        'hook_analyses',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('chapter_id', sa.Integer(), nullable=False),
        sa.Column('total_hooks', sa.Integer(), nullable=True),
        sa.Column('hooks_by_type_json', sa.Text(), nullable=True),
        sa.Column('hooks_by_position_json', sa.Text(), nullable=True),
        sa.Column('hooks_detail_json', sa.Text(), nullable=True),
        sa.Column('opening_hook_strength', sa.Float(), nullable=True),
        sa.Column('ending_hook_strength', sa.Float(), nullable=True),
        sa.Column('overall_hook_score', sa.Float(), nullable=True),
        sa.Column('suggestions_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_hook_analyses_chapter_id', 'hook_analyses', ['chapter_id'], unique=False)
    op.create_index('ix_hook_analyses_project_id', 'hook_analyses', ['project_id'], unique=False)

    # ============================================
    # Strand & Pacing Analysis
    # ============================================

    op.create_table(
        'strand_analyses',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('chapter_id', sa.Integer(), nullable=False),
        sa.Column('outline_id', sa.Integer(), nullable=True),
        sa.Column('quest_ratio', sa.Float(), nullable=True),
        sa.Column('fire_ratio', sa.Float(), nullable=True),
        sa.Column('constellation_ratio', sa.Float(), nullable=True),
        sa.Column('dominant_strand', sa.String(length=32), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('method', sa.String(length=32), nullable=True),
        sa.Column('keywords_found_json', sa.Text(), nullable=True),
        sa.Column('red_line_violations_json', sa.Text(), nullable=True),
        sa.Column('health_score', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['outline_id'], ['outlines.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_strand_analyses_chapter_id', 'strand_analyses', ['chapter_id'], unique=False)
    op.create_index('ix_strand_analyses_dominant_strand', 'strand_analyses', ['dominant_strand'], unique=False)
    op.create_index('ix_strand_analyses_outline_id', 'strand_analyses', ['outline_id'], unique=False)
    op.create_index('ix_strand_analyses_project_id', 'strand_analyses', ['project_id'], unique=False)

    op.create_table(
        'pacing_red_line_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('outline_id', sa.Integer(), nullable=False),
        sa.Column('strand', sa.String(length=32), nullable=False),
        sa.Column('violation_type', sa.String(length=32), nullable=False),
        sa.Column('chapters_affected_json', sa.Text(), nullable=True),
        sa.Column('severity', sa.String(length=16), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('suggestion', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['outline_id'], ['outlines.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_pacing_red_line_logs_created_at', 'pacing_red_line_logs', ['created_at'], unique=False)
    op.create_index('ix_pacing_red_line_logs_outline_id', 'pacing_red_line_logs', ['outline_id'], unique=False)
    op.create_index('ix_pacing_red_line_logs_severity', 'pacing_red_line_logs', ['severity'], unique=False)
    op.create_index('ix_pacing_red_line_logs_strand', 'pacing_red_line_logs', ['strand'], unique=False)

    # ============================================
    # Genre & Writing Guidance
    # ============================================

    op.create_table(
        'genre_profiles',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('genre_name', sa.String(length=100), nullable=False),
        sa.Column('profile_key', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('core_tropes_json', sa.Text(), nullable=True),
        sa.Column('narrative_rhythm_json', sa.Text(), nullable=True),
        sa.Column('terminology_hints_json', sa.Text(), nullable=True),
        sa.Column('character_archetypes_json', sa.Text(), nullable=True),
        sa.Column('world_building_focus_json', sa.Text(), nullable=True),
        sa.Column('pressure_source', sa.String(length=255), nullable=True),
        sa.Column('release_target', sa.String(length=255), nullable=True),
        sa.Column('guidance_text', sa.Text(), nullable=True),
        sa.Column('composite_hints_json', sa.Text(), nullable=True),
        sa.Column('is_preset', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_genre_profiles_genre_name', 'genre_profiles', ['genre_name'], unique=False)
    op.create_index('ix_genre_profiles_is_preset', 'genre_profiles', ['is_preset'], unique=False)
    op.create_index('ix_genre_profiles_profile_key', 'genre_profiles', ['profile_key'], unique=False)
    op.create_index('ix_genre_profiles_project_id', 'genre_profiles', ['project_id'], unique=False)

    op.create_table(
        'writing_guidance_records',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('chapter_id', sa.Integer(), nullable=False),
        sa.Column('strategy_card_json', sa.Text(), nullable=True),
        sa.Column('guidance_items_json', sa.Text(), nullable=True),
        sa.Column('methodology_items_json', sa.Text(), nullable=True),
        sa.Column('checklist_json', sa.Text(), nullable=True),
        sa.Column('checklist_completed', sa.Integer(), nullable=True),
        sa.Column('checklist_total', sa.Integer(), nullable=True),
        sa.Column('checklist_percentage', sa.Float(), nullable=True),
        sa.Column('risk_flags_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_writing_guidance_records_chapter_id', 'writing_guidance_records', ['chapter_id'], unique=False)
    op.create_index('ix_writing_guidance_records_project_id', 'writing_guidance_records', ['project_id'], unique=False)

    # ============================================
    # Snapshot & Backup
    # ============================================

    op.create_table(
        'snapshot_records',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('snapshot_id', sa.String(length=64), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('triggered_by', sa.String(length=32), nullable=True),
        sa.Column('version', sa.String(length=16), nullable=True),
        sa.Column('file_path', sa.String(length=512), nullable=True),
        sa.Column('size_bytes', sa.Integer(), nullable=True),
        sa.Column('entities_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('snapshot_id')
    )
    op.create_index('ix_snapshot_records_created_at', 'snapshot_records', ['created_at'], unique=False)
    op.create_index('ix_snapshot_records_project_id', 'snapshot_records', ['project_id'], unique=False)
    op.create_index('ix_snapshot_records_snapshot_id', 'snapshot_records', ['snapshot_id'], unique=False)
    op.create_index('ix_snapshot_records_triggered_by', 'snapshot_records', ['triggered_by'], unique=False)

    op.create_table(
        'backup_schedule_records',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('enabled', sa.Integer(), nullable=True),
        sa.Column('interval_minutes', sa.Integer(), nullable=True),
        sa.Column('max_snapshots', sa.Integer(), nullable=True),
        sa.Column('backup_on_shutdown', sa.Integer(), nullable=True),
        sa.Column('backup_on_chapter_save', sa.Integer(), nullable=True),
        sa.Column('backup_on_settings_change', sa.Integer(), nullable=True),
        sa.Column('last_backup_at', sa.DateTime(), nullable=True),
        sa.Column('last_backup_id', sa.String(length=64), nullable=True),
        sa.Column('total_backups', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_backup_schedule_records_project_id', 'backup_schedule_records', ['project_id'], unique=False)

    op.create_table(
        'archive_records',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.String(length=512), nullable=True),
        sa.Column('format', sa.String(length=16), nullable=True),
        sa.Column('size_bytes', sa.Integer(), nullable=True),
        sa.Column('snapshot_id', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_archive_records_created_at', 'archive_records', ['created_at'], unique=False)
    op.create_index('ix_archive_records_project_id', 'archive_records', ['project_id'], unique=False)
    op.create_index('ix_archive_records_snapshot_id', 'archive_records', ['snapshot_id'], unique=False)

    # ============================================
    # Index Debt & Quality Tracking
    # ============================================

    op.create_table(
        'index_debt_records',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('debt_type', sa.String(length=64), nullable=False),
        sa.Column('severity', sa.String(length=16), nullable=True),
        sa.Column('status', sa.String(length=16), nullable=True),
        sa.Column('entity_type', sa.String(length=32), nullable=True),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('entity_name', sa.String(length=255), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('meta_json', sa.Text(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('ignore_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_index_debt_records_created_at', 'index_debt_records', ['created_at'], unique=False)
    op.create_index('ix_index_debt_records_debt_type', 'index_debt_records', ['debt_type'], unique=False)
    op.create_index('ix_index_debt_records_entity_id', 'index_debt_records', ['entity_id'], unique=False)
    op.create_index('ix_index_debt_records_entity_type', 'index_debt_records', ['entity_type'], unique=False)
    op.create_index('ix_index_debt_records_project_id', 'index_debt_records', ['project_id'], unique=False)
    op.create_index('ix_index_debt_records_severity', 'index_debt_records', ['severity'], unique=False)
    op.create_index('ix_index_debt_records_status', 'index_debt_records', ['status'], unique=False)

    op.create_table(
        'quality_trend_points',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('chapter_id', sa.Integer(), nullable=False),
        sa.Column('inspection_id', sa.Integer(), nullable=True),
        sa.Column('overall_score', sa.Float(), nullable=True),
        sa.Column('dimension_scores_json', sa.Text(), nullable=True),
        sa.Column('severity_counts_json', sa.Text(), nullable=True),
        sa.Column('risk_flags_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['inspection_id'], ['ai_inspection_results.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_quality_trend_points_chapter_id', 'quality_trend_points', ['chapter_id'], unique=False)
    op.create_index('ix_quality_trend_points_created_at', 'quality_trend_points', ['created_at'], unique=False)
    op.create_index('ix_quality_trend_points_inspection_id', 'quality_trend_points', ['inspection_id'], unique=False)
    op.create_index('ix_quality_trend_points_project_id', 'quality_trend_points', ['project_id'], unique=False)

    # ============================================
    # Constraint Rules
    # ============================================

    op.create_table(
        'constraint_rule_records',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('rule_id', sa.String(length=128), nullable=False),
        sa.Column('law_type', sa.String(length=64), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('pattern', sa.String(length=512), nullable=True),
        sa.Column('severity', sa.String(length=16), nullable=True),
        sa.Column('status', sa.String(length=16), nullable=True),
        sa.Column('metadata_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_constraint_rule_records_law_type', 'constraint_rule_records', ['law_type'], unique=False)
    op.create_index('ix_constraint_rule_records_project_id', 'constraint_rule_records', ['project_id'], unique=False)
    op.create_index('ix_constraint_rule_records_rule_id', 'constraint_rule_records', ['rule_id'], unique=False)
    op.create_index('ix_constraint_rule_records_severity', 'constraint_rule_records', ['severity'], unique=False)
    op.create_index('ix_constraint_rule_records_status', 'constraint_rule_records', ['status'], unique=False)

    op.create_table(
        'constraint_violation_records',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('chapter_id', sa.Integer(), nullable=False),
        sa.Column('rule_id', sa.String(length=128), nullable=False),
        sa.Column('law_type', sa.String(length=64), nullable=False),
        sa.Column('severity', sa.String(length=16), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('evidence', sa.Text(), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('suggestion', sa.Text(), nullable=True),
        sa.Column('metadata_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_constraint_violation_records_chapter_id', 'constraint_violation_records', ['chapter_id'], unique=False)
    op.create_index('ix_constraint_violation_records_created_at', 'constraint_violation_records', ['created_at'], unique=False)
    op.create_index('ix_constraint_violation_records_law_type', 'constraint_violation_records', ['law_type'], unique=False)
    op.create_index('ix_constraint_violation_records_project_id', 'constraint_violation_records', ['project_id'], unique=False)
    op.create_index('ix_constraint_violation_records_rule_id', 'constraint_violation_records', ['rule_id'], unique=False)
    op.create_index('ix_constraint_violation_records_severity', 'constraint_violation_records', ['severity'], unique=False)

    # ============================================
    # Graph Relationships (Extended)
    # ============================================

    op.create_table(
        'graph_relationships',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('source_type', sa.String(length=32), nullable=False),
        sa.Column('source_id', sa.Integer(), nullable=False),
        sa.Column('target_type', sa.String(length=32), nullable=False),
        sa.Column('target_id', sa.Integer(), nullable=False),
        sa.Column('relation_type', sa.String(length=64), nullable=False),
        sa.Column('label', sa.String(length=255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('properties_json', sa.Text(), nullable=True),
        sa.Column('directed', sa.Integer(), nullable=True),
        sa.Column('weight', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_graph_relations_project_id', 'graph_relationships', ['project_id'], unique=False)
    op.create_index('ix_graph_relations_relation_type', 'graph_relationships', ['relation_type'], unique=False)
    op.create_index('ix_graph_relations_source', 'graph_relationships', ['source_type', 'source_id'], unique=False)
    op.create_index('ix_graph_relations_target', 'graph_relationships', ['target_type', 'target_id'], unique=False)

    # ============================================
    # Observability & Metrics
    # ============================================

    op.create_table(
        'system_metric_points',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('metric_type', sa.String(length=64), nullable=False),
        sa.Column('metric_name', sa.String(length=128), nullable=False),
        sa.Column('value', sa.Float(), nullable=True),
        sa.Column('unit', sa.String(length=32), nullable=True),
        sa.Column('tags_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_system_metric_points_created_at', 'system_metric_points', ['created_at'], unique=False)
    op.create_index('ix_system_metric_points_metric_name', 'system_metric_points', ['metric_name'], unique=False)
    op.create_index('ix_system_metric_points_metric_type', 'system_metric_points', ['metric_type'], unique=False)
    op.create_index('ix_system_metric_points_project_id', 'system_metric_points', ['project_id'], unique=False)

    op.create_table(
        'narrative_debt_records',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('debt_type', sa.String(length=64), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=True),
        sa.Column('priority', sa.String(length=16), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_chapter_id', sa.Integer(), nullable=True),
        sa.Column('expected_chapter_id', sa.Integer(), nullable=True),
        sa.Column('resolved_chapter_id', sa.Integer(), nullable=True),
        sa.Column('keywords_json', sa.Text(), nullable=True),
        sa.Column('related_character_ids_json', sa.Text(), nullable=True),
        sa.Column('overdue_chapters', sa.Integer(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['created_chapter_id'], ['chapters.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['expected_chapter_id'], ['chapters.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['resolved_chapter_id'], ['chapters.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_narrative_debt_records_created_chapter_id', 'narrative_debt_records', ['created_chapter_id'], unique=False)
    op.create_index('ix_narrative_debt_records_debt_type', 'narrative_debt_records', ['debt_type'], unique=False)
    op.create_index('ix_narrative_debt_records_priority', 'narrative_debt_records', ['priority'], unique=False)
    op.create_index('ix_narrative_debt_records_project_id', 'narrative_debt_records', ['project_id'], unique=False)
    op.create_index('ix_narrative_debt_records_status', 'narrative_debt_records', ['status'], unique=False)


def downgrade() -> None:
    """Drop all extension tables."""

    tables = [
        'narrative_debt_records',
        'system_metric_points',
        'graph_relationships',
        'constraint_violation_records',
        'constraint_rule_records',
        'quality_trend_points',
        'index_debt_records',
        'archive_records',
        'backup_schedule_records',
        'snapshot_records',
        'writing_guidance_records',
        'genre_profiles',
        'pacing_red_line_logs',
        'strand_analyses',
        'hook_analyses',
        'engagement_scores',
        'query_logs',
        'context_chunks',
    ]

    for table in tables:
        op.drop_table(table)
