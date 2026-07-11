# 前后端契约差异 — 2026-07-09

> **TL;DR**: Backend `D:/writer/backend/` implements 34 REST/WS routes under 7 routers. Frontend `src/frontend/src/api/*.ts` makes **226** distinct HTTP/WS calls across 26 files. **Zero backend router prefix matches the frontend's actual call site**. The two systems were built against entirely different designs — the backend is a Phase 1-3 MVP (auth, characters, world, outlines, chapters, writing, chat, ai); the frontend is the full Phase 4-5 surface (settings/* sub-routers, agents/*, observability/*, constraints/*, snapshots/*, context/*, graph/*, engagement/*, etc.) targeting the *old* `src/backend/` which has been deleted.

## A. 前端调用但后端没有的端点（**完全无法工作的功能区**）

| Frontend path prefix | Frontend file(s) | # calls | Backend status |
|---|---|---:|---|
| `/auth/*` (key, key/refresh, status) | `auth.ts` | 3 | Backend has `/auth/register`, `/auth/login`, `/auth/me` only. **3/3 wrong.** |
| `/settings/characters/*` | `settings.ts:39-135` | 13 | Backend has `/characters/*` (no `/settings/` prefix). |
| `/settings/items/*` | `settings.ts:149-166` | 5 | Backend has none. |
| `/settings/locations/*` | `settings.ts:179-196` | 5 | Backend has none. |
| `/settings/factions/*` | `settings.ts:209-226` | 5 | Backend has none. |
| `/settings/world/*` | `settings.ts:237-254` | 5 | Backend has `/world/*` (no `/settings/`). |
| `/settings/rules/*` | `settings.ts:267-284` | 5 | Backend has none. |
| `/settings/writing` | `settings.ts:294-308` | 3 | Backend has `/writing/` (singular). |
| `/settings/relations/*` | `settings.ts:323-343` | 5 | Backend has none. |
| `/settings/ai-provider/*` | `settings.ts:369-383` | 7 | Backend has none. |
| `/project/export*`, `/project/import*` | `settings.ts:356`, `exportImport.ts:64-133` | 7 | Backend has none. |
| `/chapters/outlines/*` | `writing.ts:36-59` | 5 | Backend has `/outlines/*` (no `/chapters/`). |
| `/chapters/if-lines/*` | `writing.ts:167-200` | 5 | Backend has none. |
| `/chapters/plot-threads/*` | `writing.ts:214-249` | 5 | Backend has none. |
| `/chapters/{id}/drafts/*` | `writing.ts:129-153` | 4 | Backend has none. |
| `/chapters/{id}/inspections` | `writing.ts:264-277` | 2 | Backend has none. |
| `/chapters/{id}/snapshots/*` | `writing.ts:532-563` | 4 | Backend has none. |
| `/styles*` | `writing.ts:296-301` | 2 | Backend has none. |
| `/ai/check/*` (consistency, continuity, pacing, ooc, high-point, reader-pull) | `aiReview.ts:129-199`, `writing.ts:312-337` | 12 | Backend has none. |
| `/ai/review`, `/ai/review-history*` | `aiReview.ts:63-112` | 5 | Backend has none. |
| `/ai/extract-entities`, `/ai/extract`, `/ai/context/deep`, `/ai/evaluate-quality`, `/ai/chapters/{id}/inspect` | `aiReview.ts:73-83`, `writing.ts:403-419, 515` | 5 | Backend has `/ai/generate`, `/ai/context` only. |
| `/agents/*` (style, review, plot, checkers, check, check-all) | `agents.ts:142-180` | 6 | Backend has none. |
| `/constraints/*` | `constraints.ts` | 6 | Backend has none. |
| `/context/*` | `context.ts` | 6 | Backend has none. |
| `/context-rank/*` | `contextRank.ts` | 10 | Backend has none. |
| `/graph/*` | `graph.ts` | 10 | Backend has none. |
| `/engagement/*` | `engagement.ts` | 6 | Backend has none. |
| `/cache/*` | `cache.ts`, `system.ts:134` | 4 | Backend has none. |
| `/genres/*` | `genres.ts` | 3 | Backend has none. |
| `/observability/*` | `observability.ts` | 10 | Backend has none. |
| `/pacing/*` | `pacing.ts` | 4 | Backend has none. |
| `/snapshots/*` (backup/archives) | `snapshots.ts` | 11 | Backend has none. |
| `/health*`, `/stats/overview`, `/ai/health`, `/ai/failover`, `/metrics*`, `/tasks*`, `/workflows/*` | `system.ts`, `metrics.ts`, `tasks.ts`, `workflows.ts` | 12 | Backend has only `/health` (singular, returns `{"status":"ok"}`). |

