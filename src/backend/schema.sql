CREATE TABLE projects (
	id INTEGER NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	description TEXT, 
	genre VARCHAR(100), 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id)
);
CREATE TABLE genre_configurations (
	id INTEGER NOT NULL, 
	genre VARCHAR(100) NOT NULL, 
	config_json TEXT NOT NULL, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	UNIQUE (genre)
);
CREATE TABLE background_tasks (
	id VARCHAR NOT NULL, 
	type VARCHAR NOT NULL, 
	status VARCHAR NOT NULL, 
	payload TEXT, 
	result TEXT, 
	error TEXT, 
	retries INTEGER, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id)
);
CREATE TABLE workflow_executions (
	id INTEGER NOT NULL, 
	workflow_name VARCHAR NOT NULL, 
	status VARCHAR, 
	started_at DATETIME, 
	completed_at DATETIME, 
	results_json TEXT, 
	error_message TEXT, 
	PRIMARY KEY (id)
);
CREATE TABLE characters (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	name VARCHAR NOT NULL, 
	gender VARCHAR, 
	personality TEXT, 
	desires TEXT, 
	flaws TEXT, 
	description TEXT, 
	tier VARCHAR, 
	cultivation_realm VARCHAR, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id)
);
CREATE INDEX ix_characters_project_id ON characters (project_id);
CREATE TABLE items (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	name VARCHAR NOT NULL, 
	description TEXT, 
	owner VARCHAR, 
	location VARCHAR, 
	tags TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id)
);
CREATE INDEX ix_items_project_id ON items (project_id);
CREATE TABLE locations (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	name VARCHAR NOT NULL, 
	description TEXT, 
	importance VARCHAR, 
	tags TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id)
);
CREATE INDEX ix_locations_project_id ON locations (project_id);
CREATE TABLE factions (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	name VARCHAR NOT NULL, 
	description TEXT, 
	type VARCHAR, 
	tags TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id)
);
CREATE INDEX ix_factions_project_id ON factions (project_id);
CREATE TABLE world_settings (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	name VARCHAR NOT NULL, 
	description TEXT, 
	details_json TEXT, 
	tags TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id)
);
CREATE INDEX ix_world_settings_project_id ON world_settings (project_id);
CREATE TABLE rules (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	name VARCHAR NOT NULL, 
	description TEXT, 
	type VARCHAR, 
	tags TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id)
);
CREATE INDEX ix_rules_project_id ON rules (project_id);
CREATE TABLE outlines (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	title VARCHAR NOT NULL, 
	description TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id)
);
CREATE INDEX ix_outlines_project_id ON outlines (project_id);
CREATE TABLE chat_sessions (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	title VARCHAR(255), 
	status VARCHAR(50), 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id)
);
CREATE INDEX ix_chat_sessions_project_id ON chat_sessions (project_id);
CREATE TABLE writing_settings (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	human_ai_ratio FLOAT, 
	writing_style VARCHAR, 
	target_word_count INTEGER, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id)
);
CREATE INDEX ix_writing_settings_project_id ON writing_settings (project_id);
CREATE TABLE agent_execution_logs (
	id INTEGER NOT NULL, 
	workflow_execution_id INTEGER NOT NULL, 
	agent_name VARCHAR NOT NULL, 
	stage_name VARCHAR NOT NULL, 
	status VARCHAR, 
	result_json TEXT, 
	started_at DATETIME, 
	completed_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(workflow_execution_id) REFERENCES workflow_executions (id) ON DELETE CASCADE
);
CREATE TABLE genre_profiles (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	genre_name VARCHAR(100) NOT NULL, 
	profile_key VARCHAR(100) NOT NULL, 
	description TEXT, 
	core_tropes_json TEXT, 
	narrative_rhythm_json TEXT, 
	terminology_hints_json TEXT, 
	character_archetypes_json TEXT, 
	world_building_focus_json TEXT, 
	pressure_source VARCHAR(255), 
	release_target VARCHAR(255), 
	guidance_text TEXT, 
	composite_hints_json TEXT, 
	is_preset INTEGER, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX ix_genre_profiles_project_id ON genre_profiles (project_id);
CREATE INDEX ix_genre_profiles_is_preset ON genre_profiles (is_preset);
CREATE INDEX ix_genre_profiles_profile_key ON genre_profiles (profile_key);
CREATE INDEX ix_genre_profiles_genre_name ON genre_profiles (genre_name);
CREATE TABLE snapshot_records (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	snapshot_id VARCHAR(64) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	description TEXT, 
	triggered_by VARCHAR(32), 
	version VARCHAR(16), 
	file_path VARCHAR(512), 
	size_bytes INTEGER, 
	entities_count INTEGER, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX ix_snapshot_records_created_at ON snapshot_records (created_at);
CREATE INDEX ix_snapshot_records_triggered_by ON snapshot_records (triggered_by);
CREATE INDEX ix_snapshot_records_project_id ON snapshot_records (project_id);
CREATE UNIQUE INDEX ix_snapshot_records_snapshot_id ON snapshot_records (snapshot_id);
CREATE TABLE backup_schedule_records (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	enabled INTEGER, 
	interval_minutes INTEGER, 
	max_snapshots INTEGER, 
	backup_on_shutdown INTEGER, 
	backup_on_chapter_save INTEGER, 
	backup_on_settings_change INTEGER, 
	last_backup_at DATETIME, 
	last_backup_id VARCHAR(64), 
	total_backups INTEGER, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX ix_backup_schedule_records_project_id ON backup_schedule_records (project_id);
CREATE TABLE archive_records (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	filename VARCHAR(255) NOT NULL, 
	file_path VARCHAR(512), 
	format VARCHAR(16), 
	size_bytes INTEGER, 
	snapshot_id VARCHAR(64), 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX ix_archive_records_project_id ON archive_records (project_id);
CREATE INDEX ix_archive_records_created_at ON archive_records (created_at);
CREATE INDEX ix_archive_records_snapshot_id ON archive_records (snapshot_id);
CREATE TABLE index_debt_records (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	debt_type VARCHAR(64) NOT NULL, 
	severity VARCHAR(16), 
	status VARCHAR(16), 
	entity_type VARCHAR(32), 
	entity_id INTEGER, 
	entity_name VARCHAR(255), 
	description TEXT NOT NULL, 
	meta_json TEXT, 
	resolved_at DATETIME, 
	ignore_reason TEXT, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX ix_index_debt_records_created_at ON index_debt_records (created_at);
CREATE INDEX ix_index_debt_records_debt_type ON index_debt_records (debt_type);
CREATE INDEX ix_index_debt_records_severity ON index_debt_records (severity);
CREATE INDEX ix_index_debt_records_project_id ON index_debt_records (project_id);
CREATE INDEX ix_index_debt_records_entity_id ON index_debt_records (entity_id);
CREATE INDEX ix_index_debt_records_status ON index_debt_records (status);
CREATE INDEX ix_index_debt_records_entity_type ON index_debt_records (entity_type);
CREATE TABLE constraint_rule_records (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	rule_id VARCHAR(128) NOT NULL, 
	law_type VARCHAR(64) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	pattern VARCHAR(512), 
	severity VARCHAR(16), 
	status VARCHAR(16), 
	metadata_json TEXT, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX ix_constraint_rule_records_rule_id ON constraint_rule_records (rule_id);
CREATE INDEX ix_constraint_rule_records_severity ON constraint_rule_records (severity);
CREATE INDEX ix_constraint_rule_records_project_id ON constraint_rule_records (project_id);
CREATE INDEX ix_constraint_rule_records_law_type ON constraint_rule_records (law_type);
CREATE INDEX ix_constraint_rule_records_status ON constraint_rule_records (status);
CREATE TABLE graph_relationships (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	source_type VARCHAR(32) NOT NULL, 
	source_id INTEGER NOT NULL, 
	target_type VARCHAR(32) NOT NULL, 
	target_id INTEGER NOT NULL, 
	relation_type VARCHAR(64) NOT NULL, 
	label VARCHAR(255), 
	description TEXT, 
	properties_json TEXT, 
	directed INTEGER, 
	weight FLOAT, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX ix_graph_relationships_source_id ON graph_relationships (source_id);
CREATE INDEX ix_graph_relationships_relation_type ON graph_relationships (relation_type);
CREATE INDEX ix_graph_relationships_target_type ON graph_relationships (target_type);
CREATE INDEX ix_graph_relationships_source_type ON graph_relationships (source_type);
CREATE INDEX ix_graph_relationships_target_id ON graph_relationships (target_id);
CREATE INDEX ix_graph_relationships_project_id ON graph_relationships (project_id);
CREATE TABLE system_metric_points (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	metric_type VARCHAR(64) NOT NULL, 
	metric_name VARCHAR(128) NOT NULL, 
	value FLOAT, 
	unit VARCHAR(32), 
	tags_json TEXT, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX ix_system_metric_points_metric_type ON system_metric_points (metric_type);
CREATE INDEX ix_system_metric_points_created_at ON system_metric_points (created_at);
CREATE INDEX ix_system_metric_points_metric_name ON system_metric_points (metric_name);
CREATE INDEX ix_system_metric_points_project_id ON system_metric_points (project_id);
CREATE TABLE character_relationships (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	character_id INTEGER NOT NULL, 
	target_id INTEGER NOT NULL, 
	type VARCHAR NOT NULL, 
	description TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id), 
	FOREIGN KEY(character_id) REFERENCES characters (id) ON DELETE CASCADE, 
	FOREIGN KEY(target_id) REFERENCES characters (id) ON DELETE CASCADE
);
CREATE INDEX ix_character_relationships_project_id ON character_relationships (project_id);
CREATE TABLE character_storylines (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	character_id INTEGER NOT NULL, 
	title VARCHAR NOT NULL, 
	arc TEXT, 
	progress INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id), 
	FOREIGN KEY(character_id) REFERENCES characters (id) ON DELETE CASCADE
);
CREATE INDEX ix_character_storylines_project_id ON character_storylines (project_id);
CREATE TABLE chapters (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	outline_id INTEGER, 
	title VARCHAR, 
	summary TEXT, 
	status VARCHAR, 
	word_count INTEGER, 
	chapter_order INTEGER, 
	content_storage_id VARCHAR(64), 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id), 
	FOREIGN KEY(outline_id) REFERENCES outlines (id) ON DELETE SET NULL
);
CREATE INDEX ix_chapters_project_id ON chapters (project_id);
CREATE TABLE if_lines (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	title VARCHAR NOT NULL, 
	linked_character_id INTEGER, 
	description TEXT, 
	sync_mode VARCHAR, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id), 
	FOREIGN KEY(linked_character_id) REFERENCES characters (id) ON DELETE SET NULL
);
CREATE INDEX ix_if_lines_project_id ON if_lines (project_id);
CREATE TABLE chat_messages (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	session_id INTEGER NOT NULL, 
	role VARCHAR NOT NULL, 
	content TEXT NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id), 
	FOREIGN KEY(session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
);
CREATE INDEX ix_chat_messages_project_id ON chat_messages (project_id);
CREATE TABLE extracted_entities (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	session_id INTEGER NOT NULL, 
	type VARCHAR NOT NULL, 
	name VARCHAR NOT NULL, 
	description TEXT, 
	confirmed INTEGER, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id), 
	FOREIGN KEY(session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
);
CREATE INDEX ix_extracted_entities_project_id ON extracted_entities (project_id);
CREATE TABLE pacing_red_line_logs (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	outline_id INTEGER NOT NULL, 
	strand VARCHAR(32) NOT NULL, 
	violation_type VARCHAR(32) NOT NULL, 
	chapters_affected_json TEXT, 
	severity VARCHAR(16), 
	message TEXT NOT NULL, 
	suggestion TEXT, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	FOREIGN KEY(outline_id) REFERENCES outlines (id) ON DELETE CASCADE
);
CREATE INDEX ix_pacing_red_line_logs_project_id ON pacing_red_line_logs (project_id);
CREATE INDEX ix_pacing_red_line_logs_strand ON pacing_red_line_logs (strand);
CREATE INDEX ix_pacing_red_line_logs_created_at ON pacing_red_line_logs (created_at);
CREATE INDEX ix_pacing_red_line_logs_outline_id ON pacing_red_line_logs (outline_id);
CREATE INDEX ix_pacing_red_line_logs_severity ON pacing_red_line_logs (severity);
CREATE TABLE draft_versions (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	chapter_id INTEGER NOT NULL, 
	content TEXT NOT NULL, 
	content_storage_id VARCHAR(64), 
	version_number INTEGER NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id), 
	FOREIGN KEY(chapter_id) REFERENCES chapters (id) ON DELETE CASCADE
);
CREATE INDEX ix_draft_versions_project_id ON draft_versions (project_id);
CREATE TABLE plot_threads (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	title VARCHAR NOT NULL, 
	description TEXT, 
	status VARCHAR, 
	created_chapter_id INTEGER, 
	reveal_chapter_id INTEGER, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id), 
	FOREIGN KEY(created_chapter_id) REFERENCES chapters (id) ON DELETE SET NULL, 
	FOREIGN KEY(reveal_chapter_id) REFERENCES chapters (id) ON DELETE SET NULL
);
CREATE INDEX ix_plot_threads_project_id ON plot_threads (project_id);
CREATE TABLE ai_inspection_results (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	chapter_id INTEGER NOT NULL, 
	inspection_type VARCHAR NOT NULL, 
	issues_json TEXT, 
	suggestions_json TEXT, 
	auto_fixed INTEGER, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id), 
	FOREIGN KEY(chapter_id) REFERENCES chapters (id) ON DELETE CASCADE
);
CREATE INDEX ix_ai_inspection_results_project_id ON ai_inspection_results (project_id);
CREATE TABLE context_chunks (
	id INTEGER NOT NULL, 
	chunk_id VARCHAR(64) NOT NULL, 
	chapter_id INTEGER NOT NULL, 
	scene_index INTEGER, 
	content TEXT NOT NULL, 
	chunk_type VARCHAR(32), 
	parent_chunk_id VARCHAR(64), 
	source_file VARCHAR(255), 
	metadata_json TEXT, 
	embedding_blob TEXT, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(chapter_id) REFERENCES chapters (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX ix_context_chunks_chunk_id ON context_chunks (chunk_id);
CREATE INDEX ix_context_chunks_parent_chunk_id ON context_chunks (parent_chunk_id);
CREATE INDEX ix_context_chunks_chapter_id ON context_chunks (chapter_id);
CREATE INDEX ix_context_chunks_chunk_type ON context_chunks (chunk_type);
CREATE TABLE query_logs (
	id INTEGER NOT NULL, 
	"query" TEXT NOT NULL, 
	query_type VARCHAR(32) NOT NULL, 
	results_count INTEGER, 
	hit_sources_json TEXT, 
	latency_ms INTEGER, 
	chapter_id INTEGER, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(chapter_id) REFERENCES chapters (id) ON DELETE SET NULL
);
CREATE INDEX ix_query_logs_chapter_id ON query_logs (chapter_id);
CREATE INDEX ix_query_logs_query_type ON query_logs (query_type);
CREATE INDEX ix_query_logs_created_at ON query_logs (created_at);
CREATE TABLE engagement_scores (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	chapter_id INTEGER NOT NULL, 
	word_count INTEGER, 
	cool_point_count INTEGER, 
	cool_point_density FLOAT, 
	cool_point_score FLOAT, 
	fulfillment_count INTEGER, 
	fulfillment_score FLOAT, 
	predicted_retention FLOAT, 
	retention_factors_json TEXT, 
	overall_engagement_score FLOAT, 
	pacing_analysis_json TEXT, 
	suggestions_json TEXT, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	FOREIGN KEY(chapter_id) REFERENCES chapters (id) ON DELETE CASCADE
);
CREATE INDEX ix_engagement_scores_project_id ON engagement_scores (project_id);
CREATE INDEX ix_engagement_scores_chapter_id ON engagement_scores (chapter_id);
CREATE TABLE hook_analyses (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	chapter_id INTEGER NOT NULL, 
	total_hooks INTEGER, 
	hooks_by_type_json TEXT, 
	hooks_by_position_json TEXT, 
	hooks_detail_json TEXT, 
	opening_hook_strength FLOAT, 
	ending_hook_strength FLOAT, 
	overall_hook_score FLOAT, 
	suggestions_json TEXT, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	FOREIGN KEY(chapter_id) REFERENCES chapters (id) ON DELETE CASCADE
);
CREATE INDEX ix_hook_analyses_project_id ON hook_analyses (project_id);
CREATE INDEX ix_hook_analyses_chapter_id ON hook_analyses (chapter_id);
CREATE TABLE strand_analyses (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	chapter_id INTEGER NOT NULL, 
	outline_id INTEGER, 
	quest_ratio FLOAT, 
	fire_ratio FLOAT, 
	constellation_ratio FLOAT, 
	dominant_strand VARCHAR(32), 
	confidence FLOAT, 
	method VARCHAR(32), 
	keywords_found_json TEXT, 
	red_line_violations_json TEXT, 
	health_score INTEGER, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	FOREIGN KEY(chapter_id) REFERENCES chapters (id) ON DELETE CASCADE, 
	FOREIGN KEY(outline_id) REFERENCES outlines (id) ON DELETE SET NULL
);
CREATE INDEX ix_strand_analyses_chapter_id ON strand_analyses (chapter_id);
CREATE INDEX ix_strand_analyses_outline_id ON strand_analyses (outline_id);
CREATE INDEX ix_strand_analyses_dominant_strand ON strand_analyses (dominant_strand);
CREATE INDEX ix_strand_analyses_project_id ON strand_analyses (project_id);
CREATE TABLE writing_guidance_records (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	chapter_id INTEGER NOT NULL, 
	strategy_card_json TEXT, 
	guidance_items_json TEXT, 
	methodology_items_json TEXT, 
	checklist_json TEXT, 
	checklist_completed INTEGER, 
	checklist_total INTEGER, 
	checklist_percentage FLOAT, 
	risk_flags_json TEXT, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	FOREIGN KEY(chapter_id) REFERENCES chapters (id) ON DELETE CASCADE
);
CREATE INDEX ix_writing_guidance_records_project_id ON writing_guidance_records (project_id);
CREATE INDEX ix_writing_guidance_records_chapter_id ON writing_guidance_records (chapter_id);
CREATE TABLE constraint_violation_records (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	chapter_id INTEGER NOT NULL, 
	rule_id VARCHAR(128) NOT NULL, 
	law_type VARCHAR(64) NOT NULL, 
	severity VARCHAR(16), 
	message TEXT NOT NULL, 
	evidence TEXT, 
	location VARCHAR(255), 
	suggestion TEXT, 
	metadata_json TEXT, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	FOREIGN KEY(chapter_id) REFERENCES chapters (id) ON DELETE CASCADE
);
CREATE INDEX ix_constraint_violation_records_chapter_id ON constraint_violation_records (chapter_id);
CREATE INDEX ix_constraint_violation_records_law_type ON constraint_violation_records (law_type);
CREATE INDEX ix_constraint_violation_records_created_at ON constraint_violation_records (created_at);
CREATE INDEX ix_constraint_violation_records_project_id ON constraint_violation_records (project_id);
CREATE INDEX ix_constraint_violation_records_severity ON constraint_violation_records (severity);
CREATE INDEX ix_constraint_violation_records_rule_id ON constraint_violation_records (rule_id);
CREATE TABLE narrative_debt_records (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	debt_type VARCHAR(64) NOT NULL, 
	status VARCHAR(16), 
	priority VARCHAR(16), 
	title VARCHAR(255) NOT NULL, 
	description TEXT, 
	created_chapter_id INTEGER, 
	expected_chapter_id INTEGER, 
	resolved_chapter_id INTEGER, 
	keywords_json TEXT, 
	related_character_ids_json TEXT, 
	overdue_chapters INTEGER, 
	resolved_at DATETIME, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	FOREIGN KEY(created_chapter_id) REFERENCES chapters (id) ON DELETE SET NULL, 
	FOREIGN KEY(expected_chapter_id) REFERENCES chapters (id) ON DELETE SET NULL, 
	FOREIGN KEY(resolved_chapter_id) REFERENCES chapters (id) ON DELETE SET NULL
);
CREATE INDEX ix_narrative_debt_records_debt_type ON narrative_debt_records (debt_type);
CREATE INDEX ix_narrative_debt_records_project_id ON narrative_debt_records (project_id);
CREATE INDEX ix_narrative_debt_records_status ON narrative_debt_records (status);
CREATE INDEX ix_narrative_debt_records_priority ON narrative_debt_records (priority);
CREATE TABLE quality_trend_points (
	id INTEGER NOT NULL, 
	project_id INTEGER, 
	chapter_id INTEGER NOT NULL, 
	inspection_id INTEGER, 
	overall_score FLOAT, 
	dimension_scores_json TEXT, 
	severity_counts_json TEXT, 
	risk_flags_json TEXT, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	FOREIGN KEY(chapter_id) REFERENCES chapters (id) ON DELETE CASCADE, 
	FOREIGN KEY(inspection_id) REFERENCES ai_inspection_results (id) ON DELETE CASCADE
);
CREATE INDEX ix_quality_trend_points_project_id ON quality_trend_points (project_id);
CREATE INDEX ix_quality_trend_points_inspection_id ON quality_trend_points (inspection_id);
CREATE INDEX ix_quality_trend_points_created_at ON quality_trend_points (created_at);
CREATE INDEX ix_quality_trend_points_chapter_id ON quality_trend_points (chapter_id);
CREATE TABLE alembic_version (
	version_num VARCHAR(32) NOT NULL, 
	CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);
CREATE TABLE wiki_pages (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id),
    entity_type VARCHAR(50),
    entity_id INTEGER,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    version INTEGER DEFAULT 1,
    is_draft INTEGER DEFAULT 0,
    created_at DATETIME,
    updated_at DATETIME
);
CREATE TABLE sqlite_sequence(name,seq);
CREATE INDEX idx_wiki_pages_project_id ON wiki_pages(project_id);
CREATE INDEX idx_wiki_pages_entity ON wiki_pages(entity_type, entity_id);
CREATE TABLE wiki_versions (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    page_id INTEGER NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    change_summary TEXT,
    created_at DATETIME
);
CREATE TABLE wiki_entity_links (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    wiki_page_id INTEGER NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
    linked_entity_type VARCHAR(50) NOT NULL,
    linked_entity_id INTEGER NOT NULL,
    link_type VARCHAR(50) NOT NULL
);
