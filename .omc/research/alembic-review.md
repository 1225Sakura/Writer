# Alembic Migration Review (US-010)

Date: 2026-05-22

## Summary

10 migration scripts found in `src/backend/alembic/versions/`. The migration chain has a **critical broken link** that prevents `alembic upgrade head` from succeeding.

---

## Migration Chain

```
7e3ddba82dcb (initial_schema)
  └─ add_projects_table
      └─ 22d0ce106c9a (add_missing_tables)
          └─ 005_extensions_context_engagement
              └─ 006_add_constraints
                  └─ 007_add_tags
                      └─ 008_constraint_rules
                          └─ 009_add_embedding_constraint_ext
                              ├─ 008_add_wiki  (down_revision OK: 009_add_embedding_constraint_ext)
                              └─ 010_ai_provider_configs  *** BROKEN ***
```

## CRITICAL ISSUE: Broken Migration Chain (010)

**File:** `2026_05_18_010_add_ai_provider_configs_table.py`

- `revision = '010_ai_provider_configs'`
- `down_revision = '009_embedding_fields'`

**Problem:** No migration has `revision = '009_embedding_fields'`. The actual migration 009 is `009_add_embedding_constraint_ext`. This means `alembic upgrade head` will fail with a "Can't locate revision '009_embedding_fields'" error.

**Fix:** Change `down_revision` in file `2026_05_18_010_add_ai_provider_configs_table.py` from `'009_embedding_fields'` to `'009_add_embedding_constraint_ext'`.

---

## Duplicate Revision Prefix

Two files both use the `008_` prefix:
- `008_constraint_rules` (2026-04-25)
- `008_add_wiki` (2026-04-25)

This is not a functional error (Alembic uses the full `revision` string, not the prefix), but it is confusing. The wiki migration should be numbered `011` or similar to avoid ambiguity.

---

## Per-Migration Review

### 001 - Initial Schema (`7e3ddba82dcb`)
- **Tables created:** characters, character_relationships, character_storylines, items, locations, factions, world_settings, rules, outlines, chapters, if_lines, chat_sessions, chat_messages, extracted_entities, draft_versions, plot_threads, ai_inspection_results, writing_settings
- **Upgrade:** Safe (CREATE TABLE only)
- **Downgrade:** Drops all tables - **data loss** (expected for initial schema rollback)
- **Risk:** None on fresh DB

### 002 - Projects Table (`add_projects_table`)
- **Tables created:** projects
- **Upgrade:** Safe (CREATE TABLE + indexes)
- **Downgrade:** Drops projects table - **data loss**
- **Risk:** None

### 003 - Add Missing Tables (`22d0ce106c9a`)
- **Changes:** Adds `project_id` FK to 17 existing tables, adds `content_storage_id` to chapters and draft_versions
- **Upgrade:** Safe (adds nullable columns + FKs)
- **Downgrade:** Removes columns and FKs - **data loss** on project_id and content_storage_id columns
- **Risk:** Low - columns are nullable, no existing data affected

### 004 - Extensions/Context/Engagement (`005_extensions_context_engagement`)
- **Tables created:** context_chunks, query_logs, engagement_scores, hook_analyses, strand_analyses, pacing_red_line_logs, genre_profiles, writing_guidance_records, snapshot_records, backup_schedule_records, archive_records, index_debt_records, quality_trend_points, constraint_rule_records, constraint_violation_records, graph_relationships, system_metric_points, narrative_debt_records
- **Upgrade:** Safe (CREATE TABLE only)
- **Downgrade:** Drops all 18 extension tables - **data loss**
- **Risk:** None

### 005 - Constraints/Indexes (`006_add_constraints`)
- **Changes:** Unique constraints on characters(name, project_id) and chapters(title, outline_id), check constraints, new indexes, FK on chat_sessions/chat_messages/extracted_entities
- **Upgrade:** **RISK** - unique constraint on `characters(name, project_id)` will fail if duplicate names exist per project
- **Downgrade:** Removes constraints - safe
- **Risk:** Medium - data must be deduplicated before running

### 006 - Tags Columns (`007_add_tags`)
- **Changes:** Adds `tags` (TEXT, nullable) to items, locations, factions, world_settings, rules
- **Upgrade:** Safe (nullable column additions)
- **Downgrade:** Drops tags columns - **data loss**
- **Risk:** Low

### 007 - Constraint Rules (`008_constraint_rules`)
- **Tables created:** constraint_rules
- **Upgrade:** Safe
- **Downgrade:** Drops table - **data loss**
- **Risk:** None

### 008 - Embedding/Constraint Extensions (`009_add_embedding_constraint_ext`)
- **Changes:** Adds embedding_vec, embedding_model, embedding_updated_at to context_chunks; extension_json, source_file, line_number to constraint_rule_records; extension_json to constraint_violation_records
- **Upgrade:** Safe (nullable columns)
- **Downgrade:** Drops columns - **data loss**
- **Risk:** Low

### 009 - Wiki Tables (`008_add_wiki`)
- **Tables created:** wiki_pages, wiki_versions, wiki_entity_links
- **Upgrade:** Safe
- **Downgrade:** Drops tables - **data loss**
- **Risk:** None

### 010 - AI Provider Configs (`010_ai_provider_configs`) -- BROKEN
- **Tables created:** ai_provider_configs
- **Upgrade:** BLOCKED (broken down_revision)
- **Downgrade:** N/A
- **Risk:** **CRITICAL** - migration cannot execute

---

## Database Location

- **Dev path:** `D:/writer/src/backend/data/writer.db`
- **Alt path:** `D:/writer/data/writer.db`
- **Config:** `src/backend/config.py` line 13

---

## Backup Protocol

Before running any migration:

```bash
cp src/backend/data/writer.db src/backend/data/writer.db.bak.$(date +%Y%m%d_%H%M%S)
```

---

## Recommendations

1. **Fix migration 010:** Change `down_revision` from `'009_embedding_fields'` to `'009_add_embedding_constraint_ext'`
2. **Rename duplicate 008_add_wiki** to `011_add_wiki_tables` for clarity (optional, cosmetic)
3. **Deduplicate character names** before running migration 005 if DB has existing data
4. **Test on copy first:** Copy DB, run `alembic upgrade head` on copy to verify full chain works
5. **Downgrade testing:** The downgrade paths are all structurally correct (mirror of upgrade), but any rollback from 005+ will drop data in those columns/tables
