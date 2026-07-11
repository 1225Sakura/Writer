# Database Model Review (US-007)

**Date:** 2026-05-22
**Branch:** backend-optimization
**Files modified:** `src/backend/core/domain/entities.py`, `src/backend/core/domain/extensions.py`

---

## Model Inventory

**Total models: 46** across two files:

### entities.py (24 models)
| Table | Key Columns |
|-------|------------|
| `projects` | id, name |
| `genre_configurations` | id, genre (unique) |
| `background_tasks` | id (String PK), type, status |
| `characters` | id, project_id, name |
| `character_relationships` | id, project_id, character_id, target_id |
| `character_storylines` | id, project_id, character_id |
| `items` | id, project_id, name |
| `locations` | id, project_id, name |
| `factions` | id, project_id, name |
| `world_settings` | id, project_id, name |
| `rules` | id, project_id, name |
| `outlines` | id, project_id, title |
| `chapters` | id, project_id, outline_id, title, chapter_order |
| `if_lines` | id, project_id, title, linked_character_id |
| `chat_sessions` | id, project_id, status |
| `chat_messages` | id, project_id, session_id, role |
| `extracted_entities` | id, project_id, session_id, type, name |
| `draft_versions` | id, project_id, chapter_id, version_number |
| `plot_threads` | id, project_id, status, created_chapter_id, reveal_chapter_id |
| `ai_inspection_results` | id, project_id, chapter_id |
| `writing_settings` | id, project_id |
| `workflow_executions` | id, workflow_name, status |
| `agent_execution_logs` | id, workflow_execution_id, agent_name, stage_name |
| `ai_provider_configs` | id, project_id, name, is_active |

### extensions.py (22 models)
| Table | Key Columns |
|-------|------------|
| `cache_entries` | key (String PK), expire_at |
| `context_chunks` | id, chunk_id (unique), chapter_id, chunk_type |
| `query_logs` | id, query_type, chapter_id |
| `engagement_scores` | id, project_id, chapter_id |
| `hook_analyses` | id, project_id, chapter_id |
| `strand_analyses` | id, project_id, chapter_id, outline_id, dominant_strand |
| `pacing_red_line_logs` | id, project_id, outline_id, strand, severity |
| `genre_profiles` | id, project_id, genre_name, profile_key, is_preset |
| `writing_guidance_records` | id, project_id, chapter_id |
| `snapshot_records` | id, project_id, snapshot_id (unique) |
| `backup_schedule_records` | id, project_id |
| `archive_records` | id, project_id, snapshot_id |
| `index_debt_records` | id, project_id, debt_type, severity, status, entity_type, entity_id |
| `quality_trend_points` | id, project_id, chapter_id, inspection_id |
| `constraint_rule_records` | id, project_id, rule_id, law_type, severity, status |
| `constraint_violation_records` | id, project_id, chapter_id, rule_id, law_type, severity |
| `graph_relationships` | id, project_id, source_type, source_id, target_type, target_id, relation_type |
| `system_metric_points` | id, project_id, metric_type, metric_name |
| `narrative_debt_records` | id, project_id, debt_type, status, priority |
| `wiki_pages` | id, project_id, entity_type, entity_id, title |
| `wiki_versions` | id, page_id, version |
| `wiki_entity_links` | id, wiki_page_id, linked_entity_type, linked_entity_id |

---

## Changes Made

### 1. Unique Constraints Added

- **`characters.name + project_id`** -- constraint name: `uq_character_name_project`
  - Character names are now unique within a project
  - Verified: `data_agent.py` queries `Character.name` without project_id filter in some places; the constraint prevents duplicates at the DB level

- **`chapters.title + outline_id`** -- constraint name: `uq_chapter_title_outline`
  - Chapter titles are now unique within an outline
  - Both columns are nullable; SQLite unique constraints treat NULLs as distinct, so this is safe

### 2. Indexes Added

| Column(s) | Table | Reason |
|-----------|-------|--------|
| `name` | `characters` | Queried by name in data_agent.py, graph_service.py, rag_adapter.py |
| `outline_id` | `chapters` | Queried by outline_id in 7+ locations; explicit `index=True` added (FK alone is not sufficient in SQLAlchemy) |
| `session_id` | `chat_messages` | Queried by session_id for message retrieval |
| `(chapter_id, version_number)` | `draft_versions` | Composite index for `get_draft_version()` query pattern |
| `entity_type`, `entity_id` | `wiki_pages` | Individual indexes plus composite `(project_id, entity_type, entity_id)` for entity lookup |
| `project_id` | Many models | Already present on all project-scoped entities |

---

## Foreign Key Verification

All ForeignKey relationships are properly defined. Summary:

| FK Pattern | Count | Status |
|-----------|-------|--------|
| `project_id -> projects.id` | 35 models | OK, all use `index=True` |
| `chapter_id -> chapters.id` | 12 models | OK, all have `ondelete` set |
| `outline_id -> outlines.id` | 4 models | OK |
| `character_id -> characters.id` | 3 models | OK, use `ondelete="CASCADE"` |
| `session_id -> chat_sessions.id` | 2 models | OK, use `ondelete="CASCADE"` |
| `workflow_execution_id -> workflow_executions.id` | 1 model | OK |
| `page_id -> wiki_pages.id` | 1 model | OK |
| `wiki_page_id -> wiki_pages.id` | 1 model | OK |
| `inspection_id -> ai_inspection_results.id` | 1 model | OK |

**No orphaned references found.** All FK targets exist.

---

## Potential Issues Noted (Not Changed)

1. **`chapter.outline_id` is nullable** with `ondelete="SET NULL"`. The unique constraint `uq_chapter_title_outline` allows multiple chapters with the same title when `outline_id` IS NULL. This is acceptable since chapters are always created within an outline context.

2. **`writing_settings.project_id`** has no unique constraint -- a project could theoretically have multiple writing settings rows. This appears intentional (one-to-one via application logic).

3. **`genre_configurations.genre`** already has `unique=True` -- no change needed.

4. **`ai_provider_configs`** -- `is_active` is indexed. No unique constraint on `(project_id, name)` was added since the task scope didn't request it, but it could be beneficial.

---

## Test Results

```
607 passed, 7 skipped, 45 warnings in 5.57s
```

No regressions. All existing tests pass with the new constraints and indexes.
