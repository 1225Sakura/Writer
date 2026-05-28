# Architecture Decisions — Auto Novel Writer

> Version: 1.0
> Date: 2026-04-22
> Status: Living document

**相关文档：**
- [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md) — 后端实现指南（分层架构、服务、事件系统）
- [OVERALL-ARCHITECTURE.md](./design/OVERALL-ARCHITECTURE.md) — 战略规划文档（路线图、风险分析、功能矩阵）

---

## Table of Contents

1. [BaseAgent System](#1-baseagent-system)
2. [Three-Tier Cache Architecture (L1/L2/L3)](#2-three-tier-cache-architecture-l1l2l3)
3. [Provider Routing (AIProvider Abstract)](#3-provider-routing-aiprovider-abstract)
4. [Checker System Design](#4-checker-system-design)
5. [Workflow Orchestrator Design](#5-workflow-orchestrator-design)
6. [Legacy Module Migration Plan](#6-legacy-module-migration-plan)
7. [API Error Response Format](#7-api-error-response-format)

---

## 1. BaseAgent System

### Why `base.py` as the Primary Version

`src/backend/agents/base.py` defines the canonical agent abstractions used throughout the system. It is the **single source of truth** for agent contracts.

```
BaseAgent (ABC)
├── _provider: AIProvider       — injected, not instantiated internally
├── _event_bus: AsyncEventBus   — decoupled pub/sub for execution events
└── execute(context: AgentContext) -> AgentResult
```

**Design choices explained:**

| Choice | Reason |
|--------|--------|
| `AIProvider` injected in `__init__` | Enables testability and provider swapping without subclassing |
| `AsyncEventBus` instead of callbacks | Decouples agents from orchestrator; enables monitoring/logging side-effects |
| `AgentContext` dataclass (not dict) | Type-safe, self-documenting; IDE autocompletion |
| `AgentResult` with confidence + warnings | Structured output enables downstream aggregation |

### DatabaseMixin Role

```python
class DatabaseMixin:
    """For agents that need AIService/MiniMaxAPIClient access.

    Use via multiple inheritance: class MyAgent(BaseAgent, DatabaseMixin)
    """
    _ai_service: AIService
    api_client: MiniMaxAPIClient  # lazily created
```

**When to use it:** `DataAgent`, `ContextAgent` — agents that perform direct API calls beyond the standard `provider.generate()` interface. Other agents should only need `provider`, not `ai_service`.

### Event-Driven Design

Agents publish to the `AsyncEventBus` (defined in `src/backend/utils/event_bus.py`) rather than calling orchestrator hooks directly:

```python
# Example event flow
await self._event_bus.publish("agent.executed", {
    "agent_id": self._name,
    "execution_id": context.execution_id,
    "status": "completed",
    "latency_ms": elapsed_ms,
})
```

This keeps agents reusable outside the orchestrator (e.g., direct API calls, ad-hoc execution).

---

## 2. Three-Tier Cache Architecture (L1/L2/L3)

Defined in `src/backend/services/tiered_cache.py`. Operates as a **write-through, read-promote** cache.

```
TieredCache
├── L1: LRUCache (in-memory OrderedDict)   — hot data, <1KB
├── L2: diskcache.Cache (disk)              — warm data, 1KB–64KB
└── L3: SQLite cache_entries table         — cold data, >64KB
```

### Tier Selection

```python
@staticmethod
def _auto_tier(value: Any) -> str:
    size = len(json.dumps(value))
    if size < 1024:       return "l1"   # < 1KB  → memory
    elif size < 64 * 1024: return "l2"  # < 64KB → disk
    return "l3"                           # ≥ 64KB → database
```

### Get Operation (Read-Promote)

```
get(key)
  ├── L1 hit? → return immediately
  ├── L2 hit? → promote to L1, return
  └── L3 hit? → promote to L1 + L2, return
```

### Set Operation

```
set(key, value, tier="auto")
  └── Write to specified tier (or auto-selected tier)
```

### CacheService vs TieredCache

| Component | File | Purpose |
|-----------|------|---------|
| `CacheService` | `cache_service.py` | High-level facade with named entity caches (character, world_setting, etc.) + singleton instance |
| `TieredCache` | `tiered_cache.py` | Low-level three-tier implementation; used by `CacheService` internally |
| `LRUCache` | `cache_service.py` | Single-tier in-memory LRU; building block |

The `cache_service.py` singleton (`cache_service = CacheService()`) is the **legacy entry point**. New code should use `TieredCache` or inject `CacheService` via DI.

### Cache Key Patterns

```python
# Via CacheService
key = cache_service.make_key("char", character_id)

# Via TieredCache
key = f"character:{character_id}"  # caller manages naming
```

---

## 3. Provider Routing (AIProvider Abstract)

Abstract base in `src/backend/services/ai/provider.py`:

```python
class AIProvider(ABC):
    @property @abstractmethod name(self) -> str: ...
    @property @abstractmethod supports_streaming(self) -> bool: ...
    @property @abstractmethod max_tokens(self) -> int: ...

    @abstractmethod async def generate(prompt, style, operation) -> str: ...
    @abstractmethod async def generate_stream(...) -> AsyncIterator[str]: ...
    @abstractmethod async def review(content, settings) -> dict: ...
    @abstractmethod async def extract_entities(content) -> list: ...
```

### Concrete Implementations

| Provider | File | Notes |
|----------|------|-------|
| MiniMax | `services/ai/minimax.py` | Primary provider for this project |
| OpenAI-compatible | `services/ai/openai_compatible.py` | For OpenAI/Claude/Ollama endpoints |

### ProviderRouter

`src/backend/services/ai/router.py` — failover and health tracking:

```python
class ProviderRouter:
    def __init__(self, providers: list[AIProvider], primary_index: int = 0)

    async def generate(prompt, style, operation) -> str:
        # Tries providers in order; skips degraded ones
        for provider in self._ordered_providers("generate"):
            try: return await provider.generate(...)
            except: last_error = exc; continue
        raise last_error
```

**Health tracking:** sliding window of 5-minute request outcomes; if error rate > 50% and ≥ 5 requests, provider is marked **degraded** for 60 seconds.

**Metrics per provider:** `total_calls`, `success_rate`, `avg_latency_ms`.

---

## 4. Checker System Design

### BaseChecker Interface

`src/backend/agents/checkers/base.py`:

```python
class BaseChecker(ABC):
    @property name(self) -> str: ...
    @property description(self) -> str: ...

    @abstractmethod
    async def quick_scan(self, content: str) -> CheckerResult:
        """Low-cost heuristic check; no AI calls."""

    @abstractmethod
    async def deep_analyze(self, content: str, context: dict) -> CheckerResult:
        """Full AI-powered analysis with world context."""
```

```python
@dataclass
class CheckerResult:
    score: int = 100              # 0–100
    issues: list[dict[str, Any]]   # detected problems
    suggestions: list[str]        # improvement recommendations
```

### CheckerResult Validation

Score is validated in `__post_init__`:

```python
def __post_init__(self):
    if not 0 <= self.score <= 100:
        raise ValueError(f"score must be between 0 and 100, got {self.score}")
```

### Existing Checkers

| Checker | File | Dimension |
|---------|------|-----------|
| `ConsistencyChecker` | `checkers/consistency_checker.py` | Setting consistency |
| `ContinuityChecker` | `checkers/continuity_checker.py` | Temporal/logical continuity |
| `HighPointChecker` | `checkers/high_point_checker.py` | Excitement density |
| `OOCChecker` | `checkers/ooc_checker.py` | Character voice consistency |
| `OutlineLawEnforcer` | `checkers/outline_law_enforcer.py` | Outline compliance |
| `PacingChecker` | `checkers/pacing_checker.py` | Strand ratio pacing |
| `ReaderPullChecker` | `checkers/reader_pull_checker.py` | Hook/engagement |
| `SettingPhysicsEnforcer` | `checkers/setting_physics_enforcer.py` | World physics rules |

### Review Flow (quick_scan → deep_analyze)

```
Content Input
    │
    ▼
quick_scan() — heuristics, regex, lightweight rules (no AI cost)
    │
    ├── No issues found? → return CheckerResult(score=100)
    │
    └── Issues found + analysis_depth != "quick"?
            │
            ▼
        deep_analyze() — AI-powered with full context
            │
            ▼
        merge_results() → final CheckerResult
```

This two-tier approach avoids costly AI calls for clean content.

---

## 5. Workflow Orchestrator Design

`src/backend/agents/orchestrator.py` — `AgentOrchestrator` class.

### Core Concepts

```python
@dataclass
class StageConfig:
    name: str
    agents: list[str]           # registered agent names
    mode: str = "sequential"    # "parallel" | "sequential"
    depends_on: list[str] = []  # stage names this stage waits for

@dataclass
class WorkflowConfig:
    name: str
    stages: list[StageConfig]
    description: str = ""
```

### Execution Flow

```
execute_workflow(name, context, db?)
  │
  ├── Build execution_id = f"{name}_{timestamp}"
  │
  ├── _topological_sort(stages) via Kahn's algorithm
  │       └── Returns stages in dependency order
  │
  ├── For each stage (in sorted order):
  │       ├── Wait for depends_on stages to complete
  │       │
  │       └── _execute_stage(stage):
  │               ├── mode == "parallel"? → asyncio.gather
  │               └── mode == "sequential"? → sequential await
  │
  └── Publish events: workflow.started → stage.completed (per stage) → workflow.completed
```

### DAG / Topological Sort

Uses Kahn's algorithm. Circular dependencies raise `ValueError`.

```python
@staticmethod
def _topological_sort(stages: list[StageConfig]) -> list[StageConfig]:
    in_degree = {s.name: len(s.depends_on) for s in stages}
    queue = [name for name, deg in in_degree.items() if deg == 0]
    # ... Kahn's algorithm
    if len(sorted_names) != len(stages):
        raise ValueError("Circular dependency detected in workflow stages")
```

### Parallel vs Sequential Execution

```python
if stage.mode == "parallel":
    tasks = [self._execute_agent(...) for agent_name in stage.agents]
    results = await asyncio.gather(*tasks, return_exceptions=True)
else:
    for agent_name in stage.agents:
        result = await self._execute_agent(...)
```

### Event Types

```python
WORKFLOW_STARTED    = "workflow.started"
STAGE_COMPLETED     = "workflow.stage.completed"
AGENT_EXECUTED      = "workflow.agent.executed"
WORKFLOW_COMPLETED  = "workflow.completed"
WORKFLOW_FAILED     = "workflow.failed"
```

### Workflow Registration

```python
orchestrator = AgentOrchestrator(event_bus, workflow_service)
orchestrator.register_workflow("my_wf", stages=[...])
orchestrator.register_agent("data", DataAgent(provider, event_bus))
```

---

## 6. Legacy Module Migration Plan

### `database_service.py` — Deprecation Timeline

**File:** `src/backend/services/database_service.py`

This module is a **procedural CRUD wrapper** over SQLAlchemy with tight coupling to `async_session_maker`. It predates the Repository pattern and the `TieredCache` system.

**Deprecation phases:**

| Phase | Target | Action |
|-------|--------|--------|
| Phase 1 (current) | New endpoints must NOT use `database_service.py` | Use Repository classes + `CacheService` |
| Phase 2 | Migration endpoints via `Repository` | Parallel support; no new functionality |
| Phase 3 | `database_service.py` becomes internal | Repository is primary; legacy module only for in-flight migrations |
| Phase 4 (end state) | Remove `database_service.py` | All CRUD goes through Repository layer |

**See also:** Task #14 — Phase 2 - P1.3: 渐进式废弃 database_service.py

### `services/` Proxy Modules

Many files in `services/` are thin wrappers or proxies that forward to `database_service.py`. As the Repository pattern is adopted (Task #6), these should be evaluated for removal or replacement:

| Module | Status | Notes |
|--------|--------|-------|
| `ai_service.py` | In use | Primary AI service; keep |
| `cache_service.py` | In use | Core caching; keep (refactor to non-singleton) |
| `chat_service.py` | Review | Candidate for Repository |
| `character_service.py` | Review | Candidate for Repository |
| `chapter_service.py` | Review | Candidate for Repository |
| `outline_service.py` | Review | Candidate for Repository |
| `workflow_service.py` | In use | Workflow persistence; keep |

### Global Singleton `cache_service`

**File:** `src/backend/services/cache_service.py` (line 396)

```python
cache_service = CacheService()  # module-level singleton
```

This is the target of Task #11 (Phase 3 - P2.3: 消除全局单例). The migration path:

1. Inject `CacheService` via dependency injection container (`src/backend/utils/di_container.py`)
2. Replace `from backend.services.cache_service import cache_service` with `cache: CacheService = Depends(get_cache_service)`
3. Remove the module-level singleton

---

## 7. API Error Response Format

All backend API errors follow a consistent envelope:

```json
{
    "error": {
        "code": "RESOURCE_NOT_FOUND",
        "message": "Character with id=42 not found",
        "details": {
            "resource_type": "character",
            "resource_id": 42
        }
    },
    "request_id": "req_01HXYZ..."
}
```

### Error Code Taxonomy

| Code | HTTP Status | When Used |
|------|-------------|-----------|
| `VALIDATION_ERROR` | 422 | Request body/params fail validation |
| `RESOURCE_NOT_FOUND` | 404 | Entity lookup fails |
| `RESOURCE_CONFLICT` | 409 | Duplicate creation, state conflict |
| `AUTHENTICATION_REQUIRED` | 401 | Missing/invalid API key |
| `PERMISSION_DENIED` | 403 | Insufficient permissions |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `AI_PROVIDER_ERROR` | 502 | Upstream AI provider failed |
| `AI_PROVIDER_DEGRADED` | 503 | All AI providers degraded/unavailable |
| `WORKFLOW_NOT_FOUND` | 404 | Workflow execution ID not found |
| `WORKFLOW_STAGE_FAILED` | 500 | Agent/Checker failed within workflow |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Implementation

```python
# src/backend/utils/exceptions.py

class AppException(Exception):
    def __init__(self, code: str, message: str, details: dict | None = None):
        self.code = code
        self.message = message
        self.details = details or {}

    def to_dict(self) -> dict:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            },
            "request_id": get_request_id(),  # from context var
        }
```

### Validation Error Details

```json
{
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Request validation failed",
        "details": {
            "field_errors": [
                {"field": "character_id", "error": "must be a positive integer"},
                {"field": "name", "error": "required field missing"}
            ]
        }
    }
}
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-22 | Initial architecture decision record |

## See Also

- `docs/design/agent-system.md` — Agent system design (Phase 1–5 roadmap)
- `docs/design/OVERALL-ARCHITECTURE.md` — System-wide architecture
- `docs/api/API_ENDPOINTS.md` — API endpoint inventory
- `src/backend/agents/base.py` — BaseAgent implementation
- `src/backend/agents/orchestrator.py` — Orchestrator implementation
- `src/backend/agents/checkers/base.py` — BaseChecker interface
- `src/backend/services/ai/provider.py` — AIProvider abstract
- `src/backend/services/ai/router.py` — ProviderRouter implementation
- `src/backend/services/tiered_cache.py` — Three-tier cache
- `src/backend/services/cache_service.py` — CacheService + LRUCache
- `src/backend/services/database_service.py` — Legacy CRUD service
