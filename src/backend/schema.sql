-- Auto Novel Writer Database Schema
-- SQLite compatible

PRAGMA foreign_keys = ON;

-- ============================================
-- Characters & Relationships
-- ============================================

CREATE TABLE characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    gender TEXT,
    personality TEXT,
    desires TEXT,
    flaws TEXT,
    description TEXT,
    tier TEXT,
    cultivation_realm TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_characters_name ON characters(name);
CREATE INDEX idx_characters_tier ON characters(tier);

CREATE TABLE character_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    target_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE INDEX idx_character_relationships_character ON character_relationships(character_id);
CREATE INDEX idx_character_relationships_target ON character_relationships(target_id);

CREATE TABLE character_storylines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    arc TEXT,
    progress INTEGER DEFAULT 0,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE INDEX idx_character_storylines_character ON character_storylines(character_id);

-- ============================================
-- World Entities
-- ============================================

CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    owner TEXT,
    location TEXT
);

CREATE INDEX idx_items_name ON items(name);
CREATE INDEX idx_items_owner ON items(owner);

CREATE TABLE locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    importance TEXT
);

CREATE INDEX idx_locations_name ON locations(name);

CREATE TABLE factions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT
);

CREATE INDEX idx_factions_name ON factions(name);

CREATE TABLE world_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    details_json TEXT
);

CREATE INDEX idx_world_settings_name ON world_settings(name);

CREATE TABLE rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT
);

CREATE INDEX idx_rules_name ON rules(name);
CREATE INDEX idx_rules_type ON rules(type);

-- ============================================
-- Story Structure
-- ============================================

CREATE TABLE outlines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT
);

CREATE INDEX idx_outlines_title ON outlines(title);

CREATE TABLE chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outline_id INTEGER,
    title TEXT,
    summary TEXT,
    status TEXT DEFAULT 'pending',
    word_count INTEGER DEFAULT 0,
    chapter_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (outline_id) REFERENCES outlines(id) ON DELETE SET NULL
);

CREATE INDEX idx_chapters_outline ON chapters(outline_id);
CREATE INDEX idx_chapters_status ON chapters(status);

CREATE TABLE if_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    linked_character_id INTEGER,
    description TEXT,
    sync_mode TEXT DEFAULT 'auto',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (linked_character_id) REFERENCES characters(id) ON DELETE SET NULL
);

CREATE INDEX idx_if_lines_character ON if_lines(linked_character_id);

-- ============================================
-- Chat / Conversation (界面1)
-- ============================================

CREATE TABLE chat_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);

CREATE TABLE extracted_entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    confirmed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_extracted_entities_session ON extracted_entities(session_id);
CREATE INDEX idx_extracted_entities_type ON extracted_entities(type);
CREATE INDEX idx_extracted_entities_confirmed ON extracted_entities(confirmed);

-- ============================================
-- Writing & Versioning (界面3)
-- ============================================

CREATE TABLE draft_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

CREATE INDEX idx_draft_versions_chapter ON draft_versions(chapter_id);
CREATE INDEX idx_draft_versions_version ON draft_versions(chapter_id, version_number);

CREATE TABLE plot_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_chapter_id INTEGER,
    reveal_chapter_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
    FOREIGN KEY (reveal_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
);

CREATE INDEX idx_plot_threads_status ON plot_threads(status);

CREATE TABLE ai_inspection_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL,
    inspection_type TEXT NOT NULL,
    issues_json TEXT,
    suggestions_json TEXT,
    auto_fixed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_inspection_chapter ON ai_inspection_results(chapter_id);
CREATE INDEX idx_ai_inspection_type ON ai_inspection_results(inspection_type);

CREATE TABLE writing_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    human_ai_ratio REAL DEFAULT 0.5,
    writing_style TEXT DEFAULT 'default',
    target_word_count INTEGER DEFAULT 3000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default writing settings
INSERT INTO writing_settings (human_ai_ratio, writing_style, target_word_count) VALUES (0.5, 'default', 3000);
