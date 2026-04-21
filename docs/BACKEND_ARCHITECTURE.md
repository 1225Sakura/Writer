# 后端架构文档

> 本文档描述 Auto Novel Writer 后端系统的整体架构设计。
> 版本: 1.0.0 | 更新日期: 2026-04-21

---

## 目录

1. [架构概览](#架构概览)
2. [三层架构](#三层架构)
3. [服务层](#服务层)
4. [Agent 系统](#agent-系统)
5. [事件驱动架构](#事件驱动架构)
6. [工作流系统](#工作流系统)
7. [缓存策略](#缓存策略)
8. [目录结构](#目录结构)

---

## 架构概览

Auto Novel Writer 后端采用 **FastAPI + SQLAlchemy + SQLite** 技术栈，面向本地桌面应用提供 REST API 和 WebSocket 实时通信能力。

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (React 18)                       │
│              界面1: 聊天  |  界面2: 设定  |  界面3: 写作       │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP / WebSocket
┌───────────────────────────▼─────────────────────────────────┐
│                    FastAPI 应用层                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐   │
│  │  Routes │ │Middleware│ │WebSocket│ │  Exception      │   │
│  │  (API)  │ │(日志/限流│ │(实时聊天)│ │  Handlers       │   │
│  └────┬────┘ └────┬────┘ └────┬────┘ └─────────────────┘   │
│       └─────────────┴─────────┘                              │
│                         │                                    │
│  ┌──────────────────────▼──────────────────────────────┐    │
│  │                    Services 服务层                    │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐  │    │
│  │  │AIService│ │CacheSvc │ │TaskQueue│ │Export/   │  │    │
│  │  │(AI调用) │ │(缓存)   │ │(后台任务)│ │Import    │  │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └──────────┘  │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────▼──────────────────────────────┐    │
│  │                    Agents Agent 层                    │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐  │    │
│  │  │Chat    │ │Context │ │Data    │ │Review/Plot/  │  │    │
│  │  │Agent   │ │Agent   │ │Agent   │ │Style Agent   │  │    │
│  │  └────────┘ └────────┘ └────────┘ └──────────────┘  │    │
│  │  ┌────────────────────────────────────────────────┐  │    │
│  │  │        Orchestrator (工作流编排器)              │  │    │
│  │  │   ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │    │
│  │  │   │初始化流程 │ │写作流程  │ │审查流程      │  │  │    │
│  │  │   └──────────┘ └──────────┘ └──────────────┘  │  │    │
│  │  └────────────────────────────────────────────────┘  │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────▼──────────────────────────────┐    │
│  │              Database / Storage 数据层                │    │
│  │         SQLite (本地)  +  diskcache (磁盘缓存)         │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 三层架构

后端采用经典的三层架构：**Repository -> Service -> Route**。

### 1. Route 层 (API 路由)

负责 HTTP 请求接收、参数校验、响应序列化。所有路由统一挂载在 `/api/v1` 前缀下。

| 路由模块 | 文件 | 职责 |
|---------|------|------|
| 认证 | `routes/auth.py` | API Key 认证、密钥管理 |
| 聊天 | `routes/chat.py` | 聊天会话/消息 CRUD |
| 设定 | `routes/settings.py` | 角色/物品/地点/势力/规则/世界观 CRUD |
| 章节 | `routes/chapters.py` | 大纲/章节/草稿版本管理 |
| AI | `routes/ai.py` | AI 生成、审查、实体提取、Checker 检测 |
| 风格 | `routes/styles.py` | 文笔风格查询 |
| 导出导入 | `routes/export_import.py` | 数据导出/导入 |
| 任务队列 | `routes/tasks.py` | 后台任务管理 |
| 健康检查 | `routes/health.py` | 数据库/AI/磁盘/依赖健康检查 |
| 缓存 | `routes/cache.py` | 缓存统计与清理 |
| 工作流 | `routes/workflows.py` | 工作流执行与状态查询 |
| Agent | `routes/agents.py` | Agent 执行、Checker 运行、风格分析 |
| 统计 | `routes/stats.py` | 项目级统计概览 |

### 2. Service 层 (业务服务)

封装核心业务逻辑，供 Route 层调用。

| 服务 | 文件 | 职责 |
|------|------|------|
| AIService | `services/ai_service.py` | 封装 MiniMax API 调用，支持流式生成 |
| CacheService | `services/cache_service.py` | 混合缓存（内存 LRU + 磁盘缓存） |
| TieredCache | `services/tiered_cache.py` | 三级缓存（L1 内存 / L2 磁盘 / L3 数据库） |
| TaskQueue | `services/task_queue.py` | 异步后台任务队列 |
| CharacterService | `services/character_service.py` | 角色相关业务逻辑 |
| ChapterService | `services/chapter_service.py` | 章节相关业务逻辑 |
| OutlineService | `services/outline_service.py` | 大纲相关业务逻辑 |
| ExportImport | `services/export_import.py` | 数据导出导入逻辑 |
| DatabaseService | `services/database_service.py` | 数据库操作封装 |
| ContentStorage | `services/content_storage.py` | 内容存储管理 |
| ChatService | `services/chat_service.py` | 聊天业务逻辑 |

### 3. Repository 层 (数据访问)

通过 SQLAlchemy ORM 模型直接操作 SQLite 数据库。

- 模型定义: `models/entities.py`
- 数据库连接: `database.py` (异步引擎 + 会话管理)
- 迁移工具: Alembic

---

## 服务层

### AIService

AI 服务的核心封装，负责与 MiniMax API 通信。

```python
# 主要功能
- generate(prompt, operation, style, human_ai_ratio) -> 流式生成文本
- review_settings(settings_data) -> 审查设定一致性
- extract_entities(chat_messages) -> 从聊天记录提取实体
```

### CacheService

混合缓存策略，针对不同类型的数据使用不同的缓存策略：

| 数据类型 | 缓存 | TTL | 容量 |
|---------|------|-----|------|
| 角色 | 内存 LRU | 300s | 256 |
| 章节 | 内存 LRU | 180s | 128 |
| 世界观设定 | 内存 LRU | 600s | 64 |
| AI 结果 | 内存 LRU | 3600s | 100 |
| 通用数据 | 磁盘 Cache | 可配置 | 无限制 |

### TaskQueue

异步后台任务队列，用于处理耗时操作（如批量导出、AI 批量审查）。

---

## Agent 系统

Agent 系统是基于 AI 的智能写作助手，所有 Agent 继承自 `BaseAgent` 抽象基类。

### Agent 基类

```python
class BaseAgent(ABC):
    def __init__(self, provider: AIProvider, event_bus: AsyncEventBus)
    @abstractmethod
    async def execute(self, context: AgentContext) -> AgentResult
```

### 核心 Agent

| Agent | 文件 | 职责 |
|-------|------|------|
| **ChatAgent** | `agents/chat_agent.py` | 驱动聊天初始化界面，通过信息熵策略主动提问收集世界观、角色、金手指等设定 |
| **ContextAgent** | `agents/context_agent.py` | 为章节写作生成"创作执行包"，包含核心任务、承接上文、出场角色、场景约束、风格指导等 |
| **DataAgent** | `agents/data_agent.py` | 从章节内容提取结构化实体（角色/地点/物品/关系），支持别名消歧、增量更新、关系图谱构建 |
| **ReviewAgent** | `agents/review_agent.py` | 三轮质量审查：快速扫描 -> 深度分析 -> 交叉验证，输出综合评分和建议 |
| **PlotAgent** | `agents/plot_agent.py` | 情节设计与节奏分析：伏笔设计、高潮规划、张力曲线分析 |
| **StyleAgent** | `agents/style_agent.py` | 风格指纹分析（句式/词汇/修辞/情感）、文笔风格调节、风格迁移建议 |
| **StrandTracker** | `agents/strand_tracker.py` | 情节线（主线/副线/IF线）比例追踪与健康分析，红线检查 |

### Checker Agent (质量检查器)

Checker 是专门的轻量级质量检测 Agent，用于审查章节质量：

| Checker | 文件 | 检测维度 |
|---------|------|---------|
| ConsistencyChecker | `agents/checkers/consistency_checker.py` | 世界设定一致性 |
| ContinuityChecker | `agents/checkers/continuity_checker.py` | 叙事连续性 |
| PacingChecker | `agents/checkers/pacing_checker.py` | 叙事节奏与故事线比例 |
| OOCChecker | `agents/checkers/ooc_checker.py` | 角色行为一致性（OOC 检测） |
| HighPointChecker | `agents/checkers/high_point_checker.py` | 高潮分布与兴奋点密度 |
| ReaderPullChecker | `agents/checkers/reader_pull_checker.py` | 读者吸引力与钩子效果 |
| OutlineLawEnforcer | `agents/checkers/outline_law_enforcer.py` | 大纲关键设定合规性 |
| SettingPhysicsEnforcer | `agents/checkers/setting_physics_enforcer.py` | 世界观物理/规则一致性 |

CheckerPipeline (`agents/checkers/pipeline.py`) 支持并行运行多个 Checker，并聚合结果。

---

## 事件驱动架构

后端采用轻量级事件总线 (`AsyncEventBus`) 实现组件间解耦通信。

### 事件总线

```python
class AsyncEventBus:
    def subscribe(self, event_type: str, handler: Callable) -> None
    def unsubscribe(self, event_type: str, handler: Callable) -> bool
    async def publish(self, event_type: str, payload: Dict[str, Any]) -> None
```

### 预定义事件类型

| 事件类型 | 常量 | 触发场景 |
|---------|------|---------|
| entity.created | `ENTITY_CREATED` | 实体创建后 |
| entity.updated | `ENTITY_UPDATED` | 实体更新后 |
| entity.deleted | `ENTITY_DELETED` | 实体删除后 |
| cache.invalidate | `CACHE_INVALIDATE` | 缓存失效时 |
| agent.executed | `AGENT_EXECUTED` | Agent 执行完成后 |
| workflow.started | `WORKFLOW_STARTED` | 工作流启动时 |
| workflow.stage.completed | `STAGE_COMPLETED` | 工作流阶段完成时 |
| workflow.agent.executed | `AGENT_EXECUTED` | 工作流中 Agent 执行后 |
| workflow.completed | `WORKFLOW_COMPLETED` | 工作流完成时 |
| workflow.failed | `WORKFLOW_FAILED` | 工作流失败时 |

### 事件使用场景

1. **缓存失效**: 实体更新后发布 `entity.updated`，缓存监听器自动清理相关缓存
2. **工作流监控**: 工作流各阶段发布事件，支持外部监控和日志记录
3. **Agent 执行追踪**: Agent 执行完成后发布事件，用于统计和调试

---

## 工作流系统

工作流系统由 `AgentOrchestrator` 编排，支持多阶段、并行/串行执行、DAG 依赖管理。

### 核心工作流

#### 1. 初始化工作流 (initialization)

用于界面1（聊天初始化），收集故事设定：

```
chat_collection (ChatAgent, 串行)
    -> context_synthesis (ContextAgent, 串行, 依赖 chat_collection)
        -> data_extraction (DataAgent, 串行, 依赖 context_synthesis)
```

#### 2. 写作工作流 (writing)

用于界面3（正文写作），生成章节内容：

```
context_building (ContextAgent, 串行)
    -> plot_planning (PlotAgent, 串行, 依赖 context_building)
        -> style_application (StyleAgent, 串行, 依赖 plot_planning)
            -> quality_review (ReviewAgent, 串行, 依赖 style_application)
```

#### 3. 审查工作流 (review)

用于质量检查，并行运行多个 Checker：

```
comprehensive_review (ReviewAgent + 多个 Checker, 并行)
```

### 工作流执行状态

```python
class WorkflowStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
```

### 工作流持久化

工作流执行结果持久化在内存中（`AgentOrchestrator._executions`），支持：

- 查询执行状态 (`get_execution_status`)
- 列出历史执行 (`list_executions`)
- 按工作流名称过滤

---

## 缓存策略

后端采用 **多级缓存策略**，针对不同数据特征选择最优缓存层级。

### 三级缓存架构

```
请求 -> L1 (内存 LRU) -> L2 (磁盘 diskcache) -> L3 (数据库 cache_entries)
         ^                    ^                      ^
         | 热数据             | 温数据               | 冷数据
         | <1KB              | <64KB               | 大对象
         | 最快              | 较快                | 最慢
```

### 缓存层级详情

| 层级 | 实现 | 容量 | 持久化 | 适用场景 |
|------|------|------|--------|---------|
| L1 | `LRUCache` (OrderedDict) | 配置上限 | 否 | 角色、章节、设定等热数据 |
| L2 | `diskcache.Cache` | 磁盘限制 | 是 | AI 生成结果、导出数据 |
| L3 | SQLite `cache_entries` 表 | 无限制 | 是 | 大对象、长期缓存 |

### 缓存策略

1. **自动分级**: 根据数据大小自动选择缓存层级（<1KB -> L1, <64KB -> L2, 其余 -> L3）
2. **提升策略**: L2/L3 命中后自动提升到 L1
3. **失效策略**: 实体变更时通过事件总线触发缓存失效
4. **TTL 策略**: 不同数据类型配置不同 TTL（角色 300s、设定 600s、AI 结果 3600s）

### 缓存服务统计

`CacheService.stats()` 返回所有缓存层级的实时统计：

```json
{
  "memory_caches": {
    "characters": {"size": 10, "max_size": 256, "expired_entries": 0},
    "chapters": {"size": 5, "max_size": 128, "expired_entries": 0}
  },
  "disk_cache": {"size": 50, "directory": "/data/cache"}
}
```

---

## 目录结构

```
src/backend/
├── main.py                 # FastAPI 应用入口， lifespan 管理
├── config.py               # 应用配置 (pydantic-settings)
├── database.py             # 数据库连接与会话管理
├── models/
│   └── entities.py         # SQLAlchemy ORM 模型
├── routes/
│   ├── __init__.py         # API 路由聚合 (api_router)
│   ├── auth.py             # 认证路由
│   ├── chat.py             # 聊天路由
│   ├── settings.py         # 设定路由
│   ├── chapters.py         # 章节路由
│   ├── ai.py               # AI 生成/审查路由
│   ├── styles.py           # 风格路由
│   ├── export_import.py    # 导出导入路由
│   ├── tasks.py            # 任务队列路由
│   ├── health.py           # 健康检查路由
│   ├── cache.py            # 缓存管理路由
│   ├── workflows.py        # 工作流路由
│   ├── agents.py           # Agent 执行路由
│   └── stats.py            # 统计路由
├── services/
│   ├── __init__.py         # 服务导出
│   ├── ai_service.py       # AI 服务
│   ├── cache_service.py    # 缓存服务
│   ├── tiered_cache.py     # 三级缓存
│   ├── task_queue.py       # 任务队列
│   ├── character_service.py # 角色服务
│   ├── chapter_service.py  # 章节服务
│   ├── outline_service.py  # 大纲服务
│   ├── export_import.py    # 导出导入服务
│   ├── database_service.py # 数据库服务
│   ├── content_storage.py  # 内容存储
│   └── chat_service.py     # 聊天服务
├── agents/
│   ├── __init__.py         # Agent 导出
│   ├── base.py             # BaseAgent 抽象基类
│   ├── chat_agent.py       # 聊天 Agent
│   ├── context_agent.py    # 上下文 Agent
│   ├── data_agent.py       # 数据提取 Agent
│   ├── review_agent.py     # 审查 Agent
│   ├── plot_agent.py       # 情节 Agent
│   ├── style_agent.py      # 风格 Agent
│   ├── strand_tracker.py   # 情节线追踪
│   ├── orchestrator.py     # 工作流编排器
│   ├── workflows.py        # 工作流定义
│   ├── utils.py            # Agent 工具函数
│   └── checkers/           # 质量检查器
│       ├── __init__.py
│       ├── base.py         # BaseChecker 基类
│       ├── pipeline.py     # Checker 流水线
│       ├── consistency_checker.py
│       ├── continuity_checker.py
│       ├── pacing_checker.py
│       ├── ooc_checker.py
│       ├── high_point_checker.py
│       ├── reader_pull_checker.py
│       ├── outline_law_enforcer.py
│       └── setting_physics_enforcer.py
├── middleware/
│   ├── logging.py          # 结构化日志中间件
│   ├── rate_limit.py       # 限流中间件
│   ├── performance.py      # 性能监控中间件
│   ├── errors.py           # 异常处理
│   ├── auth.py             # 认证中间件
│   └── request_context.py  # 请求上下文
├── utils/
│   ├── logging.py          # 日志工具
│   ├── event_bus.py        # 事件总线
│   ├── migrations.py       # 迁移检查
│   └── keyring_storage.py  # 密钥存储
├── tests/                  # 测试目录
│   ├── conftest.py         # pytest 共享 fixtures
│   ├── test_api.py
│   ├── test_api_integration.py
│   ├── test_auth.py
│   ├── test_health.py
│   ├── test_phase4_integration.py  # Phase 4 集成测试
│   └── ...
└── alembic/                # 数据库迁移
    └── versions/
```

---

## 中间件栈

请求处理流水线（从外到内）：

```
1. CORS Middleware          # 跨域处理
2. RateLimit Middleware     # 请求限流 (60 req/min)
3. Performance Middleware   # 性能监控 (请求耗时/查询计数)
4. Logging Middleware       # 结构化请求日志
5. Exception Handlers       # 全局异常处理
6. Route Handler            # 业务路由处理
```

---

## 配置管理

配置通过 `pydantic-settings` 管理，优先级：环境变量 > `.env` 文件 > 默认值。

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `database_url` | `sqlite+aiosqlite:///data/writer.db` | 数据库连接 |
| `minimax_api_key` | `None` | MiniMax API 密钥 |
| `minimax_api_url` | `https://api.minimax.chat/v1` | MiniMax API 地址 |
| `api_key` | `None` | 本地 API 认证密钥 |
| `cors_origins` | `["http://localhost:5173"]` | CORS 白名单 |
| `cache_default_ttl` | `300` | 默认缓存 TTL |
| `log_level` | `INFO` | 日志级别 |

密钥支持系统密钥环覆盖（`utils/keyring_storage.py`）。
