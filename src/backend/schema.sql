-- Auto Novel Writer Database Schema
-- SQLite compatible
-- Generated from SQLAlchemy models in core/domain/entities.py and core/domain/extensions.py

PRAGMA foreign_keys = ON;

-- ============================================
-- Project & Genre Configuration
-- ============================================

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    genre TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS genre_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    genre TEXT NOT NULL UNIQUE,
    config_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Background Tasks
-- ============================================

CREATE TABLE IF NOT EXISTS background_tasks (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payload TEXT,
    result TEXT,
    error TEXT,
    retries INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Workflow Execution Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS workflow_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    results_json TEXT,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS agent_execution_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_execution_id INTEGER NOT NULL,
    agent_name TEXT NOT NULL,
    stage_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    result_json TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (workflow_execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_workflow ON agent_execution_logs(workflow_execution_id);

-- ============================================
-- Characters & Relationships
-- ============================================

CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    name TEXT NOT NULL,
    gender TEXT,
    personality TEXT,
    desires TEXT,
    flaws TEXT,
    description TEXT,
    tier TEXT,
    cultivation_realm TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id);
CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name);
CREATE INDEX IF NOT EXISTS idx_characters_tier_realm ON characters(tier, cultivation_realm);

CREATE TABLE IF NOT EXISTS character_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    character_id INTEGER NOT NULL,
    target_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_character_relationships_project ON character_relationships(project_id);
CREATE INDEX IF NOT EXISTS idx_character_relationships_character ON character_relationships(character_id);
CREATE INDEX IF NOT EXISTS idx_character_relationships_target ON character_relationships(target_id);

CREATE TABLE IF NOT EXISTS character_storylines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    character_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    arc TEXT,
    progress INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_character_storylines_project ON character_storylines(project_id);
CREATE INDEX IF NOT EXISTS idx_character_storylines_character ON character_storylines(character_id);

-- ============================================
-- World Entities
-- ============================================

CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    owner TEXT,
    location TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_items_project ON items(project_id);
CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner);
CREATE INDEX IF NOT EXISTS idx_items_location ON items(location);

CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    importance TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_locations_project ON locations(project_id);
CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name);
CREATE INDEX IF NOT EXISTS idx_locations_importance ON locations(importance);

CREATE TABLE IF NOT EXISTS factions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_factions_project ON factions(project_id);
CREATE INDEX IF NOT EXISTS idx_factions_name ON factions(name);
CREATE INDEX IF NOT EXISTS idx_factions_type ON factions(type);

CREATE TABLE IF NOT EXISTS world_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    details_json TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_world_settings_project ON world_settings(project_id);
CREATE INDEX IF NOT EXISTS idx_world_settings_name ON world_settings(name);

CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rules_project ON rules(project_id);
CREATE INDEX IF NOT EXISTS idx_rules_name ON rules(name);
CREATE INDEX IF NOT EXISTS idx_rules_type ON rules(type);

-- ============================================
-- Story Structure
-- ============================================

CREATE TABLE IF NOT EXISTS outlines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_outlines_project ON outlines(project_id);
CREATE INDEX IF NOT EXISTS idx_outlines_title ON outlines(title);

