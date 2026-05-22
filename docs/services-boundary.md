# Services Boundary: `services/` vs `core/services/`

This document maps the relationship between the two service directories to clarify
responsibilities and identify cleanup opportunities.

---

## Directory Responsibilities

### `src/backend/core/services/` -- Domain CRUD Services

Owns the **entity-level CRUD services** that extend `BaseService[T]`. Each subdirectory
contains a single service for one domain entity. These services:

- Inherit `BaseService` (generic CRUD with event publishing + cache invalidation)
- Depend on SQLAlchemy async sessions, the event bus, and the cache layer
- Are the authoritative persistence layer for domain entities

**Subdirectories (17 entity services + 1 base):**

| Directory | Class | Entity |
|-----------|-------|--------|
| `base.py` | `BaseService[T]` | Generic CRUD base |
| `ai/` | `AIService`, `RAGAdapter`, `SearchResult` | AI generation + RAG |
| `ai_inspection_result/` | `AIInspectionResultService` | AI inspection results |
| `background_task/` | `BackgroundTaskService` | Background tasks |
| `chapter/` | `ChapterService` | Chapters |
| `character/` | `CharacterService` | Characters |
| `chat/` | `ChatSessionService`, `ChatMessageService` | Chat sessions/messages |
| `faction/` | `FactionService` | Factions |
| `genre_configuration/` | `GenreConfigurationService` | Genre configs |
| `if_line/` | `IFLineService` | IF lines |
| `item/` | `ItemService` | Items |
| `location/` | `LocationService` | Locations |
| `outline/` | `OutlineService` | Outlines |
| `plot_thread/` | `PlotThreadService` | Plot threads |
| `project/` | `ProjectService` | Projects |
| `rule/` | `RuleService` | Rules |
| `stats/` | `StatsService` | Statistics |
| `style/` | `StyleConstraint`, `StyleConstraintEnforcer` | Style constraints |
| `world_setting/` | `WorldSettingService` | World settings |
| `writing_settings/` | `WritingSettingsService` | Writing settings |

### `src/backend/services/` -- Infrastructure & Cross-Cutting Services

Owns **non-entity services**: AI provider abstraction, analysis engines, RAG pipeline,
constraint system, task management, and operational utilities. These services:

- Do NOT extend `BaseService` (no entity CRUD pattern)
- Handle AI provider routing, content analysis, scheduling, export/import, etc.
- Are consumed by both `core/services/` and API route handlers

**Files (45 modules, ~70 classes):**

| Module | Key Classes | Purpose |
|--------|-------------|---------|
| `ai/provider.py` | `AIProvider` (ABC) | Abstract AI provider interface |
| `ai/minimax.py` | `MiniMaxProvider` | MiniMax API provider |
| `ai/openai_compatible.py` | `OpenAICompatibleProvider` | OpenAI-compatible provider |
| `ai/router.py` | `ProviderRouter` | Multi-provider routing with health/fallback |
| `ai_provider_config_service.py` | `AIProviderConfigService` | DB-driven provider config |
| `archive_manager.py` | `ArchiveManager` | Project archiving |
| `backup_manager.py` | `BackupManager` | Backup scheduling/status |
| `chunk_strategy.py` | `ChunkStrategy`, `ParagraphChunker`, `SceneChunker`, `ChapterChunker`, `SlidingWindowChunker` | Text chunking strategies |
| `conflict_detector.py` | `Conflict`, `ConflictDetector` | Narrative conflict detection |
| `constraint_dsl.py` | `DSLCondition` hierarchy, `ConditionParser`, `ConstraintDSLCParser` | Constraint DSL parsing |
| `constraints/core.py` | `ConstraintRule`, `ConstraintViolation`, `ConstraintCheckResult` | Constraint data models |
| `constraints/engine.py` | `ConstraintEngine` | Constraint evaluation engine |
| `constraints/conflict_detector.py` | `ConflictDetector` | Constraint-level conflict detection |
| `constraints/invention_registry.py` | `InventionRegistry` | Invention tracking |
| `content_storage.py` | `ContentStorage` | Content persistence |
| `context_manager.py` | `ContextManager`, `TextChunk` | RAG context assembly |
| `context_ranker.py` | `ContextRanker` | Context relevance ranking |
| `context_weights.py` | `ContextWeights` | Context scoring weights |
| `debt_tracker.py` | `DebtTracker`, `NarrativeDebt` | Narrative debt tracking |
| `embedding_service.py` | `EmbeddingService` | Text embedding |
| `engagement_analyzer.py` | `EngagementAnalyzer`, `CoolPoint`, `Fulfillment` | Reader engagement analysis |
| `export_import.py` | `ConflictResolution`, `ExportProgressCallback` | Project export/import |
| `genre_service.py` | `GenreService` | Genre configuration |
| `graph_service.py` | `GraphService`, `GraphNode`, `GraphEdge` | Entity relationship graph |
| `guidance_builder.py` | `GuidanceBuilder` | AI guidance prompt construction |
| `hook_detector.py` | `HookDetector`, `Hook` | Narrative hook detection |
| `index_debt_tracker.py` | `IndexDebtTracker` | Index-level debt tracking |
| `observability.py` | `ObservabilityService` | Metrics/logging |
| `pacing_analyzer.py` | `PacingAnalyzer`, `PacingAnalysis` | Narrative pacing analysis |
| `preload_service.py` | `PreloadService` | Data preloading |
| `query_router.py` | `QueryRouter` | Query intent routing |
| `rag_service.py` | `RAGService`, `SearchResult` | RAG retrieval pipeline |
| `rhythm_advisor.py` | `RhythmAdvisor`, `StrandAdvice` | Narrative rhythm advice |
| `snapshot_manager.py` | `SnapshotManager` | State snapshots |
| `status_reporter.py` | `StatusReporter` | System status reporting |
| `strand_classifier.py` | `StrandClassifier` | Narrative strand classification |
| `task_queue.py` | `TaskQueue`, `Task` | Async task queue |
| `wiki_service.py` | `WikiService` | Internal wiki |
| `workflow_service.py` | `WorkflowExecutionService` | Workflow orchestration |
| `ws_message_queue.py` | `WSMessageQueue` | WebSocket message queue |

