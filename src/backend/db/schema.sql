-- Auto Novel Writer - Database Schema
-- SQLite with foreign keys support

PRAGMA foreign_keys = ON;

-- ============================================
-- Characters & Relationships
-- ============================================

CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    gender TEXT,
    personality TEXT,
    desires TEXT,
    flaws TEXT,
    description TEXT,
    tier TEXT,
    cultivation_realm TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS character_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    target_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS character_storylines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    arc TEXT,
    progress INTEGER DEFAULT 0,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- ============================================
-- World Entities
-- ============================================

CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    owner TEXT,
    location TEXT
);

CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    importance TEXT
);

CREATE TABLE IF NOT EXISTS factions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT
);

CREATE TABLE IF NOT EXISTS world_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    details_json TEXT
);

CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT
);

-- ============================================
-- Story Structure
-- ============================================

CREATE TABLE IF NOT EXISTS outlines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outline_id INTEGER,
    title TEXT,
    summary TEXT,
    status TEXT DEFAULT 'pending',
    word_count INTEGER DEFAULT 0,
    chapter_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (outline_id) REFERENCES outlines(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS if_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    linked_character_id INTEGER,
    description TEXT,
    sync_mode TEXT DEFAULT 'auto',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (linked_character_id) REFERENCES characters(id) ON DELETE SET NULL
);

-- ============================================
-- Chat / Conversation (Interface 1)
-- ============================================

CREATE TABLE IF NOT EXISTS chat_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS extracted_entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    confirmed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- ============================================
-- Writing & Versioning (Interface 3)
-- ============================================

CREATE TABLE IF NOT EXISTS draft_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS plot_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_chapter_id INTEGER,
    reveal_chapter_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
    FOREIGN KEY (reveal_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ai_inspection_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL,
    inspection_type TEXT NOT NULL,
    issues_json TEXT,
    suggestions_json TEXT,
    auto_fixed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS writing_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    human_ai_ratio REAL DEFAULT 0.5,
    writing_style TEXT DEFAULT 'default',
    target_word_count INTEGER DEFAULT 3000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Indexes
-- ============================================

-- Character indexes
CREATE INDEX IF NOT EXISTS idx_character_relationships_character_id ON character_relationships(character_id);
CREATE INDEX IF NOT EXISTS idx_character_relationships_target_id ON character_relationships(target_id);
CREATE INDEX IF NOT EXISTS idx_character_storylines_character_id ON character_storylines(character_id);

-- Composite index for character lookups by tier + cultivation realm (common filter pattern)
CREATE INDEX IF NOT EXISTS idx_characters_tier_realm ON characters(tier, cultivation_realm);

-- Chapter indexes
CREATE INDEX IF NOT EXISTS idx_chapters_outline_id ON chapters(outline_id);
-- Composite index for chapter status + order (common list query)
CREATE INDEX IF NOT EXISTS idx_chapters_status_order ON chapters(status, chapter_order);
-- Index for chapter updated_at (sorting by recent)
CREATE INDEX IF NOT EXISTS idx_chapters_updated_at ON chapters(updated_at DESC);

-- Chat indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
-- Composite index for chat messages by session + created (ordered retrieval)
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at);

-- Entity indexes
CREATE INDEX IF NOT EXISTS idx_extracted_entities_session_id ON extracted_entities(session_id);
-- Composite index for entity type filtering within a session
CREATE INDEX IF NOT EXISTS idx_extracted_entities_session_type ON extracted_entities(session_id, type);

-- Draft version indexes
CREATE INDEX IF NOT EXISTS idx_draft_versions_chapter_id ON draft_versions(chapter_id);
-- Composite index for latest draft lookup
CREATE INDEX IF NOT EXISTS idx_draft_versions_chapter_version ON draft_versions(chapter_id, version_number DESC);

-- Plot thread indexes
CREATE INDEX IF NOT EXISTS idx_plot_threads_created_chapter_id ON plot_threads(created_chapter_id);
CREATE INDEX IF NOT EXISTS idx_plot_threads_reveal_chapter_id ON plot_threads(reveal_chapter_id);
-- Composite index for active plot threads by status + created chapter
CREATE INDEX IF NOT EXISTS idx_plot_threads_status_created ON plot_threads(status, created_chapter_id);

-- AI inspection indexes
CREATE INDEX IF NOT EXISTS idx_ai_inspection_results_chapter_id ON ai_inspection_results(chapter_id);
-- Composite index for inspection type filtering within a chapter
CREATE INDEX IF NOT EXISTS idx_ai_inspection_chapter_type ON ai_inspection_results(chapter_id, inspection_type);

-- IF line indexes
CREATE INDEX IF NOT EXISTS idx_if_lines_character ON if_lines(linked_character_id);
-- Composite index for IF line sync mode filtering
CREATE INDEX IF NOT EXISTS idx_if_lines_character_sync ON if_lines(linked_character_id, sync_mode);

-- World setting index for name lookups
CREATE INDEX IF NOT EXISTS idx_world_settings_name ON world_settings(name);

-- Writing settings index (singleton table, small but consistent)
CREATE INDEX IF NOT EXISTS idx_writing_settings_updated ON writing_settings(updated_at DESC);

-- Item indexes for owner/location filtering
CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner);
CREATE INDEX IF NOT EXISTS idx_items_location ON items(location);

-- Location index for importance filtering
CREATE INDEX IF NOT EXISTS idx_locations_importance ON locations(importance);

-- Faction index for type filtering
CREATE INDEX IF NOT EXISTS idx_factions_type ON factions(type);

-- Rule index for type filtering
CREATE INDEX IF NOT EXISTS idx_rules_type ON rules(type);
