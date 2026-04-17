# Auto Novel Writer - 自动化写作软件

一款面向中文网络小说作者的本地桌面写作软件，通过 AI 辅助完成从世界观构建、角色设定到正文创作的全流程。

## 功能说明

### 三界面架构

#### 界面1：聊天初始化 (Chat Initialization)
- AI 主动提问，收集世界观、角色、金手指、反派等设定
- 实时显示已收集信息面板
- 支持随时进入界面2预览

#### 界面2：设定编辑 (Setting Editor)
- 左侧分类导航（世界观/角色/物品/地点/势力/规则/大纲/IF线）
- 右侧编辑器支持关系可视化
- AI 审查可多次迭代（一致性检查、伏笔追踪、建议优化）

#### 界面3：正文写作 (Writing Editor)
- 沉浸式写作区，最大化正文空间
- AI 操作抽屉（右侧）+ 协作面板抽屉（右侧），可独立展开/收起
- 工具栏：写作/大纲/AI操作/协作/返回设定
- 人机比例滑块实时调节
- 快捷键：Ctrl+Shift+O(优化) / E(扩写) / S(缩写) / R(改写) / W(续写) / P(润色)

### 核心功能

- **AI 辅助写作**：支持续写、扩写、缩写、改写、优化、润色等多种操作
- **人机协作比例调节**：滑块实时控制 AI 生成内容比例
- **IF 线同步写作**：支持配角角色故事线同步创作
- **文笔风格选择**：江南/卡夫卡/加缪/默认等多种风格
- **关系图谱可视化**：角色关系可视化展示
- **章节版本管理**：自动保存每次修改的版本
- **伏笔追踪**：记录和追踪故事中的伏笔

## 技术栈

### 后端
- **框架**：Python 3.11+ / FastAPI
- **数据库**：SQLite + SQLAlchemy (异步)
- **AI**：MiniMax API (流式响应)
- **服务器**：Uvicorn

### 前端
- **框架**：React 18 + TypeScript
- **状态管理**：Zustand
- **富文本编辑器**：Tiptap
- **关系图谱**：react-force-graph-2d / react-force-graph-3d
- **UI 组件**：Radix UI + Tailwind CSS
- **构建工具**：Vite
- **动画**：Framer Motion

## 快速开始

### 环境要求

- Python 3.11+
- Node.js 18+
- npm 或 pnpm

### 后端启动

```bash
cd src/backend

# 安装依赖
pip install -r requirements.txt

# 配置环境变量 (.env)
MINIMAX_API_KEY=your_api_key_here

# 初始化数据库
python init_db.py

# 启动服务器
python start.py
# 或
uvicorn main:app --reload --port 8000
```

后端服务将在 http://localhost:8000 启动

### 前端启动

```bash
cd src/frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务将在 http://localhost:5173 启动

### 构建生产版本

```bash
cd src/frontend
npm run build
```

## API 文档

基础路径：`/api`

### 聊天接口 (Chat)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/chat/sessions` | POST | 创建聊天会话 |
| `/api/chat/sessions` | GET | 获取会话列表 |
| `/api/chat/sessions/{session_id}` | GET | 获取指定会话 |
| `/api/chat/sessions/{session_id}` | DELETE | 删除会话 |
| `/api/chat/sessions/{session_id}/messages` | POST | 发送消息 |
| `/api/chat/sessions/{session_id}/messages` | GET | 获取消息历史 |
| `/api/chat/sessions/{session_id}/entities` | GET | 获取提取的实体 |
| `/api/chat/entities/{entity_id}/confirm` | PATCH | 确认/取消确认实体 |

