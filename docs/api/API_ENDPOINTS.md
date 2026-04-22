# API Endpoints Documentation

Auto Novel Writer API - FastAPI Backend

## Base URL
```
http://localhost:8000/api/v1
```

## Authentication

All endpoints (except `/auth/*` and `/health/*`) require API key authentication.

**Header:** `X-API-Key: your-api-key`

To obtain an API key, see [Auth Endpoints](#auth).

## Table of Contents

- [Health](#health) - Health check endpoints
- [Auth](#auth) - Authentication
- [Chat](#chat) - Chat sessions (Interface 1)
- [Settings](#settings) - World settings (Interface 2)
- [Chapters](#chapters) - Chapters and story structure (Interface 3)
- [AI](#ai) - AI generation and checking
- [Tasks](#tasks) - Background tasks
- [Styles](#styles) - Writing styles
- [Cache](#cache) - Cache management
- [Project](#project) - Export/Import

---

## Health

Health check endpoints for monitoring and Kubernetes probes.

### GET /health

Comprehensive health check including database, AI service, disk space, and dependencies.

**Authentication:** None required

**Response 200:**
```json
{
  "status": "healthy",
  "timestamp": "2026-04-21T10:30:00Z",
  "app": {
    "name": "Auto Novel Writer",
    "version": "1.0.0"
  },
  "system": {
    "python_version": "3.11.0",
    "platform": "Windows-11"
  },
  "checks": {
    "database": {"status": "connected", "latency_ms": 0},
    "ai_service": {"status": "configured", "url": "https://api.minimax.chat"},
    "disk_space": {"status": "healthy", "total_gb": 476.94, "free_gb": 150.23, "used_percent": 68.5},
    "dependencies": {
      "FastAPI": {"status": "available", "version": "0.109.0"},
      "SQLAlchemy": {"status": "available", "version": "2.0.0"}
    }
  }
}
```

### GET /health/ready

Kubernetes-style readiness probe. Returns 200 only when ready to accept traffic.

**Authentication:** None required

**Response 200:**
```json
{"status": "ready"}
```

**Response 503:**
```json
{"status": "not_ready", "reason": "database_unavailable"}
```

### GET /health/live

Kubernetes-style liveness probe.

**Authentication:** None required

**Response 200:**
```json
{"status": "alive"}
```

---

## Auth

Local API key management for the desktop application.

### POST /auth/key

Get or create the local API key. For desktop app, returns existing key (generated once, persisted).

**Authentication:** None required

**Response 200:**
```json
{
  "api_key": "sk_local_abc123...",
  "message": "Use this key in the X-API-Key header for all API requests"
}
```

### POST /auth/key/refresh

Generate a new API key, invalidating the old one. Use if key is compromised.

**Authentication:** None required

**Response 200:**
```json
{
  "api_key": "sk_local_xyz789...",
  "message": "API key refreshed. Update your client with the new key."
}
```

### GET /auth/status

Check if authentication is configured.

**Authentication:** None required

**Response 200:**
```json
{
  "enabled": true,
  "key_configured": true,
  "auth_type": "api_key",
  "skip_localhost": true
}
```

---

## Chat

Interface 1: Chat initialization for collecting world settings through AI conversation.

### POST /chat/sessions

Create a new chat session.

**Authentication:** Required

**Response 201:**
```json
{
  "id": 1,
  "created_at": "2026-04-21T10:00:00Z",
  "updated_at": "2026-04-21T10:00:00Z"
}
```

### GET /chat/sessions

List all chat sessions with pagination.

**Authentication:** Required

**Query Parameters:**
- `skip` (int): Number of records to skip (default: 0)
- `limit` (int): Max records to return, capped at 100 (default: 20)

**Rate Limit:** 60 requests per 60 seconds

**Response 200:**
```json
[
  {"id": 1, "created_at": "2026-04-21T10:00:00Z", "updated_at": "2026-04-21T10:00:00Z"},
  {"id": 2, "created_at": "2026-04-21T09:00:00Z", "updated_at": "2026-04-21T09:30:00Z"}
]
```

### GET /chat/sessions/{session_id}

Get a specific chat session.

**Authentication:** Required

**Response 200:**
```json
{"id": 1, "created_at": "2026-04-21T10:00:00Z", "updated_at": "2026-04-21T10:00:00Z"}
```

**Response 404:** Session not found

### DELETE /chat/sessions/{session_id}

Delete a chat session and all its messages.

**Authentication:** Required

**Response 200:**
```json
{"message": "Session deleted"}
```

### POST /chat/sessions/{session_id}/messages

Add a message to a chat session.

**Authentication:** Required

**Rate Limit:** 30 requests per 60 seconds

**Request Body:**
```json
{
  "role": "user",
  "content": "我要写一个修仙小说"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| role | string | Yes | "user", "assistant", or "system" |
| content | string | Yes | Message content (max 50,000 chars) |

**Response 201:**
```json
{
  "id": 1,
  "session_id": 1,
  "role": "user",
  "content": "我要写一个修仙小说",
  "created_at": "2026-04-21T10:00:00Z"
}
```

### GET /chat/sessions/{session_id}/messages

Get all messages for a chat session.

**Authentication:** Required

**Query Parameters:**
- `skip` (int): Number of records to skip (default: 0)
- `limit` (int): Max records to return (default: 100)

**Response 200:**
```json
[
  {"id": 1, "session_id": 1, "role": "user", "content": "...", "created_at": "..."},
  {"id": 2, "session_id": 1, "role": "assistant", "content": "...", "created_at": "..."}
]
```

### GET /chat/sessions/{session_id}/entities

Get extracted entities from a chat session.

**Authentication:** Required

**Query Parameters:**
- `type` (string, optional): Filter by entity type
- `confirmed` (bool, optional): Filter by confirmation status

**Response 200:**
```json
[
  {
    "id": 1,
    "session_id": 1,
    "type": "character",
    "name": "张三",
    "description": "主角",
    "confirmed": true,
    "created_at": "2026-04-21T10:00:00Z"
  }
]
```

### PATCH /chat/entities/{entity_id}/confirm

Confirm or unconfirm an extracted entity.

**Authentication:** Required

**Query Parameters:**
- `confirmed` (bool): Confirmation status (default: true)

**Response 200:**
```json
{"message": "Entity updated"}
```

---

## Settings

Interface 2: World settings management (characters, items, locations, factions, rules).

### Characters

#### GET /settings/characters

List all characters with optional filtering.

**Authentication:** Required

**Query Parameters:**
- `skip` (int): Number of records to skip (default: 0)
- `limit` (int): Max records to return (default: 100)
- `tier` (string, optional): Filter by character tier

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "张三",
    "gender": "男",
    "personality": "坚毅果敢",
    "desires": "修炼成仙",
    "flaws": "过于固执",
    "description": "主角",
    "tier": "protagonist",
    "cultivation_realm": "筑基期",
    "created_at": "2026-04-21T10:00:00Z",
    "updated_at": "2026-04-21T10:00:00Z"
  }
]
```

#### POST /settings/characters

Create a new character.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "张三",
  "gender": "男",
  "personality": "坚毅果敢",
  "desires": "修炼成仙",
  "flaws": "过于固执",
  "description": "主角",
  "tier": "protagonist",
  "cultivation_realm": "筑基期"
}
```

**Response 201:** CharacterResponse object

#### GET /settings/characters/{character_id}

Get a specific character.

**Authentication:** Required

**Response 200:** CharacterResponse object

**Response 404:** Character not found

#### PATCH /settings/characters/{character_id}

Update a character.

**Authentication:** Required

**Request Body:** Partial CharacterUpdate object

**Response 200:** Updated CharacterResponse object

#### DELETE /settings/characters/{character_id}

Delete a character.

**Authentication:** Required

**Response 200:**
```json
{"message": "Character deleted"}
```

#### GET /settings/characters/{character_id}/relationships

List all relationships for a character.

**Authentication:** Required

**Response 200:**
```json
[
  {
    "id": 1,
    "character_id": 1,
    "target_id": 2,
    "type": "rival",
    "description": "竞争对手"
  }
]
```

#### POST /settings/characters/{character_id}/relationships

Create a relationship for a character.

**Authentication:** Required

**Request Body:**
```json
{
  "character_id": 1,
  "target_id": 2,
  "type": "rival",
  "description": "竞争对手"
}
```

**Response 201:** CharacterRelationshipResponse object

#### GET /settings/characters/{character_id}/storylines

List all storylines for a character.

**Authentication:** Required

**Response 200:**
```json
[
  {
    "id": 1,
    "character_id": 1,
    "title": "成长线",
    "arc": "从凡人修炼成仙",
    "progress": 45
  }
]
```

#### POST /settings/characters/{character_id}/storylines

Create a storyline for a character.

**Authentication:** Required

**Request Body:**
```json
{
  "character_id": 1,
  "title": "成长线",
  "arc": "从凡人修炼成仙",
  "progress": 45
}
```

**Response 201:** CharacterStorylineResponse object

### Items

#### GET /settings/items

List all items.

**Authentication:** Required

**Query Parameters:**
- `skip` (int): Number of records to skip (default: 0)
- `limit` (int): Max records to return (default: 100)
- `owner` (string, optional): Filter by owner

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "青锋剑",
    "description": "一把锋利的剑",
    "owner": "张三",
    "location": "腰间"
  }
]
```

#### POST /settings/items

Create a new item.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "青锋剑",
  "description": "一把锋利的剑",
  "owner": "张三",
  "location": "腰间"
}
```

**Response 201:** ItemResponse object

#### PATCH /settings/items/{item_id}

Update an item.

**Authentication:** Required

**Request Body:** Partial ItemCreate object

**Response 200:** Updated ItemResponse object

#### DELETE /settings/items/{item_id}

Delete an item.

**Authentication:** Required

**Response 200:**
```json
{"message": "Item deleted"}
```

### Locations

#### GET /settings/locations

List all locations.

**Authentication:** Required

**Query Parameters:**
- `skip` (int): Number of records to skip (default: 0)
- `limit` (int): Max records to return (default: 100)
- `importance` (string, optional): Filter by importance level

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "青云峰",
    "description": "主峰之一",
    "importance": "high"
  }
]
```

#### POST /settings/locations

Create a new location.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "青云峰",
  "description": "主峰之一",
  "importance": "high"
}
```

**Response 201:** LocationResponse object

#### PATCH /settings/locations/{location_id}

Update a location.

**Authentication:** Required

**Request Body:** Partial LocationCreate object

**Response 200:** Updated LocationResponse object

#### DELETE /settings/locations/{location_id}

Delete a location.

**Authentication:** Required

**Response 200:**
```json
{"message": "Location deleted"}
```

### Factions

#### GET /settings/factions

List all factions.

**Authentication:** Required

**Query Parameters:**
- `skip` (int): Number of records to skip (default: 0)
- `limit` (int): Max records to return (default: 100)
- `type` (string, optional): Filter by faction type

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "青云门",
    "description": "正道领袖",
    "type": "sect"
  }
]
```

#### POST /settings/factions

Create a new faction.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "青云门",
  "description": "正道领袖",
  "type": "sect"
}
```

**Response 201:** FactionResponse object

#### PATCH /settings/factions/{faction_id}

Update a faction.

**Authentication:** Required

**Request Body:** Partial FactionCreate object

**Response 200:** Updated FactionResponse object

#### DELETE /settings/factions/{faction_id}

Delete a faction.

**Authentication:** Required

**Response 200:**
```json
{"message": "Faction deleted"}
```

### World Settings

#### GET /settings/world

List all world settings.

**Authentication:** Required

**Query Parameters:**
- `skip` (int): Number of records to skip (default: 0)
- `limit` (int): Max records to return (default: 100)

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "修仙体系",
    "description": "详细描述",
    "details_json": "{}"
  }
]
```

#### POST /settings/world

Create a new world setting.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "修仙体系",
  "description": "详细描述",
  "details_json": "{}"
}
```

**Response 201:** WorldSettingResponse object

#### PATCH /settings/world/{setting_id}

Update a world setting.

**Authentication:** Required

**Request Body:** Partial WorldSettingCreate object

**Response 200:** Updated WorldSettingResponse object

#### DELETE /settings/world/{setting_id}

Delete a world setting.

**Authentication:** Required

**Response 200:**
```json
{"message": "World setting deleted"}
```

### Rules

#### GET /settings/rules

List all rules.

**Authentication:** Required

**Query Parameters:**
- `skip` (int): Number of records to skip (default: 0)
- `limit` (int): Max records to return (default: 100)
- `type` (string, optional): Filter by rule type

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "灵气稀薄",
    "description": "设定",
    "type": "world"
  }
]
```

#### POST /settings/rules

Create a new rule.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "灵气稀薄",
  "description": "设定",
  "type": "world"
}
```

**Response 201:** RuleResponse object

#### PATCH /settings/rules/{rule_id}

Update a rule.

**Authentication:** Required

**Request Body:** Partial RuleCreate object

**Response 200:** Updated RuleResponse object

#### DELETE /settings/rules/{rule_id}

Delete a rule.

**Authentication:** Required

**Response 200:**
```json
{"message": "Rule deleted"}
```

### Writing Settings

#### GET /settings/writing

Get current writing settings.

**Authentication:** Required

**Response 200:**
```json
{
  "id": 1,
  "human_ai_ratio": 0.7,
  "writing_style": "江南",
  "target_word_count": 3000
}
```

#### PATCH /settings/writing

Update writing settings.

**Authentication:** Required

**Request Body:**
```json
{
  "human_ai_ratio": 0.8,
  "writing_style": "卡夫卡",
  "target_word_count": 5000
}
```

| Field | Type | Constraints |
|-------|------|-------------|
| human_ai_ratio | float | 0.0 to 1.0 |
| writing_style | string | Available styles: 江南, 卡夫卡, 加缪, default |
| target_word_count | int | Positive integer |

**Response 200:** Updated WritingSettingsResponse object

### Settings Export/Import

#### GET /settings/export

Export all project settings data as JSON.

**Authentication:** Required

**Response 200:**
```json
{
  "version": "1.0",
  "exported_at": "2026-04-21T10:00:00Z",
  "characters": [...],
  "character_relationships": [...],
  "character_storylines": [...],
  "items": [...],
  "locations": [...],
  "factions": [...],
  "world_settings": [...],
  "rules": [...],
  "writing_settings": {...}
}
```

#### POST /settings/import

Import project data from JSON with relationship support.

**Authentication:** Required

**Request Body:** ExportData object

**Response 200:**
```json
{
  "message": "Import successful",
  "imported": {
    "characters": 10,
    "character_relationships": 15,
    "character_storylines": 5,
    "items": 20,
    "locations": 8,
    "factions": 3,
    "world_settings": 4,
    "rules": 6
  }
}
```

---

## Chapters

Interface 3: Chapter and story structure management.

### Outlines

#### GET /chapters/outlines

List all outlines.

**Authentication:** Required

**Query Parameters:**
- `skip` (int): Number of records to skip (default: 0)
- `limit` (int): Max records to return (default: 50)

**Response 200:**
```json
[
  {
    "id": 1,
    "title": "第一章",
    "description": "故事开端"
  }
]
```

#### POST /chapters/outlines

Create a new outline.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "第一章",
  "description": "故事开端"
}
```

**Response 201:** OutlineResponse object

#### GET /chapters/outlines/{outline_id}

Get a specific outline.

**Authentication:** Required

**Response 200:** OutlineResponse object

**Response 404:** Outline not found

#### PATCH /chapters/outlines/{outline_id}

Update an outline.

**Authentication:** Required

**Request Body:** Partial OutlineUpdate object

**Response 200:** Updated OutlineResponse object

#### DELETE /chapters/outlines/{outline_id}

Delete an outline.

**Authentication:** Required

**Response 200:**
```json
{"message": "Outline deleted"}
```

### Chapters

#### GET /chapters/

List all chapters with optional filtering.

**Authentication:** Required

**Query Parameters:**
- `skip` (int): Number of records to skip (default: 0)
- `limit` (int): Max records to return (default: 100)
- `outline_id` (int, optional): Filter by outline
- `status` (string, optional): Filter by status

**Response 200:**
```json
[
  {
    "id": 1,
    "outline_id": 1,
    "title": "初入仙门",
    "summary": "主角来到仙门",
    "status": "in_progress",
    "word_count": 3500,
    "chapter_order": 1,
    "created_at": "2026-04-21T10:00:00Z",
    "updated_at": "2026-04-21T12:00:00Z"
  }
]
```

#### POST /chapters/

Create a new chapter.

**Authentication:** Required

**Request Body:**
```json
{
  "outline_id": 1,
  "title": "初入仙门",
  "summary": "主角来到仙门",
  "status": "pending",
  "word_count": 0,
  "chapter_order": 1
}
```

**Response 201:** ChapterResponse object

#### GET /chapters/{chapter_id}

Get a specific chapter.

**Authentication:** Required

**Response 200:** ChapterResponse object

**Response 404:** Chapter not found

#### PATCH /chapters/{chapter_id}

Update a chapter.

**Authentication:** Required

**Request Body:** Partial ChapterUpdate object

**Response 200:** Updated ChapterResponse object

#### DELETE /chapters/{chapter_id}

Delete a chapter.

**Authentication:** Required

**Response 200:**
```json
{"message": "Chapter deleted"}
```

### Draft Versions

#### GET /chapters/{chapter_id}/drafts

List all draft versions for a chapter.

**Authentication:** Required

**Query Parameters:**
- `skip` (int): Number of records to skip (default: 0)
- `limit` (int): Max records to return (default: 20)

**Response 200:**
```json
[
  {
    "id": 1,
    "chapter_id": 1,
    "content": "章节内容...",
    "version_number": 1,
    "created_at": "2026-04-21T10:00:00Z"
  }
]
```

#### POST /chapters/{chapter_id}/drafts

Create a new draft version.

**Authentication:** Required

**Request Body:**
```json
{
  "chapter_id": 1,
  "content": "章节内容...",
  "version_number": 2
}
```

**Response 201:** DraftVersionResponse object

#### GET /chapters/{chapter_id}/drafts/{version_number}

Get a specific draft version.

**Authentication:** Required

**Response 200:** DraftVersionResponse object

**Response 404:** Draft version not found

### AI Inspections

#### GET /chapters/{chapter_id}/inspections

List all AI inspection results for a chapter.

**Authentication:** Required

**Query Parameters:**
- `skip` (int): Number of records to skip (default: 0)
- `limit` (int): Max records to return (default: 20)

**Response 200:**
```json
[
  {
    "id": 1,
    "chapter_id": 1,
    "inspection_type": "consistency",
    "issues_json": "[]",
    "suggestions_json": "[]",
    "auto_fixed": false,
    "created_at": "2026-04-21T10:00:00Z"
  }
]
```

#### POST /chapters/{chapter_id}/inspections

Create a new AI inspection result.

**Authentication:** Required

**Request Body:**
```json
{
  "chapter_id": 1,
  "inspection_type": "consistency",
  "issues_json": "[]",
  "suggestions_json": "[]",
  "auto_fixed": false
}
```

**Response 201:** AIInspectionResultResponse object

### IF Lines

#### GET /chapters/if-lines

List all IF lines.

**Authentication:** Required

**Query Parameters:**
- `skip` (int): Number of records to skip (default: 0)
- `limit` (int): Max records to return (default: 50)
- `character_id` (int, optional): Filter by linked character

**Response 200:**
```json
[
  {
    "id": 1,
    "title": "IF线：反派线",
    "linked_character_id": 2,
    "description": "反派的成长故事",
    "sync_mode": "auto",
    "created_at": "2026-04-21T10:00:00Z",
    "updated_at": "2026-04-21T10:00:00Z"
  }
]
```

#### POST /chapters/if-lines

Create a new IF line.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "IF线：反派线",
  "linked_character_id": 2,
  "description": "反派的成长故事",
  "sync_mode": "auto"
}
```

**Response 201:** IFLineResponse object

#### GET /chapters/if-lines/{if_line_id}

Get a specific IF line.

**Authentication:** Required

**Response 200:** IFLineResponse object

**Response 404:** IF line not found

#### PATCH /chapters/if-lines/{if_line_id}

Update an IF line.

**Authentication:** Required

**Request Body:** Partial IFLineUpdate object

**Response 200:** Updated IFLineResponse object

#### DELETE /chapters/if-lines/{if_line_id}

Delete an IF line.

**Authentication:** Required

**Response 200:**
```json
{"message": "IF line deleted"}
```

### Plot Threads

#### GET /chapters/plot-threads

List all plot threads.

**Authentication:** Required

**Query Parameters:**
- `skip` (int): Number of records to skip (default: 0)
- `limit` (int): Max records to return (default: 100)
- `status` (string, optional): Filter by status

**Response 200:**
```json
[
  {
    "id": 1,
    "title": "伏笔：神秘剑客",
    "description": "第三章出现的神秘剑客",
    "status": "active",
    "created_chapter_id": 3,
    "reveal_chapter_id": 10,
    "created_at": "2026-04-21T10:00:00Z"
  }
]
```

#### POST /chapters/plot-threads

Create a new plot thread.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "伏笔：神秘剑客",
  "description": "第三章出现的神秘剑客",
  "status": "active",
  "created_chapter_id": 3,
  "reveal_chapter_id": 10
}
```

**Response 201:** PlotThreadResponse object

#### GET /chapters/plot-threads/{plot_thread_id}

Get a specific plot thread.

**Authentication:** Required

**Response 200:** PlotThreadResponse object

**Response 404:** Plot thread not found

#### PATCH /chapters/plot-threads/{plot_thread_id}

Update a plot thread.

**Authentication:** Required

**Request Body:** Partial PlotThreadUpdate object

**Response 200:** Updated PlotThreadResponse object

#### DELETE /chapters/plot-threads/{plot_thread_id}

Delete a plot thread.

**Authentication:** Required

**Response 200:**
```json
{"message": "Plot thread deleted"}
```

---

## AI

AI generation and quality checking endpoints.

### Content Generation

#### POST /ai/generate

Generate AI content with streaming response.

**Authentication:** Required

**Request Body:**
```json
{
  "prompt": "续写主角初入仙门的场景",
  "operation": "continue",
  "chapter_id": 1,
  "human_ai_ratio": 70,
  "style": "江南"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| prompt | string | Yes | Generation prompt (max 10,000 chars) |
| operation | string | Yes | One of: continue, expand, condense, rewrite, polish, optimize |
| chapter_id | int | No | Associated chapter |
| human_ai_ratio | int | No | 0-100, human vs AI ratio |
| style | string | No | Writing style (江南, 卡夫卡, 加缪, default) |

**Response (Streaming):** `text/plain`
```
这是AI生成的内容...
```

**Headers:**
- `X-Operation`: The operation performed
- `X-Human-AI-Ratio`: Human-AI ratio used
- `X-Style`: Style used

### AI Review

#### POST /ai/review

Review world settings for consistency using AI.

**Authentication:** Required

**Request Body:**
```json
{
  "settings_data": {
    "characters": [...],
    "locations": [...],
    "items": [...]
  }
}
```

**Response 200:**
```json
{
  "review_content": "AI审查结果...",
  "raw_response": {...}
}
```

#### POST /ai/extract-entities

Extract entities from chat messages.

**Authentication:** Required

**Request Body:**
```json
{
  "chat_messages": [
    {"role": "user", "content": "主角叫张三，是个修士"},
    {"role": "assistant", "content": "了解，张三是青云门的弟子"}
  ]
}
```

**Response 200:**
```json
{
  "entities": [
    {"type": "character", "name": "张三", "description": "修士"},
    {"type": "faction", "name": "青云门", "description": "仙门"}
  ]
}
```

### Chapter Inspection

#### POST /ai/chapters/{chapter_id}/inspect

Run AI inspection on a chapter.

**Authentication:** Required

**Response 200:**
```json
{
  "chapter_id": 1,
  "review_content": "审查结果...",
  "raw_response": {...}
}
```

### Context Building

#### POST /ai/context

Build a writing execution package for a chapter.

**Authentication:** Required

**Request Body:**
```json
{
  "chapter_id": 1
}
```

**Response 200:**
```json
{
  "chapter_id": 1,
  "chapter_title": "初入仙门",
  "core_task": {"goal": "...", "obstacle": "...", "cost": "..."},
  "承接上文": {...},
  "active_characters": [...],
  "scene_constraints": {...},
  "time_constraints": "修仙纪元2024年",
  "style_guidance": "...",
  "continuity": {...},
  "engagement_strategy": "...",
  "raw_ai_response": "..."
}
```

### Entity Extraction

#### POST /ai/extract

Extract structured entities from chapter content.

**Authentication:** Required

**Request Body:**
```json
{
  "content": "章节内容...",
  "chapter_id": 1
}
```

**Response 200:**
```json
{
  "chapter_id": 1,
  "entities": [...],
  "relationships": [...],
  "state_changes": [...],
  "scenes": [...],
  "summary": "章节摘要..."
}
```

### Quality Checkers

All checker endpoints are rate-limited to 1 request per minute per IP.

#### POST /ai/check/consistency

Check world consistency for a chapter (locations, timelines, power levels, item ownership).

**Authentication:** Required

**Rate Limit:** 1 request per minute

**Request Body:**
```json
{
  "chapter_id": 1
}
```

**Response 200:**
```json
{
  "chapter_id": 1,
  "score": 85,
  "issues": [],
  "suggestions": ["建议在第三章补充角色动机"]
}
```

#### POST /ai/check/continuity

Check scene and narrative continuity (scene transitions, event consistency, plot thread fulfillment).

**Authentication:** Required

**Rate Limit:** 1 request per minute

**Request Body:**
```json
{
  "chapter_id": 1
}
```

**Response 200:**
```json
{
  "chapter_id": 1,
  "score": 78,
  "issues": ["场景转换过于突兀"],
  "suggestions": [...],
  "plot_thread_status": {
    "active": 3,
    "resolved": 1,
    "pending": 2
  }
}
```

#### POST /ai/check/pacing

Check narrative pacing and strand ratios (quest/fire/constellation - target 60%/20%/20%).

**Authentication:** Required

**Rate Limit:** 1 request per minute

**Request Body:**
```json
{
  "chapter_id": 1
}
```

**Response 200:**
```json
{
  "chapter_id": 1,
  "score": 72,
  "issues": ["战斗场景过少"],
  "suggestions": [...],
  "strand_ratios": {
    "quest": 0.65,
    "fire": 0.15,
    "constellation": 0.20
  },
  "analysis": "节奏分析..."
}
```

#### POST /ai/check/ooc

Check for Out-Of-Character behavior.

**Authentication:** Required

**Rate Limit:** 1 request per minute

**Request Body:**
```json
{
  "chapter_id": 1,
  "character_id": 1
}
```

**Response 200:**
```json
{
  "chapter_id": 1,
  "character_id": 1,
  "score": 90,
  "issues": [],
  "suggestions": [],
  "violations": []
}
```

#### POST /ai/check/high-point

Check excitement density and high points (climax distribution, emotional pacing, ending hook).

**Authentication:** Required

**Rate Limit:** 1 request per minute

**Request Body:**
```json
{
  "chapter_id": 1
}
```

**Response 200:**
```json
{
  "chapter_id": 1,
  "score": 75,
  "issues": ["高潮点不够突出"],
  "suggestions": [...],
  "high_points": [
    {"location": "第800字", "type": "战斗", "intensity": 8, "pacing": "适中"}
  ],
  "excitement_density": "中等",
  "ending_hook": "留下悬念：剑客的身份"
}
```

#### POST /ai/check/reader-pull

Check reader engagement and hooks (opening hooks, ending suspense, curiosity gaps).

**Authentication:** Required

**Rate Limit:** 1 request per minute

**Request Body:**
```json
{
  "chapter_id": 1
}
```

**Response 200:**
```json
{
  "chapter_id": 1,
  "score": 80,
  "issues": [],
  "suggestions": [...],
  "hooks": [
    {"location": "开头", "type": "悬念", "description": "...", "effectiveness": 7}
  ],
  "opening_hook": "开篇钩子",
  "ending_hook": "结尾钩子",
  "curiosity_gaps": ["剑客的身份是什么？"]
}
```

---

## Tasks

Background task management.

### Submit Task

#### POST /tasks

Submit a new background task.

**Authentication:** Required

**Request Body:**
```json
{
  "type": "ai_generate",
  "payload": {
    "prompt": "...",
    "operation": "continue",
    "style": "江南",
    "human_ai_ratio": 70
  },
  "task_id": "optional-custom-id"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | ai_generate, export_project, batch_operation, cleanup |
| payload | object | No | Task-specific payload |
| task_id | string | No | Optional custom task ID |

**Response 201:**
```json
{
  "task_id": "abc123",
  "status": "pending",
  "message": "Task abc123 submitted successfully"
}
```

### Get Task

#### GET /tasks/{task_id}

Get task status and result by ID.

**Authentication:** Required

**Response 200:**
```json
{
  "id": "abc123",
  "type": "ai_generate",
  "status": "completed",
  "payload": {...},
  "result": {"content": "..."},
  "error": null,
  "retries": 0,
  "created_at": "2026-04-21T10:00:00Z",
  "updated_at": "2026-04-21T10:01:00Z"
}
```

**Response 404:** Task not found

### List Tasks

#### GET /tasks

List background tasks with optional filtering.

**Authentication:** Required

**Query Parameters:**
- `status` (string, optional): pending, running, completed, failed, cancelled
- `type` (string, optional): ai_generate, export_project, batch_operation, cleanup
- `limit` (int): Max records (1-500, default: 100)
- `offset` (int): Records to skip (default: 0)

**Response 200:**
```json
{
  "tasks": [...],
  "total": 10,
  "limit": 100,
  "offset": 0
}
```

### Cancel Task

#### DELETE /tasks/{task_id}

Cancel a pending background task.

**Authentication:** Required

**Note:** Only pending tasks can be cancelled. Running tasks will complete.

**Response 200:**
```json
{
  "success": true,
  "message": "Task abc123 cancelled successfully"
}
```

---

## Styles

Writing style management.

### List Styles

#### GET /styles/

List all available writing styles.

**Authentication:** Required

**Response 200:**
```json
[
  {
    "id": "江南",
    "name": "江南风格",
    "description": "东方玄幻风格，文笔细腻柔美，擅长情感描写和意境营造"
  },
  {
    "id": "卡夫卡",
    "name": "卡夫卡风格",
    "description": "表现主义风格，文风荒诞抽象，善于揭示人性的异化和社会的荒谬"
  },
  {
    "id": "加缪",
    "name": "加缪风格",
    "description": "存在主义风格，文风冷峻深刻，擅长哲学思辨和对生命意义的探索"
  },
  {
    "id": "default",
    "name": "默认风格",
    "description": "专业中文网络小说风格，文笔流畅，情节紧凑，可读性强"
  }
]
```

### Get Style

#### GET /styles/{style_id}

Get a specific writing style by ID.

**Authentication:** Required

**Response 200:** WritingStyle object

**Response 404:** Style not found

---

## Cache

Cache management endpoints.

### Get Cache Stats

#### GET /cache/stats

Get cache statistics.

**Authentication:** Required

**Response 200:**
```json
{
  "size": 1024,
  "directory": "./cache"
}
```

### Flush Cache

#### POST /cache/flush

Clear all cache entries.

**Authentication:** Required

**Response 200:**
```json
{
  "message": "Cache flushed successfully"
}
```

### Invalidate Cache Tag

#### POST /cache/invalidate/{tag}

Invalidate all cache entries associated with a tag.

**Authentication:** Required

**Response 200:**
```json
{
  "tag": "characters",
  "deleted_count": 15
}
```

---

## Project

Export/Import for complete project backup.

### Export Project

#### GET /api/project/export

Export all project data as JSON.

**Authentication:** Required

**Response 200:**
```json
{
  "version": "1.0",
  "exported_at": "2026-04-21T10:00:00Z",
  "data": {...}
}
```

### Export as ZIP

#### GET /api/project/export/zip

Export all project data as a ZIP archive.

**Authentication:** Required

**Response:** `application/zip` binary stream

**Headers:**
- `Content-Disposition: attachment; filename=project_export.zip`

### Import Project

#### POST /api/project/import

Import project data from JSON.

**Authentication:** Required

**Request Body:**
```json
{
  "data": {...},
  "mode": "merge"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| data | object | Yes | Project data to import |
| mode | string | No | "merge" (default) or "replace" |

**Response 200:**
```json
{
  "success": true,
  "summary": {
    "characters": 10,
    "chapters": 5,
    ...
  }
}
```

### Import from ZIP

#### POST /api/project/import/zip

Import project data from a ZIP archive.

**Authentication:** Required

**Request Body:**
```json
{
  "data": "<base64-encoded-zip>",
  "mode": "merge"
}
```

**Response 200:**
```json
{
  "success": true,
  "summary": {...}
}
```

---

## WebSocket

Real-time communication endpoints.

### Chat WebSocket

#### WS /ws/chat/{session_id}

WebSocket endpoint for real-time chat streaming.

**Authentication:** Query parameter `api_key` or header

**Message Format (send):**
```json
{
  "content": "消息内容",
  "role": "user"
}
```

**Message Format (receive):**
```json
{
  "type": "message",
  "content": "消息内容",
  "role": "assistant"
}
```

**Keep-alive:** Server sends ping every 30 seconds, client should respond with "pong"

### General WebSocket

#### WS /ws

General WebSocket endpoint for real-time updates.

**Authentication:** Query parameter `api_key` or header

### WebSocket Status

#### GET /ws/status/{session_id}

Get WebSocket connection status for a session.

**Response 200:**
```json
{
  "session_id": 1,
  "status": "connected",
  "connections": 2
}
```

---

## Rate Limits

| Endpoint Group | Limit | Window |
|----------------|-------|--------|
| Chat sessions | 60 requests | 60 seconds |
| Chat messages | 30 requests | 60 seconds |
| AI checker endpoints | 1 request | 60 seconds |
| General /api/v1/* | 60 requests | 60 seconds |

---

## Error Responses

### 400 Bad Request
```json
{
  "detail": "Validation error description"
}
```

### 401 Unauthorized
```json
{
  "detail": "Invalid or missing API key"
}
```

### 403 Forbidden
```json
{
  "detail": "Access denied"
}
```

### 404 Not Found
```json
{
  "detail": "Resource not found"
}
```

### 429 Too Many Requests
```json
{
  "detail": "Rate limit exceeded"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error"
}
```

---

## Example curl Commands

### Get API Key
```bash
curl -X POST http://localhost:8000/auth/key
```

### Health Check
```bash
curl http://localhost:8000/health
```

### Create Chat Session
```bash
curl -X POST http://localhost:8000/api/v1/chat/sessions \
  -H "X-API-Key: your-api-key"
```

### List Characters
```bash
curl http://localhost:8000/api/v1/settings/characters \
  -H "X-API-Key: your-api-key"
```

### Create Character
```bash
curl -X POST http://localhost:8000/api/v1/settings/characters \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"name": "张三", "gender": "男", "tier": "protagonist"}'
```

### Generate AI Content
```bash
curl -X POST http://localhost:8000/api/v1/ai/generate \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "续写主角初入仙门", "operation": "continue"}'
```

### Export Project
```bash
curl -O http://localhost:8000/api/v1/project/export \
  -H "X-API-Key: your-api-key"
```

---

## OpenAPI Documentation

FastAPI auto-generates OpenAPI documentation at:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **OpenAPI JSON:** http://localhost:8000/openapi.json
