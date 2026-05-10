# Auto Novel Writer - SQLAlchemy Extension Models
# Additional tables for data that should be normalized (not just JSON fields)
# Created by Phase 4 ecosystem integration.

from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime, ForeignKey, Index, JSON
)
from sqlalchemy.orm import relationship

from backend.infrastructure.database import Base


# ============================================
# RAG Context & Chunk Storage
# ============================================

class ContextChunk(Base):
    """Stores text chunks for RAG retrieval (synced from ContextManager)."""

    __tablename__ = "context_chunks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chunk_id = Column(String(64), nullable=False, unique=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False, index=True)
    scene_index = Column(Integer, default=0)
    content = Column(Text, nullable=False)
    chunk_type = Column(String(32), default="scene", index=True)  # scene | summary | character | plot | setting
    parent_chunk_id = Column(String(64), nullable=True, index=True)
    source_file = Column(String(255), nullable=True)
    metadata_json = Column(Text, nullable=True)
    embedding_blob = Column(Text, nullable=True)  # base64 or hex encoded embedding
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chapter = relationship("Chapter")


class QueryLog(Base):
    """Logs RAG queries for observability and optimization."""

    __tablename__ = "query_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    query = Column(Text, nullable=False)
    query_type = Column(String(32), nullable=False, index=True)  # vector | bm25 | hybrid | graph_hybrid
    results_count = Column(Integer, default=0)
    hit_sources_json = Column(Text, nullable=True)
    latency_ms = Column(Integer, default=0)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


# ============================================
# Engagement & Hook Analysis
# ============================================

class EngagementScore(Base):
    """Stores engagement analysis results per chapter."""

    __tablename__ = "engagement_scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False, index=True)
    word_count = Column(Integer, default=0)
    cool_point_count = Column(Integer, default=0)
    cool_point_density = Column(Float, default=0.0)
    cool_point_score = Column(Float, default=0.0)
    fulfillment_count = Column(Integer, default=0)
    fulfillment_score = Column(Float, default=0.0)
    predicted_retention = Column(Float, default=0.0)
    retention_factors_json = Column(Text, nullable=True)
    overall_engagement_score = Column(Float, default=0.0)
    pacing_analysis_json = Column(Text, nullable=True)
    suggestions_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chapter = relationship("Chapter")


class HookAnalysis(Base):
    """Stores hook detection results per chapter."""

    __tablename__ = "hook_analyses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False, index=True)
    total_hooks = Column(Integer, default=0)
    hooks_by_type_json = Column(Text, nullable=True)
    hooks_by_position_json = Column(Text, nullable=True)
    hooks_detail_json = Column(Text, nullable=True)
    opening_hook_strength = Column(Float, default=0.0)
    ending_hook_strength = Column(Float, default=0.0)
    overall_hook_score = Column(Float, default=0.0)
    suggestions_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chapter = relationship("Chapter")


# ============================================
# Strand & Pacing Analysis
# ============================================

class StrandAnalysis(Base):
    """Stores strand classification and pacing analysis per chapter."""

    __tablename__ = "strand_analyses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False, index=True)
    outline_id = Column(Integer, ForeignKey("outlines.id", ondelete="SET NULL"), nullable=True, index=True)
    quest_ratio = Column(Float, default=0.0)
    fire_ratio = Column(Float, default=0.0)
    constellation_ratio = Column(Float, default=0.0)
    dominant_strand = Column(String(32), default="quest", index=True)
    confidence = Column(Float, default=0.0)
    method = Column(String(32), default="heuristic")
    keywords_found_json = Column(Text, nullable=True)
    red_line_violations_json = Column(Text, nullable=True)
    health_score = Column(Integer, default=100)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chapter = relationship("Chapter")
    outline = relationship("Outline")


class PacingRedLineLog(Base):
    """Logs red line violations detected by pacing analyzer."""

    __tablename__ = "pacing_red_line_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    outline_id = Column(Integer, ForeignKey("outlines.id", ondelete="CASCADE"), nullable=False, index=True)
    strand = Column(String(32), nullable=False, index=True)
    violation_type = Column(String(32), nullable=False)  # continuous | gap
    chapters_affected_json = Column(Text, nullable=True)
    severity = Column(String(16), default="warning", index=True)  # warning | critical
    message = Column(Text, nullable=False)
    suggestion = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    outline = relationship("Outline")


# ============================================
# Genre & Writing Guidance
# ============================================

class GenreProfile(Base):
    """Stores genre profile templates and project-specific genre settings."""

    __tablename__ = "genre_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    genre_name = Column(String(100), nullable=False, index=True)
    profile_key = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    core_tropes_json = Column(Text, nullable=True)
    narrative_rhythm_json = Column(Text, nullable=True)
    terminology_hints_json = Column(Text, nullable=True)
    character_archetypes_json = Column(Text, nullable=True)
    world_building_focus_json = Column(Text, nullable=True)
    pressure_source = Column(String(255), nullable=True)
    release_target = Column(String(255), nullable=True)
    guidance_text = Column(Text, nullable=True)
    composite_hints_json = Column(Text, nullable=True)
    is_preset = Column(Integer, default=0, index=True)  # 1 = built-in preset, 0 = project-specific
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WritingGuidanceRecord(Base):
    """Stores generated writing guidance per chapter."""

    __tablename__ = "writing_guidance_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False, index=True)
    strategy_card_json = Column(Text, nullable=True)
    guidance_items_json = Column(Text, nullable=True)
    methodology_items_json = Column(Text, nullable=True)
    checklist_json = Column(Text, nullable=True)
    checklist_completed = Column(Integer, default=0)
    checklist_total = Column(Integer, default=0)
    checklist_percentage = Column(Float, default=0.0)
    risk_flags_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chapter = relationship("Chapter")


