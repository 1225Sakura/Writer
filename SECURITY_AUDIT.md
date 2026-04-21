# Security Audit Report - Auto Novel Writer Backend

**Date:** 2026-04-21
**Auditor:** worker-5 (Security Audit Team)
**Scope:** Auth middleware, Pydantic schemas, rate limiting, CORS, SQL injection protection

---

## Executive Summary

The backend has solid security foundations with timing-safe auth, comprehensive input validation, and ORM-based SQL injection protection. However, there are critical gaps in WebSocket security and some medium-severity issues that should be addressed.

---

## Findings

### GOOD: What's Working Well

| Area | Finding | Assessment |
|------|---------|------------|
| **Auth** | API key validation uses `secrets.compare_digest()` | Timing-attack safe |
| **Auth** | Configurable localhost skip via `auth_skip_localhost` | Dev convenience without prod risk if disabled |
| **Auth** | Generated keys use `secrets.token_urlsafe(32)` | Cryptographically secure |
| **Rate Limiting** | Thread-safe in-memory store with TTL cleanup | Properly implemented |
| **Rate Limiting** | Returns 429 with `Retry-After` header | RFC compliant |
| **SQL Injection** | All queries use SQLAlchemy async ORM | Parameterized queries, no raw SQL |
| **Pydantic Validation** | Comprehensive field validators in all request schemas | Length limits, type checking, sanitization |
| **HTML Sanitization** | `html.escape()` applied to text fields | XSS prevention |
| **Error Handling** | Custom exception hierarchy, generic messages to clients | No sensitive info leakage |
| **CORS** | Uses `settings.cors_origins` (configurable) | Not hardcoded wildcard |
| **Credentials** | No hardcoded secrets in source code | .env files properly used |

---

### ISSUES: What Needs Fixing

#### CRITICAL

| # | Issue | Location | Risk | Recommendation |
|---|-------|----------|------|----------------|
| 1 | **WebSocket endpoints have NO authentication** | `main.py:430, 477` | Any client can connect to `/ws/chat/{session_id}` and `/ws` without API key | Add auth dependency to WebSocket endpoints |
| 2 | **WebSocket doesn't validate session_id ownership** | `main.py:431` | Users can send messages to any session_id, potentially reading other users' conversations | Validate the user owns the session before allowing WebSocket connection |

#### HIGH

| # | Issue | Location | Risk | Recommendation |
|---|-------|----------|------|----------------|
| 3 | **Rate limiting doesn't cover WebSocket endpoints** | `rate_limit.py:88` | WebSocket `/ws/chat/*` and `/ws` are not rate-limited, enabling DoS via connection flooding | Extend rate limiting middleware to cover `/ws/*` routes |
| 4 | **WebSocket JSON parsing has no size limit** | `main.py:267, 308` | `json.loads(data)` on uncontrolled input could cause memory issues | Add message size validation before parsing |

#### MEDIUM

| # | Issue | Location | Risk | Recommendation |
|---|-------|----------|------|----------------|
| 5 | **CORS allows all methods and headers** | `main.py:196-198` | `allow_methods=["*"]` and `allow_headers=["*"]` is overly permissive | Restrict to specific methods/headers needed by the app |
| 6 | **`MINIMAX_API_KEY=` placeholder in cli.py** | `cli.py:69` | Default empty value in source could confuse users or be accidentally deployed | Remove default or use `None` |
| 7 | **Health endpoint reveals AI API availability** | `routes/health.py:45` | `minimax_api_key` presence check leaks whether API is configured | Return generic status without revealing configuration details |

#### LOW

| # | Issue | Location | Risk | Recommendation |
|---|-------|----------|------|----------------|
| 8 | **Rate limit store is in-memory only** | `rate_limit.py` | Not shared across multiple server instances | Document this limitation for multi-instance deployments |
| 9 | **No WebSocket ping/pong timeout validation** | `main.py` | Connection could silently die without detection | Consider implementing connection health checks with timeouts |

---

## Risk Matrix

```
SEVERITY     │ LIKELIHOOD │ OVERALL   │ FIX PRIORITY
─────────────┼────────────┼───────────┼─────────────
Critical     │ High       │ Critical  │ Immediate
High         │ Medium     │ High      │ Soon
Medium       │ Low        │ Medium    │ Next sprint
Low          │ Low        │ Low       │ When convenient
```

---

## Recommendations (Priority Order)

### 1. Fix WebSocket Authentication (Critical)

Add auth dependency to WebSocket endpoints in `main.py`:

```python
@app.websocket("/ws/chat/{session_id}")
async def websocket_chat(
    websocket: WebSocket,
    session_id: int,
    api_key: Optional[str] = Query(None)
):
    # Verify API key first
    if not await verify_ws_api_key(api_key):
        await websocket.close(code=4001)
        return
    # TODO: Verify user owns session_id
```

### 2. Extend Rate Limiting to WebSocket (High)

Modify `rate_limit.py` to also cover `/ws/*` routes:

```python
if not (path.startswith("/api/v1/chat") or
        path.startswith("/api/v1/ai") or
        path.startswith("/ws")):
    return await call_next(request)
```

### 3. Add WebSocket Message Size Limit (High)

In WebSocket handlers, validate message size before parsing:

```python
MAX_WS_MESSAGE_SIZE = 1_000_000  # 1MB
if len(data) > MAX_WS_MESSAGE_SIZE:
    await websocket.send_json({"error": "Message too large"})
    return
```

### 4. Restrict CORS Configuration (Medium)

Use explicit origin list instead of wildcard:

```python
allow_origins=settings.cors_origins,  # Should be specific domains
allow_methods=["GET", "POST"],
allow_headers=["Content-Type", "X-API-Key"],
```

### 5. Sanitize Health Endpoint Response (Medium)

Return generic status without revealing configuration:

```python
# Instead of checking minimax_api_key existence
return {
    "status": "healthy",
    "ai_service": "configured" if settings.minimax_api_key else "not_configured"
}
# Change to:
return {"status": "healthy"}  # Generic, no details
```

---

## Verification

- **Auth:** Verified `secrets.compare_digest` usage in `middleware/auth.py:112`
- **SQL Injection:** Confirmed all DB queries use SQLAlchemy async ORM with parameterized queries
- **Rate Limiting:** Confirmed thread-safe implementation with TTL cleanup
- **Validation:** Reviewed all Pydantic schemas in `schemas/request_schemas.py`
- **Secrets:** Confirmed `.env` files for configuration, no hardcoded credentials
- **Error Messages:** Reviewed `middleware/errors.py` - no sensitive data leakage

---

## Conclusion

The backend has a strong security foundation. The critical WebSocket authentication gap and missing rate limiting for WebSocket endpoints are the most urgent issues to address. All high and critical issues should be resolved before production deployment.
