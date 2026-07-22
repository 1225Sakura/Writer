# IF-Line API Schema v1 (Frozen)

**Version:** v1.0
**Frozen at:** 2026-07-22
**Status:** CONTRACT-FROZEN — Breaking changes require v2 migration plan.
**Phase:** v0.5 patch Phase 0a.5 (IF vertical slice)
**Owner:** worker-3

This document freezes the request/response contract for the IF-Line fork
endpoint exposed by the FastAPI backend at `src/backend/`. Frontend
clients must NOT depend on any field or status code outside this
document without a coordinated schema bump.

---

## 1. Endpoint

### `POST /api/v1/if-lines/{if_line_id}/fork`

Fork an existing IF-Line at a chapter point, creating a divergent branch.

> **Implementation note (2026-07-22):** the router is mounted at
> `prefix="/if-lines"` under the parent `api_router` (which carries
> `/api/v1`), so the full path is `/api/v1/if-lines/{if_line_id}/fork`.
> The contract path is the only one clients depend on.

#### 1.1 Path parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `if_line_id` | string (UUID or int) | yes | The ID of the IF-Line to fork. Treated as opaque on the wire; backend resolves via `IFLine.id` lookup. |

#### 1.2 Request headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | yes | Must be `application/json`. |
| `X-API-Key` | yes | Local API key (v0.4 P0-Sec1a). Enforced by `verify_api_key` dependency. |
| `X-Request-ID` | optional | Correlation ID. Minted server-side if absent (v0.4 P0-Sec8). Echoed in response. |
| `Idempotency-Key` | required | UUID v4 generated client-side per logical fork attempt. Within 24h, reuse yields identical response. |

#### 1.3 Request body schema

```json
{
  "if_line_id": "1f6b3e9a-2c41-4f88-9b71-c9a6f1a5e5d6",
  "source_chapter_id": "8c2b7e10-3a5b-4b6f-8d4a-1c5b9f7e2a31",
  "label": "主角接受邀请的分支"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `if_line_id` | string | yes | Must match path parameter. |
| `source_chapter_id` | string (UUID or int) | optional | Anchor chapter for the fork. If omitted, forks at the latest chapter of the IF-Line. |
| `label` | string (1–120 chars) | optional | Human-readable name for the new branch. |

#### 1.4 Response body schema (200 OK)

```json
{
  "success": true,
  "data": {
    "forked_if_line_id": "2c8a9f01-5b7d-4e21-a3f4-7d9c1e2b8f44",
    "forked_chapter_id": "9d3c8f22-6c8e-5f32-b405-8e0d2f3c9a55",
    "conflicts": [
      {
        "chapter_id": "8c2b7e10-3a5b-4b6f-8d4a-1c5b9f7e2a31",
        "type": "missing_chapter",
        "message": "Target IFLine has no chapter at order 12"
      }
    ]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `forked_if_line_id` | string | The new IF-Line created by the fork. |
| `forked_chapter_id` | string | The new chapter anchored at `source_chapter_id`. |
| `conflicts` | array | Zero or more non-fatal conflicts encountered during fork (e.g. missing chapters). Fork still succeeds when this is non-empty. |

---

## 2. Error codes

All error responses follow the unified envelope:

```json
{
  "success": false,
  "error": {
    "code": "STRING_CODE",
    "message": "Human-readable",
    "correlation_id": "uuid"
  }
}
```

| HTTP | code | When |
|------|------|------|
| 401 | `AUTH_ERROR` | `X-API-Key` missing or invalid. |
| 403 | `FORBIDDEN_ERROR` | API key lacks scope for this project. |
| 404 | `NOT_FOUND` | IF-Line or chapter does not exist. |
| 409 | `CONFLICT` | Idempotency-Key conflict with different payload. |
| 422 | `VALIDATION_ERROR` | Body schema invalid (e.g. `label` > 120 chars). |
| 500 | `INTERNAL_ERROR` | Unhandled server error. `correlation_id` is logged. |

---

## 3. Idempotency contract

`Idempotency-Key` is mandatory. Server-side behaviour:

1. First request with key `K` and payload `P1` — execute, cache response (status, body) keyed on `K`.
2. Subsequent request with key `K` and payload `P1` (within 24h) — return cached response, **no side effects**.
3. Subsequent request with key `K` and payload `P2` (different) — return 409 `CONFLICT`.
4. After 24h, the key is evicted; subsequent requests with `K` execute as fresh.

Client MUST generate `Idempotency-Key` with `crypto.randomUUID()` (or equivalent) for every fork attempt, including retries of the same logical user action.

---

## 4. Transactional atomicity

The fork endpoint executes the following operations **within a single
database transaction**:

1. Validate `if_line_id` exists (else 404).
2. Validate `source_chapter_id` exists if supplied (else 404).
3. Create new `IFLine` row (child of source).
4. Copy source chapter to a new `Chapter` row bound to the new IFLine.
5. Commit.

If any step fails, the entire transaction rolls back. Partial forks
MUST NOT be persisted. Clients receive either a complete success
response or a complete error response.

---

## 5. Out of scope (v1)

- Batch fork (multiple IF-Lines in one request).
- Conflict resolution UI.
- Real-time push of fork updates to other clients (use WebSocket separately).
- Authorization beyond local API key (per-project RBAC is v2).

---

## 6. Versioning

Breaking changes require:

1. Bump `version` in `app/config.py` (`settings.app_version`).
2. New schema file: `if-api-schema-v2.md`.
3. Frontend migrator: keep v1 client alive for one release behind a
   `feature_flags.IF_API_VERSION` flag.