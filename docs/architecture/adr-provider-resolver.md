# ADR: Provider Resolver (Phase 1 Track A)

**Status**: Accepted (Phase 1, 2026-07-22)
**Owner**: Backend (worker-1) + Lead
**Replaces**: Inline `settings.anthropic_*` reads scattered across 6 services

---

## §1 Session 事务边界

Provider resolution uses **two distinct session lifecycles**:

| Session type | Operations | Lifecycle |
|--------------|------------|-----------|
| Read-only | `list`, `get`, `get_active` | FastAPI `Depends(get_db)` — opened by request middleware |
| Write | `update`, `activate`, `delete`, `create` | FastAPI `Depends(get_db)` — same dependency, wrapped in route handler |

The session boundary comes from FastAPI's dependency injection. The resolver
never owns its own session — it always receives a `Session` from the caller.
This keeps the resolver orthogonal to transaction management: callers control
when to `commit()` and `rollback()`.

The resolver **never** calls `commit()` itself. It performs a `SELECT` to load
the active provider row, decrypts the key (read-only), and returns a
`ProviderConfig` snapshot. Cache invalidation is performed by the route
handler AFTER the write transaction commits (see §3).

---

## §2 缓存设计

In-process cache (single-process desktop app) keyed by
**`(user_id, project_id, active_provider_id)`** with **5-minute TTL**.

### Cache value

`ProviderConfig` is an **immutable snapshot** containing:

```python
@dataclass(frozen=True)
class ProviderConfig:
    provider_id: int
    name: str
    model: str
    base_url: str
    key: SecretStr          # wrapped secret (see §6)
    max_tokens: int
    temperature: float
```

Frozen dataclass guarantees immutability; cache entries cannot be mutated
in-place. Updating a provider means constructing a new `ProviderConfig`
and replacing the cache entry.

### Cache location

In-process `dict[(str, int, int), tuple[ProviderConfig, float]]` guarded by
`asyncio.Lock`. The single-process nature of the desktop app makes this safe;
no cross-process cache synchronization needed.

### Why no Redis/Memcached

Phase 1 spec §A.5 mandates "single-process desktop app". Adding a cache layer
would (a) introduce IPC overhead, (b) require extra dependencies, (c) complicate
the deployment story. The 5-minute TTL plus per-write invalidation gives a hit
rate of >95% for typical editing sessions.

---

## §3 失效机制

Cache invalidation happens **synchronously after write transaction commits**:

```python
# In route handler (e.g., ai_provider router)
provider = service.activate(provider_id)   # commits the DB transaction
resolver.invalidate(user_id, project_id)   # clears cache AFTER commit
return ApiResponse(data=provider)
```

The order is critical:
1. `service.activate()` — `commit()` succeeds
2. `resolver.invalidate()` — clear cache

If `commit()` fails (raises), `invalidate()` is never called and stale cache
remains — but the DB is unchanged so stale data is harmless.

### Cross-process safety

Desktop is single-user, single-process. If a future multi-process scenario
emerges, add `flock` on `~/.writer/provider-cache.lock`. Phase 1 doesn't ship
this because the cost (lock contention) outweighs the benefit (no other process
exists).

---

## §4 错误码

| Condition | Error code | HTTP status | Rationale |
|-----------|-----------|-------------|-----------|
| No active provider configured | `PROVIDER_NONE_ACTIVE` | **409 Conflict** | Configuration state, not auth |
| Provider not found | `PROVIDER_NOT_FOUND` | 404 | Resource lookup |
| Provider URL fails SSRF check | `PROVIDER_URL_BLOCKED` | 400 | Security validation |
| Connection test failed | `PROVIDER_TEST_FAILED` | 502 | Upstream failure |

**409 Conflict (not 401/403)** because the user IS authenticated; the request
simply references a missing configuration. This matches HTTP semantics:
- 401/403 = identity/permission problem
- 409 = request can't be fulfilled due to current resource state

### Response envelope

Aligns with existing `ApiResponse[T]`:

```json
{
  "success": false,
  "error": {
    "code": "PROVIDER_NONE_ACTIVE",
    "message": "No active AI provider configured. Run /settings/ai-provider to activate one."
  }
}
```

---

## §5 解密责任

**Single point of decryption: `ProviderResolver.get_active()`.**

- Repositories (`AIProviderRepository`) only read/write **encrypted bytes**.
  They never see plaintext keys.
- Services (`AIProviderService.update/create`) call `encrypt_api_key()` on
  write — never decrypt.
- Routers calling `get_ai_provider_key` (the explicit key-retrieval endpoint)
  use `decrypt_api_key()` directly because that's the documented purpose.
- All AI consumer services (`ai_generate`, `ai_review`, `ai_fill_fields`,
  `ai_rewrite_description`, `ai_generate_entity`, `ai_review_consistency`)
  receive a **`ProviderConfig` with decrypted `SecretStr`** from the resolver.

This containment means:
- DB compromise → ciphertext only (AES-GCM, requires master key)
- Log capture → `***` (SecretStr.__repr__)
- Memory dump → plaintext only in request-local stack frame, cleared at
  end of request via `SecretStr.clear()` in `finally` block

---

## §6 Python 内存安全（CRITICAL）

Python `str` is **immutable and unzeroizable** — there's no equivalent of
Rust's `Zeroize<String>`. We minimize plaintext lifetime through:

### 6.1 SecretStr wrapper