### 设定接口 (Settings)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/settings/characters` | GET | 获取角色列表 |
| `/api/settings/characters` | POST | 创建角色 |
| `/api/settings/characters/{id}` | GET/PATCH/DELETE | 角色 CRUD |
| `/api/settings/characters/{id}/relationships` | GET/POST | 角色关系 |
| `/api/settings/characters/{id}/storylines` | GET/POST | 角色故事线 |
| `/api/settings/items` | GET/POST | 物品管理 |
| `/api/settings/items/{id}` | PATCH/DELETE | 物品 CRUD |
| `/api/settings/locations` | GET/POST | 地点管理 |
| `/api/settings/locations/{id}` | PATCH/DELETE | 地点 CRUD |
| `/api/settings/factions` | GET/POST | 势力管理 |
| `/api/settings/factions/{id}` | PATCH/DELETE | 势力 CRUD |
| `/api/settings/world` | GET/POST | 世界设定 |
| `/api/settings/world/{id}` | PATCH/DELETE | 世界设定 CRUD |
| `/api/settings/rules` | GET/POST | 规则管理 |
| `/api/settings/rules/{id}` | PATCH/DELETE | 规则 CRUD |
| `/api/settings/writing` | GET/PATCH | 写作设置 |

### 章节接口 (Chapters)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/chapters/outlines` | GET/POST | 大纲管理 |
| `/api/chapters/outlines/{id}` | GET/PATCH/DELETE | 大纲 CRUD |
| `/api/chapters/` | GET/POST | 章节列表/创建 |
| `/api/chapters/{id}` | GET/PATCH/DELETE | 章节 CRUD |
| `/api/chapters/{id}/drafts` | GET/POST | 版本历史 |
| `/api/chapters/{id}/drafts/{version}` | GET | 获取指定版本 |
| `/api/chapters/{id}/inspections` | GET/POST | AI 审查记录 |
| `/api/chapters/if-lines` | GET/POST | IF 线列表 |
| `/api/chapters/if-lines/{id}` | GET/PATCH/DELETE | IF 线 CRUD |
| `/api/chapters/plot-threads` | GET/POST | 伏笔追踪 |
| `/api/chapters/plot-threads/{id}` | GET/PATCH/DELETE | 伏笔 CRUD |

### AI 接口

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/ai/generate` | POST | AI 内容生成（流式） |
| `/api/ai/review` | POST | AI 设定审查 |
| `/api/ai/extract-entities` | POST | 从聊天提取实体 |
| `/api/ai/chapters/{id}/inspect` | POST | 章节 AI 审查 |

### 风格接口

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/styles/` | GET | 获取可用风格列表 |
| `/api/styles/{id}` | GET | 获取指定风格 |

## API 详细文档

### 基础信息

- **Base URL**: `http://localhost:8000/api`
- **认证**: 当前版本无需认证（后续支持本地 Token）
- **请求头**: `Content-Type: application/json`
- **流式响应**: AI 生成接口返回 Server-Sent Events (SSE)

---

### 聊天接口 (Chat)

#### 创建聊天会话
```http
POST /api/chat/sessions
```

**响应示例**:
```json
{
  "id": 1,
  "created_at": "2026-04-17T10:00:00",
  "updated_at": "2026-04-17T10:00:00"
}
```

#### 获取会话列表
```http
GET /api/chat/sessions?skip=0&limit=20
```

**响应示例**:
```json
[
  {
    "id": 1,
    "created_at": "2026-04-17T10:00:00",
    "updated_at": "2026-04-17T10:30:00"
  }
]
```

#### 发送消息
```http
POST /api/chat/sessions/{session_id}/messages
Content-Type: application/json

{
  "role": "user",
  "content": "我想写一个修仙小说"
}
```

**响应示例**:
```json
{
  "id": 1,
  "session_id": 1,
  "role": "user",
  "content": "我想写一个修仙小说",
  "created_at": "2026-04-17T10:00:00"
}
```

#### 获取提取的实体
```http
GET /api/chat/sessions/{session_id}/entities?type=character&confirmed=true
```

**响应示例**:
```json
[
  {
    "id": 1,
    "session_id": 1,
    "type": "character",
    "name": "张三",
    "description": "主角，筑基期修士",
    "confirmed": true,
    "created_at": "2026-04-17T10:00:00"
  }
]
```

#### 确认/取消确认实体
```http
PATCH /api/chat/entities/{entity_id}/confirm?confirmed=true
```

**响应示例**:
```json
{
  "message": "Entity updated"
}
```

---

### 设定接口 (Settings)

