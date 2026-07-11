# Baseline Report — 2026-05-22

## pytest
- **581 passed**, 7 skipped, 41 warnings in 5.70s
- Warnings: Pydantic config deprecation (config.py:46), datetime.utcnow() deprecation, unawaited coroutine in export_import.py

## Backend Import
- **OK** — requires sys.path setup: `src/backend` + `src` (handled by conftest.py)
- Import: `from backend.interface.web.main import app`

## TypeScript (tsc --noEmit)
- **Clean** — zero type errors (exit code 0)

## Frontend Build
- Pending verification

## Test Infrastructure Added (Phase 0.5)
- tests/test_checker_smoke.py — 10 tests (8 checker quick_scan + 2 property tests)
- tests/unit/test_base_agent.py — 10 tests (AgentContext, AgentResult, BaseAgent, DatabaseMixin)
- tests/integration/test_api_baseline.py — 5 tests (health, settings, chat endpoints)
- Total new: 26 tests, all passing
