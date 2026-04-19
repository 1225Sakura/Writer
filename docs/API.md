# API 文档

## Base URL
```
http://localhost:8000/api/v1
```

## 聊天接口 `/api/v1/chat`

Interface 1: 聊天初始化，收集世界观、角色、金手指等设定

| 端点 | 方法 | 说明 |
|------|------|------|
| `/chat/sessions` | POST | 创建聊天会话 |
| `/chat/sessions` | GET | 获取会话列表 (skip, limit) |
| `/chat/sessions/{session_id}` | GET | 获取会话详情 |
| `/chat/sessions/{session_id}` | DELETE | 删除会话 |
| `/chat/sessions/{session_id}/messages` | POST | 发送消息 |
| `/chat/sessions/{session_id}/messages` | GET | 获取消息列表 (skip, limit) |
| `/chat/sessions/{session_id}/entities` | GET | 获取提取的实体 (type, confirmed) |
| `/chat/entities/{entity_id}/confirm` | PATCH | 确认/取消确认实体 |

### 请求/响应格式

**POST /chat/sessions**
```json
// Response
{
  "id": 1,
  "created_at": "2026-04-19T10:00:00",
  "updated_at": "2026-04-19T10:00:00"
}
```

**POST /chat/sessions/{session_id}/messages**
```json
// Request
{
  "role": "user",
  "content": "我的小说主角叫张三..."
}
// Response
{
  "id": 1,
  "session_id": 1,
  "role": "user",
  "content": "我的小说主角叫张三...",
  "created_at": "2026-04-19T10:00:00"
}
```

**GET /chat/sessions/{session_id}/entities**
```json
// Query params: type (optional), confirmed (optional)
// Response
[
  {
    "id": 1,
    "session_id": 1,
    "type": "character",
    "name": "张三",
    "description": "主角",
    "confirmed": false,
    "created_at": "2026-04-19T10:00:00"
  }
]
```

---

## 设定接口 `/api/v1/settings`

Interface 2: 世界观、角色、物品、地点、势力、规则等设定管理

### 角色 `/settings/characters`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/settings/characters` | GET | 获取角色列表 (skip, limit, tier) |
| `/settings/characters` | POST | 创建角色 |
| `/settings/characters/{character_id}` | GET | 获取角色详情 |
| `/settings/characters/{character_id}` | PATCH | 更新角色 |
| `/settings/characters/{character_id}` | DELETE | 删除角色 |
| `/settings/characters/{character_id}/relationships` | GET | 获取角色关系 |
| `/settings/characters/{character_id}/relationships` | POST | 创建角色关系 |
| `/settings/characters/{character_id}/storylines` | GET | 获取角色剧情线 |
| `/settings/characters/{character_id}/storylines` | POST | 创建角色剧情线 |

### 物品 `/settings/items`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/settings/items` | GET | 获取物品列表 (skip, limit, owner) |
| `/settings/items` | POST | 创建物品 |
| `/settings/items/{item_id}` | PATCH | 更新物品 |
| `/settings/items/{item_id}` | DELETE | 删除物品 |

### 地点 `/settings/locations`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/settings/locations` | GET | 获取地点列表 (skip, limit, importance) |
| `/settings/locations` | POST | 创建地点 |
| `/settings/locations/{location_id}` | PATCH | 更新地点 |
| `/settings/locations/{location_id}` | DELETE | 删除地点 |

### 势力 `/settings/factions`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/settings/factions` | GET | 获取势力列表 (skip, limit, type) |
| `/settings/factions` | POST | 创建势力 |
| `/settings/factions/{faction_id}` | PATCH | 更新势力 |
| `/settings/factions/{faction_id}` | DELETE | 删除势力 |

### 世界观 `/settings/world`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/settings/world` | GET | 获取世界观设定列表 |
| `/settings/world` | POST | 创建世界观设定 |
| `/settings/world/{setting_id}` | PATCH | 更新世界观设定 |
| `/settings/world/{setting_id}` | DELETE | 删除世界观设定 |

### 规则 `/settings/rules`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/settings/rules` | GET | 获取规则列表 (skip, limit, type) |
| `/settings/rules` | POST | 创建规则 |
| `/settings/rules/{rule_id}` | PATCH | 更新规则 |
| `/settings/rules/{rule_id}` | DELETE | 删除规则 |