#### 创建角色
```http
POST /api/settings/characters
Content-Type: application/json

{
  "name": "张三",
  "gender": "男",
  "personality": "沉稳内敛，心思缜密",
  "desires": "突破金丹期",
  "flaws": "过于执着",
  "tier": "main",
  "cultivation_realm": "筑基期"
}
```

**响应示例**:
```json
{
  "id": 1,
  "name": "张三",
  "gender": "男",
  "personality": "沉稳内敛，心思缜密",
  "desires": "突破金丹期",
  "flaws": "过于执着",
  "description": null,
  "tier": "main",
  "cultivation_realm": "筑基期",
  "created_at": "2026-04-17T10:00:00",
  "updated_at": "2026-04-17T10:00:00"
}
```

#### 获取角色列表
```http
GET /api/settings/characters?tier=main&skip=0&limit=100
```

**响应示例**:
```json
[
  {
    "id": 1,
    "name": "张三",
    "gender": "男",
    "personality": "沉稳内敛",
    "tier": "main",
    "cultivation_realm": "筑基期",
    "created_at": "2026-04-17T10:00:00",
    "updated_at": "2026-04-17T10:00:00"
  }
]
```

#### 创建角色关系
```http
POST /api/settings/characters/{character_id}/relationships
Content-Type: application/json

{
  "character_id": 1,
  "target_id": 2,
  "type": "rival",
  "description": "同为筑基期天才，互相竞争"
}
```

#### 创建物品
```http
POST /api/settings/items
Content-Type: application/json

{
  "name": "青锋剑",
  "description": "一柄青色长剑，剑身刻有符文",
  "owner": "张三",
  "location": "储物袋"
}
```

#### 获取写作设置
```http
GET /api/settings/writing
```

**响应示例**:
```json
{
  "id": 1,
  "human_ai_ratio": 0.7,
  "writing_style": "江南",
  "target_word_count": 3000
}
```

#### 更新写作设置
```http
PATCH /api/settings/writing
Content-Type: application/json

{
  "human_ai_ratio": 0.8,
  "writing_style": "卡夫卡",
  "target_word_count": 5000
}
```

---

### 章节接口 (Chapters)

#### 创建大纲
```http
POST /api/chapters/outlines
Content-Type: application/json

{
  "title": "第一章：入门测试",
  "description": "主角参加宗门入门测试"
}
```

**响应示例**:
```json
{
  "id": 1,
  "title": "第一章：入门测试",
  "description": "主角参加宗门入门测试"
}
```

#### 创建章节
```http
POST /api/chapters/
Content-Type: application/json

{
  "outline_id": 1,
  "title": "测试开始",
  "summary": "主角面对测试官",
  "status": "pending",
  "chapter_order": 1
}
```

**响应示例**:
```json
{
  "id": 1,
  "outline_id": 1,
  "title": "测试开始",
  "summary": "主角面对测试官",
  "status": "pending",
  "word_count": 0,
  "chapter_order": 1,
  "created_at": "2026-04-17T10:00:00",
  "updated_at": "2026-04-17T10:00:00"
}
```

#### 创建草稿版本
```http
POST /api/chapters/{chapter_id}/drafts
Content-Type: application/json

{
  "chapter_id": 1,
  "content": "清晨，阳光洒在演武场上...",
  "version_number": 1
}
```

**响应示例**:
```json
{
  "id": 1,
  "chapter_id": 1,
  "content": "清晨，阳光洒在演武场上...",
  "version_number": 1,
  "created_at": "2026-04-17T10:00:00"
}
```

#### 获取草稿版本列表
```http
GET /api/chapters/{chapter_id}/drafts?skip=0&limit=20
```

#### 创建 IF 线
```http
POST /api/chapters/if-lines
Content-Type: application/json

{
  "title": "支线：师妹的命运",
  "linked_character_id": 2,
  "description": "如果师妹选择了另一条路",
  "sync_mode": "auto"
}
```

#### 创建伏笔
```http
POST /api/chapters/plot-threads
Content-Type: application/json

{
  "title": "神秘玉佩",
  "description": "主角捡到的玉佩似乎有来历",
  "status": "active",
  "created_chapter_id": 1
}
```

---

### AI 接口

