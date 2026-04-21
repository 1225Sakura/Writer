# API Design Document

## Auto Novel Writer - API Route & Endpoint Architecture

**Version:** 1.0  
**Date:** 2026-04-21  
**Status:** Design Review  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current API Assessment](#2-current-api-assessment)
3. [API Design Principles](#3-api-design-principles)
4. [Base URL & Versioning](#4-base-url--versioning)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Complete Endpoint Catalog](#6-complete-endpoint-catalog)
7. [Request/Response Standards](#7-requestresponse-standards)
8. [Error Handling Specification](#8-error-handling-specification)
9. [Rate Limiting Strategy](#9-rate-limiting-strategy)
10. [WebSocket Event Protocol](#10-websocket-event-protocol)
11. [OpenAPI Documentation](#11-openapi-documentation)
12. [Missing Endpoints & Future Extensions](#12-missing-endpoints--future-extensions)
13. [GraphQL Consideration](#13-graphql-consideration)
14. [Implementation Roadmap](#14-implementation-roadmap)

---

## 1. Executive Summary

This document defines the complete API architecture for the Auto Novel Writer backend. It consolidates existing endpoints, identifies gaps, and provides a forward-looking design that supports the three-interface architecture (Chat Initialization, Setting Editor, Writing Editor) with room for future growth.

**Key Decisions:**
- Continue with RESTful design (no GraphQL needed for current scope)
- Version prefix: `/api/v1`
- Unified error response format with error codes
- Tiered rate limiting per endpoint group
- WebSocket for real-time chat and notifications
- No multi-tenancy (single-user desktop app)

---

## 2. Current API Assessment

### 2.1 Existing Routes (routes/__init__.py)

| Router | Prefix | Tags | Auth | Status |
|--------|--------|------|------|--------|
| auth | `/auth` | auth | None | OK |
| chat | `/chat` | chat | Required | OK |
| settings | `/settings` | settings | Required | OK |
| chapters | `/chapters` | chapters | Required | OK |
| ai | `/ai` | ai | Required | OK |
| styles | `/styles` | styles | Required | OK |
| export_import | `/api/project` | project | Required | **Inconsistent prefix** |
| tasks | `/tasks` | tasks | **Missing** | Needs auth |
| health | `/health` | health | None | OK |
| cache | `/cache` | cache | Required | OK |

### 2.2 Issues Found

#### Issue 1: Inconsistent Route Prefix
`export_import.py` uses `prefix="/api/project"` which creates `/api/v1/api/project/export` - double `/api`. Should be `prefix="/project"`.

#### Issue 2: Missing Authentication on Tasks Router
`routes/tasks.py` does not include `dependencies=[require_auth]`, leaving background task endpoints unprotected.

#### Issue 3: Duplicate Pydantic Models
Many route files define local Pydantic models that duplicate or shadow `backend.schemas` imports (e.g., `ChatMessageCreate` in `chat.py` vs imported `ChatMessageCreateRequest`).

#### Issue 4: Inconsistent Update Patterns
- Some updates use `PATCH` with `exclude_unset=True` (correct)
- Some use `PUT` semantics with full replacement
- Some update endpoints don't set `updated_at` consistently

#### Issue 5: Missing Sort Parameter
List endpoints support `skip`/`limit` but lack `sort`/`order` parameters.

#### Issue 6: No Bulk Operations
No endpoints support batch create/update/delete operations.

#### Issue 7: Inconsistent Response for DELETE
Some return `{"message": "..."}`, others could benefit from returning the deleted object or a structured response.

#### Issue 8: Missing Pagination Metadata
List endpoints return arrays without total count, making client-side pagination impossible.

#### Issue 9: Route Conflict Risk in chapters.py
IF lines and plot threads are registered before `/{chapter_id}` but the order is fragile. Consider moving to dedicated routers.

---

## 3. API Design Principles

1. **RESTful Resource Naming**: Use nouns (plural) for collections, IDs for individuals
2. **Consistent HTTP Methods**: GET (read), POST (create), PATCH (partial update), DELETE (remove)
3. **Standardized Responses**: All responses follow a consistent envelope structure where appropriate
4. **Comprehensive Validation**: Pydantic models with field validators on all inputs
5. **Explicit Error Codes**: Every error includes a machine-readable `error_code` field
6. **Rate Limit Headers**: All responses include `X-RateLimit-*` headers
7. **Request ID Propagation**: Every request gets a `X-Request-ID` header for tracing

---

## 4. Base URL & Versioning

### Current
```
http://localhost:8000/api/v1
```

### Versioning Strategy

| Version | Path | Status | Description |
|---------|------|--------|-------------|
| v1 | `/api/v1` | Current | Initial stable API |
| v2 | `/api/v2` | Future | Breaking changes only |

**Rules:**
- Minor additions (new endpoints, new optional fields) go into current version
- Breaking changes (removed fields, changed behavior) require new version
- Support N and N-1 versions simultaneously during transition period
- Version deprecation announced 6 months in advance

### URL Structure
```
/api/v1/{resource}/{id}/{sub-resource}
```

---

## 5. Authentication & Authorization

### Current: API Key Authentication

```http
X-API-Key: writer_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Auth Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/key` | None | Get or create API key |
| POST | `/auth/key/refresh` | None | Rotate API key |
| GET | `/auth/status` | None | Check auth configuration |

### Auth Behavior
- Localhost requests skip auth (configurable via `auth_skip_localhost`)
- Health endpoints (`/health`, `/health/ready`, `/health/live`) are public
- All other endpoints require valid API key
- WebSocket connections authenticate via query parameter `?api_key=...`

---

## 6. Complete Endpoint Catalog

### 6.1 Health & Monitoring

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Comprehensive health check |
| GET | `/health/ready` | None | Readiness probe (k8s) |
| GET | `/health/live` | None | Liveness probe (k8s) |

### 6.2 Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/key` | None | Get/create API key |
| POST | `/auth/key/refresh` | None | Rotate API key |
| GET | `/auth/status` | None | Auth status |

### 6.3 Chat Sessions (Interface 1)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | `/chat/sessions` | Required | 60/min | Create session |
| GET | `/chat/sessions` | Required | 60/min | List sessions |
| GET | `/chat/sessions/{id}` | Required | 60/min | Get session |
| DELETE | `/chat/sessions/{id}` | Required | 60/min | Delete session |
| POST | `/chat/sessions/{id}/messages` | Required | 30/min | Send message |
| GET | `/chat/sessions/{id}/messages` | Required | 60/min | Get messages |
| GET | `/chat/sessions/{id}/entities` | Required | 60/min | Get extracted entities |
| PATCH | `/chat/entities/{id}/confirm` | Required | 60/min | Confirm entity |

### 6.4 Settings (Interface 2)

#### Characters
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/settings/characters` | Required | List characters |
| POST | `/settings/characters` | Required | Create character |
| GET | `/settings/characters/{id}` | Required | Get character |
| PATCH | `/settings/characters/{id}` | Required | Update character |
| DELETE | `/settings/characters/{id}` | Required | Delete character |
| GET | `/settings/characters/{id}/relationships` | Required | List relationships |
| POST | `/settings/characters/{id}/relationships` | Required | Create relationship |
| DELETE | `/settings/characters/{id}/relationships/{rel_id}` | Required | Delete relationship |
| GET | `/settings/characters/{id}/storylines` | Required | List storylines |
| POST | `/settings/characters/{id}/storylines` | Required | Create storyline |
| PATCH | `/settings/characters/{id}/storylines/{story_id}` | Required | Update storyline |
| DELETE | `/settings/characters/{id}/storylines/{story_id}` | Required | Delete storyline |

#### Items
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/settings/items` | Required | List items |
| POST | `/settings/items` | Required | Create item |
| GET | `/settings/items/{id}` | Required | Get item |
| PATCH | `/settings/items/{id}` | Required | Update item |
| DELETE | `/settings/items/{id}` | Required | Delete item |

#### Locations
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/settings/locations` | Required | List locations |
| POST | `/settings/locations` | Required | Create location |
| GET | `/settings/locations/{id}` | Required | Get location |
| PATCH | `/settings/locations/{id}` | Required | Update location |
| DELETE | `/settings/locations/{id}` | Required | Delete location |

#### Factions
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/settings/factions` | Required | List factions |
| POST | `/settings/factions` | Required | Create faction |
| GET | `/settings/factions/{id}` | Required | Get faction |
| PATCH | `/settings/factions/{id}` | Required | Update faction |
| DELETE | `/settings/factions/{id}` | Required | Delete faction |

#### World Settings
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/settings/world` | Required | List world settings |
| POST | `/settings/world` | Required | Create world setting |
| GET | `/settings/world/{id}` | Required | Get world setting |
| PATCH | `/settings/world/{id}` | Required | Update world setting |
| DELETE | `/settings/world/{id}` | Required | Delete world setting |

#### Rules
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/settings/rules` | Required | List rules |
| POST | `/settings/rules` | Required | Create rule |
| GET | `/settings/rules/{id}` | Required | Get rule |
| PATCH | `/settings/rules/{id}` | Required | Update rule |
| DELETE | `/settings/rules/{id}` | Required | Delete rule |

#### Writing Settings
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/settings/writing` | Required | Get writing settings |
| PATCH | `/settings/writing` | Required | Update writing settings |

### 6.5 Chapters & Story Structure (Interface 3)

#### Outlines
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/chapters/outlines` | Required | List outlines |
| POST | `/chapters/outlines` | Required | Create outline |
| GET | `/chapters/outlines/{id}` | Required | Get outline |
| PATCH | `/chapters/outlines/{id}` | Required | Update outline |
| DELETE | `/chapters/outlines/{id}` | Required | Delete outline |

#### Chapters
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/chapters` | Required | List chapters |
| POST | `/chapters` | Required | Create chapter |
| GET | `/chapters/{id}` | Required | Get chapter |
| PATCH | `/chapters/{id}` | Required | Update chapter |
| DELETE | `/chapters/{id}` | Required | Delete chapter |

#### Draft Versions
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/chapters/{id}/drafts` | Required | List drafts |
| POST | `/chapters/{id}/drafts` | Required | Create draft |
| GET | `/chapters/{id}/drafts/{version}` | Required | Get draft |
| DELETE | `/chapters/{id}/drafts/{version}` | Required | Delete draft |

#### IF Lines
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/chapters/if-lines` | Required | List IF lines |
| POST | `/chapters/if-lines` | Required | Create IF line |
| GET | `/chapters/if-lines/{id}` | Required | Get IF line |
| PATCH | `/chapters/if-lines/{id}` | Required | Update IF line |
| DELETE | `/chapters/if-lines/{id}` | Required | Delete IF line |

#### Plot Threads
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/chapters/plot-threads` | Required | List plot threads |
| POST | `/chapters/plot-threads` | Required | Create plot thread |
| GET | `/chapters/plot-threads/{id}` | Required | Get plot thread |
| PATCH | `/chapters/plot-threads/{id}` | Required | Update plot thread |
| DELETE | `/chapters/plot-threads/{id}` | Required | Delete plot thread |

#### AI Inspections
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/chapters/{id}/inspections` | Required | List inspections |
| POST | `/chapters/{id}/inspections` | Required | Create inspection |

### 6.6 AI Operations

#### Content Generation
| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | `/ai/generate` | Required | 30/min | Generate content (streaming) |
| POST | `/ai/review` | Required | 10/min | Review world settings |
| POST | `/ai/extract-entities` | Required | 30/min | Extract entities from chat |
| POST | `/ai/chapters/{id}/inspect` | Required | 10/min | Inspect chapter |

#### Context & Extraction
| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | `/ai/context` | Required | 30/min | Build execution package |
| POST | `/ai/extract` | Required | 30/min | Extract structured entities |

#### Quality Checkers
| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | `/ai/check/consistency` | Required | 10/min | World consistency check |
| POST | `/ai/check/continuity` | Required | 10/min | Narrative continuity check |
| POST | `/ai/check/pacing` | Required | 10/min | Pacing analysis |
| POST | `/ai/check/ooc` | Required | 10/min | Out-of-character check |
| POST | `/ai/check/high-point` | Required | 10/min | Excitement density check |
| POST | `/ai/check/reader-pull` | Required | 10/min | Reader engagement check |

### 6.7 Writing Styles

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/styles` | Required | List styles |
| GET | `/styles/{id}` | Required | Get style |

### 6.8 Project Export/Import

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/project/export` | Required | Export project (JSON) |
| GET | `/project/export/json` | Required | Export as JSON file |
| GET | `/project/export/yaml` | Required | Export as YAML file |
| GET | `/project/export/zip` | Required | Export as ZIP archive |
| POST | `/project/import` | Required | Import from JSON |
| POST | `/project/import/yaml` | Required | Import from YAML |
| POST | `/project/import/zip` | Required | Import from ZIP |

### 6.9 Background Tasks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/tasks` | Required | Submit task |
| GET | `/tasks` | Required | List tasks |
| GET | `/tasks/{id}` | Required | Get task status |
| DELETE | `/tasks/{id}` | Required | Cancel task |

### 6.10 Cache Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/cache/stats` | Required | Cache statistics |
| POST | `/cache/flush` | Required | Clear all cache |
| POST | `/cache/invalidate/{tag}` | Required | Invalidate by tag |

---

## 7. Request/Response Standards

### 7.1 Pagination

All list endpoints support standardized pagination:

**Query Parameters:**
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| skip | int | 0 | - | Records to skip |
| limit | int | 20 | 100 | Records per page |
| sort | string | `created_at` | - | Sort field |
| order | string | `desc` | - | `asc` or `desc` |

**Response Structure:**
```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "skip": 0,
    "limit": 20,
    "has_more": true
  }
}
```

### 7.2 Filtering

List endpoints support filtering via query parameters:

```
GET /settings/characters?tier=protagonist&sort=name&order=asc
GET /chapters?outline_id=1&status=in_progress
GET /chapters/plot-threads?status=active
```

### 7.3 Common Request Models

#### PaginatedRequest
```json
{
  "skip": 0,
  "limit": 20,
  "sort": "created_at",
  "order": "desc"
}
```

#### BulkOperationRequest
```json
{
  "operation": "delete",
  "ids": [1, 2, 3]
}
```

### 7.4 Common Response Models

#### Success Response (Single Resource)
```json
{
  "id": 1,
  "name": "张三",
  "created_at": "2026-04-21T10:00:00Z",
  "updated_at": "2026-04-21T10:00:00Z"
}
```

#### List Response
```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "skip": 0,
    "limit": 20,
    "has_more": true
  }
}
```

#### Delete Response
```json
{
  "success": true,
  "id": 1,
  "message": "Resource deleted"
}
```

---

## 8. Error Handling Specification

### 8.1 Error Response Format

All errors follow this structure:

```json
{
  "error_code": "CHARACTER_NOT_FOUND",
  "message": "Character not found (id=999)",
  "details": {
    "character_id": 999
  },
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-04-21T10:00:00Z"
}
```

### 8.2 HTTP Status Codes

| Status | Code | Usage |
|--------|------|-------|
| 200 | OK | Successful GET, PATCH, DELETE |
| 201 | Created | Successful POST |
| 400 | Bad Request | Validation error, malformed request |
| 401 | Unauthorized | Missing API key |
| 403 | Forbidden | Invalid API key |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource conflict (duplicate order, etc.) |
| 422 | Unprocessable | Semantic validation failure |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Error | Server error |
| 502 | Bad Gateway | AI service error |
| 503 | Service Unavailable | Database unavailable |

### 8.3 Error Codes by Domain

See `backend/middleware/errors.py` for complete error code registry. Key codes:

| Code | HTTP | Description |
|------|------|-------------|
| INTERNAL_ERROR | 500 | Generic server error |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 422 | Input validation failed |
| AUTH_ERROR | 401 | Authentication failed |
| PERMISSION_DENIED | 403 | Invalid credentials |
| RATE_LIMIT_EXCEEDED | 429 | Rate limit hit |
| AI_SERVICE_ERROR | 502 | AI API failure |
| DATABASE_ERROR | 500 | Database operation failed |

---

## 9. Rate Limiting Strategy

### 9.1 Tiered Rate Limits

| Tier | Endpoints | Limit | Window |
|------|-----------|-------|--------|
| Critical | AI checkers | 10 | 60s |
| High | AI generation, review | 30 | 60s |
| Medium | Chat messages | 30 | 60s |
| Standard | All other API | 60 | 60s |
| Public | Health, auth | Unlimited | - |

### 9.2 Rate Limit Headers

All responses include:
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1713696000
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
```

### 9.3 Rate Limit Response

```json
{
  "error_code": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded. Please try again later.",
  "details": {
    "limit": 30,
    "window": 60,
    "retry_after": 45
  },
  "request_id": "...",
  "timestamp": "2026-04-21T10:00:00Z"
}
```

---

## 10. WebSocket Event Protocol

### 10.1 Connection Endpoints

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `ws://localhost:8000/ws/chat/{session_id}` | Real-time chat | Query param `api_key` |
| `ws://localhost:8000/ws` | General updates | Query param `api_key` |

### 10.2 Message Format

All WebSocket messages are JSON with a `type` field:

#### Client -> Server
```json
{"type": "message", "content": "...", "role": "user"}
{"type": "ping"}
{"type": "typing_start"}
{"type": "typing_stop"}
```

#### Server -> Client
```json
{"type": "message", "content": "...", "role": "assistant", "timestamp": "..."}
{"type": "ping", "timestamp": 1713696000}
{"type": "error", "code": "rate_limit_exceeded", "message": "..."}
{"type": "status", "status": "generating", "progress": 0.5}
{"type": "chunk", "content": "...", "operation": "continue"}
{"type": "complete", "content": "...", "metadata": {...}}
```

### 10.3 Event Types

| Type | Direction | Description |
|------|-----------|-------------|
| `message` | Bidirectional | Chat message |
| `ping` | Server->Client | Keep-alive ping |
| `pong` | Client->Server | Keep-alive response |
| `error` | Server->Client | Error notification |
| `status` | Server->Client | Operation status update |
| `chunk` | Server->Client | Streaming content chunk |
| `complete` | Server->Client | Operation completed |
| `typing_start` | Client->Server | User started typing |
| `typing_stop` | Client->Server | User stopped typing |

### 10.4 Heartbeat

- Server sends `ping` every 30 seconds
- Client must respond with `pong` within 90 seconds
- Connection closed if no pong received

### 10.5 Rate Limiting

- 120 messages per 60 seconds per session
- Messages exceeding 64KB are rejected

---

## 11. OpenAPI Documentation

### 11.1 Auto-Generated Docs

FastAPI automatically generates:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **OpenAPI JSON**: `http://localhost:8000/openapi.json`

### 11.2 OpenAPI Enhancements Needed

1. **Add response examples** to all endpoints using `responses` parameter
2. **Add operation summaries** for all endpoints
3. **Tag descriptions** for each tag group
4. **Security scheme** documentation for API key

### 11.3 Example OpenAPI Extension

```python
@router.get(
    "/characters",
    response_model=PaginatedResponse[CharacterResponse],
    summary="List characters",
    description="Retrieve a paginated list of characters with optional filtering by tier.",
    responses={
        200: {"description": "Successful response", "model": PaginatedResponse[CharacterResponse]},
        401: {"description": "Unauthorized", "model": ErrorResponse},
        429: {"description": "Rate limit exceeded", "model": ErrorResponse},
    },
    tags=["characters"]
)
```

---

## 12. Missing Endpoints & Future Extensions

### 12.1 Missing for Current MVP

#### Scenes (within chapters)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/chapters/{id}/scenes` | List scenes in chapter |
| POST | `/chapters/{id}/scenes` | Create scene |
| GET | `/chapters/{id}/scenes/{scene_id}` | Get scene |
| PATCH | `/chapters/{id}/scenes/{scene_id}` | Update scene |
| DELETE | `/chapters/{id}/scenes/{scene_id}` | Delete scene |

#### Timeline / Events
| Method | Path | Description |
|--------|------|-------------|
| GET | `/settings/timeline` | List timeline events |
| POST | `/settings/timeline` | Create timeline event |
| GET | `/settings/timeline/{id}` | Get timeline event |
| PATCH | `/settings/timeline/{id}` | Update timeline event |
| DELETE | `/settings/timeline/{id}` | Delete timeline event |

#### Search
| Method | Path | Description |
|--------|------|-------------|
| GET | `/search` | Global search across all entities |
| GET | `/search/characters` | Search characters |
| GET | `/search/chapters` | Search chapters |

#### Statistics / Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats/writing` | Writing statistics |
| GET | `/stats/progress` | Novel progress |
| GET | `/stats/ai-usage` | AI usage statistics |

### 12.2 Future v2 Considerations

- **Bulk operations**: `POST /bulk/characters`, `PATCH /bulk/chapters`
- **Advanced filtering**: `GET /chapters?filter[status]=in_progress&filter[word_count][gt]=1000`
- **Field selection**: `GET /characters?fields=id,name,tier`
- **Embed relations**: `GET /characters?embed=relationships,storylines`
- **Webhooks**: `POST /webhooks` for external integrations

---

## 13. GraphQL Consideration

### Decision: Do NOT implement GraphQL

**Reasons:**
1. **Single-user desktop app**: No complex multi-client query requirements
2. **Frontend is React SPA**: Known query patterns, no over-fetching concerns
3. **Team size**: Small team, REST is simpler to maintain
4. **Current complexity**: Entity relationships are manageable with REST
5. **Performance**: SQLite backend, no N+1 query optimization needed

**Revisit if:**
- Mobile app added with different data requirements
- Complex dashboard with aggregations needed
- Third-party integrations require flexible queries

---

## 14. Implementation Roadmap

### Phase 1: Fixes (Immediate)

1. **Fix export_import prefix**: Change `prefix="/api/project"` to `prefix="/project"`
2. **Add auth to tasks router**: Add `dependencies=[require_auth]` to tasks router
3. **Remove duplicate models**: Consolidate Pydantic models into `backend/schemas.py`
4. **Standardize DELETE responses**: Return structured `{success, id, message}`

### Phase 2: Enhancements (Short-term)

1. **Add pagination metadata** to all list endpoints
2. **Add sort/order parameters** to all list endpoints
3. **Add search endpoints** for global and per-entity search
4. **Add scene endpoints** within chapters
5. **Add timeline/event endpoints**
6. **Enhance OpenAPI docs** with examples and descriptions

### Phase 3: Advanced (Medium-term)

1. **Bulk operations** endpoints
2. **Advanced filtering** syntax
3. **Field selection** support
4. **Statistics/analytics** endpoints
5. **API versioning** infrastructure for v2

---

## Appendix A: Complete Endpoint Summary Table

| # | Method | Path | Auth | Rate Limit | Tags |
|---|--------|------|------|------------|------|
| 1 | GET | `/health` | None | - | health |
| 2 | GET | `/health/ready` | None | - | health |
| 3 | GET | `/health/live` | None | - | health |
| 4 | POST | `/auth/key` | None | - | auth |
| 5 | POST | `/auth/key/refresh` | None | - | auth |
| 6 | GET | `/auth/status` | None | - | auth |
| 7 | POST | `/chat/sessions` | Required | 60/min | chat |
| 8 | GET | `/chat/sessions` | Required | 60/min | chat |
| 9 | GET | `/chat/sessions/{id}` | Required | 60/min | chat |
| 10 | DELETE | `/chat/sessions/{id}` | Required | 60/min | chat |
| 11 | POST | `/chat/sessions/{id}/messages` | Required | 30/min | chat |
| 12 | GET | `/chat/sessions/{id}/messages` | Required | 60/min | chat |
| 13 | GET | `/chat/sessions/{id}/entities` | Required | 60/min | chat |
| 14 | PATCH | `/chat/entities/{id}/confirm` | Required | 60/min | chat |
| 15 | GET | `/settings/characters` | Required | 60/min | settings |
| 16 | POST | `/settings/characters` | Required | 60/min | settings |
| 17 | GET | `/settings/characters/{id}` | Required | 60/min | settings |
| 18 | PATCH | `/settings/characters/{id}` | Required | 60/min | settings |
| 19 | DELETE | `/settings/characters/{id}` | Required | 60/min | settings |
| 20 | GET | `/settings/characters/{id}/relationships` | Required | 60/min | settings |
| 21 | POST | `/settings/characters/{id}/relationships` | Required | 60/min | settings |
| 22 | DELETE | `/settings/characters/{id}/relationships/{rel_id}` | Required | 60/min | settings |
| 23 | GET | `/settings/characters/{id}/storylines` | Required | 60/min | settings |
| 24 | POST | `/settings/characters/{id}/storylines` | Required | 60/min | settings |
| 25 | PATCH | `/settings/characters/{id}/storylines/{story_id}` | Required | 60/min | settings |
| 26 | DELETE | `/settings/characters/{id}/storylines/{story_id}` | Required | 60/min | settings |
| 27 | GET | `/settings/items` | Required | 60/min | settings |
| 28 | POST | `/settings/items` | Required | 60/min | settings |
| 29 | GET | `/settings/items/{id}` | Required | 60/min | settings |
| 30 | PATCH | `/settings/items/{id}` | Required | 60/min | settings |
| 31 | DELETE | `/settings/items/{id}` | Required | 60/min | settings |
| 32 | GET | `/settings/locations` | Required | 60/min | settings |
| 33 | POST | `/settings/locations` | Required | 60/min | settings |
| 34 | GET | `/settings/locations/{id}` | Required | 60/min | settings |
| 35 | PATCH | `/settings/locations/{id}` | Required | 60/min | settings |
| 36 | DELETE | `/settings/locations/{id}` | Required | 60/min | settings |
| 37 | GET | `/settings/factions` | Required | 60/min | settings |
| 38 | POST | `/settings/factions` | Required | 60/min | settings |
| 39 | GET | `/settings/factions/{id}` | Required | 60/min | settings |
| 40 | PATCH | `/settings/factions/{id}` | Required | 60/min | settings |
| 41 | DELETE | `/settings/factions/{id}` | Required | 60/min | settings |
| 42 | GET | `/settings/world` | Required | 60/min | settings |
| 43 | POST | `/settings/world` | Required | 60/min | settings |
| 44 | GET | `/settings/world/{id}` | Required | 60/min | settings |
| 45 | PATCH | `/settings/world/{id}` | Required | 60/min | settings |
| 46 | DELETE | `/settings/world/{id}` | Required | 60/min | settings |
| 47 | GET | `/settings/rules` | Required | 60/min | settings |
| 48 | POST | `/settings/rules` | Required | 60/min | settings |
| 49 | GET | `/settings/rules/{id}` | Required | 60/min | settings |
| 50 | PATCH | `/settings/rules/{id}` | Required | 60/min | settings |
| 51 | DELETE | `/settings/rules/{id}` | Required | 60/min | settings |
| 52 | GET | `/settings/writing` | Required | 60/min | settings |
| 53 | PATCH | `/settings/writing` | Required | 60/min | settings |
| 54 | GET | `/chapters/outlines` | Required | 60/min | chapters |
| 55 | POST | `/chapters/outlines` | Required | 60/min | chapters |
| 56 | GET | `/chapters/outlines/{id}` | Required | 60/min | chapters |
| 57 | PATCH | `/chapters/outlines/{id}` | Required | 60/min | chapters |
| 58 | DELETE | `/chapters/outlines/{id}` | Required | 60/min | chapters |
| 59 | GET | `/chapters` | Required | 60/min | chapters |
| 60 | POST | `/chapters` | Required | 60/min | chapters |
| 61 | GET | `/chapters/{id}` | Required | 60/min | chapters |
| 62 | PATCH | `/chapters/{id}` | Required | 60/min | chapters |
| 63 | DELETE | `/chapters/{id}` | Required | 60/min | chapters |
| 64 | GET | `/chapters/{id}/drafts` | Required | 60/min | chapters |
| 65 | POST | `/chapters/{id}/drafts` | Required | 60/min | chapters |
| 66 | GET | `/chapters/{id}/drafts/{version}` | Required | 60/min | chapters |
| 67 | DELETE | `/chapters/{id}/drafts/{version}` | Required | 60/min | chapters |
| 68 | GET | `/chapters/if-lines` | Required | 60/min | chapters |
| 69 | POST | `/chapters/if-lines` | Required | 60/min | chapters |
| 70 | GET | `/chapters/if-lines/{id}` | Required | 60/min | chapters |
| 71 | PATCH | `/chapters/if-lines/{id}` | Required | 60/min | chapters |
| 72 | DELETE | `/chapters/if-lines/{id}` | Required | 60/min | chapters |
| 73 | GET | `/chapters/plot-threads` | Required | 60/min | chapters |
| 74 | POST | `/chapters/plot-threads` | Required | 60/min | chapters |
| 75 | GET | `/chapters/plot-threads/{id}` | Required | 60/min | chapters |
| 76 | PATCH | `/chapters/plot-threads/{id}` | Required | 60/min | chapters |
| 77 | DELETE | `/chapters/plot-threads/{id}` | Required | 60/min | chapters |
| 78 | GET | `/chapters/{id}/inspections` | Required | 60/min | chapters |
| 79 | POST | `/chapters/{id}/inspections` | Required | 60/min | chapters |
| 80 | POST | `/ai/generate` | Required | 30/min | ai |
| 81 | POST | `/ai/review` | Required | 10/min | ai |
| 82 | POST | `/ai/extract-entities` | Required | 30/min | ai |
| 83 | POST | `/ai/chapters/{id}/inspect` | Required | 10/min | ai |
| 84 | POST | `/ai/context` | Required | 30/min | ai |
| 85 | POST | `/ai/extract` | Required | 30/min | ai |
| 86 | POST | `/ai/check/consistency` | Required | 10/min | ai |
| 87 | POST | `/ai/check/continuity` | Required | 10/min | ai |
| 88 | POST | `/ai/check/pacing` | Required | 10/min | ai |
| 89 | POST | `/ai/check/ooc` | Required | 10/min | ai |
| 90 | POST | `/ai/check/high-point` | Required | 10/min | ai |
| 91 | POST | `/ai/check/reader-pull` | Required | 10/min | ai |
| 92 | GET | `/styles` | Required | 60/min | styles |
| 93 | GET | `/styles/{id}` | Required | 60/min | styles |
| 94 | GET | `/project/export` | Required | 10/min | project |
| 95 | GET | `/project/export/json` | Required | 10/min | project |
| 96 | GET | `/project/export/yaml` | Required | 10/min | project |
| 97 | GET | `/project/export/zip` | Required | 10/min | project |
| 98 | POST | `/project/import` | Required | 10/min | project |
| 99 | POST | `/project/import/yaml` | Required | 10/min | project |
| 100 | POST | `/project/import/zip` | Required | 10/min | project |
| 101 | POST | `/tasks` | Required | 60/min | tasks |
| 102 | GET | `/tasks` | Required | 60/min | tasks |
| 103 | GET | `/tasks/{id}` | Required | 60/min | tasks |
| 104 | DELETE | `/tasks/{id}` | Required | 60/min | tasks |
| 105 | GET | `/cache/stats` | Required | 60/min | cache |
| 106 | POST | `/cache/flush` | Required | 60/min | cache |
| 107 | POST | `/cache/invalidate/{tag}` | Required | 60/min | cache |

**Total: 107 endpoints**

---

## Appendix B: Schema Reference

### PaginatedResponse[T]
```python
class PaginatedResponse(BaseModel, Generic[T]):
    data: List[T]
    pagination: PaginationMeta

class PaginationMeta(BaseModel):
    total: int
    skip: int
    limit: int
    has_more: bool
```

### ErrorResponse
```python
class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None
    request_id: Optional[str] = None
    timestamp: str  # ISO 8601
```

### BulkOperationRequest
```python
class BulkOperationRequest(BaseModel):
    operation: Literal["create", "update", "delete"]
    items: List[dict]
```