---

## Lazy-Imported Classes via `services/__init__.py`

`services/__init__.py` acts as a **facade/proxy** that re-exports select `core/services/`
classes to avoid circular imports. It uses `__getattr__` for lazy loading.

**Directly imported (not lazy):**
- `ContentStorage` (from `services/content_storage.py`)
- `WorkflowExecutionService` (from `services/workflow_service.py`)

**Lazy-imported (via `__getattr__`):**

| Attribute Name | Actual Source | Status |
|---------------|---------------|--------|
| `CharacterService` | `core.services.character.character_service` | OK -- exists |
| `ChapterService` | `core.services.chapter.chapter_service` | OK -- exists |
| `ChatSessionService` | `core.services.chat.chat_service` | OK -- exists |
| `ChatMessageService` | `core.services.chat.chat_service` | OK -- exists |
| `OutlineService` | `core.services.outline.outline_service` | OK -- exists |

All 5 lazy-imported classes resolve correctly to existing `core/services/` implementations.

---

## Overlaps

### 1. `ConflictDetector` (name collision, different scope)

| Location | Class | Purpose |
|----------|-------|---------|
| `services/conflict_detector.py` | `ConflictDetector` | Narrative conflict detection (story-level) |
| `services/constraints/conflict_detector.py` | `ConflictDetector` | Constraint rule conflict detection |

**Verdict:** Different concerns, same name. Not a true duplication, but confusing.
Consider renaming one (e.g., `NarrativeConflictDetector` vs `ConstraintConflictDetector`).

### 2. `SearchResult` (name collision, different scope)

| Location | Class | Purpose |
|----------|-------|---------|
| `services/rag_service.py` | `SearchResult` | RAG search result model |
| `core/services/ai/rag_adapter.py` | `SearchResult` | RAG adapter search result model |

**Verdict:** Two `SearchResult` classes in two different RAG-related modules.
Likely one should import from the other rather than redefining.

### 3. RAG: `RAGService` vs `RAGAdapter`

| Location | Class | Purpose |
|----------|-------|---------|
| `services/rag_service.py` | `RAGService` | Full RAG pipeline (retrieval + generation) |
| `core/services/ai/rag_adapter.py` | `RAGAdapter` | RAG adapter for AIService |

**Verdict:** `RAGAdapter` wraps around `services/` components (ContextManager, MiniMaxProvider)
to plug into `AIService`. This is an intentional adapter pattern, not duplication.
However, the `SearchResult` duplication suggests incomplete consolidation.

### 4. Debt Tracking: `debt_tracker.py` vs `index_debt_tracker.py`

| Location | Class | Purpose |
|----------|-------|---------|
| `services/debt_tracker.py` | `DebtTracker`, `NarrativeDebt` | Narrative debt (story consistency) |
| `services/index_debt_tracker.py` | `IndexDebtTracker` | Index debt (structural consistency) |

**Verdict:** Two separate debt trackers with overlapping enum names (`DebtType`, `DebtStatus`).
These share ~60% of their data model. Consider a shared base or unified module.

