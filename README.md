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

## License

MIT