#### AI 内容生成（流式）
```http
POST /api/ai/generate
Content-Type: application/json

{
  "prompt": "主角站在山崖边，望着远处的云海...",
  "operation": "continue",
  "chapter_id": 1,
  "human_ai_ratio": 70,
  "style": "江南"
}
```

**操作类型**:
| operation | 说明 |
|-----------|------|
| `continue` | 续写后续内容 |
| `expand` | 扩写当前内容 |
| `condense` | 缩写当前内容 |
| `rewrite` | 改写当前内容 |
| `polish` | 润色当前内容 |
| `optimize` | 优化当前内容 |

**响应**: 流式文本响应 (text/plain)

**响应头**:
```
X-Operation: continue
X-Human-AI-Ratio: 70
X-Style: 江南
```

#### AI 设定审查
```http
POST /api/ai/review
Content-Type: application/json

{
  "settings_data": {
    "characters": [...],
    "locations": [...],
    "items": [...]
  }
}
```

**响应示例**:
```json
{
  "review_content": "审查意见：角色设定一致性问题...",
  "raw_response": {
    "choices": [...],
    "usage": {...}
  }
}
```

#### 从聊天提取实体
```http
POST /api/ai/extract-entities
Content-Type: application/json

{
  "chat_messages": [
    {"role": "user", "content": "主角叫张三，是青云门弟子"}
  ]
}
```

**响应示例**:
```json
{
  "entities": [
    {"type": "character", "name": "张三", "description": "青云门弟子"}
  ]
}
```

#### 章节 AI 审查
```http
POST /api/ai/chapters/{chapter_id}/inspect
```

**响应示例**:
```json
{
  "chapter_id": 1,
  "review_content": "发现以下问题：\n1. 角色一致性...\n2. 情节逻辑...",
  "raw_response": {...}
}
```

---

### 风格接口

#### 获取风格列表
```http
GET /api/styles/
```

**响应示例**:
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

#### 获取指定风格
```http
GET /api/styles/江南
```

---

### 错误响应

所有接口错误返回统一格式：

```json
{
  "detail": "错误描述"
}
```

**常见 HTTP 状态码**:
| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 数据库 Schema (18 Tables)

### Characters & Relationships
- `characters` - 角色表
- `character_relationships` - 角色关系表
- `character_storylines` - 角色故事线表

### World Entities
- `items` - 物品表
- `locations` - 地点表
- `factions` - 势力表
- `world_settings` - 世界设定表
- `rules` - 规则表

### Story Structure
- `outlines` - 大纲表
- `chapters` - 章节表
- `if_lines` - IF 线表

### Chat / Conversation
- `chat_sessions` - 聊天会话表
- `chat_messages` - 聊天消息表
- `extracted_entities` - 提取的实体表

### Writing & Versioning
- `draft_versions` - 草稿版本表
- `plot_threads` - 伏笔表
- `ai_inspection_results` - AI 审查结果表
- `writing_settings` - 写作设置表

详细表结构请参考 `src/backend/schema.sql`

## 色彩系统

| 类型 | 色值 | 用途 |
|------|------|------|
| 深墨色 | #1a1a2e | 写作区背景（深色模式） |
| 宣纸白 | #f5f0e6 | 正文文字/卡片背景 |
| 朱砂红 | #c45c5c | 强调/警告/重要标记 |
| 角色橙 | #e8b87d | 角色类型编码 |
| 物品紫 | #9b7ed9 | 物品类型编码 |
| 地点青 | #5eb5a6 | 地点类型编码 |
| 势力红 | #d45d5d | 势力类型编码 |
| 大纲蓝 | #5b8ee8 | 大纲类型编码 |
| IF线绿 | #7eb84a | IF线类型编码 |

## 快捷键

| 操作 | 快捷键 |
|------|--------|
| 切换AI抽屉 | Ctrl+\ |
| 切换协作面板 | Ctrl+/ |
| 保存 | Ctrl+S |
| 全屏写作 | F11 |
| 优化 | Ctrl+Shift+O |
| 扩写 | Ctrl+Shift+E |
| 缩写 | Ctrl+Shift+S |
| 改写 | Ctrl+Shift+R |
| 续写 | Ctrl+Shift+W |
| 润色 | Ctrl+Shift+P |

