# Database Model Review Report

**Project:** Auto Novel Writer (自动化写作软件)  
**Review Date:** 2026-04-22  
**Reviewer:** explorer-1  
**Files Analyzed:**
- `src/backend/core/domain/entities.py` - SQLAlchemy models
- `src/backend/db/schema.sql` - SQLite schema definition
- `src/backend/database.py` - Database configuration
- `src/backend/migrations.py` - Migration management
- `src/backend/config.py` - Configuration settings

---

## 1. SQLAlchemy Model Design

### 1.1 Model Structure

The project defines **20 SQLAlchemy models** mapped to `src/backend/core/domain/entities.py`:

| Model | Table | Purpose |
|-------|-------|---------|
| `Project` | `projects` | Project/Genre configuration |
| `GenreConfiguration` | `genre_configurations` | Genre-specific settings |
| `BackgroundTask` | `background_tasks` | Async task tracking |
| `Character` | `characters` | Character definitions |
| `CharacterRelationship` | `character_relationships` | Character-to-character relations |
| `CharacterStoryline` | `character_storylines` | Character arc tracking |
| `Item` | `items` | World items |
| `Location` | `locations` | World locations |
| `Faction` | `factions` | Factions/powers |
| `WorldSetting` | `world_settings` | World rules/settings |
| `Rule` | `rules` | Story rules |
| `Outline` | `outlines` | Story outlines |
| `Chapter` | `chapters` | Chapters |
| `IFLine` | `if_lines` | IF branching storylines |
| `ChatSession` | `chat_sessions` | Chat sessions (Interface 1) |
| `ChatMessage` | `chat_messages` | Chat messages |
| `ExtractedEntity` | `extracted_entities` | Entities extracted from chat |
| `DraftVersion` | `draft_versions` | Chapter draft versioning |
| `PlotThread` | `plot_threads` | Plot/foreshadowing tracking |
| `AIInspectionResult` | `ai_inspection_results` | AI review results |
| `WritingSettings` | `writing_settings` | Writing preferences |
| `WorkflowExecution` | `workflow_executions` | Workflow run tracking |
| `AgentExecutionLog` | `agent_execution_logs` | Agent execution logs |

### 1.2 Design Patterns

**Positive Aspects:**
- Alias-based singleton pattern prevents duplicate table definitions when imported via different paths
- Proper use of `cascade="all, delete-orphan"` for child relationships
- Consistent `default=datetime.utcnow` for timestamps
- `onupdate=datetime.utcnow` for `updated_at` fields

**Issues:**
- **Missing Composite Indexes**: No composite indexes defined in SQLAlchemy models (only single-column `index=True`)
- **No Partial Indexes**: SQLite supports partial indexes but none are defined
- **No Expression Indexes**: No functional indexes for frequently-queried expressions
- **Missing Constraints**: No `UniqueConstraint` defined at model level for business rules (e.g., character name uniqueness within a project)

### 1.3 Missing Model Relationships

The following relationships are **not defined** in SQLAlchemy despite being implied by foreign keys:

| Missing Relationship | Reason |
|---------------------|--------|
| `Character.target` (target character in relationship) | `CharacterRelationship.target_id` has no back_populates |
| `IFLine.linked_character` | No relationship defined |
| `PlotThread.created_chapter` / `reveal_chapter` | No relationships defined |
| `ExtractedEntity.session` | Relationship defined in `ChatSession.extracted_entities` but not in `ExtractedEntity` |

---

## 2. Table Relationship Design

### 2.1 Entity Relationship Diagram

```
Project (1) ─────< Character (N)
    │                   │
    │                   ├────< CharacterRelationship (N)
    │                   │            │
    │                   │            └────> CharacterRelationship (target_id) ──> Character
    │                   │
    │                   └────< CharacterStoryline (N)
    │
    ├────< Item (N)
    ├────< Location (N)
    ├────< Faction (N)
    ├────< WorldSetting (N)
    ├────< Rule (N)
    │
    ├────< Outline (N) ─────< Chapter (N) ─────< DraftVersion (N)
    │                                   │
    │                                   ├────< AIInspectionResult (N)
    │                                   │
    │                                   └────< PlotThread (N) ───> Chapter (created/reveal)
    │
    ├────< IFLine (N) ────> Character (linked_character_id)
    │
    ├────< ChatSession (N) ────< ChatMessage (N)
    │                   │
    │                   └────< ExtractedEntity (N)
    │
    ├────< WritingSettings (N)
    │
    └────< BackgroundTask (N)

WorkflowExecution (1) ─────< AgentExecutionLog (N)
```