# ============================================
# Snapshot & Backup
# ============================================

class SnapshotRecord(Base):
    """Metadata for project snapshots (references JSON files on disk)."""

    __tablename__ = "snapshot_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    snapshot_id = Column(String(64), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    triggered_by = Column(String(32), default="manual", index=True)  # manual | scheduled | event | export | import
    version = Column(String(16), default="1.0")
    file_path = Column(String(512), nullable=True)
    size_bytes = Column(Integer, default=0)
    entities_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class BackupScheduleRecord(Base):
    """Persistent backup schedule configuration."""

    __tablename__ = "backup_schedule_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    enabled = Column(Integer, default=1)
    interval_minutes = Column(Integer, default=30)
    max_snapshots = Column(Integer, default=20)
    backup_on_shutdown = Column(Integer, default=1)
    backup_on_chapter_save = Column(Integer, default=1)
    backup_on_settings_change = Column(Integer, default=0)
    last_backup_at = Column(DateTime, nullable=True)
    last_backup_id = Column(String(64), nullable=True)
    total_backups = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ArchiveRecord(Base):
    """Metadata for exported project archives."""

    __tablename__ = "archive_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=True)
    format = Column(String(16), default="zip")  # zip | tar.gz | tar.bz2
    size_bytes = Column(Integer, default=0)
    snapshot_id = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


# ============================================
# Index Debt & Quality Tracking
# ============================================

class IndexDebtRecord(Base):
    """Persistent storage for index debt tracking items."""

    __tablename__ = "index_debt_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    debt_type = Column(String(64), nullable=False, index=True)
    # chapter_reindex | entity_relink | orphan_entity | missing_relationship |
    # plot_thread_gap | inspection_stale | word_count_mismatch
    severity = Column(String(16), default="medium", index=True)  # low | medium | high | critical
    status = Column(String(16), default="pending", index=True)  # pending | in_progress | resolved | ignored
    entity_type = Column(String(32), nullable=True, index=True)  # chapter | character | item | plot_thread
    entity_id = Column(Integer, nullable=True, index=True)
    entity_name = Column(String(255), nullable=True)
    description = Column(Text, nullable=False)
    meta_json = Column(Text, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    ignore_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class QualityTrendPoint(Base):
    """Stores aggregated quality trend data points."""

    __tablename__ = "quality_trend_points"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False, index=True)
    inspection_id = Column(Integer, ForeignKey("ai_inspection_results.id", ondelete="CASCADE"), nullable=True, index=True)
    overall_score = Column(Float, nullable=True)
    dimension_scores_json = Column(Text, nullable=True)
    severity_counts_json = Column(Text, nullable=True)
    risk_flags_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    chapter = relationship("Chapter")


# ============================================
# Constraint Rules
# ============================================

class ConstraintRuleRecord(Base):
    """Persistent storage for writing constraint rules."""

    __tablename__ = "constraint_rule_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    rule_id = Column(String(128), nullable=False, index=True)
    law_type = Column(String(64), nullable=False, index=True)  # outline_law | setting_physics | invention_registration
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    pattern = Column(String(512), nullable=True)
    severity = Column(String(16), default="high", index=True)  # critical | high | medium | low | info
    status = Column(String(16), default="active", index=True)  # active | disabled | deprecated
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ConstraintViolationRecord(Base):
    """Stores constraint check violations."""

    __tablename__ = "constraint_violation_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_id = Column(String(128), nullable=False, index=True)
    law_type = Column(String(64), nullable=False, index=True)
    severity = Column(String(16), default="medium", index=True)
    message = Column(Text, nullable=False)
    evidence = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)
    suggestion = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    chapter = relationship("Chapter")


# ============================================
# Graph Relationships (Extended)
# ============================================

class GraphRelationship(Base):
    """Extended entity relationships beyond character relationships."""

    __tablename__ = "graph_relationships"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    source_type = Column(String(32), nullable=False, index=True)  # character | item | location | faction
    source_id = Column(Integer, nullable=False, index=True)
    target_type = Column(String(32), nullable=False, index=True)
    target_id = Column(Integer, nullable=False, index=True)
    relation_type = Column(String(64), nullable=False, index=True)  # ownership | faction_location | alliance | enmity | etc.
    label = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    properties_json = Column(Text, nullable=True)
    directed = Column(Integer, default=1)
    weight = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================
# Observability & Metrics
# ============================================

class SystemMetricPoint(Base):
    """Stores system metric snapshots over time."""

    __tablename__ = "system_metric_points"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    metric_type = Column(String(64), nullable=False, index=True)  # ai_call | db_query | ws_connection | request
    metric_name = Column(String(128), nullable=False, index=True)
    value = Column(Float, default=0.0)
    unit = Column(String(32), nullable=True)  # ms | count | bytes | percent
    tags_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class NarrativeDebtRecord(Base):
    """Persistent storage for narrative debt tracker items."""

    __tablename__ = "narrative_debt_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    debt_type = Column(String(64), nullable=False, index=True)  # plot_promise | character_arc | mystery | foreshadowing | relationship | world_building
    status = Column(String(16), default="active", index=True)  # active | fulfilled | overdue | abandoned
    priority = Column(String(16), default="medium", index=True)  # critical | high | medium | low
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True)
    expected_chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True)
    resolved_chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True)
    keywords_json = Column(Text, nullable=True)
    related_character_ids_json = Column(Text, nullable=True)
    overdue_chapters = Column(Integer, default=0)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================
# Indexes for frequently queried columns
# ============================================

# Composite indexes defined via __table_args__ where beneficial
# The individual column indexes are defined inline above.