```python
class SecretStr:
    """Bytes-backed secret; minimizes plaintext lifetime."""

    def __init__(self, plaintext: str):
        # bytearray can be overwritten; str cannot
        self._buf = bytearray(plaintext.encode("utf-8"))

    def __repr__(self) -> str:
        return "***"           # log/print safety

    def __str__(self) -> str:
        raise SecretAccessError("Use .get() to access plaintext")

    def get(self) -> str:
        return self._buf.decode("utf-8")

    def clear(self) -> None:
        # Overwrite bytes before releasing reference (best-effort)
        for i in range(len(self._buf)):
            self._buf[i] = 0

    def __del__(self):
        try:
            self.clear()
        except Exception:
            pass
```

### 6.2 Lifetime constraints

- ✅ Plaintext key exists **only** in `SecretStr._buf` bytearray
- ✅ `SecretStr` instances are **never** stored as instance attributes on
  long-lived objects (resolvers, services, repositories)
- ✅ `SecretStr` instances are **never** pickled, json-serialized, or
  passed through `repr()` / `str()` / format strings
- ✅ Anthropic SDK receives plaintext via `SecretStr.get()` inside the
  request handler; the SDK copies internally (out of our control)
- ✅ `finally` block in resolver calls `SecretStr.clear()` after use

### 6.3 Logging safety

All stdlib log handlers route through `CorrelationIDFilter` which calls
`record.getMessage()`. Because SecretStr has `__repr__ -> "***"`, even if
an f-string embeds `%r` of a SecretStr, the log output is `***`.

### 6.4 What this DOESN'T protect against

- Memory dump of running process (OS-level, out of scope for application code)
- Python interpreter heap snapshots (e.g., `gc.get_objects()`)
- Core dumps
- Swap file persistence

These are accepted risks; the alternative (Rust rewrite) is out of scope for
Phase 1.

---

## §7 SQLite 并发一致性

SQLite has **no row-level locking equivalent to Postgres `SELECT FOR UPDATE`**.
The desktop app uses WAL mode + transaction-level isolation:

### 7.1 WAL mode

- Default in `app/database.py` via `PRAGMA journal_mode=WAL`
- Allows concurrent readers + one writer
- Trade-off: extra `.wal` file (cleaned on `PRAGMA wal_checkpoint(TRUNCATE)`)

### 7.2 Write transactions: `BEGIN IMMEDIATE`

Write paths (`update`, `activate`, `delete`) wrap their work in
`BEGIN IMMEDIATE` (acquire write lock at statement start). SQLAlchemy emits
this automatically when using `session.begin()` context manager.

### 7.3 Read transactions: default deferred

Read paths (`get_active`, `list`) use default deferred transaction. SQLite
will upgrade to shared lock on first read; if a concurrent writer holds the
reserved/exclusive lock, readers retry with `SQLITE_BUSY` (handled by
SQLAlchemy `pool_pre_ping`).

### 7.4 Race condition coverage

The activate race (two clients both activate provider A and provider B)
is covered by the DB-level **partial unique index**:

```sql
CREATE UNIQUE INDEX idx_one_active_provider
    ON ai_providers (user_id)
    WHERE is_active = 1;
```

Whichever transaction commits first wins; the second fails with
`IntegrityError`. Application code catches this and retries once with
the latest DB state.

---

## §8 测试覆盖（CRITICAL）

The leakage test ensures no plaintext key escapes through any of the documented
output channels:

### 8.1 Test channels covered

1. **stdlib logging** via `caplog` (root logger + named loggers)
2. **Structlog** (if added later; passes because SecretStr.__repr__ → `***`)
3. **Sentry `beforeSend`** (mocked — verifies our app-side filter is `***`)
4. **JSONL sink** (`app/services/ai_log_emitter.py` — verifies payloads
   don't include plaintext)
5. **`traceback.format_exc()`** (verifies exception messages don't leak)
6. **HTTP debug log** (httpx `event_hooks` — verifies URL/headers don't
   include key)
7. **`repr()` of any object in scope** (sanity check)

### 8.2 Test mechanism

```python
def test_provider_key_zero_leakage(caplog):
    fake_key = "sk-fake-aaaa-12345-leak-test"

    # 1. Create test provider with fake_key
    # 2. Mock Anthropic SDK (intercept messages.create)
    # 3. Trigger AI call path
    # 4. Capture: caplog, repr(), traceback, json.dumps()

    # CRITICAL assertion: zero hits across all channels
    assert fake_key not in caplog.text
    assert fake_key not in repr(scope_objects)
    try:
        raise ValueError(fake_key)
    except Exception:
        assert fake_key not in traceback.format_exc()
```

### 8.3 Negative test (controls)

- `repr(SecretStr(fake_key))` → `"***"` (must NOT contain fake_key)
- `str(SecretStr(fake_key))` → raises (must NOT contain fake_key)
- `SecretStr(fake_key).get()` → fake_key (sanity — this is the escape hatch)

These three controls pin down the contract for future maintainers.

---

## §9 Migration Path

1. **Phase 1 Track A** (this ADR): Resolver + SecretStr + 3 caller services
2. **Phase 1 Track A.4**: Extend remaining 3 services (ai_generate_entity,
   ai_review_consistency, ai_rewrite_description)
3. **Phase 1 Track B**: Snapshot/persistence work uses resolver for any
   AI-backed restoration flows
4. **Future**: When (if) the app goes multi-process or multi-user,
   introduce `flock`-backed cache or migrate to Postgres

---

## §10 References

- `app/services/ai_provider.py` — AIProviderService (CRUD, no resolver)
- `app/services/ai_generate.py` — currently reads `settings.anthropic_*`
  (will switch to resolver)
- `app/core/security.py` — `decrypt_api_key`, `encrypt_api_key` (master key)
- `app/repositories/ai_provider.py` — AIProviderRepository (DB access only)
- `app/dependencies.py:187-313` — 6 AI service factories (will inject resolver)