### 2.2 Foreign Key Analysis

**Correctly Implemented:**
- `CharacterRelationship.character_id` -> `characters.id` with `ondelete="CASCADE"`
- `CharacterRelationship.target_id` -> `characters.id` with `ondelete="CASCADE"`
- `CharacterStoryline.character_id` -> `characters.id` with `ondelete="CASCADE"`
- `Chapter.outline_id` -> `outlines.id` with `ondelete="SET NULL"`
- `ChatMessage.session_id` -> `chat_sessions.id` with `ondelete="CASCADE"`
- `DraftVersion.chapter_id` -> `chapters.id` with `ondelete="CASCADE"`
- `AIInspectionResult.chapter_id` -> `chapters.id` with `ondelete="CASCADE"`

**Issues Found:**
1. **Missing self-referential relationship target**: `CharacterRelationship.target_id` has no back-populates in Character model
2. **Missing relationship on IFLine.linked_character_id**: No relationship defined despite FK
3. **Missing relationships on PlotThread**: `created_chapter_id` and `reveal_chapter_id` have FK but no relationships
4. **Missing content storage tracking**: `Chapter.content_storage_id` and `DraftVersion.content_storage_id` have no corresponding model/service

---

## 3. Indexes and Performance Optimization

### 3.1 Current Index Coverage

**Defined in schema.sql (SQLite):**
```sql
-- Characters
CREATE INDEX idx_characters_name ON characters(name);
CREATE INDEX idx_characters_tier ON characters(tier);

-- Character Relationships
CREATE INDEX idx_character_relationships_character ON character_relationships(character_id);
CREATE INDEX idx_character_relationships_target ON character_relationships(target_id);

-- Character Storylines
CREATE INDEX idx_character_storylines_character ON character_storylines(character_id);

-- Items
CREATE INDEX idx_items_name ON items(name);
CREATE INDEX idx_items_owner ON items(owner);

-- Locations
CREATE INDEX idx_locations_name ON locations(name);

-- Factions
CREATE INDEX idx_factions_name ON factions(name);

-- World Settings
CREATE INDEX idx_world_settings_name ON world_settings(name);

-- Rules
CREATE INDEX idx_rules_name ON rules(name);
CREATE INDEX idx_rules_type ON rules(type);

-- Outlines
CREATE INDEX idx_outlines_title ON outlines(title);

-- Chapters
CREATE INDEX idx_chapters_outline ON chapters(outline_id);
CREATE INDEX idx_chapters_status ON chapters(status);

-- IF Lines
CREATE INDEX idx_if_lines_character ON if_lines(linked_character_id);

-- Chat Messages
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);

-- Extracted Entities
CREATE INDEX idx_extracted_entities_session ON extracted_entities(session_id);
CREATE INDEX idx_extracted_entities_type ON extracted_entities(type);
CREATE INDEX idx_extracted_entities_confirmed ON extracted_entities(confirmed);

-- Draft Versions
CREATE INDEX idx_draft_versions_chapter ON draft_versions(chapter_id);
CREATE INDEX idx_draft_versions_version ON draft_versions(chapter_id, version_number);

-- Plot Threads
CREATE INDEX idx_plot_threads_status ON plot_threads(status);

-- AI Inspection Results
CREATE INDEX idx_ai_inspection_chapter ON ai_inspection_results(chapter_id);
CREATE INDEX idx_ai_inspection_type ON ai_inspection_results(inspection_type);
```

### 3.2 SQLAlchemy-Defined Indexes