CREATE TABLE IF NOT EXISTS chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    outline_id INTEGER,
    title TEXT,
    summary TEXT,
    status TEXT DEFAULT 'pending',
    word_count INTEGER DEFAULT 0,
    chapter_order INTEGER DEFAULT 0,
    content_storage_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (outline_id) REFERENCES outlines(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(project_id);
CREATE INDEX IF NOT EXISTS idx_chapters_outline ON chapters(outline_id);
CREATE INDEX IF NOT EXISTS idx_chapters_status_order ON chapters(status, chapter_order);
CREATE INDEX IF NOT EXISTS idx_chapters_updated_at ON chapters(updated_at DESC);

CREATE TABLE IF NOT EXISTS if_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    title TEXT NOT NULL,
    linked_character_id INTEGER,
    description TEXT,
    sync_mode TEXT DEFAULT 'auto',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (linked_character_id) REFERENCES characters(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_if_lines_project ON if_lines(project_id);
CREATE INDEX IF NOT EXISTS idx_if_lines_character ON if_lines(linked_character_id);
CREATE INDEX IF NOT EXISTS idx_if_lines_character_sync ON if_lines(linked_character_id, sync_mode);

-- ============================================
-- Chat / Conversation (Interface 1)
-- ============================================

CREATE TABLE IF NOT EXISTS chat_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_project ON chat_sessions(project_id);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    session_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_project ON chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS extracted_entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    session_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    confirmed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_extracted_entities_project ON extracted_entities(project_id);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_session ON extracted_entities(session_id);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_session_type ON extracted_entities(session_id, type);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_confirmed ON extracted_entities(confirmed);

-- ============================================
-- Writing & Versioning (Interface 3)
-- ============================================

CREATE TABLE IF NOT EXISTS draft_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    chapter_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_storage_id TEXT,
    version_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_draft_versions_project ON draft_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_draft_versions_chapter ON draft_versions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_draft_versions_chapter_version ON draft_versions(chapter_id, version_number DESC);

CREATE TABLE IF NOT EXISTS plot_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_chapter_id INTEGER,
    reveal_chapter_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
    FOREIGN KEY (reveal_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_plot_threads_project ON plot_threads(project_id);
CREATE INDEX IF NOT EXISTS idx_plot_threads_status ON plot_threads(status);
CREATE INDEX IF NOT EXISTS idx_plot_threads_created_chapter ON plot_threads(created_chapter_id);
CREATE INDEX IF NOT EXISTS idx_plot_threads_reveal_chapter ON plot_threads(reveal_chapter_id);
CREATE INDEX IF NOT EXISTS idx_plot_threads_status_created ON plot_threads(status, created_chapter_id);

CREATE TABLE IF NOT EXISTS ai_inspection_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    chapter_id INTEGER NOT NULL,
    inspection_type TEXT NOT NULL,
    issues_json TEXT,
    suggestions_json TEXT,
    auto_fixed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_inspection_project ON ai_inspection_results(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_inspection_chapter ON ai_inspection_results(chapter_id);
CREATE INDEX IF NOT EXISTS idx_ai_inspection_chapter_type ON ai_inspection_results(chapter_id, inspection_type);

CREATE TABLE IF NOT EXISTS writing_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    human_ai_ratio REAL DEFAULT 0.5,
    writing_style TEXT DEFAULT 'default',
    target_word_count INTEGER DEFAULT 3000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_writing_settings_project ON writing_settings(project_id);
CREATE INDEX IF NOT EXISTS idx_writing_settings_updated ON writing_settings(updated_at DESC);

-- Insert default writing settings (global, no project_id)
INSERT INTO writing_settings (human_ai_ratio, writing_style, target_word_count) VALUES (0.5, 'default', 3000);

-- ============================================
-- RAG Context & Chunk Storage
-- ============================================

CREATE TABLE IF NOT EXISTS context_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chunk_id TEXT NOT NULL UNIQUE,
    chapter_id INTEGER NOT NULL,
    scene_index INTEGER DEFAULT 0,
    content TEXT NOT NULL,
    chunk_type TEXT DEFAULT 'scene',
    parent_chunk_id TEXT,
    source_file TEXT,
    metadata_json TEXT,
    embedding_blob TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_context_chunks_chunk_id ON context_chunks(chunk_id);
CREATE INDEX IF NOT EXISTS idx_context_chunks_chapter ON context_chunks(chapter_id);
CREATE INDEX IF NOT EXISTS idx_context_chunks_type ON context_chunks(chunk_type);
CREATE INDEX IF NOT EXISTS idx_context_chunks_parent ON context_chunks(parent_chunk_id);

CREATE TABLE IF NOT EXISTS query_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    query_type TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    hit_sources_json TEXT,
    latency_ms INTEGER DEFAULT 0,
    chapter_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_query_logs_type ON query_logs(query_type);
CREATE INDEX IF NOT EXISTS idx_query_logs_chapter ON query_logs(chapter_id);
CREATE INDEX IF NOT EXISTS idx_query_logs_created ON query_logs(created_at);

-- ============================================
-- Engagement & Hook Analysis
-- ============================================

CREATE TABLE IF NOT EXISTS engagement_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    chapter_id INTEGER NOT NULL,
    word_count INTEGER DEFAULT 0,
    cool_point_count INTEGER DEFAULT 0,
    cool_point_density REAL DEFAULT 0.0,
    cool_point_score REAL DEFAULT 0.0,
    fulfillment_count INTEGER DEFAULT 0,
    fulfillment_score REAL DEFAULT 0.0,
    predicted_retention REAL DEFAULT 0.0,
    retention_factors_json TEXT,
    overall_engagement_score REAL DEFAULT 0.0,
    pacing_analysis_json TEXT,
    suggestions_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_engagement_project ON engagement_scores(project_id);
CREATE INDEX IF NOT EXISTS idx_engagement_chapter ON engagement_scores(chapter_id);

CREATE TABLE IF NOT EXISTS hook_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    chapter_id INTEGER NOT NULL,
    total_hooks INTEGER DEFAULT 0,
    hooks_by_type_json TEXT,
    hooks_by_position_json TEXT,
    hooks_detail_json TEXT,
    opening_hook_strength REAL DEFAULT 0.0,
    ending_hook_strength REAL DEFAULT 0.0,
    overall_hook_score REAL DEFAULT 0.0,
    suggestions_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hook_analysis_project ON hook_analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_hook_analysis_chapter ON hook_analyses(chapter_id);

-- ============================================
-- Strand & Pacing Analysis
-- ============================================

CREATE TABLE IF NOT EXISTS strand_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    chapter_id INTEGER NOT NULL,
    outline_id INTEGER,
    quest_ratio REAL DEFAULT 0.0,
    fire_ratio REAL DEFAULT 0.0,
    constellation_ratio REAL DEFAULT 0.0,
    dominant_strand TEXT DEFAULT 'quest',
    confidence REAL DEFAULT 0.0,
    method TEXT DEFAULT 'heuristic',
    keywords_found_json TEXT,
    red_line_violations_json TEXT,
    health_score INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    FOREIGN KEY (outline_id) REFERENCES outlines(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_strand_analysis_project ON strand_analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_strand_analysis_chapter ON strand_analyses(chapter_id);
CREATE INDEX IF NOT EXISTS idx_strand_analysis_outline ON strand_analyses(outline_id);
CREATE INDEX IF NOT EXISTS idx_strand_analysis_dominant ON strand_analyses(dominant_strand);

CREATE TABLE IF NOT EXISTS pacing_red_line_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    outline_id INTEGER NOT NULL,
    strand TEXT NOT NULL,
    violation_type TEXT NOT NULL,
    chapters_affected_json TEXT,
    severity TEXT DEFAULT 'warning',
    message TEXT NOT NULL,
    suggestion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (outline_id) REFERENCES outlines(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pacing_red_line_project ON pacing_red_line_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_pacing_red_line_outline ON pacing_red_line_logs(outline_id);
CREATE INDEX IF NOT EXISTS idx_pacing_red_line_strand ON pacing_red_line_logs(strand);
CREATE INDEX IF NOT EXISTS idx_pacing_red_line_severity ON pacing_red_line_logs(severity);
CREATE INDEX IF NOT EXISTS idx_pacing_red_line_created ON pacing_red_line_logs(created_at);

-- ============================================
-- Genre & Writing Guidance
-- ============================================

CREATE TABLE IF NOT EXISTS genre_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    genre_name TEXT NOT NULL,
    profile_key TEXT NOT NULL,
    description TEXT,
    core_tropes_json TEXT,
    narrative_rhythm_json TEXT,
    terminology_hints_json TEXT,
    character_archetypes_json TEXT,
    world_building_focus_json TEXT,
    pressure_source TEXT,
    release_target TEXT,
    guidance_text TEXT,
    composite_hints_json TEXT,
    is_preset INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_genre_profiles_project ON genre_profiles(project_id);
CREATE INDEX IF NOT EXISTS idx_genre_profiles_genre ON genre_profiles(genre_name);
CREATE INDEX IF NOT EXISTS idx_genre_profiles_key ON genre_profiles(profile_key);
CREATE INDEX IF NOT EXISTS idx_genre_profiles_preset ON genre_profiles(is_preset);

CREATE TABLE IF NOT EXISTS writing_guidance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    chapter_id INTEGER NOT NULL,
    strategy_card_json TEXT,
    guidance_items_json TEXT,
    methodology_items_json TEXT,
    checklist_json TEXT,
    checklist_completed INTEGER DEFAULT 0,
    checklist_total INTEGER DEFAULT 0,
    checklist_percentage REAL DEFAULT 0.0,
    risk_flags_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_writing_guidance_project ON writing_guidance_records(project_id);
CREATE INDEX IF NOT EXISTS idx_writing_guidance_chapter ON writing_guidance_records(chapter_id);

-- ============================================
-- Snapshot & Backup
-- ============================================

CREATE TABLE IF NOT EXISTS snapshot_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    snapshot_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    triggered_by TEXT DEFAULT 'manual',
    version TEXT DEFAULT '1.0',
    file_path TEXT,
    size_bytes INTEGER DEFAULT 0,
    entities_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshots_project ON snapshot_records(project_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_snapshot_id ON snapshot_records(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_triggered ON snapshot_records(triggered_by);
CREATE INDEX IF NOT EXISTS idx_snapshots_created ON snapshot_records(created_at);

CREATE TABLE IF NOT EXISTS backup_schedule_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    enabled INTEGER DEFAULT 1,
    interval_minutes INTEGER DEFAULT 30,
    max_snapshots INTEGER DEFAULT 20,
    backup_on_shutdown INTEGER DEFAULT 1,
    backup_on_chapter_save INTEGER DEFAULT 1,
    backup_on_settings_change INTEGER DEFAULT 0,
    last_backup_at TIMESTAMP,
    last_backup_id TEXT,
    total_backups INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_backup_schedule_project ON backup_schedule_records(project_id);

CREATE TABLE IF NOT EXISTS archive_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    filename TEXT NOT NULL,
    file_path TEXT,
    format TEXT DEFAULT 'zip',
    size_bytes INTEGER DEFAULT 0,
    snapshot_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_archives_project ON archive_records(project_id);
CREATE INDEX IF NOT EXISTS idx_archives_snapshot ON archive_records(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_archives_created ON archive_records(created_at);

-- ============================================
-- Index Debt & Quality Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS index_debt_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    debt_type TEXT NOT NULL,
    severity TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    entity_type TEXT,
    entity_id INTEGER,
    entity_name TEXT,
    description TEXT NOT NULL,
    meta_json TEXT,
    resolved_at TIMESTAMP,
    ignore_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_index_debt_project ON index_debt_records(project_id);
CREATE INDEX IF NOT EXISTS idx_index_debt_type ON index_debt_records(debt_type);
CREATE INDEX IF NOT EXISTS idx_index_debt_severity ON index_debt_records(severity);
CREATE INDEX IF NOT EXISTS idx_index_debt_status ON index_debt_records(status);
CREATE INDEX IF NOT EXISTS idx_index_debt_entity_type ON index_debt_records(entity_type);
CREATE INDEX IF NOT EXISTS idx_index_debt_entity_id ON index_debt_records(entity_id);
CREATE INDEX IF NOT EXISTS idx_index_debt_created ON index_debt_records(created_at);

CREATE TABLE IF NOT EXISTS quality_trend_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    chapter_id INTEGER NOT NULL,
    inspection_id INTEGER,
    overall_score REAL,
    dimension_scores_json TEXT,
    severity_counts_json TEXT,
    risk_flags_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    FOREIGN KEY (inspection_id) REFERENCES ai_inspection_results(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_quality_trend_project ON quality_trend_points(project_id);
CREATE INDEX IF NOT EXISTS idx_quality_trend_chapter ON quality_trend_points(chapter_id);
CREATE INDEX IF NOT EXISTS idx_quality_trend_inspection ON quality_trend_points(inspection_id);
CREATE INDEX IF NOT EXISTS idx_quality_trend_created ON quality_trend_points(created_at);

-- ============================================
-- Constraint Rules
-- ============================================

CREATE TABLE IF NOT EXISTS constraint_rule_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    rule_id TEXT NOT NULL,
    law_type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    pattern TEXT,
    severity TEXT DEFAULT 'high',
    status TEXT DEFAULT 'active',
    metadata_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_constraint_rules_project ON constraint_rule_records(project_id);
CREATE INDEX IF NOT EXISTS idx_constraint_rules_rule_id ON constraint_rule_records(rule_id);
CREATE INDEX IF NOT EXISTS idx_constraint_rules_law_type ON constraint_rule_records(law_type);
CREATE INDEX IF NOT EXISTS idx_constraint_rules_severity ON constraint_rule_records(severity);
CREATE INDEX IF NOT EXISTS idx_constraint_rules_status ON constraint_rule_records(status);

CREATE TABLE IF NOT EXISTS constraint_violation_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    chapter_id INTEGER NOT NULL,
    rule_id TEXT NOT NULL,
    law_type TEXT NOT NULL,
    severity TEXT DEFAULT 'medium',
    message TEXT NOT NULL,
    evidence TEXT,
    location TEXT,
    suggestion TEXT,
    metadata_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_constraint_violations_project ON constraint_violation_records(project_id);
CREATE INDEX IF NOT EXISTS idx_constraint_violations_chapter ON constraint_violation_records(chapter_id);
CREATE INDEX IF NOT EXISTS idx_constraint_violations_rule ON constraint_violation_records(rule_id);
CREATE INDEX IF NOT EXISTS idx_constraint_violations_law_type ON constraint_violation_records(law_type);
CREATE INDEX IF NOT EXISTS idx_constraint_violations_severity ON constraint_violation_records(severity);
CREATE INDEX IF NOT EXISTS idx_constraint_violations_created ON constraint_violation_records(created_at);

-- ============================================
-- Graph Relationships (Extended)
-- ============================================

CREATE TABLE IF NOT EXISTS graph_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    source_type TEXT NOT NULL,
    source_id INTEGER NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    relation_type TEXT NOT NULL,
    label TEXT,
    description TEXT,
    properties_json TEXT,
    directed INTEGER DEFAULT 1,
    weight REAL DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_graph_rel_project ON graph_relationships(project_id);
CREATE INDEX IF NOT EXISTS idx_graph_rel_source ON graph_relationships(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_graph_rel_target ON graph_relationships(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_graph_rel_type ON graph_relationships(relation_type);

-- ============================================
-- Observability & Metrics
-- ============================================

CREATE TABLE IF NOT EXISTS system_metric_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    metric_type TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    value REAL DEFAULT 0.0,
    unit TEXT,
    tags_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_system_metrics_project ON system_metric_points(project_id);
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metric_points(metric_type);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metric_points(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_created ON system_metric_points(created_at);

CREATE TABLE IF NOT EXISTS narrative_debt_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    debt_type TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    priority TEXT DEFAULT 'medium',
    title TEXT NOT NULL,
    description TEXT,
    created_chapter_id INTEGER,
    expected_chapter_id INTEGER,
    resolved_chapter_id INTEGER,
    keywords_json TEXT,
    related_character_ids_json TEXT,
    overdue_chapters INTEGER DEFAULT 0,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
    FOREIGN KEY (expected_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_narrative_debt_project ON narrative_debt_records(project_id);
CREATE INDEX IF NOT EXISTS idx_narrative_debt_type ON narrative_debt_records(debt_type);
CREATE INDEX IF NOT EXISTS idx_narrative_debt_status ON narrative_debt_records(status);
CREATE INDEX IF NOT EXISTS idx_narrative_debt_priority ON narrative_debt_records(priority);
