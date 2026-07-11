# Test Engineering Review — Round 3

## Verdict: PASS

## Summary

All 109 new regression tests pass. The backend suite (581 passed, 7 skipped) and frontend suite (50 passed, 2 failed) match the reported baseline. The 2 frontend failures are pre-existing ux-benchmark ARIA issues unrelated to the new tests. The new test files demonstrate strong structural quality: the backend tests verify behavioral logging rather than just import safety, and the frontend store tests validate state transitions and queue management. Two minor quality issues were found (tautological assertions in writingStore) but they do not affect the verdict.

## Test Suite Status

| Suite | Passed | Failed | Skipped | Notes |
|-------|--------|--------|---------|-------|
| Backend pytest | 581 | 0 | 7 | All new tests pass. 7 skips are pre-existing (optional deps). |
| Frontend vitest | 50 | 2 | 0 | 2 failures are pre-existing ux-benchmark ARIA tests (ProjectDataPanel.tsx missing labels). |

## New Test Quality Assessment

| File | Tests | Quality | Coverage | Issues |
|------|-------|---------|----------|--------|
| test_bare_except_regression.py | 27 | **High** | 3-tier: AST scan + import smoke + behavioral logging for 7/9 modules | metrics_service and cache_service lack behavioral logging tests (import-only + weak "no crash" check) |
| test_security_roundtrip.py | 19 | **High** | Encrypt round-trip (6 tests), rate limiter lifecycle (6), WS queue ops (7). Edge cases: empty string, Unicode, legacy plaintext passthrough, auto-init. | No negative test for corrupted ciphertext. No test for concurrent rate limiter access. |
| test_architecture_imports.py | 19 | **Medium** | Module import validation (16 modules), dead code dir check, full codebase bare-except scan, architecture boundary enforcement | Mostly structural/syntactic. The bare-except scan duplicates test_bare_except_regression but scans ALL files (valuable as a safety net). |
| writingStore.test.ts | 13 | **Medium** | Initial state, config defaults, content/ratio/style/target updates, save status, session tracking, no-chapter early returns | 2 tautological `expect(true).toBe(true)` assertions. Error paths (save failure, init failure) are untested. |
| syncStore.test.ts | 11 | **High** | IF line lifecycle, sync status, global mode, character progress, conflict add/resolve, generation tasks, pause/resume, stats | Good behavioral coverage. One "should not throw" test but it verifies `isSyncing === false` afterward (not tautological). |
| aiStore.test.ts | 8 | **Medium** | Initial state, action exposure, job add/cancel/status/clear, style fetch | Job retry logic and error propagation paths are untested. Known Immer mutation bug noted but not guarded by a test. |
| request-toast.test.ts | 12 | **High** | API client exports, error message mapping, retryable classification, error type checking, network error transform, online detection setup/teardown | Good behavioral tests. Actual axios interceptor logic is mocked (appropriate for unit tests). |

## Coverage Gaps

### Backend

1. **metrics_service behavioral test missing** — Listed in `_FIXED_MODULES_REL` (had bare-except-pass fixed) but has no behavioral test verifying that errors are actually logged. Only an import smoke test exists.

2. **cache_service behavioral test is weak** — `TestCacheServiceInvalidation.test_invalidate_character_cache_no_crash` only asserts "doesn't raise." It does not verify logging behavior, making it a regression test only for crashes, not for the bare-except-pass fix itself.

3. **Corrupted ciphertext decryption** — No test for what happens when `decrypt_value` receives a Fernet-formatted but tampered ciphertext. Should verify it raises `InvalidToken` or returns a sensible error.

4. **Rate limiter window expiry** — No test verifying that requests are allowed again after the time window expires (would require time mocking).

5. **WS queue concurrent access** — No test for multiple sessions enqueueing/dequeueing concurrently.

### Frontend

6. **writingStore error paths untested** — `saveCurrentChapter` and `triggerAutoSave` both have `catch` blocks that set `saveStatus = 'error'` and call `showOperationError`. None of the 13 tests exercise these paths.

7. **aiStore retry logic untested** — The `processNextJob` function has retry logic with `MAX_RETRIES` and error accumulation. No test verifies retry behavior or that `job.error` is set correctly on final failure.

8. **syncStore error paths untested** — `triggerGlobalSync` has a catch block that calls `showError`. The test only covers the "paused" early-return path, not the error path.

9. **Immer mutation bug in aiStore** — Line 161 of aiStore.ts mutates a frozen Immer reference. The test suppresses the resulting `unhandledRejection` with a comment "known bug." This should either be fixed or have a dedicated test documenting the expected broken behavior.

## Anti-patterns Found

### 1. Tautological assertions (writingStore.test.ts, lines 171 and 179)

```typescript
// Line 164-172
it('should not throw on saveCurrentChapter when no chapter selected', async () => {
    ...
    await act(async () => {
      await result.current.saveCurrentChapter()
    })
    expect(true).toBe(true)  // <-- always passes regardless of implementation
})
```

`expect(true).toBe(true)` is a no-op assertion. These tests verify only that no exception is thrown, which is a valid concern but should use a meaningful assertion (e.g., verify `saveStatus` remains unchanged or is still `'idle'`).

**Severity: Low** — The test still catches crash regressions, but it cannot detect behavioral changes.

### 2. Known bug suppressed instead of fixed (aiStore.test.ts, lines 73-76)

```typescript
const suppressRejection = (err: unknown) => { /* expected */ }
process.on('unhandledRejection', suppressRejection)
```

A known Immer frozen-object mutation bug in `processNextJob` is papered over with a global rejection suppressor. This masks other potential issues in the same test.

**Severity: Medium** — Should be fixed at the source or isolated with a targeted mock.

### 3. No-op test name semantics (writingStore.test.ts)

Two tests are named "should not throw on X when no chapter selected" — this is testing an implementation detail (early return) rather than observable behavior. A better name would describe the expected outcome: "saveCurrentChapter with no selection should keep save status unchanged."

**Severity: Cosmetic**

## Recommendations

1. **Add behavioral test for metrics_service** — Mirror the pattern used for backup_manager/rag_service: force an error in a stats query or metric collection and verify it appears in logs.

2. **Strengthen cache_service test** — Verify that `invalidate_character_cache` actually clears expected cache entries, not just "doesn't crash."

3. **Replace `expect(true).toBe(true)`** — In both writingStore tests, add a meaningful assertion such as `expect(result.current.saveStatus).not.toBe('error')` or verify the save function returned early without calling the API mock.

4. **Test aiStore retry/failure paths** — Add a test where the AI API consistently fails and verify that `job.status` becomes `'failed'` and `job.error` contains the error message after max retries.

5. **Test writingStore save error path** — Mock `chapterApi.update` to reject, call `saveCurrentChapter` with a valid chapter ID, and verify `saveStatus` becomes `'error'` and `showOperationError` was called.

6. **Add corrupted ciphertext test** — A single test passing a base64-encoded but invalid Fernet token to `decrypt_value` would close the gap.

7. **Consider fixing the Immer mutation bug** — Rather than suppressing the rejection, fix the root cause in `processNextJob` (likely a direct state mutation inside an Immer produce callback).
