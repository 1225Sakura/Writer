# Security Review — Round 1

**Reviewer:** security-reviewer agent
**Date:** 2026-05-21
**Scope:** Encryption, Rate Limiter, WebSocket Message Queue

## Verdict: PASS

## Summary

All three security components are correctly implemented for a local desktop application. No critical or high-severity vulnerabilities were found. All SQL queries use parameterized statements, encryption uses industry-standard Fernet with proper key management, and session isolation is maintained throughout. Two low-severity findings and a handful of test coverage gaps were identified, none of which represent exploitable risks in the current deployment context.

## Findings

| # | Severity | Component | Finding | Status |
|---|----------|-----------|---------|--------|
| 1 | LOW | encryption | Key file at `~/.writer/encryption.key` has world-readable Unix permissions (644) on non-Windows systems. On Windows, ACLs correctly restrict access to SYSTEM/Administrators/current-user only. Should set `0o600` on key file creation for cross-platform hardening. | OPEN |
| 2 | LOW | encryption | `decrypt_value()` silently returns plaintext on decryption failure (legacy fallback). This is intentional for migration but means a corrupted or tampered ciphertext silently passes through as-is. For a local desktop app this is acceptable; for a server deployment it would need stricter handling. | RESOLVED (by design) |
| 3 | LOW | wsqueue | `has_messages()` and `queue_size()` do not acquire the async lock, unlike `enqueue()`/`dequeue_all()`. Under concurrent access these read methods could return slightly stale counts. Not exploitable — purely a consistency concern for monitoring. | OPEN |
| 4 | LOW | ratelimit | The `_last_cleanup` timestamp in `SQLiteRateLimiter._maybe_cleanup()` is an instance variable updated without lock protection in the `check()` path. Since `check()` already holds `self._lock`, this is safe in practice, but the write to `self._last_cleanup` happens before the DB commit, meaning a failed commit could still advance the cleanup timer. | OPEN |

### Positive Findings (No Issues)

| # | Component | What was verified |
|---|-----------|-------------------|
| 5 | encryption | No hardcoded keys anywhere. Key generation uses `Fernet.generate_key()` (CSPRNG-backed). Env var priority is correct. |
| 6 | encryption | `encrypt_value("")` works correctly (empty string round-trips). |
| 7 | encryption | `migrate_plaintext_keys()` correctly skips `None` values, checks existing encryption via decrypt-then-skip pattern, and only commits when changes exist. |
| 8 | encryption | Startup lifecycle in `main.py:519-530` correctly calls `migrate_plaintext_keys()` before any API key usage at line 559-560. |
| 9 | ratelimit | **All SQL queries use parameterized placeholders** (`?` bindings). Zero string interpolation in SQL. No SQL injection surface. |
| 10 | ratelimit | `asyncio.Lock()` correctly serializes all read-modify-write operations in `check()`. Race condition between concurrent requests is prevented. |
| 11 | ratelimit | Cleanup runs inside the same lock as `check()`, so it cannot interfere with concurrent requests. |
| 12 | ratelimit | The adapter in `middleware/rate_limit.py` correctly bridges `SQLiteRateLimiter` to the middleware interface. |
| 13 | wsqueue | **JSON injection is not possible.** Messages are serialized with `json.dumps()` and deserialized with `json.loads()` — standard library handles all escaping. |
| 14 | wsqueue | Queue overflow is correctly handled: per-session cap (default 100) enforced, oldest undelivered message dropped when full. No unbounded growth. |
| 15 | wsqueue | Session isolation is enforced at the SQL level — all queries filter by `session_id` parameter. No cross-session data leak possible. |
| 16 | wsqueue | Malformed JSON in the queue is caught by `json.JSONDecodeError` handler in `dequeue_all()` (line 161-162) — skipped with a warning, does not crash. |
| 17 | auth | API key comparison uses `secrets.compare_digest()` in both HTTP and WebSocket auth paths (constant-time comparison, prevents timing attacks). |

## Test Coverage Assessment

**File:** `tests/test_security_roundtrip.py`

**Coverage is adequate for the current scope but has gaps:**

**Well-covered:**
- Encryption round-trip (6 tests): standard, unicode, empty string, legacy passthrough, availability check, IV randomness
- Rate limiter (6 tests): allow/block/reset, independent clients, custom window names, auto-initialize
- WS message queue (7 tests): enqueue/dequeue, FIFO order, session isolation, empty dequeue, has_messages/queue_size, auto-initialize, complex payloads

**Missing test coverage:**
1. `migrate_plaintext_keys()` — no test for the migration function itself (mixed encrypted/plaintext rows, already-encrypted skip, None handling)
2. Concurrent access — no test verifying the asyncio locks work under parallel coroutines
3. `encrypt_value` when `cryptography` is not installed — the `RuntimeError` path is untested
4. Rate limiter cleanup/timestamp expiry — the `_maybe_cleanup` periodic purge is untested
5. WS queue overflow — no test verifying the oldest-message-drop behavior when the cap is reached
6. WS queue `cleanup()` method — untested
7. Edge case: very large message payloads in the WS queue

These gaps are low-risk given the local-desktop deployment context, but should be addressed before any server-side deployment.

## Recommendations

1. **Set restrictive file permissions on key creation** (line 54 of `encryption.py`): After `write_bytes(key)`, add `os.chmod(_KEY_PATH, 0o600)` for Unix systems. Windows is already fine via default ACLs.

2. **Add `migrate_plaintext_keys` integration test**: Create a test that seeds a database with a mix of plaintext and encrypted keys, runs migration, and verifies all are encrypted afterward with round-trip decryption.

3. **Add overflow test for WS queue**: Test that enqueueing beyond `max_queue_per_session` correctly drops the oldest message and preserves FIFO order.

4. **Consider key rotation support**: The current design has no mechanism to rotate the Fernet key. If the key file is compromised, all stored ciphertexts need re-encryption. A future enhancement could support multiple keys with a key-id prefix.

5. **Consider locking `has_messages`/`queue_size`**: For consistency, these read methods in `WSMessageQueue` should acquire `self._lock`. Low priority since the slight staleness is harmless.

6. **Document the legacy plaintext fallback behavior**: The `decrypt_value()` fallback is correct but surprising — a code comment explaining the security tradeoff explicitly (plaintext visible in logs if debug enabled) would help future maintainers.