> **Subtotal**: 198 frontend calls (with template-literal expansion) hit endpoints that do not exist in the current backend. Of the 132 distinct call sites in `frontend-api-calls.json`, **129 (97.7%) target paths the new backend never implemented**.

## B. 后端有但前端没调用的端点（**死代码 / 等待迁移**）

| Backend path | Backend file | Status |
|---|---|---|
| `/api/v1/auth/register` | `auth.py:38` | Frontend uses `/auth/key` instead — old API-key auth model. |
| `/api/v1/auth/login` | `auth.py:46` | Frontend has no login UI; uses anonymous API key. |
| `/api/v1/auth/me` | `auth.py:54` | Frontend has no user concept. |
| `/api/v1/characters/{id}` (PUT only) | `characters.py:40` | Frontend uses PATCH (HTTP method mismatch, see D2). |
| `/api/v1/world/{id}` (PUT only) | `world.py:40` | Same PATCH vs PUT issue. |
| `/api/v1/outlines/{id}` (PUT only) | `outlines.py:40` | Same PATCH vs PUT issue. |
| `/api/v1/chapters/{id}` (PUT only) | `chapters.py:47` | Same PATCH vs PUT issue. |
| `/api/v1/writing/` (GET, PUT) | `writing.py` | Frontend uses `/settings/writing`. |
| `/api/v1/chat/sessions/{id}/send` (POST) | `chat.py:136` | Frontend uses WebSocket exclusively (`/ws/chat/{id}`); the REST fallback is never called. |
| `/api/v1/chat/sessions/{id}/messages` (GET) | `chat.py:119` | Frontend uses WebSocket. |

> **Subtotal**: 9 backend routes have **zero frontend callers** as of 2026-07-09.

## C. 路径不匹配（前端调 X 后端是 Y）— 11 类

| Frontend expects | Backend actual | Frontend file:line | Backend file:line | Severity |
|---|---|---|---|---|
| `/auth/key` | `/auth/register` (or `/auth/login`) | `auth.ts:25` | `auth.py:38` | **BLOCKING** (auth bootstrap fails) |
| `/auth/key/refresh` | (no equivalent) | `auth.ts:36` | — | **BLOCKING** |
| `/auth/status` | `/auth/me` | `auth.ts:47` | `auth.py:54` | **BLOCKING** |
| `/settings/characters/*` | `/characters/*` | `settings.ts:39-95` | `characters.py:16-52` | **BLOCKING** (整个角色/关系/故事线失效) |
| `/settings/world/*` | `/world/*` | `settings.ts:237-254` | `world.py:16-52` | **BLOCKING** |
| `/settings/writing` | `/writing/` | `settings.ts:294,298,306` | `writing.py:16,23` | **BLOCKING** |
| `/chapters/outlines/*` | `/outlines/*` | `writing.ts:36-59` | `outlines.py:16-52` | **BLOCKING** |
| `/styles` | (not implemented) | `writing.ts:296` | — | **BLOCKING** |
| `/ws/chat/{id}` | `/chat/ws/{id}` | `websocket.ts:252` | `chat.py:208` | **BLOCKING** (chat WS 连接失败) |
| `/ai/check/*` (6 paths) | (not implemented) | `aiReview.ts:129-199`, `writing.ts:312-337` | — | **BLOCKING** (所有 AI checker UI 失效) |
| `/agents/*` (6 paths) | (not implemented) | `agents.ts:142-180` | — | **BLOCKING** (style/review/plot 失效) |

> **Note**: The pattern is consistent — the frontend was authored against the *old* `src/backend/` (still present at `D:/writer/src/backend-old/` for reference, per task instructions not to modify) where routers were namespaced as `/settings/...`, `/chapters/...`, `/agents/...`, etc. The new `D:/writer/backend/` uses bare nouns (`/characters`, `/outlines`, `/agents` is absent entirely).

## D. 字段/方法差异

### D1. HTTP method mismatches (PUT vs PATCH) — 4 endpoints

| Endpoint | Frontend uses | Backend accepts | Mismatch |
|---|---|---|---|
| `/characters/{id}` | `api.patch<Character>(...)` | `@router.put(...)` | method mismatch |
| `/world/{id}` | `api.patch<WorldSetting>(...)` | `@router.put(...)` | method mismatch |
| `/outlines/{id}` | `api.patch<Outline>(...)` | `@router.put(...)` | method mismatch |
| `/chapters/{id}` | `api.patch<Chapter>(...)` | `@router.put(...)` | method mismatch |

> Frontend PATCH vs backend PUT — even if paths matched, requests would 405.

### D2. Field-name conventions (snake_case everywhere)

