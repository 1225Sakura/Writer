# Architecture Review — Round 4

## Verdict: FAIL

## Summary

The removed code (`backend.db`, `backend.vendor`, vendor fallback in `tiered_cache.py`) is cleanly eliminated with no broken imports. However, the DDD layer boundaries have **11 cross-layer violations** concentrated in `core/services/ai/` and `core/domain/`. The most severe issue is a **reverse dependency** where `core/` imports from `services/` and even from `api/` (interface layer), inverting the intended dependency direction.

## DDD Layer Compliance

| Layer | Status | Violations |
|-------|--------|------------|
| core -> infrastructure | VIOLATION | 6 files import from `backend.infrastructure` |
| core -> services (reverse!) | VIOLATION | 4 files import from `backend.services` |
| core -> interface/api | VIOLATION | 1 file imports from `backend.api.v1.endpoints` |
| services -> interface | OK | No violations found |
| services -> infrastructure | OK | Expected and allowed |

### Detailed Violation List

**core -> infrastructure (6 violations):**

| File | Line | Import |
|------|------|--------|
| `core/domain/entities.py` | 11 | `from backend.infrastructure.database import Base` |
| `core/domain/extensions.py` | 12 | `from backend.infrastructure.database import Base` |
| `core/services/base.py` | 8 | `from backend.infrastructure.cache.cache_service import CacheService` |
| `core/services/character/character_service.py` | 13 | `from backend.infrastructure.cache.cache_service import CacheService` |
| `core/services/ai/ai_service.py` | 8 | `from backend.infrastructure.cache.cache_service import ...` |
| `core/services/ai/rag_adapter.py` | 643 | `from backend.infrastructure.database import async_session_maker` |

**core -> services (reverse dependency, 4 violations):**

| File | Line | Import |
|------|------|--------|
| `core/services/ai/ai_service.py` | 7 | `from backend.services.ai import ProviderRouter, MiniMaxProvider, OpenAICompatibleProvider` |
| `core/services/ai/rag_adapter.py` | 25 | `from backend.services.context_manager import ContextManager, TextChunk` |
| `core/services/ai/rag_adapter.py` | 82, 89 | `from backend.services.ai import MiniMaxProvider, ProviderRouter` |
| `core/services/style/style_constraint.py` | 24 | `from backend.services.constraints import ...` |

**core -> interface/api (1 violation):**

| File | Line | Import |
|------|------|--------|
| `core/services/ai/ai_service.py` | 98-99 | `from backend.api.v1.endpoints.ai import set_ai_provider` |

## Service Overlap Assessment

`core/services/` and `services/` are **complementary in intent but misassigned in practice**:

- **core/services/** contains: chat, chapter, character, outline, style, ai (domain CRUD + business logic)
- **services/** contains: ai provider, content storage, workflow, export/import, observability, rag, context manager, constraints, etc. (application/infrastructure concerns)

The `services/__init__.py` re-exports core services (CharacterService, ChapterService, etc.) as a convenience facade -- this is a reasonable pattern.

**However**, `core/services/ai/ai_service.py` is misplaced. It depends on `services.ai` (provider infrastructure), `infrastructure.cache`, and even `api.v1.endpoints`. This is not a domain service -- it is an application service that orchestrates AI providers. Similarly, `core/services/ai/rag_adapter.py` depends on `services.context_manager` and `services.ai`.

**Verdict**: The boundary is clear in concept but violated by the AI subsystem. `core/services/ai/` should be moved to `services/ai/` or the provider abstraction should be lifted into core as an interface/protocol.

## Dead Code Verification

| Check | Result |
|-------|--------|
| `backend.db` imports | CLEAN -- zero references found |
| `backend.vendor` imports | CLEAN -- zero references found |
| `tiered_cache.py` vendor references | CLEAN -- no vendor code remains |
| `src/backend/db/` directory | REMOVED -- confirmed not present |
| `src/backend/vendor/` directory | REMOVED -- confirmed not present |
| Import test (`from backend.interface.web.main import app`) | PASS -- imports successfully |

## Import Path Consistency

- All `__init__.py` files properly export their modules
- `core/services/__init__.py` uses lazy `__getattr__` to avoid circular imports -- well implemented
- `services/__init__.py` also uses lazy `__getattr__` with clear documentation of the circular dependency it avoids
- No stale import paths referencing removed `db/` or `vendor/` modules
- `infrastructure/__init__.py` properly re-exports `Base`, `engine`, `async_session_maker`, `get_db`

## Recommendations

### P0 — Fix reverse dependency (core -> services/api)

`core/services/ai/ai_service.py` violates the dependency rule in three ways. Options:

1. **Move to services/**: Relocate `AIService` to `services/ai/ai_service.py` since it is an application service, not a domain service. Update all consumers.
2. **Introduce core interface**: Define an abstract `AIProviderProtocol` in `core/` and have `services/ai/` implement it. `AIService` in core would depend only on the protocol.

Same applies to `core/services/ai/rag_adapter.py` and `core/services/style/style_constraint.py`.

### P1 — Accept or resolve Base coupling

`core/domain/entities.py` and `extensions.py` importing `Base` from `infrastructure.database` is a pragmatic SQLAlchemy pattern. Two options:

1. **Accept as exception**: Document that ORM model files may import `Base` from infrastructure (common DDD practice for Active Record patterns).
2. **Move Base to core**: Define `Base` in `core/domain/` and have infrastructure reference it. This is cleaner but requires updating Alembic config.

### P2 — Decouple CacheService from core base service

`core/services/base.py` importing `CacheService` from infrastructure propagates infrastructure coupling to every core service subclass. Consider defining a cache port/interface in `core/` and injecting the infrastructure implementation.