## 项目结构

```
writer/
├── src/
│   ├── backend/
│   │   ├── app/              # 备用应用目录
│   │   ├── models/           # SQLAlchemy 模型
│   │   │   └── entities.py   # 实体模型定义
│   │   ├── routes/           # API 路由
│   │   │   ├── ai.py         # AI 接口
│   │   │   ├── chat.py       # 聊天接口
│   │   │   ├── chapters.py   # 章节接口
│   │   │   ├── settings.py   # 设定接口
│   │   │   └── styles.py     # 风格接口
│   │   ├── services/         # 业务服务
│   │   │   ├── ai_service.py
│   │   │   └── database_service.py
│   │   ├── config.py         # 配置
│   │   ├── database.py      # 数据库连接
│   │   ├── init_db.py       # 数据库初始化
│   │   ├── main.py          # FastAPI 入口
│   │   ├── requirements.txt  # Python 依赖
│   │   ├── schema.sql       # 数据库 schema
│   │   └── start.py         # 启动脚本
│   └── frontend/
│       ├── src/
│       │   ├── components/   # React 组件
│       │   ├── pages/       # 页面组件
│       │   ├── stores/      # Zustand 状态
│       │   └── ...
│       ├── package.json
│       └── vite.config.ts
├── data/                     # 数据目录 (SQLite DB)
├── README.md
└── CLAUDE.md
```

## 约束

- 仅本地桌面应用，不做移动端/Web端
- 不部署本地模型，纯 API 调用
- 不做出版级校对/语法检查
- 不做多语言/翻译功能

## 部署指南

### 环境变量配置

#### 后端环境变量 (`src/backend/.env`)

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `MINIMAX_API_KEY` | 是 | MiniMax API 密钥 | `your_api_key_here` |
| `DATABASE_URL` | 否 | 数据库连接 URL | `sqlite+aiosqlite:///./data/writer.db` |

#### 前端环境变量 (`src/frontend/.env`)

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `VITE_API_BASE_URL` | 是 | 后端 API 地址 | `http://127.0.0.1:8000/api` |

#### 环境变量文件示例

后端 (`src/backend/.env.example`):
```env
MINIMAX_API_KEY=your_api_key_here
DATABASE_URL=sqlite+aiosqlite:///./data/writer.db
```

前端 (`src/frontend/.env`):
```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

### 生产构建

#### 前端生产构建

```bash
cd src/frontend
npm install
npm run build
```

构建产物输出到 `src/frontend/dist/`，使用 `vite preview` 可本地预览生产版本。

#### 后端生产启动

```bash
cd src/backend
pip install -r requirements.txt
python start.py
# 或使用 uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Docker 部署（可选）

如需使用 Docker Compose 部署，请创建以下文件：

#### `docker-compose.yml`

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./src/backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - MINIMAX_API_KEY=${MINIMAX_API_KEY}
      - DATABASE_URL=sqlite+aiosqlite:///./data/writer.db
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  frontend:
    build:
      context: ./src/frontend
      dockerfile: Dockerfile
    ports:
      - "5173:80"
    depends_on:
      - backend
    restart: unless-stopped
```

### 生产环境检查清单

- [ ] 配置 `MINIMAX_API_KEY` 环境变量
- [ ] 确认 `DATABASE_URL` 指向正确的数据库路径
- [ ] 前端 `VITE_API_BASE_URL` 指向正确的后端地址
- [ ] 生产构建 `npm run build` 无错误
- [ ] 数据库目录 `data/` 存在且有写入权限
- [ ] 确认后端 CORS 配置允许前端域名（如需远程访问）

### 目录结构

```
writer/
├── data/                    # 数据目录 (SQLite DB)
│   └── writer.db           # 自动创建
├── src/
│   ├── backend/
│   │   ├── .env            # 环境变量（需手动创建）
│   │   ├── .env.example    # 环境变量示例
│   │   └── ...
│   └── frontend/
│       ├── .env            # 前端环境变量
│       └── dist/           # 生产构建产物（构建后生成）
├── docker-compose.yml      # 可选 Docker 部署
└── README.md
```

## License

MIT