### 写作设置 `/settings/writing`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/settings/writing` | GET | 获取写作设置 |
| `/settings/writing` | PATCH | 更新写作设置 |

### 导出/导入 `/api/v1/project`

项目级数据导出导入（独立于 settings 前缀）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/project/export` | GET | 导出所有项目数据 (JSON) |
| `/api/project/export/zip` | GET | 导出所有项目数据 (ZIP) |
| `/api/project/import` | POST | 导入项目数据 (mode: merge/replace) |
| `/api/project/import/zip` | POST | 从 ZIP 导入项目数据 |

### 请求/响应格式

**POST /settings/characters**
```json
// Request
{
  "name": "张三",
  "gender": "男",
  "personality": "坚毅果敢",
  "tier": "主角"
}
// Response
{
  "id": 1,
  "name": "张三",
  "gender": "男",
  "personality": "坚毅果敢",
  "desires": null,
  "flaws": null,
  "description": null,
  "tier": "主角",
  "cultivation_realm": null,
  "created_at": "2026-04-19T10:00:00",
  "updated_at": "2026-04-19T10:00:00"
}
```

**PATCH /settings/writing**
```json
// Request
{
  "human_ai_ratio": 0.7,
  "writing_style": "江南",
  "target_word_count": 500000
}
```

**GET /api/project/export**
```json
// Response
{
  "version": "1.0",
  "exported_at": "2026-04-19T10:00:00",
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

---

## 章节接口 `/api/v1/chapters`

Interface 3: 大纲、章节、IF线、剧情线索管理

### 大纲 `/chapters/outlines`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/chapters/outlines` | GET | 获取大纲列表 (skip, limit) |
| `/chapters/outlines` | POST | 创建大纲 |
| `/chapters/outlines/{outline_id}` | GET | 获取大纲详情 |
| `/chapters/outlines/{outline_id}` | PATCH | 更新大纲 |
| `/chapters/outlines/{outline_id}` | DELETE | 删除大纲 |

### 章节 `/chapters`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/chapters/` | GET | 获取章节列表 (skip, limit, outline_id, status) |
| `/chapters/` | POST | 创建章节 |
| `/chapters/{chapter_id}` | GET | 获取章节详情 |
| `/chapters/{chapter_id}` | PATCH | 更新章节 |
| `/chapters/{chapter_id}` | DELETE | 删除章节 |
| `/chapters/{chapter_id}/drafts` | GET | 获取草稿列表 |
| `/chapters/{chapter_id}/drafts` | POST | 创建草稿版本 |
| `/chapters/{chapter_id}/drafts/{version_number}` | GET | 获取指定草稿 |
| `/chapters/{chapter_id}/inspections` | GET | 获取 AI 审查结果 |
| `/chapters/{chapter_id}/inspections` | POST | 创建 AI 审查结果 |

### IF 线 `/chapters/if-lines`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/chapters/if-lines` | GET | 获取 IF 线列表 (skip, limit, character_id) |
| `/chapters/if-lines` | POST | 创建 IF 线 |
| `/chapters/if-lines/{if_line_id}` | GET | 获取 IF 线详情 |
| `/chapters/if-lines/{if_line_id}` | PATCH | 更新 IF 线 |
| `/chapters/if-lines/{if_line_id}` | DELETE | 删除 IF 线 |

### 剧情线索 `/chapters/plot-threads`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/chapters/plot-threads` | GET | 获取剧情线索列表 (skip, limit, status) |
| `/chapters/plot-threads` | POST | 创建剧情线索 |
| `/chapters/plot-threads/{plot_thread_id}` | GET | 获取剧情线索详情 |
| `/chapters/plot-threads/{plot_thread_id}` | PATCH | 更新剧情线索 |
| `/chapters/plot-threads/{plot_thread_id}` | DELETE | 删除剧情线索 |

### 请求/响应格式

**POST /chapters/**
```json
// Request
{
  "outline_id": 1,
  "title": "第一章 觉醒",
  "summary": "主角在山谷中发现神秘玉佩",
  "status": "pending",
  "word_count": 0,
  "chapter_order": 1
}
// Response
{
  "id": 1,
  "outline_id": 1,
  "title": "第一章 觉醒",
  "summary": "主角在山谷中发现神秘玉佩",
  "status": "pending",
  "word_count": 0,
  "chapter_order": 1,
  "created_at": "2026-04-19T10:00:00",
  "updated_at": "2026-04-19T10:00:00"
}
```

**POST /chapters/if-lines**
```json
// Request
{
  "title": "主角的平行世界",
  "linked_character_id": 1,
  "description": "如果主角选择了另一条路",
  "sync_mode": "auto"
}
```

**POST /chapters/plot-threads**
```json
// Request
{
  "title": "玉佩之谜",
  "description": "玉佩的来历和作用",
  "status": "active",
  "created_chapter_id": 1,
  "reveal_chapter_id": 5
}
```

---

## AI 接口 `/api/v1/ai`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/ai/generate` | POST | AI 生成内容（流式） |
| `/ai/review` | POST | AI 审查设定 |
| `/ai/extract-entities` | POST | 从聊天提取实体 |
| `/ai/chapters/{chapter_id}/inspect` | POST | AI 审查章节 |

### 请求/响应格式

**POST /ai/generate**
```json
// Request
{
  "prompt": "继续写主角在山谷中的冒险...",
  "operation": "continue",
  "chapter_id": 1,
  "human_ai_ratio": 70,
  "style": "江南"
}
// Response: 流式文本 (text/plain)
// Headers: X-Operation, X-Human-AI-Ratio, X-Style

// operation 类型:
/*
continue: 续写后续内容
expand: 扩写当前内容
condense: 缩写当前内容
rewrite: 改写当前内容
polish: 润色当前内容
optimize: 优化当前内容
*/
```

**POST /ai/review**
```json
// Request
{
  "settings_data": {
    "characters": [...],
    "locations": [...],
    "items": [...],
    "factions": [...],
    "rules": [...]
  }
}
// Response
{
  "review_content": "审查报告内容...",
  "raw_response": {...}
}
```

**POST /ai/extract-entities**
```json
// Request
[
  {"role": "user", "content": "主角张三在京城遇到李四"},
  {"role": "assistant", "content": "好的，张三是这本书的主角..."}
]
// Response
{
  "entities": [
    {"type": "character", "name": "张三", "description": "主角"},
    {"type": "character", "name": "李四", "description": "配角"},
    {"type": "location", "name": "京城", "description": "都城"}
  ]
}
```

**POST /ai/chapters/{chapter_id}/inspect**
```json
// Response
{
  "chapter_id": 1,
  "review_content": "章节审查报告...",
  "raw_response": {...}
}
```

---

## 文笔风格 `/api/v1/styles`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/styles` | GET | 获取可用文笔风格列表 |
| `/styles/{style_id}` | GET | 获取特定风格详情 |

### 可用风格

| ID | 名称 | 描述 |
|----|------|------|
| `江南` | 江南风格 | 东方玄幻风格，文笔细腻柔美，擅长情感描写和意境营造 |
| `卡夫卡` | 卡夫卡风格 | 表现主义风格，文风荒诞抽象，善于揭示人性的异化和社会的荒谬 |
| `加缪` | 加缪风格 | 存在主义风格，文风冷峻深刻，擅长哲学思辨和对生命意义的探索 |
| `default` | 默认风格 | 专业中文网络小说风格，文笔流畅，情节紧凑，可读性强 |

### 请求/响应格式

**GET /styles**
```json
// Response
[
  {
    "id": "江南",
    "name": "江南风格",
    "description": "东方玄幻风格..."
  },
  ...
]
```

---

## 通用响应格式

所有请求和响应均为 JSON 格式（流式响应除外）。

### 成功响应
```json
{
  "id": 1,
  "name": "角色名称",
  ...
}
```

### 错误响应
```json
{
  "detail": "错误描述"
}
```

### 分页参数

支持分页的端点接受以下查询参数：
- `skip`: 跳过记录数（默认 0）
- `limit`: 返回记录数（最大 100）

### 过滤参数

部分端点支持过滤：
- `status`: 状态过滤
- `type`: 类型过滤
- `tier`: 等级过滤
- `confirmed`: 确认状态过滤
- `owner`: 所有者过滤
- `importance`: 重要性过滤
- `character_id`: 角色 ID 过滤

---

## 速率限制

聊天接口实施了速率限制：
- `GET /chat/sessions`: 60 请求/分钟
- `POST /chat/sessions/{id}/messages`: 30 请求/分钟

超过限制返回 429 状态码。