---

## Omissions: Core Services NOT Proxied via `services/__init__.py`

The following `core/services/` classes exist but are **not** exposed through the
`services/__init__.py` facade:

| Class | Source | Notes |
|-------|--------|-------|
| `AIService` | `core/services/ai/ai_service.py` | Exposed in `core/services/__init__.py` but not `services/__init__.py` |
| `RAGAdapter` | `core/services/ai/rag_adapter.py` | Same as above |
| `StyleConstraintEnforcer` | `core/services/style/style_constraint.py` | Same as above |
| `StyleConstraint` | `core/services/style/style_constraint.py` | Same as above |
| `AIInspectionResultService` | `core/services/ai_inspection_result/` | Not proxied anywhere |
| `BackgroundTaskService` | `core/services/background_task/` | Not proxied anywhere |
| `FactionService` | `core/services/faction/` | Not proxied anywhere |
| `GenreConfigurationService` | `core/services/genre_configuration/` | Not proxied anywhere |
| `IFLineService` | `core/services/if_line/` | Not proxied anywhere |
| `ItemService` | `core/services/item/` | Not proxied anywhere |
| `LocationService` | `core/services/location/` | Not proxied anywhere |
| `PlotThreadService` | `core/services/plot_thread/` | Not proxied anywhere |
| `ProjectService` | `core/services/project/` | Not proxied anywhere |
| `RuleService` | `core/services/rule/` | Not proxied anywhere |
| `StatsService` | `core/services/stats/` | Not proxied anywhere |
| `WorldSettingService` | `core/services/world_setting/` | Not proxied anywhere |
| `WritingSettingsService` | `core/services/writing_settings/` | Not proxied anywhere |

**Pattern:** Only 5 of 17 entity services are proxied through `services/__init__.py`.
The rest are imported directly by consumers (e.g., `from backend.core.services.faction.faction_service import FactionService`).

This is **not necessarily a problem** -- the lazy proxy exists to break a specific
circular import chain (`services/__init__ -> core/services/chat -> agents/base -> services/__init__`).
Services not involved in that cycle can be imported directly.

---

## Dependency Flow

```
services/ (infrastructure)
  ai/provider.py, router.py, minimax.py, openai_compatible.py
  constraints/, rag_service.py, context_manager.py, etc.
        |
        | consumed by
        v
core/services/ (domain CRUD)
  ai/ai_service.py  --->  services.ai (ProviderRouter, MiniMaxProvider)
  ai/rag_adapter.py --->  services.context_manager, services.ai
  style/style_constraint.py --->  services.constraints
        |
        | proxied through
        v
services/__init__.py  (lazy re-export of 5 classes)
```

**Key dependency:** `core/services/` depends **downward** into `services/` for AI
providers and analysis engines. The `services/` layer never imports from `core/services/`
except through the `__init__.py` facade (which exists solely to break circular imports).

Wait -- correction: `services/constraints/engine.py`, `services/task_queue.py`, and
`services/strand_classifier.py` do import `AIService` from `core/services/ai/ai_service.py`.
This is a **bidirectional dependency** that the `__init__.py` facade was meant to prevent.

---

## Follow-Up Issues to Track

1. **Rename conflicting `ConflictDetector` classes** -- Two classes with the same name
   in different modules. Rename for clarity (e.g., `NarrativeConflictDetector`).

2. **Consolidate `SearchResult` duplication** -- `services/rag_service.py` and
   `core/services/ai/rag_adapter.py` both define `SearchResult`. One should import
   from the other.

3. **Unify debt tracker data models** -- `debt_tracker.py` and `index_debt_tracker.py`
   share overlapping enums (`DebtType`, `DecStatus`). Extract shared types.

4. **Audit bidirectional imports** -- `services/constraints/engine.py`,
   `services/task_queue.py`, and `services/strand_classifier.py` import from
   `core/services/`, breaking the intended dependency direction. These should either:
   - Accept `AIService` via dependency injection, or
   - Move the AI-dependent logic into `core/services/ai/`.

5. **Decide on facade scope** -- Either:
   - **Expand** `services/__init__.py` to proxy all `core/services/` classes (single import point), or
   - **Shrink** it to only the 5 classes needed to break circular imports (current state), with consumers importing directly from `core/services/`.

6. **Document the intended boundary** -- The current split is:
   - `core/services/` = entity CRUD (extends `BaseService`)
   - `services/` = infrastructure/analysis (standalone)
   
   This is a reasonable boundary but is not documented or enforced. Consider adding
   a lint rule or architectural test.