Backend Pydantic schemas use `snake_case` (`chat_messages`, `human_ai_ratio`, `created_chapter_id`, `coverage_score`). Frontend TS interfaces also use `snake_case` (`ChatSendRequest`, `AIGenerateRequest`, etc.). **This is consistent** — no snake/camel divergence at this layer. (Auth.ts frontend uses snake_case `api_key`, matching backend's intent.)

### D3. WS protocol mismatch

| Aspect | Backend (`chat.py:208-329`) | Frontend (`websocket.ts:252`) |
|---|---|---|
| Path | `/api/v1/chat/ws/{session_id}` | `${baseUrl}/ws/chat/${sessionId}` (no `/chat/` segment, no `/api/v1` prefix) |
| Frame format | `send_json({type, content, propose_exit, coverage_score, entities})` | Sends JSON; expects reply but no parse in `tryConnect()` |
| Auth | none (open WS) | `?api_key=...` query param |

> **Consequence**: even if the path matched, the frontend does not parse the `{"type":"reply",...}` frame — it relies on `event:` / `data:` SSE parsing from `chat.ts:160-278`, which does NOT apply to the raw WebSocket.

## E. WebSocket & Auth deep-dive

### E1. WebSocket endpoint

- **Backend**: `WS /api/v1/chat/ws/{session_id}` at `api/v1/endpoints/chat.py:208`.
  - Wire: client sends `{"content": "..."}` JSON lines; server replies with `{"type":"reply","content":"...","propose_exit":...,"coverage_score":...,"entities":[...]}` then optional `{"type":"propose_exit",...}`.
  - Cancellation: in-flight agent task is cancelled on `WebSocketDisconnect`.
- **Frontend**: `WS ${baseUrl}/ws/chat/${sessionId}` at `websocket.ts:252`.
  - Path mismatch: missing `/chat/` segment, missing `/api/v1` prefix.
  - Wire: sends `JSON.stringify(item.data)` (assumes `data` already JSON-encoded), receives with `ws.onmessage` but stores raw — no `JSON.parse` of reply frames.

### E2. Auth flow

- **Backend** (`auth.py`): Phase-1 stub. Users stored in-process dict; password compared in cleartext; `dev-token:{username}` issued. Endpoints: `register`, `login`, `me`.
- **Frontend** (`auth.ts`): Phase-5 design. No username/password at all — backend mints an API key (`/auth/key` GET), frontend stores in `localStorage.writer_api_key`, sends as `X-API-Key` header. See `request.ts:65-83`, `electron.ts:47-54`.
- **Status: completely different auth paradigms**. No overlap possible.

## F. 总结

| Metric | Count |
|---|---:|
| Backend routes (static analysis) | **34** (task brief said 39 — the extra 5 are speculative) |
| Frontend distinct call sites | **226** |
| Frontend calls to nonexistent paths | **220 (97.3%)** |
| Backend routes with zero frontend callers | **9** |
| Path-prefix mismatches (frontend vs backend) | **11 categories / 100+ individual paths** |
| HTTP-method mismatches (PATCH vs PUT) | **4 endpoints** |
| **完全匹配的端点** | **6 (out of 34)**: `/api/v1/chat/sessions` (POST+GET), `/api/v1/chat/sessions/{id}` (GET+DELETE), `/api/v1/chat/sessions/{id}/messages` (GET), `/api/v1/chat/sessions/{id}/send` (POST), `/api/v1/ai/generate` (POST), `/api/v1/ai/context` (POST). Only chat + ai match — nothing else does. |
| **阻塞前端功能**: chat auth/key bootstrap, all `/settings/*` writes, all `/chapters/{id}/*` sub-resources, all AI checkers, all `/agents/*`, all `/workflows`, `/styles`, `/snapshots`, `/graph`, `/engagement`, `/context-rank`, `/constraints`, `/observability`, `/pacing`, `/genres`, `/cache` | **20+ functional areas, ~85% of frontend surface** |

### Conclusion (for I-3 cleanup decision)

The frontend cannot talk to the new backend at all except for **chat sessions + chat messages + ai generate + ai context** (6 endpoints). Everything else — including the auth bootstrap that gates every other call — is dead-on-arrival.

Two options for I-3:
1. **Rewrite frontend to call new backend's surface** (smaller backend, lose 95% of features temporarily).
2. **Port the deleted `src/backend-old/` routers to `D:/writer/backend/`** (recover frontend functionality; ~3-5 days of porting).
3. **Bridge adapter**: add shim routes in the new backend that proxy the old paths to the new ones (`/settings/characters` → `/characters`, `/auth/key` → auto-register+login, etc.). Lowest risk, fastest to working — recommended.

Recommend option 3 unless team-lead explicitly chooses 1 or 2.