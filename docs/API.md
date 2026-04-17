# API 文档

## Base URL
```
http://localhost:8000/api/v1
```

## 后端 API 端点

### 聊天接口 `/api/v1/chat`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/chat/sessions` | POST | 创建聊天会话 |
| `/chat/sessions` | GET | 获取会话列表 |
| `/chat/sessions/{id}` | GET | 获取会话详情 |
| `/chat/sessions/{id}` | DELETE | 删除会话 |
| `/chat/sessions/{id}/messages` | POST | 发送消息 |
| `/chat/sessions/{id}/messages` | GET | 获取消息列表 |
| `/chat/sessions/{id}/entities` | GET | 获取提取的实体 |
| `/chat/entities/{id}/confirm` | PATCH | 确认实体 |

### 设定接口 `/api/v1/settings`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/settings/characters` | GET, POST | 角色 CRUD |
| `/settings/characters/{id}` | GET, PATCH, DELETE | 角色操作 |
| `/settings/characters/{id}/relationships` | GET, POST | 角色关系 |
| `/settings/characters/{id}/storylines` | GET, POST | 角色剧情线 |
| `/settings/items` | GET, POST | 物品 CRUD |
| `/settings/locations` | GET, POST | 地点 CRUD |
| `/settings/factions` | GET, POST | 势力 CRUD |
| `/settings/world` | GET, POST | 世界观 CRUD |
| `/settings/rules` | GET, POST | 规则 CRUD |
| `/settings/writing` | GET, PATCH | 写作设置 |
| `/settings/export` | GET | 导出数据 |
| `/settings/import` | POST | 导入数据 |

### 章节接口 `/api/v1/chapters`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/chapters/outlines` | GET, POST | 大纲 CRUD |
| `/chapters/outlines/{id}` | GET, PATCH, DELETE | 大纲操作 |
| `/chapters/` | GET, POST | 章节 CRUD |
| `/chapters/{id}` | GET, PATCH, DELETE | 章节操作 |
| `/chapters/{id}/drafts` | GET, POST | 草稿版本 |
| `/chapters/{id}/inspections` | GET, POST | AI 审查结果 |
| `/chapters/if-lines` | GET, POST | IF 线 |
| `/chapters/plot-threads` | GET, POST | 剧情线索 |

### AI 接口 `/api/v1/ai`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/ai/generate` | POST | AI 生成内容（流式） |
| `/ai/review` | POST | AI 审查设定 |
| `/ai/extract-entities` | POST | 从聊天提取实体 |
| `/ai/chapters/{id}/inspect` | POST | AI 审查章节 |

### 文笔风格 `/api/v1/styles`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/styles` | GET | 获取可用文笔风格列表 |
| `/styles/{id}` | GET | 获取特定风格详情 |

## 请求/响应格式

所有请求和响应均为 JSON 格式。

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