Models define `index=True` for:
- `Character.project_id`
- `CharacterRelationship.project_id`
- `CharacterStoryline.project_id`
- `Item.project_id`
- `Location.project_id`
- `Faction.project_id`
- `WorldSetting.project_id`
- `Rule.project_id`
- `Outline.project_id`
- `Chapter.project_id`
- `IFLine.project_id`
- `ChatSession.project_id`
- `ChatMessage.project_id`
- `ExtractedEntity.project_id`
- `DraftVersion.project_id`
- `PlotThread.project_id`
- `AIInspectionResult.project_id`
- `WritingSettings.project_id`

### 3.3 Missing Indexes (Performance Issues)

| Query Pattern | Missing Index |
|--------------|---------------|
| Get chapters by status and project | `CREATE INDEX idx_chapters_project_status ON chapters(project_id, status)` |
| Get chat messages by session and time | `CREATE INDEX idx_chat_messages_session_created ON chat_messages(session_id, created_at)` |
| Get draft versions latest first | `CREATE INDEX idx_draft_versions_chapter_version ON draft_versions(chapter_id, version_number DESC)` |
| Get characters by tier within project | `CREATE INDEX idx_characters_project_tier ON characters(project_id, tier)` |
| Search characters by name within project | `CREATE INDEX idx_characters_project_name ON characters(project_id, name)` |
| Get if_lines by sync_mode | `CREATE INDEX idx_if_lines_sync_mode ON if_lines(sync_mode)` |
| Get plot threads by status | `idx_plot_threads_status` already exists |
| Background tasks by status | `CREATE INDEX idx_background_tasks_status ON background_tasks(status)` |
| Workflow executions by status | `CREATE INDEX idx_workflow_executions_status ON workflow_executions(status)` |

### 3.4 WAL Mode Configuration

**Positive:** The `database.py` correctly enables SQLite WAL mode for better concurrency:
```python
@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_wal(dbapi_connection, connection_record):
    raw = getattr(dbapi_connection, "driver_connection", dbapi_connection)
    sqlite_conn = getattr(raw, "_conn", raw)
    try:
        sqlite_conn.execute("PRAGMA journal_mode=WAL")
    except Exception:
        pass
```

---

## 4. Data Integrity and Constraints

### 4.1 Implemented Constraints

**Positive:**
- `PRAGMA foreign_keys = ON` enforced
- `ON DELETE CASCADE` for dependent entities
- `ON DELETE SET NULL` for optional references
- Non-nullable primary keys with autoincrement
- `default=datetime.utcnow` for timestamps

**Issues:**

1. **No Unique Constraints**:
   - Character name should be unique within a project
   - Chat session should have a unique identifier for external reference
   - `GenreConfiguration.genre` should be unique (enforced at DB level, not model)

2. **No Check Constraints**:
   - `Chapter.status` should be validated against enum values
   - `IFLine.sync_mode` should be validated
   - `PlotThread.status` should be validated
   - `human_ai_ratio` should be between 0 and 1
   - `BackgroundTask.status` should be validated

3. **No Length Constraints at DB Level**:
   - String columns use `String` without length specification
   - Schema.sql uses TEXT for all descriptions, allowing unlimited length
   - Request schemas have validation but DB does not enforce

4. **No NOT NULL Constraints** on business-critical fields:
   - `Chapter.title` can be NULL
   - `Outline.title` has NOT NULL but other tables have inconsistent enforcement

5. **Missing `content_storage_id` model**: 
   - `Chapter.content_storage_id` and `DraftVersion.content_storage_id` reference a storage system that doesn't appear to have a corresponding model
   - This is referenced but not defined in entities.py

### 4.2 Cascade Delete Analysis

| Parent | Child | Current Behavior | Recommended |
|--------|-------|-----------------|-------------|
| Project | Character | Model has `project_id` FK (nullable) | Should cascade delete |
| Project | Chapter | Model has `project_id` FK (nullable) | Should cascade delete |
| Project | ChatSession | Model has `project_id` FK (nullable) | Should cascade delete |
| Character | CharacterRelationship | `ondelete="CASCADE"` | Correct |
| Character | CharacterStoryline | `ondelete="CASCADE"` | Correct |
| Chapter | DraftVersion | `ondelete="CASCADE"` | Correct |
| Chapter | AIInspectionResult | `ondelete="CASCADE"` | Correct |
| ChatSession | ChatMessage | `ondelete="CASCADE"` | Correct |
| ChatSession | ExtractedEntity | `ondelete="CASCADE"` | Correct |

**Issue:** `project_id` columns have no `ondelete` behavior defined - records orphaned when project is deleted (if FK even exists at DB level for all tables).

---

## 5. Business Entity Mapping

### 5.1 Three-Interface Architecture Mapping

**Interface 1 (Chat Initialization):**
- `ChatSession` - Session management
- `ChatMessage` - Message storage
- `ExtractedEntity` - Entity extraction from conversation

**Interface 2 (Setting Editor):**
- `Character` + `CharacterRelationship` + `CharacterStoryline`
- `Item`, `Location`, `Faction`
- `WorldSetting`, `Rule`
- `Outline` (story structure)

**Interface 3 (Writing Editor):**
- `Chapter` + `DraftVersion` + `AIInspectionResult`
- `IFLine` (branching storylines)
- `PlotThread` (foreshadowing tracking)
- `WritingSettings` (human-AI ratio, style)

### 5.2 Missing Business Entities

From CLAUDE.md requirements:

| Required Entity | Status in Code |
|-----------------|----------------|
| `CharacterStory` | Partial - `CharacterStoryline` exists but incomplete |
| `StoryOutline` | Partial - `Outline` exists but missing chapter ordering |
| `AIGeneratedContent` | Partial - `AIInspectionResult` exists, no quality score |
| `WritingStyle` | Partial - stored as string, no dedicated table |
| `PlotThread` | Implemented |
| `Foreshadowing` | Partial - `PlotThread` can serve this |

### 5.3 Workflow Entities

**Positive:**
- `WorkflowExecution` and `AgentExecutionLog` properly track agent runs
- Timestamps for start/completion

**Issues:**
- No status enum validation
- No foreign key from `WorkflowExecution` to `Project`
- `AgentExecutionLog` has no foreign key to `Project`

---

## 6. Key Issues Summary

### Critical Issues

1. **Missing `project_id` FK on many tables**: The schema.sql doesn't include project_id on all tables, but the SQLAlchemy models do. This mismatch causes potential sync issues.

2. **Missing relationships**: Several FK relationships have no corresponding SQLAlchemy relationship definition.

3. **No `content_storage` model**: `content_storage_id` fields reference a storage system with no model defined.

4. **Inconsistent project isolation**: Most tables have `project_id` in SQLAlchemy but schema.sql doesn't consistently include it.

### Medium Issues

5. **Missing composite indexes**: Common query patterns will suffer without composite indexes.

6. **No unique constraints**: Business rules like "character name unique within project" not enforced at DB level.

7. **No check constraints**: Status fields allow arbitrary string values.

8. **Missing project cascade deletes**: Orphaned records when projects are deleted.

### Low Issues

9. **Schema/Model drift**: No automated schema validation between schema.sql and SQLAlchemy models.

10. **No migration history tracking in schema.sql**: Only migrations.py tracks, not the DB itself.

---

## 7. Recommendations

### Immediate Fixes

1. Add `project_id` column consistently to all tables in schema.sql
2. Define all missing SQLAlchemy relationships
3. Add composite indexes for common query patterns
4. Create `ContentStorage` model for `content_storage_id` references

### Short-term

5. Add unique constraints at DB level for business rules
6. Add check constraints for enum-like fields
7. Implement project-level cascade delete behavior
8. Add foreign key from `WorkflowExecution` to `Project`

### Long-term

9. Implement Alembic migrations properly (currently only schema.sql approach)
10. Add database-level validation functions
11. Consider partitioning for large datasets
12. Add audit logging for data changes

---

## 8. Files Reference

| File | Purpose |
|------|---------|
| `src/backend/core/domain/entities.py` | SQLAlchemy model definitions |
| `src/backend/db/schema.sql` | SQLite schema (source of truth) |
| `src/backend/database.py` | SQLAlchemy engine/session config |
| `src/backend/migrations.py` | Migration management |
| `src/backend/config.py` | Database URL configuration |

---

*Report generated by explorer-1 as part of backend-architecture-review team*
