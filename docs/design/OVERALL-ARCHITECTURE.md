# Auto Novel Writer - 后端架构完善总体方案

> **版本**: v1.0
> **日期**: 2026-04-21
> **项目**: Auto Novel Writer（自动化写作软件）
> **技术栈**: Python FastAPI + React 18 + SQLite + MiniMax API
> **文档类型**: 总体架构方案（汇总文档）

**相关文档：**
- [ARCHITECTURE.md](../ARCHITECTURE.md) — 架构决策记录 (ADR)
- [BACKEND_ARCHITECTURE.md](../BACKEND_ARCHITECTURE.md) — 后端实现指南（分层架构、服务、事件系统）

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [现状评估](#2-现状评估)
3. [目标架构蓝图](#3-目标架构蓝图)
4. [关键决策记录](#4-关键决策记录)
5. [功能模块矩阵](#5-功能模块矩阵)
6. [数据架构](#6-数据架构)
7. [API架构](#7-api架构)
8. [Agent与AI工作流](#8-agent与ai工作流)
9. [安全与性能策略](#9-安全与性能策略)
10. [测试与质量保障](#10-测试与质量保障)
11. [实施路线图](#11-实施路线图)
12. [风险与缓解措施](#12-风险与缓解措施)
13. [附录](#13-附录)

---

## 1. 执行摘要

### 1.1 项目定位

Auto Novel Writer 是一款面向中文网络小说作者的**本地桌面写作软件**，通过 AI 辅助完成从世界观构建、角色设定到正文创作的全流程。核心差异化在于：

- **本地隐私优先**：数据本地存储，AI 通过 API 调用，不上传原文
- **三界面架构**：聊天初始化 → 设定编辑 → 正文写作的独特流程
- **IF线同步**：独创的多线叙事管理功能
- **人机协作**：可调节的 AI 参与比例

### 1.2 本文档范围与目标

本文档综合 9 份子文档的研究成果，为后端架构完善提供总体方案。文档涵盖从现状评估、目标架构、关键决策、功能矩阵、数据与API架构、AI工作流、安全性能、测试质量到实施路线图的全方位规划。

**输入子文档清单**：

| 子文档 | 核心结论 | 路径 |
|--------|----------|------|
| `agent-system.md` | Agent 系统需重构为基类+编排器模式，支持多 Provider | `docs/design/agent-system.md` |
| `reference-analysis.md` | reference-webnovel 的 Context Contract、六维审查、债务追踪值得借鉴 | `docs/design/reference-analysis.md` |
| `code-review.md` | 当前代码 6/10 分，存在严重 Bug、重复代码、性能问题 | `docs/design/code-review.md` |
| `data-model.md` | 需从 18 个模型扩展至 30 个，引入 Project 聚合根 | `docs/design/data-model.md` |
| `industry-research.md` | 本地+AI 混合模式是空白市场，IF线/关系图谱/伏笔追踪无竞品 | `docs/design/industry-research.md` |
| `security-performance.md` | 安全成熟度 3/5，性能成熟度 3/5，需系统级加固 | `docs/design/security-performance.md` |
| `api-design.md` | 107 个端点，存在前缀不一致、缺少认证、重复模型等问题 | `docs/design/api-design.md` |
| `service-layer.md` | 需引入 Repository 模式、Service 层、事件驱动、依赖注入 | `docs/design/service-layer.md` |
| `test-strategy.md` | 目标覆盖率 70%+，需建立完整的测试金字塔 | `docs/design/test-strategy.md` |

### 1.3 总体结论

当前后端已具备**基础框架**（FastAPI + SQLAlchemy + WebSocket + 缓存），但在**架构深度**、**代码质量**、**安全性能**方面存在明显短板。本方案提出分 4 阶段、历时约 16 周的实施路线图，将后端从 MVP 级别提升至**生产就绪级别**。

**关键数字**：
- 现有端点：107 个
- 现有模型：18 个 → 目标：30 个
- 现有代码评分：6/10 → 目标：8.5/10
- 安全成熟度：3/5 → 目标：5/5
- 性能成熟度：3/5 → 目标：5/5
- 测试覆盖率：低 → 目标：70%+
- 预计总工时：320 小时（16 周）

---

## 2. 现状评估

### 2.1 当前架构总览

```
┌─────────────────────────────────────────┐
│           前端 (React 18)                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ 界面1   │ │ 界面2   │ │ 界面3   │   │
│  │聊天初始化│ │设定编辑 │ │正文写作 │   │
│  └─────────┘ └─────────┘ └─────────┘   │
├─────────────────────────────────────────┤
│           后端 (Python FastAPI)          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Routes  │ │ Agents  │ │Services │   │
│  │ (直接DB)│ │ (硬编码)│ │(重复代码)│   │
│  └─────────┘ └─────────┘ └─────────┘   │
├─────────────────────────────────────────┤
│           数据层 (SQLite)                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ 18模型  │ │ 无索引  │ │ 无加密  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
├─────────────────────────────────────────┤
│           AI层 (MiniMax API)             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ 单Provider│ │ 无流式优化│ │ 无缓存  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────┘
```

当前架构为典型的快速原型结构：路由层直接操作数据库，Agent 层硬编码 AI 调用，服务层存在大量重复代码，数据层缺少索引和加密，AI 层仅支持单一 Provider。这种架构在 MVP 阶段是合理的选择，但要支撑长期的产品演进，必须进行系统性的架构升级。

### 2.2 现有优势

| 优势 | 说明 | 来源 |
|------|------|------|
| 现代 Web 架构 | FastAPI + SQLAlchemy + WebSocket，适合桌面应用封装 | `reference-analysis.md` |
| 版本控制 | DraftVersion 表实现正文版本管理 | `reference-analysis.md` |
| 导出导入 | JSON/YAML/ZIP 多格式支持 | `reference-analysis.md` |
| 流式输出 | WebSocket 实时 AI 生成体验 | `reference-analysis.md` |
| IF线支持 | 原生 IFLine 表，领先所有参考项目 | `reference-analysis.md` |
| 任务队列 | 基础 asyncio Queue 支持异步 AI 操作 | `code-review.md` |
| 人机比例 | 滑块控制（0-100%），行业首创 | `industry-research.md` |
| 结构化日志 | JSON/文本可选，模块级配置 | `reference-analysis.md` |
| 限流中间件 | 基于内存的滑动窗口限流 | `code-review.md` |

### 2.3 核心问题汇总

#### 2.3.1 严重问题（立即修复）

| # | 问题 | 影响 | 来源 |
|---|------|------|------|
| 1 | `main.py:docs_policy="redirect"` 不是 FastAPI 有效参数 | 运行时 TypeError，应用无法启动 | `code-review.md` |
| 2 | `main.py:disconnect()` 字典操作异常 | 连接断开时 KeyError | `code-review.md` |
| 3 | `models/entities.py` 使用 `datetime.utcnow`（已废弃） | Python 3.12+ 运行时警告/错误 | `code-review.md` |
| 4 | 每次请求创建新 `AIService` / `httpx.AsyncClient` | 严重性能损耗，TCP 连接无法复用 | `code-review.md` |
| 5 | `middleware/rate_limit.py` 使用 `threading.Lock` | 潜在的并发安全问题 | `code-review.md` |
| 6 | `routes/tasks.py` 缺少 `require_auth` | 未认证可访问任务队列 | `code-review.md` |
| 7 | `routes/settings.py` Export 使用 `__dict__` 序列化 | 包含 SQLAlchemy 内部属性 | `code-review.md` |
| 8 | `routes/export_import.py` ZIP 导入参数签名错误 | 无法接收上传文件 | `code-review.md` |
| 9 | `.env` 明文存储 API Key | 安全风险，不符合桌面应用最佳实践 | `security-performance.md` |
| 10 | SQLite 数据库完全未加密 | 用户创作内容可被任意读取 | `security-performance.md` |

#### 2.3.2 架构问题（近期重构）

| # | 问题 | 影响 | 来源 |
|---|------|------|------|
| 1 | 路由层直接操作数据库，无 Service 层 | 业务逻辑散落，难以测试 | `service-layer.md` |
| 2 | 无 Repository 模式 | 数据访问与业务逻辑耦合 | `service-layer.md` |
| 3 | AI Provider 硬编码（仅 MiniMax） | 无法切换 Provider | `service-layer.md` |
| 4 | 6 个 Checker 80% 代码重复 | 维护困难，扩展成本高 | `code-review.md` |
| 5 | `routes/ai.py` 743 行，职责过重 | 维护困难 | `code-review.md` |
| 6 | `routes/settings.py` 951 行，含两套导入导出 | 维护困难，易遗漏缓存失效 | `code-review.md` |
| 7 | 无事件驱动机制 | 跨模块操作耦合 | `service-layer.md` |
| 8 | 无依赖注入容器 | 组件紧耦合，难以替换 | `service-layer.md` |
| 9 | 缓存失效逻辑散落在各端点 | 容易遗漏，与业务逻辑耦合 | `code-review.md` |
| 10 | 无事务边界控制 | 多步操作可能数据不一致 | `code-review.md` |

#### 2.3.3 功能缺失（中期补充）

| # | 缺失功能 | 竞品覆盖 | 来源 |
|---|----------|----------|------|
| 1 | Project（作品）聚合根 | 无 | `data-model.md` |
| 2 | Scene（场景）拆分 | Scrivener | `data-model.md` |
| 3 | Foreshadowing（伏笔追踪） | 无 | `data-model.md` |
| 4 | Timeline/Event（时间线） | 无 | `data-model.md` |
| 5 | Tag（标签系统） | Scrivener | `data-model.md` |
| 6 | RAG 检索 | reference-webnovel | `reference-analysis.md` |
| 7 | 追读力债务系统 | reference-webnovel | `reference-analysis.md` |
| 8 | 实体别名消歧 | reference-webnovel | `reference-analysis.md` |
| 9 | 关系图谱可视化 | 无 | `industry-research.md` |
| 10 | 敏感词检测 | 橙瓜码字 | `industry-research.md` |
| 11 | 全文搜索（FTS） | 无 | `data-model.md` |
| 12 | 编辑历史（diff） | Scrivener Snapshots | `data-model.md` |

### 2.4 代码质量详细评分

基于 `code-review.md` 的深度审查，各模块评分如下：

| 模块 | 评分 | 主要问题 | 改进优先级 |
|------|------|----------|------------|
| `main.py` | 6/10 | docs_policy 无效参数、disconnect 字典异常、WebSocket 重复代码 | 高 |
| `config.py` | 8/10 | 路径解析时机问题、缺少环境区分 | 低 |
| `database.py` | 7.5/10 | 自动 commit 设计隐患、连接池硬编码 | 中 |
| `models/entities.py` | 6.5/10 | datetime.utcnow 废弃、缺少索引、关系不完整 | 高 |
| `routes/ai.py` | 5/10 | 743 行职责过重、AIService 未复用、Checker 重复代码 | 高 |
| `routes/chapters.py` | 6.5/10 | 本地模型与 schemas 并存、缓存失效散落 | 中 |
| `routes/settings.py` | 5/10 | 951 行职责过重、两套导入导出、CRUD 重复 | 高 |
| `routes/chat.py` | 6/10 | 独立内存限流与中间件重复、confirmed 类型不一致 | 高 |
| `routes/export_import.py` | 5.5/10 | ZIP 导入参数签名错误、缺少文件大小验证 | 高 |
| `routes/tasks.py` | 6/10 | 缺少认证、total 计数错误 | 高 |
| `services/ai_service.py` | 5.5/10 | 每次请求新建 httpx.AsyncClient、缓存 key 生成缺陷 | 高 |
| `services/cache_service.py` | 7/10 | 全局单例、缓存与业务逻辑混合 | 中 |
| `middleware/rate_limit.py` | 6/10 | threading.Lock 混用 | 高 |
| `middleware/auth.py` | 7/10 | WebSocket 认证方式不够安全 | 中 |

**总体评分：6/10**，距离生产就绪（8.5/10）有显著差距。

### 2.5 与参考项目的能力对比

基于 `reference-analysis.md` 的分析，我们与核心参考项目 reference-webnovel 的能力对比如下：

| 能力维度 | reference-webnovel | 我们的实现 | 差距评估 |
|----------|-------------------|-----------|---------|
| 项目组织 | Workspace -> 多小说 -> 卷/章 | 单项目单本书 | 缺少多项目/多卷支持 |
| 角色模型 | 完整档案 + 弧光追踪 | 基础信息 | 缺少角色弧光、详细档案 |
| 关系模型 | 实体图谱 + 别名消歧 | CharacterRelationship 表 | 缺少别名/消歧系统 |
| 大纲结构 | 总纲 -> 卷纲 -> 章纲 (三级) | Outline -> Chapter (两级) | 缺少卷级中间层 |
| IF 线支持 | 无原生支持 | IFLine 表 + sync_mode | **领先** |
| 版本控制 | 文件覆盖 | DraftVersion 表 | **显著领先** |
| 流式输出 | 无 | WebSocket + SSE | **显著领先** |
| 导出导入 | 无原生导出 | JSON/YAML/ZIP 多格式 | **显著领先** |
| RAG 检索 | vector + bm25 + hybrid | 无 | 完全缺失 |
| 追读力债务 | chase_debt 利息系统 | 无 | 完全缺失 |
| 上下文契约 | 8 板块标准化执行包 | 基础上下文组装 | 差距较大 |
| 六维审查 | 写作后自动触发 | API 手动调用 | 缺少自动触发 |
| 性能观测 | 分步耗时 + 瓶颈分析 | 慢请求日志 | 差距较大 |

---

## 3. 目标架构蓝图

### 3.1 分层架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              前端层 (React 18)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ 界面1: 聊天  │  │ 界面2: 设定  │  │ 界面3: 写作  │  │ 检查面板 / 报告 │ │
│  │ 初始化      │  │ 编辑器      │  │ 编辑器      │  │                 │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│                              API 层 (FastAPI)                            │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Routes 层：HTTP 请求/响应、参数校验、认证授权、限流               │  │
│  │  - /api/v1/chat/*    - /api/v1/settings/*    - /api/v1/chapters/* │  │
│  │  - /api/v1/ai/*      - /api/v1/project/*     - /api/v1/tasks/*    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                         Application Services 层                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │StorySvc  │ │Character │ │ChapterSvc│ │ ChatSvc  │ │  ExportSvc   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  AISvc   │ │ ReviewSvc│ │ CacheSvc │ │ TaskSvc  │ │  SettingSvc  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                           Domain Services 层                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │Context   │ │Entity    │ │Quality   │ │ Style    │ │   Plot       │  │
│  │Builder   │ │Extractor │ │Checker   │ │ Manager  │ │   Agent      │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  六维 Checker 集群 (并行执行)                                     │  │
│  │  Consistency / Continuity / Pacing / OOC / HighPoint / ReaderPull│  │
│  └──────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                           Repository 层                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │Character │ │  Story   │ │  Chat    │ │  Draft   │ │   Cache      │  │
│  │  Repo    │ │  Repo    │ │  Repo    │ │  Repo    │ │   Repo       │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                           Infrastructure 层                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ SQLite   │ │ AI       │ │  File    │ │  Event   │ │   Security   │  │
│  │ (主库)   │ │ Provider │ │  Store   │ │   Bus    │ │   (加密/密钥)│  │
│  │ +FTS5    │ │ (多Provider)│ │(内容外存)│ │ (async)  │ │              │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 各层职责

| 层级 | 职责 | 禁止事项 | 对应目录 |
|------|------|----------|----------|
| **Routes** | HTTP 请求/响应、参数校验、认证授权、限流 | 直接操作数据库、包含业务逻辑 | `api/` |
| **App Services** | 编排领域服务、事务管理、缓存策略、权限检查 | 直接 SQL 查询、原始 HTTP 调用 | `application/services/` |
| **Domain Services** | 核心业务逻辑、AI 编排、规则引擎 | 依赖具体存储实现 | `domain/services/` |
| **Repositories** | 数据访问抽象、查询构建、ORM 映射 | 包含业务规则 | `repositories/` |
| **Infrastructure** | 数据库连接、API 客户端、文件 I/O、消息队列 | 引用上层业务逻辑 | `infrastructure/` |

### 3.3 技术选型

| 领域 | 当前选型 | 目标选型 | 变更理由 |
|------|----------|----------|----------|
| Web 框架 | FastAPI | FastAPI | 保持不变，优秀选择 |
| ORM | SQLAlchemy 2.0 (async) | SQLAlchemy 2.0 (async) | 保持不变 |
| 数据库 | SQLite + aiosqlite | SQLite + aiosqlite + FTS5 | 增加全文搜索 |
| 缓存 | LRU + diskcache | 三级缓存 (L1内存/L2磁盘/L3DB) | 性能优化 |
| AI Provider | MiniMax (硬编码) | MiniMax + OpenAI + 本地模型 | 多 Provider 支持 |
| 密钥存储 | `.env` 明文 | 系统密钥环 (keyring) | 安全加固 |
| 数据库加密 | 无 | SQLCipher / 应用层 AES | 安全加固 |
| 任务队列 | asyncio Queue | 增强型队列（优先级/定时/重试） | 功能增强 |
| 事件机制 | 无 | 异步内存事件总线 | 解耦架构 |
| 依赖注入 | 无 | 简易 DI 容器 | 可测试性 |

### 3.4 目录结构演进

当前目录结构（MVP 阶段）：

```
src/backend/
├── services/           # 服务层（直接操作数据库）
│   ├── ai_service.py
│   ├── cache_service.py
│   ├── export_import.py
│   └── task_queue.py
├── agents/             # Agent 层（硬编码 AI 调用）
│   ├── context_agent.py
│   ├── data_agent.py
│   ├── checkers/       # 6 个 Checker（80% 代码重复）
│   └── utils.py
├── routes/             # 路由层（直接 DB 操作）
│   ├── chapters.py     # 743 行
│   ├── settings.py     # 951 行
│   ├── ai.py           # 743 行
│   ├── chat.py
│   ├── export_import.py
│   └── tasks.py
├── models/
│   └── entities.py     # 18 个模型
├── database.py
├── config.py
└── main.py
```

目标目录结构（生产就绪）：

```
src/backend/
├── api/                        # API 层（原 routes）
│   ├── v1/
│   │   ├── __init__.py
│   │   ├── auth.py             # 认证端点
│   │   ├── chat.py             # 聊天端点
│   │   ├── settings/
│   │   │   ├── characters.py   # 角色端点
│   │   │   ├── items.py        # 物品端点
│   │   │   ├── locations.py    # 地点端点
│   │   │   ├── factions.py     # 势力端点
│   │   │   ├── world.py        # 世界观端点
│   │   │   └── rules.py        # 规则端点
│   │   ├── chapters/
│   │   │   ├── outlines.py     # 大纲端点
│   │   │   ├── chapters.py     # 章节端点
│   │   │   ├── if_lines.py     # IF 线端点
│   │   │   └── scenes.py       # 场景端点
│   │   ├── ai/
│   │   │   ├── generate.py     # AI 生成端点
│   │   │   ├── review.py       # 审查端点
│   │   │   ├── checkers.py     # 六维检查端点
│   │   │   └── styles.py       # 风格端点
│   │   ├── project.py          # 项目导出导入
│   │   ├── tasks.py            # 后台任务
│   │   └── cache.py            # 缓存管理
│   └── deps.py                 # 依赖注入
├── application/                # 应用服务层
│   ├── services/
│   │   ├── story_service.py
│   │   ├── character_service.py
│   │   ├── world_service.py
│   │   ├── chat_service.py
│   │   ├── ai_service.py
│   │   ├── review_service.py
│   │   ├── export_service.py
│   │   ├── task_service.py
│   │   └── cache_service.py
│   └── dto/                    # 数据传输对象
│       ├── character_dto.py
│       ├── chapter_dto.py
│       └── story_dto.py
├── domain/                     # 领域层
│   ├── services/
│   │   ├── context_builder.py
│   │   ├── entity_extractor.py
│   │   ├── quality_checker.py
│   │   ├── style_manager.py
│   │   └── plot_agent.py
│   ├── agents/
│   │   ├── base.py             # BaseAgent 基类
│   │   ├── context_agent.py
│   │   ├── data_agent.py
│   │   ├── review_agent.py
│   │   ├── plot_agent.py
│   │   ├── style_agent.py
│   │   ├── chat_agent.py
│   │   ├── ifline_agent.py
│   │   └── orchestrator.py     # AgentOrchestrator
│   ├── checkers/
│   │   ├── base_checker.py     # BaseChecker 基类
│   │   ├── consistency.py
│   │   ├── continuity.py
│   │   ├── pacing.py
│   │   ├── ooc.py
│   │   ├── high_point.py
│   │   └── reader_pull.py
│   └── events/                 # 领域事件
│       ├── events.py
│       └── handlers.py
├── repositories/               # 数据访问层
│   ├── base.py                 # Repository 基类
│   ├── character_repo.py
│   ├── story_repo.py
│   ├── chapter_repo.py
│   ├── chat_repo.py
│   ├── draft_repo.py
│   └── cache_repo.py
├── infrastructure/             # 基础设施层
│   ├── database.py             # 数据库连接
│   ├── ai/
│   │   ├── providers.py        # AIProvider 协议
│   │   ├── minimax_provider.py
│   │   ├── openai_provider.py
│   │   └── router.py           # ProviderRouter
│   ├── cache/
│   │   ├── lru_cache.py
│   │   ├── disk_cache.py
│   │   └── tiered_cache.py
│   ├── events/
│   │   └── event_bus.py        # AsyncEventBus
│   ├── security/
│   │   ├── keyring_manager.py
│   │   └── field_encryption.py
│   └── storage/
│       └── content_storage.py  # 大文本外部存储
├── models/                     # 数据模型
│   └── entities.py             # 30 个模型
├── schemas/                    # Pydantic 模型
│   ├── requests.py
│   └── responses.py
├── middleware/                 # 中间件
│   ├── auth.py
│   ├── rate_limit.py
│   ├── logging.py
│   └── cors.py
├── config.py                   # 配置管理
├── main.py                     # 应用入口
└── di.py                       # 依赖注入容器
```

---

## 4. 关键决策记录

### ADR-001: 保持 RESTful API，不引入 GraphQL

- **决策**: 继续使用 RESTful API，当前阶段不引入 GraphQL
- **背景**: 单用户桌面应用，前端是 React SPA，查询模式已知，无过度获取问题
- **方案**: 保持 `/api/v1` 前缀，107 个端点覆盖全部需求
- **后果**: 正向 - 维护简单，团队学习成本低；负向 - 未来如需移动应用或第三方集成，可能需要重新评估
- **来源**: `api-design.md` 第 13 节

### ADR-002: 引入 Repository + Service 分层架构

- **决策**: 引入 Repository 模式和 Application Service 层
- **背景**: 当前路由层直接操作数据库，业务逻辑散落，难以测试
- **方案**: Routes → App Services → Domain Services → Repositories → Infrastructure
- **后果**: 正向 - 可测试性提升，业务逻辑集中，代码复用；负向 - 初期重构工作量大，增加抽象层
- **来源**: `service-layer.md` 第 2-4 节

### ADR-003: 多 AI Provider 抽象层

- **决策**: 引入 AIProvider 抽象接口，支持 MiniMax / OpenAI / 本地模型
- **背景**: 当前仅支持 MiniMax，硬编码在多处，无法切换或降级
- **方案**: 定义 `AIProvider` Protocol，实现 `MiniMaxProvider`、`OpenAICompatibleProvider`，通过 `ProviderRouter` 按任务类型路由
- **后果**: 正向 - 可切换 Provider，支持降级，成本可控；负向 - 需要维护多个 Provider 适配器
- **来源**: `service-layer.md` 第 8 节，`agent-system.md` 第 8 节

### ADR-004: SQLite 保持为主数据库

- **决策**: 继续使用 SQLite 作为主数据库，不迁移到 PostgreSQL
- **背景**: 单用户桌面应用，数据量有限（单作品 < 1GB），SQLite 足够
- **方案**: 启用 WAL 模式、连接池调优、FTS5 全文搜索、应用层字段加密
- **后果**: 正向 - 零配置，单文件便于备份，适合桌面应用；负向 - 并发性能有限，无原生全文搜索（需 FTS5）
- **来源**: `security-performance.md` 第 3.1 节，`data-model.md` 第 11 节

### ADR-005: 数据加密采用应用层方案

- **决策**: 优先实现应用层字段加密，后续版本迁移到 SQLCipher
- **背景**: SQLCipher 集成复杂，需要替换 aiosqlite 驱动
- **方案**: 使用 `cryptography.fernet` 对小说正文等敏感字段加密，密钥存储于系统密钥环
- **后果**: 正向 - 实施成本低，立即可用；负向 - 不如 SQLCipher 全面，索引和查询性能受影响
- **来源**: `security-performance.md` 第 2.2 节

### ADR-006: 事件驱动采用内存总线

- **决策**: 使用异步内存事件总线，不引入外部消息队列
- **背景**: 单用户桌面应用，无分布式需求，Redis/RabbitMQ 过重
- **方案**: `AsyncEventBus` 基于 `asyncio.Queue`，支持订阅/发布/并行处理
- **后果**: 正向 - 零依赖，足够桌面场景；负向 - 进程重启丢失事件，无持久化
- **来源**: `service-layer.md` 第 6 节

### ADR-007: Agent 系统采用基类+编排器模式

- **决策**: 重构 Agent 为 `BaseAgent` 抽象基类 + `AgentOrchestrator` 工作流编排器
- **背景**: 当前 Agent 独立类，无统一接口，Checker 大量重复
- **方案**: 定义 `BaseAgent`、`AgentContext`、`AgentResult`，编排器支持拓扑排序、并行执行、条件分支
- **后果**: 正向 - 新增 Agent 无需修改核心逻辑，工作流可视化；负向 - 编排器本身复杂度
- **来源**: `agent-system.md` 第 3-4 节

### ADR-008: 测试策略采用金字塔模型

- **决策**: 单元测试 70% + 集成测试 25% + E2E 测试 5%
- **背景**: 当前测试覆盖率低，AI 相关测试不稳定
- **方案**: pytest + asyncio，内存数据库，Mock AI 服务，分层标记（unit/integration/e2e）
- **后果**: 正向 - 快速反馈，稳定可靠；负向 - 需要维护大量 fixtures 和 mocks
- **来源**: `test-strategy.md` 第 1-5 节

### ADR-009: 数据模型引入 Project 聚合根

- **决策**: 新增 `Project` 表作为顶层聚合根，所有实体关联到项目
- **背景**: 当前无作品概念，所有数据平铺，无法支持多作品管理
- **方案**: `Project` → Outline/IFLine/Character/WorldSetting/...，渐进式迁移现有数据到默认项目
- **后果**: 正向 - 支持多作品，数据隔离；负向 - 大规模数据库迁移，外键约束变更
- **来源**: `data-model.md` 第 3.1.1 节

### ADR-010: 参考项目核心设计采纳清单

- **决策**: 有选择地采纳 reference-webnovel 的核心设计
- **背景**: reference-webnovel 的 Context Contract、六维审查、债务追踪非常成熟
- **方案**:
  - P0 采纳: Context Contract 标准化、六维审查自动触发、逻辑红线校验、章节元数据增强
  - P1 采纳: 卷级大纲、追读力债务、状态变化历史、RAG 基础框架
  - P2 采纳: Agent 性能观测、风格样本库、项目记忆系统
- **后果**: 正向 - 大幅提升 AI 生成质量一致性；负向 - 需要大量 prompt 工程和测试
- **来源**: `reference-analysis.md` 第 9 节

### ADR-011: 引入 Project 聚合根与多作品支持

- **决策**: 新增 `Project` 表作为顶层聚合根，所有实体关联到项目
- **背景**: 当前无作品概念，所有数据平铺，无法支持多作品管理
- **方案**: `Project` -> Outline/IFLine/Character/WorldSetting/...，渐进式迁移现有数据到默认项目
- **后果**: 正向 - 支持多作品，数据隔离，导出导入以项目为单位；负向 - 大规模数据库迁移，所有查询需增加 project_id 过滤
- **来源**: `data-model.md` 第 3.1.1 节

### ADR-012: 章节写作流程标准化

- **决策**: 将 reference-webnovel 的 CLI 写作流程映射为标准化 API 工作流
- **背景**: reference-webnovel 的 `/webnovel-write` 命令包含 6 个前置步骤和 10 个后置步骤，流程成熟
- **方案**:
  - 前置: 上下文快照 -> 大纲读取 -> 追读力分析 -> 实体读取 -> 执行包组装 -> 红线校验
  - 写作: AI 生成（流式）
  - 后置: 实体提取 -> 消歧 -> 持久化 -> 摘要生成 -> 场景切片 -> 债务计算 -> 报告生成
- **后果**: 正向 - 大幅提升生成质量一致性；负向 - 流程变长，需要优化并行度
- **来源**: `reference-analysis.md` 第 3.2 节

### ADR-013: 数据加密采用应用层方案（优先）

- **决策**: 优先实现应用层字段加密，后续版本迁移到 SQLCipher
- **背景**: SQLCipher 集成复杂，需要替换 aiosqlite 驱动，影响开发效率
- **方案**: 使用 `cryptography.fernet` 对小说正文、角色档案等敏感字段加密，密钥存储于系统密钥环
- **后果**: 正向 - 实施成本低，立即可用，敏感字段受保护；负向 - 不如 SQLCipher 全面，加密字段无法建立索引，查询性能受影响
- **来源**: `security-performance.md` 第 2.2 节

### ADR-014: 缓存采用三级架构

- **决策**: 实现 L1 内存 LRU + L2 磁盘 diskcache + L3 数据库的三级缓存
- **背景**: 当前仅有全局单例 `cache_service`，缓存与业务逻辑混合
- **方案**:
  - L1: 进程内 LRUCache，TTL 60s，用于热点数据
  - L2: 磁盘 diskcache，TTL 1h，用于跨进程共享
  - L3: 数据库缓存表，TTL 24h，用于持久化缓存
- **后果**: 正向 - 命中率提升，减少 AI API 调用成本；负向 - 缓存一致性复杂度增加
- **来源**: `security-performance.md` 第 3.2 节

### ADR-015: 后台任务队列增强

- **决策**: 将基础 asyncio Queue 增强为支持优先级、定时、重试的任务队列
- **背景**: 当前任务队列无优先级，无重试策略，失败任务无处理
- **方案**:
  - 优先级: 高/中/低三级队列
  - 重试: 指数退避，最大 3 次重试
  - 定时: 支持延迟执行任务
  - 持久化: 任务状态存储于数据库，进程重启可恢复
- **后果**: 正向 - 任务可靠性提升，支持复杂工作流；负向 - 队列管理复杂度增加
- **来源**: `service-layer.md` 第 1.2 节

---

## 5. 功能模块矩阵

### 5.1 模块总览

| 模块 | 优先级 | 当前状态 | 目标状态 | 依赖模块 | 参考文档 |
|------|--------|----------|----------|----------|----------|
| **项目管理** | P0 | 缺失 | 完整 CRUD | 无 | `data-model.md` |
| **角色管理** | P0 | 基础 | 增强版（别名/档案/弧光） | Project | `data-model.md` |
| **世界观管理** | P0 | 基础 | 增强版（标签/继承） | Project | `data-model.md` |
| **大纲管理** | P0 | 基础 | 卷级支持 | Project | `data-model.md` |
| **章节管理** | P0 | 基础 | 场景拆分 | 大纲 | `data-model.md` |
| **草稿版本** | P0 | 基础 | diff 存储/分支 | 章节 | `data-model.md` |
| **IF线管理** | P1 | 基础 | 同步增强 | 章节/角色 | `agent-system.md` |
| **聊天初始化** | P0 | 基础 | 主动提问流程 | 实体提取 | `agent-system.md` |
| **AI生成** | P0 | 基础 | 多 Provider/流式优化 | Provider 抽象 | `service-layer.md` |
| **设定审查** | P1 | 框架 | 多轮深度审查 | AI生成 | `agent-system.md` |
| **六维检查** | P1 | 框架 | 分层检查/量化评分 | 设定审查 | `agent-system.md` |
| **文笔风格** | P1 | 基础 | 结构化定义/迁移 | AI生成 | `data-model.md` |
| **伏笔追踪** | P2 | 缺失 | 完整生命周期 | 章节 | `data-model.md` |
| **时间线** | P2 | 缺失 | 事件管理 | 章节 | `data-model.md` |
| **关系图谱** | P2 | 缺失 | 可视化数据接口 | 角色关系 | `industry-research.md` |
| **标签系统** | P2 | 缺失 | 多态关联 | 所有实体 | `data-model.md` |
| **导出导入** | P0 | 基础 | 加密/增量/流式 | 所有实体 | `security-performance.md` |
| **全文搜索** | P2 | 缺失 | FTS5 | 所有实体 | `data-model.md` |
| **任务队列** | P1 | 基础 | 优先级/定时/重试 | 无 | `service-layer.md` |
| **缓存系统** | P1 | 基础 | 三级缓存 | 无 | `security-performance.md` |
| **安全加固** | P0 | 基础 | 密钥环/加密/验证 | 无 | `security-performance.md` |
| **性能优化** | P1 | 基础 | WAL/连接池/索引 | 无 | `security-performance.md` |
| **测试覆盖** | P0 | 低 | 70%+ | 所有模块 | `test-strategy.md` |

### 5.2 优先级定义

| 优先级 | 定义 | 响应时间 |
|--------|------|----------|
| P0 | 阻塞发布，必须立即实施 | 1-2 周 |
| P1 | 重要功能，近期实施 | 2-4 周 |
| P2 | 增强体验，中期实施 | 4-8 周 |
| P3 | 锦上添花，长期规划 | 8-16 周 |

### 5.3 模块详细设计要点

#### 5.3.1 项目管理模块

项目管理是新增的核心模块，作为所有数据的聚合根。

**核心功能**:
- 作品 CRUD：创建、编辑、归档、删除作品
- 题材配置：选择题材（仙侠/都市/科幻等），加载默认模板
- 元数据管理：封面、作者名、目标字数、当前进度
- 多作品切换：支持同时管理多个作品

**数据流**:
```
用户创建作品
    -> 选择题材 (GenreConfiguration)
    -> 系统加载默认实体模板
    -> 创建 Project 记录
    -> 创建默认 Outline (主线)
    -> 创建默认 ChatSession (初始化会话)
    -> 返回作品 ID
```

#### 5.3.2 角色管理模块（增强）

在现有 Character 基础上增强：

**新增功能**:
- 角色别名系统：支持"萧炎"/"他"/"萧家小子"指向同一实体
- 角色档案增强：外貌、性格、动机、冲突、弧光追踪
- 关系图谱：多维度关系（enemy/ally/family/mentor/rival）
- 状态变化历史：追踪角色每次状态变更的时间线

**参考设计** (reference-webnovel):
```json
{
  "name": "萧炎",
  "aliases": ["他", "萧家小子", "炎儿"],
  "profile": {
    "appearance": "黑衣少年，背负玄重尺",
    "personality": "坚韧不屈，重情重义",
    "motivation": "三年之约，洗刷耻辱",
    "conflict": "家族衰落 vs 个人崛起"
  },
  "arc": {
    "start_state": "斗之气三段，废物",
    "current_state": "斗师，云岚宗",
    "target_state": "斗帝，拯救大陆"
  }
}
```

#### 5.3.3 大纲管理模块（增强）

引入卷级结构，从两级变为三级：

```
Outline (总纲)
    -> Volume (卷)
        -> Chapter (章)
            -> Scene (场景)
```

**新增功能**:
- 卷级规划：每卷的目标、主题、高潮设计
- 章节元数据：钩子类型、节奏模式、结束状态
- 时间线约束：卷级时间线表和章节时间锚点

#### 5.3.4 AI 生成模块（多 Provider）

**Provider 路由策略**:

| 任务类型 | 首选 Provider | 备选 Provider | 路由策略 |
|----------|---------------|---------------|----------|
| 上下文生成 | MiniMax | OpenAI | 质量优先 |
| 深度分析 | OpenAI | Anthropic | 质量优先 |
| 快速检查 | MiniMax | - | 速度优先 |
| Embedding | OpenAI | 本地模型 | 成本优先 |
| 关键任务 | Anthropic | OpenAI | 最强模型 |

**降级策略**:
1. 主 Provider 超时（>30s）→ 自动切换到备选
2. 主 Provider 错误率 >10% → 自动切换到备选
3. 所有 Provider 不可用 → 返回友好错误，提示用户检查网络

#### 5.3.5 设定审查模块

**审查流程**:
```
用户提交审查请求
    -> 加载相关设定（角色/世界/规则）
    -> 粗审：AI 快速扫描，识别明显冲突（< 5s）
    -> 细审：AI 深度分析，检查隐性矛盾（< 30s）
    -> 交叉验证：多维度一致性检查
    -> 生成审查报告（问题列表 + 修复建议）
    -> 用户确认/修改
```

**审查维度**:
- 设定一致性：战力体系、物品归属、规则适用
- 角色一致性：行为符合人设、成长弧线合理
- 时间线一致性：事件顺序、因果关系
- 逻辑一致性：因果关系、前提条件

#### 5.3.6 六维检查模块

**分层检查机制**:

| 层级 | 触发条件 | 耗时 | 覆盖维度 |
|------|----------|------|----------|
| 快速扫描 | 每次保存 | < 2s | Consistency + OOC |
| 标准检查 | 用户手动触发 | < 10s | 六维全部 |
| 深度分析 | 章节完成时 | < 60s | 六维 + 交叉验证 |

**评分算法**:
```
综合评分 = sum(维度评分 * 维度权重)

维度权重:
- Consistency: 0.20 (关键)
- OOC: 0.20 (关键)
- Continuity: 0.15
- Pacing: 0.15
- HighPoint: 0.15
- ReaderPull: 0.15

及格线: 60分
良好线: 80分
优秀线: 90分
```

#### 5.3.7 导出导入模块（增强）

**导出格式增强**:

| 格式 | 内容 | 用途 |
|------|------|------|
| JSON | 完整数据结构 | 备份/迁移 |
| YAML | 人类可读结构 | 版本控制 |
| ZIP | 结构化目录 + 元数据 | 完整项目备份 |
| Markdown | 正文纯文本 | 发布/分享 |

**ZIP 导出目录结构**:
```
project-export.zip
├── project_data.json       # 核心数据
├── .webnovel/              # 元数据目录
│   ├── state.json          # 进度、配置、节奏追踪
│   ├── chapter_meta.json   # 每章钩子、模式、结束状态
│   ├── reading_power.jsonl # 追读力历史
│   ├── style_samples.json  # 风格样本库
│   └── summaries/          # 章节摘要
├── 正文/                    # 正文章节 (Markdown)
├── 大纲/                    # 总纲与卷纲
└── 设定集/                  # 世界观、角色、力量体系
```

---

## 6. 数据架构

### 6.1 ER 图概述

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PROJECT (项目/作品)                              │
│  id, title, genre_id, author_name, description, status, created_at, etc.   │
└─────────────┬───────────────────────────────┬───────────────────────────────┘
              │ 1:N                           │ 1:N
    ┌─────────▼──────────┐        ┌───────────▼────────────┐
    │   GENRE_CONFIG     │        │   USER_PREFERENCE      │
    │  (题材配置)         │        │   (用户偏好)            │
    └────────────────────┘        └────────────────────────┘
              │
              ▼ 1:N
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STORY_OUTLINE (故事线基类)                          │
│  (Outline / IFLine 的公共抽象，支持统一查询)                                   │
└─────────────┬───────────────────────────────────────────────────────────────┘
              │ 1:N
    ┌─────────▼──────────┐        ┌───────────▼────────────┐
    │     OUTLINE        │        │       IF_LINE          │
    │   (主线大纲)        │        │     (IF线)             │
    └─────────┬──────────┘        └───────────┬────────────┘
              │ 1:N                           │ 1:N
    ┌─────────▼──────────┐        ┌───────────▼────────────┐
    │      CHAPTER       │        │   IF_LINE_CHAPTER      │
    │    (章节)           │        │   (IF线章节)            │
    └─────────┬──────────┘        └────────────────────────┘
              │ 1:N
    ┌─────────▼──────────┐
    │       SCENE        │
    │    (场景)           │
    └─────────┬──────────┘
              │ 1:N
    ┌─────────▼──────────┐
    │   DRAFT_VERSION    │
    │   (草稿版本)        │
    └────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHARACTER (角色) - 增强版                             │
└─────────────┬───────────────────────────────────────────────────────────────┘
              │
    ┌─────────┼──────────┐        ┌───────────┐
    ▼         ▼          ▼        ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐
│Relationship│Storyline│  Tag   │ Timeline │ Foreshadowing│
└────────┘ └────────┘ └────────┘ └────────┘ └────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        WORLD ENTITY (世界实体) - 统一标签                      │
│  Item / Location / Faction / WorldSetting / Rule 均支持 Tag 关联              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        CHAT & AI (聊天与AI)                                  │
│  ChatSession → ChatMessage → ExtractedEntity → (确认后创建正式实体)           │
│  AIInspectionResult / AIGeneratedContent / WritingStyle                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 核心实体关系

| 父实体 | 子实体 | 关系类型 | 级联策略 | 说明 |
|--------|--------|----------|----------|------|
| Project | Outline | 1:N | CASCADE | 作品包含多个大纲 |
| Project | IFLine | 1:N | CASCADE | 作品包含多个 IF 线 |
| Project | Character | 1:N | CASCADE | 作品包含多个角色 |
| Project | WorldSetting | 1:N | CASCADE | 作品包含世界观设定 |
| Project | ChatSession | 1:N | SET NULL | 作品关联聊天会话 |
| Outline | Chapter | 1:N | CASCADE | 大纲包含多个章节 |
| Chapter | Scene | 1:N | CASCADE | 章节包含多个场景 |
| Chapter | DraftVersion | 1:N | CASCADE | 章节包含多个草稿版本 |
| Character | CharacterRelationship | 1:N | CASCADE | 角色包含多个关系 |
| Character | CharacterStoryline | 1:N | CASCADE | 角色包含多个故事线 |
| Scene | AIGeneratedContent | 1:N | CASCADE | 场景包含 AI 生成内容 |
| * | TagAssociation | N:M | CASCADE | 多态标签关联 |

### 6.3 模型统计

| 类别 | 数量 | 说明 |
|------|------|------|
| 现有模型（改造后） | 18 | Character/Item/Location/... |
| 新增模型 | 12 | Project/Scene/Foreshadowing/Timeline/Tag/... |
| **总计** | **30** | 详见 `data-model.md` |

### 6.4 全文搜索

| 虚拟表 | 搜索字段 | 关联实体 |
|--------|----------|----------|
| chapter_search | title, summary, content | chapters |
| scene_search | title, content | scenes |
| entity_search | name, description | characters, items, locations... |

### 6.5 数据模型详细设计

#### 6.5.1 Project（项目/作品）

```python
class Project(Base):
    """作品项目 - 顶层聚合根"""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    subtitle = Column(String(500))
    author_name = Column(String(100), default="")
    description = Column(Text)

    # 题材与类型
    genre_id = Column(Integer, ForeignKey("genre_configurations.id", ondelete="SET NULL"))
    sub_genre = Column(String(50))

    # 状态管理
    status = Column(String(20), default="draft")
    target_word_count = Column(Integer, default=100000)
    current_word_count = Column(Integer, default=0)

    # 封面与元数据
    cover_image_path = Column(String(500))

    # 审计字段
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    deleted_at = Column(DateTime)  # 软删除标记

    # 关系
    outlines = relationship("Outline", back_populates="project")
    if_lines = relationship("IFLine", back_populates="project")
    characters = relationship("Character", back_populates="project")
    world_settings = relationship("WorldSetting", back_populates="project")
    chat_sessions = relationship("ChatSession", back_populates="project")
    tags = relationship("TagAssociation", back_populates="project")
```

**索引设计**:
```sql
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_genre ON projects(genre_id);
CREATE INDEX idx_projects_deleted_at ON projects(deleted_at) WHERE deleted_at IS NULL;
```

#### 6.5.2 Scene（场景）

```python
class Scene(Base):
    """场景 - Chapter 的子单元，支持细粒度写作"""
    __tablename__ = "scenes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)

    title = Column(String(200))
    content = Column(Text, default="")
    summary = Column(Text)

    # 场景元数据
    scene_order = Column(Integer, default=0)
    word_count = Column(Integer, default=0)

    # 场景设定（覆盖或继承章节设定）
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="SET NULL"))
    time_of_day = Column(String(20))
    weather = Column(String(50))

    # 状态
    status = Column(String(20), default="draft")

    # 人机比例（可覆盖全局设置）
    human_ai_ratio = Column(Float)

    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    deleted_at = Column(DateTime)

    # 关系
    chapter = relationship("Chapter", back_populates="scenes")
    location = relationship("Location")
    ai_contents = relationship("AIGeneratedContent", back_populates="scene")
    draft_versions = relationship("DraftVersion", back_populates="scene")
```

**索引设计**:
```sql
CREATE INDEX idx_scenes_chapter ON scenes(chapter_id);
CREATE INDEX idx_scenes_order ON scenes(chapter_id, scene_order);
CREATE INDEX idx_scenes_status ON scenes(status);
CREATE INDEX idx_scenes_deleted_at ON scenes(deleted_at) WHERE deleted_at IS NULL;
```

#### 6.5.3 Foreshadowing（伏笔追踪）

```python
class Foreshadowing(Base):
    """伏笔 - 埋设与回收的完整生命周期"""
    __tablename__ = "foreshadowings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)

    title = Column(String(200), nullable=False)
    description = Column(Text)

    # 埋设信息
    plant_chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"))
    plant_scene_id = Column(Integer, ForeignKey("scenes.id", ondelete="SET NULL"))
    plant_text = Column(Text)

    # 回收信息（可为空，表示未回收）
    resolve_chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"))
    resolve_scene_id = Column(Integer, ForeignKey("scenes.id", ondelete="SET NULL"))
    resolve_text = Column(Text)

    # 状态
    status = Column(String(20), default="planted")
    importance = Column(String(20), default="normal")

    # 关联角色
    planted_by_character_id = Column(Integer, ForeignKey("characters.id", ondelete="SET NULL"))
    resolved_by_character_id = Column(Integer, ForeignKey("characters.id", ondelete="SET NULL"))

    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
```

**索引设计**:
```sql
CREATE INDEX idx_foreshadowings_project ON foreshadowings(project_id);
CREATE INDEX idx_foreshadowings_status ON foreshadowings(status);
CREATE INDEX idx_foreshadowings_plant ON foreshadowings(plant_chapter_id);
CREATE INDEX idx_foreshadowings_resolve ON foreshadowings(resolve_chapter_id);
```

#### 6.5.4 Timeline & TimelineEvent（时间线/事件）

```python
class Timeline(Base):
    """时间线 - 故事的时间轴"""
    __tablename__ = "timelines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(100), nullable=False)
    description = Column(Text)
    time_unit = Column(String(20), default="chapter")

    created_at = Column(DateTime, default=datetime.now(timezone.utc))

    # 关系
    project = relationship("Project")
    events = relationship("TimelineEvent", back_populates="timeline", order_by="TimelineEvent.position")


class TimelineEvent(Base):
    """时间线事件"""
    __tablename__ = "timeline_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timeline_id = Column(Integer, ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)

    title = Column(String(200), nullable=False)
    description = Column(Text)

    # 时间定位
    position = Column(Integer, default=0)
    time_label = Column(String(100))

    # 关联
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"))
    character_ids = Column(Text)

    # 事件类型
    event_type = Column(String(30), default="plot")

    created_at = Column(DateTime, default=datetime.now(timezone.utc))

    # 关系
    timeline = relationship("Timeline", back_populates="events")
    chapter = relationship("Chapter")
```

#### 6.5.5 Tag & TagAssociation（标签系统）

```python
class Tag(Base):
    """标签定义"""
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(50), nullable=False)
    color = Column(String(7), default="#5b8ee8")
    category = Column(String(30), default="general")

    created_at = Column(DateTime, default=datetime.now(timezone.utc))

    # 关系
    project = relationship("Project")
    associations = relationship("TagAssociation", back_populates="tag")


class TagAssociation(Base):
    """标签关联 - 多态关联到任意实体"""
    __tablename__ = "tag_associations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tag_id = Column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), nullable=False)

    # 多态关联
    entity_type = Column(String(30), nullable=False)
    entity_id = Column(Integer, nullable=False)

    created_at = Column(DateTime, default=datetime.now(timezone.utc))

    # 关系
    tag = relationship("Tag", back_populates="associations")

    # 联合唯一约束
    __table_args__ = (
        Index('idx_tag_assoc_unique', 'tag_id', 'entity_type', 'entity_id', unique=True),
        Index('idx_tag_assoc_entity', 'entity_type', 'entity_id'),
    )
```

#### 6.5.6 WritingStyle（文笔风格 - 结构化）

```python
class WritingStyle(Base):
    """文笔风格 - 结构化定义"""
    __tablename__ = "writing_styles"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String(50), nullable=False)
    display_name = Column(String(100), nullable=False)
    description = Column(Text)

    # 风格维度（JSON 结构化）
    style_dimensions = Column(Text)
    # {
    #   "sentence_rhythm": "长短句交错，节奏舒缓",
    #   "vocabulary_level": "文言夹杂，意境优先",
    #   "emotion_expression": "含蓄内敛，侧面烘托",
    #   "pacing": "慢热，重氛围",
    #   "perspective": "第三人称限知",
    #   "dialogue_style": "简短有力，潜台词丰富"
    # }

    # AI Prompt 片段
    ai_prompt_fragment = Column(Text)

    # 示例文本
    sample_text = Column(Text)

    # 内置标记
    is_builtin = Column(Integer, default=0)
    is_active = Column(Integer, default=1)

    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
```

#### 6.5.7 AIGeneratedContent（AI生成内容）

```python
class AIGeneratedContent(Base):
    """AI生成内容 - 追踪质量与使用"""
    __tablename__ = "ai_generated_contents"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # 关联场景
    scene_id = Column(Integer, ForeignKey("scenes.id", ondelete="CASCADE"))
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"))

    # 生成类型
    generation_type = Column(String(30), nullable=False)
    # continuation, expansion, rewrite, polish, summary...

    # 输入/输出
    prompt = Column(Text)
    content = Column(Text, nullable=False)

    # 质量评估
    quality_score = Column(Float)
    user_rating = Column(Integer)
    is_accepted = Column(Integer, default=0)

    # 元数据
    model_name = Column(String(50))
    tokens_used = Column(Integer)
    generation_time_ms = Column(Integer)

    created_at = Column(DateTime, default=datetime.now(timezone.utc))
```

### 6.6 数据迁移策略

从 18 个模型迁移到 30 个模型的策略：

**Phase 1: 新增表（无数据依赖）**
- GenreConfiguration（预置数据）
- WritingStyle（预置数据）
- UserPreference（默认配置）

**Phase 2: 新增核心表（需要默认值）**
- Project：创建默认项目，将所有现有数据关联到默认项目
- Scene：为每个 Chapter 创建默认 Scene（内容迁移）

**Phase 3: 新增功能表（空表即可）**
- Foreshadowing
- Timeline / TimelineEvent
- Tag / TagAssociation
- AIGeneratedContent
- EditHistory

**Phase 4: 现有表改造**
- 所有表增加 `project_id` 字段（默认项目 ID）
- 所有表增加 `deleted_at` 字段（软删除）
- 所有表增加 `created_at` / `updated_at` 字段（审计）
- 替换 `datetime.utcnow` 为 `datetime.now(timezone.utc)`

**迁移工具**: Alembic 迁移脚本，每次迁移前自动备份数据库

---

## 7. API架构

### 7.1 端点统计

| 类别 | 端点数量 | 说明 |
|------|----------|------|
| Health & Monitoring | 3 | /health, /health/ready, /health/live |
| Authentication | 3 | /auth/key, /auth/key/refresh, /auth/status |
| Chat Sessions | 8 | 会话 CRUD + 消息 + 实体提取 |
| Settings (Characters) | 12 | 角色 CRUD + 关系 + 故事线 |
| Settings (Items/Locations/Factions/World/Rules) | 25 | 各类设定 CRUD |
| Settings (Writing) | 2 | 写作设置 |
| Chapters & Outlines | 15 | 大纲/章节/草稿版本 |
| IF Lines & Plot Threads | 10 | IF线/情节线索 |
| AI Operations | 14 | 生成/审查/检查/实体提取 |
| Writing Styles | 2 | 风格列表 |
| Project Export/Import | 7 | JSON/YAML/ZIP 导出导入 |
| Background Tasks | 4 | 任务提交/查询/取消 |
| Cache Management | 3 | 缓存统计/清空/失效 |
| **总计** | **107** | 详见 `api-design.md` |

### 7.2 版本策略

| 版本 | 路径 | 状态 | 说明 |
|------|------|--------|------|
| v1 | `/api/v1` | Current | 初始稳定 API |
| v2 | `/api/v2` | Future | 仅破坏性变更 |

**规则**:
- 小版本增加（新端点、新可选字段）归入当前版本
- 破坏性变更（删除字段、改变行为）需要新版本
- 过渡期间同时支持 N 和 N-1 版本
- 版本废弃提前 6 个月公告

### 7.3 协议与标准

| 方面 | 标准 |
|------|------|
| 接口风格 | RESTful，资源命名使用复数名词 |
| HTTP 方法 | GET(读) / POST(创建) / PATCH(部分更新) / DELETE(删除) |
| 认证方式 | API Key (`X-API-Key` header)，localhost 可跳过 |
| 错误格式 | `{error_code, message, details, request_id, timestamp}` |
| 分页 | `skip`/`limit`/`sort`/`order`，返回 `{data, pagination}` |
| 流式输出 | SSE (Server-Sent Events) for AI 生成 |
| WebSocket | `ws://localhost:8000/ws/chat/{session_id}` |
| 限流 | 分级限流：Critical 10/min, High 30/min, Standard 60/min |

### 7.4 请求/响应标准

#### 7.4.1 分页响应结构

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

#### 7.4.2 错误响应结构

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

#### 7.4.3 HTTP 状态码使用规范

| 状态码 | 含义 | 使用场景 |
|--------|------|----------|
| 200 | OK | 成功的 GET、PATCH、DELETE |
| 201 | Created | 成功的 POST |
| 400 | Bad Request | 验证错误、格式错误 |
| 401 | Unauthorized | 缺少 API Key |
| 403 | Forbidden | 无效的 API Key |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突（如重复名称） |
| 422 | Unprocessable | 语义验证失败 |
| 429 | Too Many Requests | 限流触发 |
| 500 | Internal Error | 服务器内部错误 |
| 502 | Bad Gateway | AI 服务错误 |
| 503 | Service Unavailable | 数据库不可用 |

### 7.5 现有 API 问题与修复方案

基于 `api-design.md` 的审查，现有 API 存在以下问题：

#### 7.5.1 路由前缀不一致

**问题**: `export_import.py` 使用 `prefix="/api/project"`，导致 `/api/v1/api/project/export`（双重 `/api`）。

**修复**: 改为 `prefix="/project"`，最终路径为 `/api/v1/project/export`。

#### 7.5.2 缺少认证

**问题**: `routes/tasks.py` 未包含 `dependencies=[require_auth]`，后台任务端点未受保护。

**修复**: 添加认证依赖：
```python
router = APIRouter(prefix="/tasks", tags=["tasks"], dependencies=[require_auth])
```

#### 7.5.3 重复 Pydantic 模型

**问题**: 多个路由文件定义本地 Pydantic 模型，与 `backend.schemas` 中的定义重复或冲突。

**修复**: 统一使用 `schemas/request_schemas.py` 和 `schemas/response_schemas.py`，删除路由文件中的本地模型定义。

#### 7.5.4 更新模式不一致

**问题**: 部分更新使用 `PATCH` 配合 `exclude_unset=True`（正确），部分使用 `PUT` 语义全量替换。

**修复**: 统一使用 `PATCH` + `exclude_unset=True`，所有更新端点支持部分字段更新。

#### 7.5.5 缺少排序参数

**问题**: 列表端点支持 `skip`/`limit` 但缺少 `sort`/`order` 参数。

**修复**: 所有列表端点统一支持：
```python
async def list_items(
    skip: int = 0,
    limit: int = 20,
    sort: str = "created_at",
    order: str = "desc",
    # ... 其他过滤参数
):
```

#### 7.5.6 无批量操作

**问题**: 无批量创建/更新/删除端点。

**修复**: 新增批量操作端点：
```python
POST /settings/characters/bulk   # 批量创建角色
PATCH /settings/characters/bulk  # 批量更新角色
DELETE /settings/characters/bulk # 批量删除角色
```

#### 7.5.7 DELETE 响应不一致

**问题**: 部分返回 `{"message": "..."}`，部分无结构化响应。

**修复**: 统一 DELETE 响应：
```json
{
  "success": true,
  "id": 1,
  "message": "Resource deleted"
}
```

#### 7.5.8 缺少分页元数据

**问题**: 列表端点返回数组，无总数量，客户端无法实现分页。

**修复**: 所有列表端点返回分页结构：
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

### 7.6 WebSocket 事件协议

#### 7.6.1 连接建立

```
ws://localhost:8000/ws/chat/{session_id}?api_key=writer_xxx
```

**改进方案**（ADR）：
```
ws://localhost:8000/ws/chat/{session_id}
Headers:
  Sec-WebSocket-Protocol: writer_xxx
```

#### 7.6.2 消息格式

**客户端 -> 服务器**:
```json
{
  "type": "message",
  "content": "用户消息内容",
  "timestamp": "2026-04-21T10:00:00Z"
}
```

**服务器 -> 客户端（AI 流式）**:
```json
{
  "type": "chunk",
  "content": "AI 生成的片段",
  "is_final": false
}
```

**服务器 -> 客户端（完成）**:
```json
{
  "type": "complete",
  "content": "完整内容",
  "metadata": {
    "tokens_used": 150,
    "generation_time_ms": 2500
  }
}
```

**服务器 -> 客户端（错误）**:
```json
{
  "type": "error",
  "error_code": "RATE_LIMIT_EXCEEDED",
  "message": "请求过于频繁，请稍后再试"
}
```

#### 7.6.3 心跳机制

```json
// 客户端心跳
{"type": "ping", "timestamp": 1713690000000}

// 服务器响应
{"type": "pong", "timestamp": 1713690000010}
```

**超时处理**: 60s 无 ping 视为断开，清理连接状态。

---

## 8. Agent与AI工作流

### 8.1 Agent 类型

| Agent | 职责 | 现有状态 | 目标状态 | 优先级 |
|-------|------|----------|----------|--------|
| Context Agent | 生成创作执行包 | 已实现 | 增强（Strand/反幻觉） | P0 |
| Data Agent | 实体提取与结构化 | 已实现 | 增强（消歧/增量） | P0 |
| Review Agent | 设定深度审查 | 框架 | 多轮审查/修复建议 | P1 |
| Plot Agent | 情节规划/伏笔管理 | 缺失 | 新增 | P2 |
| Style Agent | 文笔风格分析/迁移 | 缺失 | 新增 | P1 |
| Chat Agent | 聊天初始化对话管理 | 缺失 | 新增 | P1 |
| IFLine Agent | IF 线同步写作管理 | 缺失 | 新增 | P2 |

### 8.2 协作模式

```
章节写作工作流 (CHAPTER_WRITE):
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  1. Context │────▶│  2. Style   │────▶│  3. AI      │
│     Agent   │     │    Agent    │     │  Generate   │
│  (获取上下文)│     │  (风格指导)  │     │  (生成正文)  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  6. Data    │◀────│  5. Review  │◀────│  4. Checker │
│    Agent    │     │   (人工确认) │     │  Pipeline   │
│ (提取实体)   │     │             │     │ (六维检查)   │
└─────────────┘     └─────────────┘     └─────────────┘

章节审查工作流 (CHAPTER_REVIEW):
┌─────────────────────────────────────────────┐
│           并行执行六维检查                     │
│  Consistency / Continuity / Pacing / OOC    │
│  HighPoint / ReaderPull                     │
└─────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│           结果聚合与评分                       │
│  - 综合评分 = weighted_average(六维评分)      │
│  - 问题去重与分级                            │
│  - 生成修复建议优先级队列                     │
└─────────────────────────────────────────────┘
```

### 8.3 六维检查维度

| 维度 | 权重 | 及格线 | 是否关键 | 检查内容 |
|------|------|--------|----------|----------|
| Consistency（一致性） | 0.20 | 70 | 是 | 设定冲突、战力体系、物品归属 |
| Continuity（连续性） | 0.15 | 65 | 否 | 场景转换、状态延续、伏笔呼应 |
| Pacing（节奏） | 0.15 | 60 | 否 | Strand 比例、张弛度、红线检查 |
| OOC（角色一致性） | 0.20 | 75 | 是 | 行为符合人设、成长弧线 |
| HighPoint（爽点） | 0.15 | 60 | 否 | 高潮强度、间距、情绪曲线 |
| ReaderPull（追读力） | 0.15 | 65 | 否 | 开篇钩子、结尾悬念、认知差 |

### 8.4 反幻觉机制

```
AI 生成内容
    │
    ▼
┌─────────────────┐
│ 1. Outline Law  │── 违反? ──▶ 拒绝 + 修正指令
│    Enforcer     │
└────────┬────────┘
         │ 通过
         ▼
┌─────────────────┐
│ 2. Setting      │── 违反? ──▶ 标记 + 建议修正
│    Physics      │
└────────┬────────┘
         │ 通过
         ▼
┌─────────────────┐
│ 3. Invention    │── 发现新发明? ──▶ 入库待确认
│    Identifier   │
└────────┬────────┘
         │
         ▼
    内容通过反幻觉检查
```

### 8.5 多 Provider 路由

| 任务类型 | 首选 Provider | 备选 Provider | 路由策略 |
|----------|---------------|---------------|----------|
| 上下文生成 | MiniMax | OpenAI | 质量优先 |
| 深度分析 | OpenAI | Anthropic | 质量优先 |
| 快速检查 | MiniMax | - | 速度优先 |
| Embedding | OpenAI | 本地模型 | 成本优先 |
| 关键任务 | Anthropic | OpenAI | 最强模型 |

### 8.6 Agent 基类设计

```python
# domain/agents/base.py

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Optional
from enum import Enum
import uuid
import time


class AgentStatus(Enum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    WAITING = "waiting"


class AgentPriority(Enum):
    CRITICAL = 0
    HIGH = 1
    NORMAL = 2
    LOW = 3


@dataclass
class AgentContext:
    """Agent 执行上下文，贯穿整个工作流。"""
    workflow_id: str
    chapter_id: Optional[int] = None
    story_id: Optional[int] = None
    user_preferences: dict = field(default_factory=dict)
    genre_config: Optional[dict] = None
    session_history: list = field(default_factory=list)
    shared_memory: dict = field(default_factory=dict)
    hallucination_flags: list = field(default_factory=list)


@dataclass
class AgentResult:
    """Agent 执行结果标准格式。"""
    agent_id: str
    agent_type: str
    status: AgentStatus
    priority: AgentPriority
    data: dict = field(default_factory=dict)
    issues: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    execution_time_ms: int = 0
    tokens_used: int = 0
    provider: str = ""
    raw_response: Optional[str] = None
    hallucination_score: float = 0.0


class BaseAgent(ABC):
    """Agent 抽象基类。所有 Agent 必须继承此类。"""

    agent_type: str = "base"
    priority: AgentPriority = AgentPriority.NORMAL
    required_context_keys: list[str] = []

    def __init__(self, provider: "AIProvider", config: Optional[dict] = None):
        self.provider = provider
        self.config = config or {}
        self.agent_id = f"{self.agent_type}_{uuid.uuid4().hex[:8]}"
        self.status = AgentStatus.IDLE

    @abstractmethod
    async def execute(self, context: AgentContext) -> AgentResult:
        """执行 Agent 核心逻辑。"""
        pass

    def validate_context(self, context: AgentContext) -> list[str]:
        """验证上下文是否满足执行条件。"""
        missing = []
        for key in self.required_context_keys:
            if key not in context.shared_memory:
                missing.append(key)
        return missing

    async def run(self, context: AgentContext, timeout_ms: int = 60000) -> AgentResult:
        """带超时、重试、日志的标准执行入口。"""
        start_time = time.time()
        self.status = AgentStatus.RUNNING

        missing = self.validate_context(context)
        if missing:
            self.status = AgentStatus.FAILED
            return AgentResult(
                agent_id=self.agent_id,
                agent_type=self.agent_type,
                status=AgentStatus.FAILED,
                priority=self.priority,
                issues=[f"Missing required context: {missing}"],
                execution_time_ms=int((time.time() - start_time) * 1000),
            )

        try:
            result = await self.execute(context)
            result.agent_id = self.agent_id
            result.agent_type = self.agent_type
            result.priority = self.priority
            result.execution_time_ms = int((time.time() - start_time) * 1000)
            self.status = result.status
            return result
        except Exception as e:
            self.status = AgentStatus.FAILED
            return AgentResult(
                agent_id=self.agent_id,
                agent_type=self.agent_type,
                status=AgentStatus.FAILED,
                priority=self.priority,
                issues=[str(e)],
                execution_time_ms=int((time.time() - start_time) * 1000),
            )
```

### 8.7 Agent Orchestrator 设计

```python
# domain/agents/orchestrator.py

from typing import Callable
import asyncio
import networkx as nx


class AgentOrchestrator:
    """Agent 工作流编排器，支持拓扑排序、并行执行、条件分支。"""

    def __init__(self):
        self.workflows: dict[str, nx.DiGraph] = {}
        self.handlers: dict[str, Callable] = {}

    def register_workflow(self, name: str, graph: nx.DiGraph):
        """注册工作流定义。"""
        if not nx.is_directed_acyclic_graph(graph):
            raise ValueError(f"Workflow {name} must be a DAG")
        self.workflows[name] = graph

    def register_handler(self, agent_type: str, handler: Callable):
        """注册 Agent 类型处理器。"""
        self.handlers[agent_type] = handler

    async def execute(self, workflow_name: str, context: AgentContext) -> WorkflowResult:
        """执行工作流。"""
        graph = self.workflows[workflow_name]
        execution_order = list(nx.topological_sort(graph))

        results = {}
        for node in execution_order:
            agent_type = graph.nodes[node]["agent_type"]
            handler = self.handlers.get(agent_type)
            if not handler:
                raise ValueError(f"No handler for agent type: {agent_type}")

            # 并行执行无依赖的节点
            predecessors = list(graph.predecessors(node))
            if predecessors:
                # 等待前置节点完成
                for pred in predecessors:
                    if pred not in results:
                        await asyncio.sleep(0.1)

            # 执行当前节点
            result = await handler(context)
            results[node] = result

            # 检查关键节点失败
            if result.priority == AgentPriority.CRITICAL and result.status == AgentStatus.FAILED:
                return WorkflowResult(
                    status="failed",
                    failed_node=node,
                    results=results,
                )

        return WorkflowResult(status="completed", results=results)
```

### 8.8 Context Contract 标准化

Context Agent 的输出必须包含以下 8 个板块：

```json
{
    "core_task": {
        "goal": "本章主角核心目标",
        "obstacle": "主要阻力",
        "cost": "需要付出的代价",
        "strand_type": "quest|fire|constellation",
        "strand_weight": 0.6
    },
    "承接上文": {
        "hooks": ["上章钩子列表"],
        "reader_expectations": "读者期待",
        "emotional_carryover": "情绪延续"
    },
    "active_characters": [
        {
            "name": "角色名",
            "current_state": "当前状态",
            "motivation": "本章动机",
            "emotional_base": "情绪底色",
            "arc_position": "角色弧线位置"
        }
    ],
    "scene_constraints": {
        "locations": ["场景列表"],
        "power_limits": "力量约束",
        "time_of_day": "时间段",
        "weather": "天气/环境"
    },
    "time_constraints": "时间线约束",
    "style_guidance": {
        "writing_style": "文笔风格",
        "tone": "基调",
        "pacing_target": "目标节奏",
        "dialogue_ratio": 0.3
    },
    "continuity": {
        "foreshadowing": ["需回收伏笔"],
        "ongoing_threads": ["持续线索"],
        "outline_anchor": "大纲锚点（反幻觉）"
    },
    "engagement_strategy": {
        "hook_type": "开篇钩子类型",
        "cliffhanger_plan": "结尾悬念计划",
        "curiosity_gaps": ["认知差设计"]
    },
    "anti_hallucination": {
        "outline_verified": true,
        "setting_checksum": "设定哈希",
        "invention_flags": []
    }
}
```

### 8.9 逻辑红线校验

在 Context Agent 输出前，必须校验以下 6 条红线：

| 红线编号 | 规则 | 违反后果 |
|----------|------|----------|
| R1 | 不得擅自改变大纲设定的核心事件 | 拒绝 + 修正指令 |
| R2 | 不得让角色做出违背人设的行为 | 标记 + 建议修正 |
| R3 | 不得引入未在设定中定义的新力量体系 | 拒绝 + 修正指令 |
| R4 | 不得破坏已建立的战力对比关系 | 标记 + 建议修正 |
| R5 | 时间线必须保持因果一致性 | 拒绝 + 修正指令 |
| R6 | 伏笔回收必须在埋设后合理距离内 | 标记 + 建议修正 |

### 8.10 Strand Weave 节奏控制

Strand 类型定义：

| Strand 类型 | 含义 | 占比建议 | 功能 |
|-------------|------|----------|------|
| Quest | 主线任务推进 | 50-60% | 推动情节 |
| Fire | 冲突/战斗/高潮 | 20-30% | 提供爽点 |
| Constellation | 世界观展开/伏笔埋设 | 15-25% | 增加深度 |

**红线检查**:
- Quest 连续超过 3 章无 Fire → 警告节奏拖沓
- Fire 连续超过 2 章 → 警告审美疲劳
- Constellation 超过 3 章无回收 → 警告伏笔断档

### 8.11 追读力债务系统

参考 reference-webnovel 的 chase_debt 设计：

```python
class ReadingDebtTracker:
    """追读力债务追踪器。"""

    def __init__(self):
        self.debts = {}  # chapter_id -> debt_amount

    def calculate_debt(self, chapter_id: int, reading_power: float) -> float:
        """计算章节追读力债务。"""
        target = 80.0  # 目标追读力
        if reading_power < target:
            # 债务 = 差额 * 利息系数
            debt = (target - reading_power) * 1.1
            self.debts[chapter_id] = debt
            return debt
        return 0.0

    def get_total_debt(self) -> float:
        """获取总债务。"""
        return sum(self.debts.values())

    def get_repayment_plan(self) -> list[dict]:
        """生成还债计划（后续章节需要提升的追读力）。"""
        total_debt = self.get_total_debt()
        remaining_chapters = self._get_remaining_chapters()
        if remaining_chapters == 0:
            return []
        per_chapter = total_debt / remaining_chapters
        return [
            {"chapter_id": cid, "target_boost": per_chapter}
            for cid in remaining_chapters
        ]
```

---

## 9. 安全与性能策略

### 9.1 安全核心措施

| 优先级 | 措施 | 实施方式 | 预估工时 |
|--------|------|----------|----------|
| P0 | 系统密钥环存储 API Key | `keyring` 库替代 `.env` | 4h |
| P0 | SQLite 应用层字段加密 | `cryptography.fernet` | 8h |
| P0 | ZIP 导入 Zip Slip 防护 | 路径验证 + 压缩比检查 | 3h |
| P0 | WebSocket Origin 验证 | 验证 Origin header | 2h |
| P1 | 导出 ZIP 密码加密 | `pyzipper` AES-256 | 3h |
| P1 | WebSocket 认证改为 subprotocol | `sec-websocket-protocol` | 3h |
| P2 | CORS 方法/头部限定 | 限定具体方法和头部 | 2h |
| P2 | 导入数据深度/大小限制 | 递归深度和总大小限制 | 3h |
| P3 | XSS 输出编码中间件 | HTML 转义 | 3h |
| P3 | 导出文件完整性签名 | HMAC 签名 | 3h |

### 9.2 性能核心措施

| 优先级 | 措施 | 实施方式 | 预估工时 |
|--------|------|----------|----------|
| P0 | 启用 SQLite WAL 模式 | PRAGMA journal_mode=WAL | 2h |
| P1 | 连接池调优 | 移除 NullPool，pool_size=3 | 2h |
| P1 | 大文本外部存储 | `ContentStorage` 类，文件分目录 | 6h |
| P1 | 三级缓存实现 | L1内存/L2磁盘/L3DB | 6h |
| P1 | AI 流式响应批量发送 | 缓冲区 + 自适应刷新 | 4h |
| P2 | 复合索引和 FTS5 | 全文搜索虚拟表 | 6h |
| P2 | 启动懒加载优化 | 延迟导入重型模块 | 4h |
| P2 | 流式导出实现 | 生成器逐实体产出 | 4h |
| P2 | WAL 定期 checkpoint | 后台任务 5 分钟一次 | 2h |
| P3 | 启动预加载热点数据 | warmup_cache() | 2h |

### 9.3 安全成熟度演进

| 阶段 | 成熟度 | 关键里程碑 |
|------|--------|------------|
| 当前 | 3/5 | 基础认证、CORS、限流、请求日志 |
| Phase 1 后 | 4/5 | 密钥环、字段加密、Zip Slip 防护 |
| Phase 2 后 | 4.5/5 | 加密 ZIP、subprotocol 认证、输入验证 |
| Phase 3 后 | 5/5 | SQLCipher、完整性签名、XSS 防护 |

### 9.4 性能成熟度演进

| 阶段 | 成熟度 | 关键里程碑 |
|------|--------|------------|
| 当前 | 3/5 | 基础缓存、慢请求日志 |
| Phase 1 后 | 4/5 | WAL、连接池、HTTP 连接复用 |
| Phase 2 后 | 4.5/5 | 三级缓存、大文本外存、流式优化 |
| Phase 3 后 | 5/5 | FTS5、懒加载、预加载、文本压缩 |

### 9.5 安全详细实施方案

#### 9.5.1 系统密钥环集成

**当前问题**: API Key 存储于 `.env` 文件，明文可读。

**实施方案**:

```python
# infrastructure/security/keyring_manager.py
import keyring
import secrets

SERVICE_NAME = "auto-novel-writer"

class KeyringManager:
    """跨平台密钥环管理。"""

    @staticmethod
    def get_api_key() -> str | None:
        return keyring.get_password(SERVICE_NAME, "local_api_key")

    @staticmethod
    def set_api_key(key: str) -> None:
        keyring.set_password(SERVICE_NAME, "local_api_key", key)

    @staticmethod
    def get_minimax_key() -> str | None:
        return keyring.get_password(SERVICE_NAME, "minimax_api_key")

    @staticmethod
    def set_minimax_key(key: str) -> None:
        keyring.set_password(SERVICE_NAME, "minimax_api_key", key)

    @staticmethod
    def generate_and_store_api_key() -> str:
        key = f"writer_{secrets.token_urlsafe(32)}"
        KeyringManager.set_api_key(key)
        return key
```

**迁移策略**:
1. 首次启动时检查密钥环是否存在 API Key
2. 不存在则从 `.env` 读取并迁移到密钥环
3. 迁移成功后删除 `.env` 中的敏感字段
4. 后续启动仅从密钥环读取

#### 9.5.2 应用层字段加密

**加密范围**:
- 小说正文 (Chapter.content, Scene.content)
- 角色详细档案 (Character.description 等长文本)
- 用户写作设置 (WritingSettings 中的敏感偏好)

**不加密字段**:
- ID、外键、状态枚举（需要索引和查询）
- 创建时间、更新时间（审计字段）
- 字数统计、排序字段（需要排序和过滤）

```python
# infrastructure/security/field_encryption.py
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

class FieldEncryption:
    """应用层字段加密。"""

    def __init__(self, master_key: bytes):
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"auto-novel-writer-salt",
            iterations=480000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(master_key))
        self._fernet = Fernet(key)

    def encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        return self._fernet.decrypt(ciphertext.encode()).decode()
```

#### 9.5.3 ZIP 导入安全防护

```python
# infrastructure/security/zip_validator.py
import zipfile
import io

MAX_ZIP_SIZE = 50 * 1024 * 1024
MAX_FILES_IN_ZIP = 100
MAX_FILE_SIZE = 10 * 1024 * 1024

class ZipValidationError(ValueError):
    pass

def validate_zip_archive(zip_bytes: bytes) -> None:
    if len(zip_bytes) > MAX_ZIP_SIZE:
        raise ZipValidationError(f"ZIP too large: {len(zip_bytes)} bytes")

    with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as zf:
        if len(zf.namelist()) > MAX_FILES_IN_ZIP:
            raise ZipValidationError(f"Too many files: {len(zf.namelist())}")

        for name in zf.namelist():
            # Zip Slip 防护
            if os.path.isabs(name) or ".." in name:
                raise ZipValidationError(f"Invalid path: {name}")

            info = zf.getinfo(name)
            if info.file_size > MAX_FILE_SIZE:
                raise ZipValidationError(f"File too large: {name}")

            # ZIP 炸弹防护
            if info.file_size > 0:
                ratio = info.file_size / max(info.compress_size, 1)
                if ratio > 100:
                    raise ZipValidationError(f"Suspicious compression: {name}")
```

#### 9.5.4 WebSocket 安全增强

```python
# middleware/websocket_auth.py
async def verify_websocket_auth(websocket: WebSocket) -> bool:
    """增强的 WebSocket 认证。"""

    # 1. Origin 验证（防止 CSWSH）
    origin = websocket.headers.get("origin", "")
    allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173", "app://*"]
    if not any(origin.startswith(a.replace("*", "")) for a in allowed_origins):
        await websocket.close(code=1008, reason="Invalid origin")
        return False

    # 2. 从 subprotocol 获取 token（替代 query param）
    token = None
    for protocol in websocket.headers.getlist("sec-websocket-protocol"):
        if protocol.startswith("writer_"):
            token = protocol
            break

    if not token:
        await websocket.close(code=1008, reason="Missing authentication")
        return False

    # 3. 验证 token
    if not validate_api_key(token):
        await websocket.close(code=1008, reason="Invalid authentication")
        return False

    return True
```

### 9.6 性能详细优化方案

#### 9.6.1 SQLite WAL 模式

```python
# infrastructure/database.py
from sqlalchemy import event
from sqlalchemy.engine import Engine

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """启用 WAL 模式。"""
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA cache_size=-64000")  # 64MB
    cursor.execute("PRAGMA temp_store=MEMORY")
    cursor.close()
```

**WAL 模式优势**:
- 读写并发：读操作不阻塞写操作
- 性能提升：写操作追加到 WAL 文件，无需锁定整个数据库
- 崩溃恢复：WAL 文件自动重放

**维护任务**:
```python
async def wal_checkpoint_task():
    """每 5 分钟执行一次 WAL checkpoint。"""
    while True:
        await asyncio.sleep(300)
        async with engine.begin() as conn:
            await conn.execute(text("PRAGMA wal_checkpoint(PASSIVE)"))
```

#### 9.6.2 连接池调优

```python
# infrastructure/database.py
from sqlalchemy.pool import NullPool

# 开发环境
if settings.environment == "development":
    engine = create_async_engine(
        settings.database_url,
        poolclass=NullPool,  # 无连接池，便于调试
    )
else:
    # 生产环境
    engine = create_async_engine(
        settings.database_url,
        pool_size=3,
        max_overflow=5,
        pool_pre_ping=True,
        pool_recycle=3600,
    )
```

#### 9.6.3 三级缓存实现

```python
# infrastructure/cache/tiered_cache.py
class TieredCache:
    """三级缓存：L1 内存 -> L2 磁盘 -> L3 数据库。"""

    def __init__(self, l1: LRUCache, l2: DiskCache, l3: CacheRepository):
        self.l1 = l1
        self.l2 = l2
        self.l3 = l3

    async def get(self, key: str) -> Any | None:
        # L1
        value = self.l1.get(key)
        if value is not None:
            return value

        # L2
        value = self.l2.get(key)
        if value is not None:
            self.l1.set(key, value)
            return value

        # L3
        value = await self.l3.get(key)
        if value is not None:
            self.l2.set(key, value)
            self.l1.set(key, value)
            return value

        return None

    async def set(self, key: str, value: Any, ttl: int = 3600) -> None:
        self.l1.set(key, value, ttl=min(ttl, 60))
        self.l2.set(key, value, ttl=min(ttl, 3600))
        await self.l3.set(key, value, ttl=ttl)

    async def invalidate(self, pattern: str) -> None:
        self.l1.invalidate(pattern)
        self.l2.invalidate(pattern)
        await self.l3.invalidate(pattern)
```

#### 9.6.4 大文本外部存储

```python
# infrastructure/storage/content_storage.py
import hashlib
import os

class ContentStorage:
    """大文本外部存储，DB 仅存储引用。"""

    def __init__(self, base_path: str):
        self.base_path = base_path

    def _get_path(self, content_hash: str) -> str:
        # 分目录存储：ab/cd/abcdef1234...
        return os.path.join(
            self.base_path,
            content_hash[:2],
            content_hash[2:4],
            content_hash
        )

    def store(self, content: str) -> str:
        content_hash = hashlib.sha256(content.encode()).hexdigest()
        path = self._get_path(content_hash)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return content_hash

    def retrieve(self, content_hash: str) -> str:
        path = self._get_path(content_hash)
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()

    def delete(self, content_hash: str) -> None:
        path = self._get_path(content_hash)
        if os.path.exists(path):
            os.remove(path)
```

**使用场景**:
- 章节正文 > 10KB → 外部存储
- 草稿版本 > 10KB → 外部存储
- AI 生成内容 > 10KB → 外部存储

#### 9.6.5 AI 流式响应优化

```python
# infrastructure/ai/stream_optimizer.py
class StreamOptimizer:
    """AI 流式响应批量发送优化器。"""

    def __init__(self, flush_interval_ms: float = 50.0, max_buffer_size: int = 1024):
        self.flush_interval_ms = flush_interval_ms
        self.max_buffer_size = max_buffer_size
        self.buffer = []
        self.last_flush = time.time()

    async def write(self, chunk: str, send_func) -> None:
        self.buffer.append(chunk)

        # 条件触发刷新
        buffer_text = "".join(self.buffer)
        should_flush = (
            len(buffer_text) >= self.max_buffer_size
            or (time.time() - self.last_flush) * 1000 >= self.flush_interval_ms
            or chunk.endswith(("。", "！", "？", "\n"))  # 语义边界
        )

        if should_flush:
            await send_func(buffer_text)
            self.buffer = []
            self.last_flush = time.time()

    async def flush(self, send_func) -> None:
        if self.buffer:
            await send_func("".join(self.buffer))
            self.buffer = []
```

---

## 10. 测试与质量保障

### 10.1 测试金字塔

```
        /\
       /  \      E2E 测试 (5%)
      /----\     - 完整用户流程
     /      \    - Playwright / TestClient
    /--------\
   /  集成测试 \   (25%)
  /  - API端点  \  - 数据库交互
 /  - 服务层    \  - 中间件链
/----------------\
/    单元测试      \  (70%)
/  - 模型验证      \  - 工具函数
/  - 业务逻辑      \  - 缓存/限流
/--------------------\
```

### 10.2 覆盖目标

| 层级 | 目标覆盖率 | 说明 |
|------|-----------|------|
| 路由层 (Routes) | 100% | 所有 HTTP 端点至少测试一次成功路径和主要错误路径 |
| 服务层 (Services) | 80%+ | database_service, ai_service, cache_service, export_import |
| 数据访问层 (Models/DB) | 70%+ | SQLAlchemy 模型、关系、约束验证 |
| Agent 层 | 60%+ | ContextAgent, DataAgent, Checkers (AI 结果不可预测) |
| 中间件 | 80%+ | 认证、限流、日志、CORS、错误处理 |
| 工具函数 | 90%+ | _to_dict, hash_prompt, validate_* 等 |

### 10.3 测试策略

| 策略 | 说明 |
|------|------|
| 内存数据库 | 使用 `:memory:` SQLite，每个 session 创建一次表结构 |
| 事务回滚 | 每个测试用例独立事务，测试结束自动回滚 |
| AI Mock | 所有 AI 相关测试使用 mock，不调用真实 API |
| 认证绕过 | 测试环境默认跳过 localhost 认证 |
| 缓存隔离 | 测试中创建独立的 CacheService 实例 |
| 分层标记 | pytest markers: unit/integration/e2e/performance/security |

### 10.4 CI/CD 集成

```yaml
# 快速反馈 (开发时)
pytest -m unit -x  # 仅单元测试, 失败即停

# 提交前检查
pytest -m "unit or integration" --cov-fail-under=75

# 完整测试 (CI/CD)
pytest -v --cov=src/backend --cov-report=html

# 性能测试
pytest -m performance --benchmark-only

# 安全测试
pytest -m security -v
```

### 10.5 测试 Fixtures 详细设计

#### 10.5.1 异步数据库引擎

```python
# tests/conftest.py
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture(scope="session")
async def engine():
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        future=True,
        poolclass=NullPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest_asyncio.fixture
async def db_session(engine):
    async with engine.connect() as connection:
        trans = await connection.begin()
        session_maker = async_sessionmaker(
            bind=connection,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        async with session_maker() as session:
            yield session
        await trans.rollback()
```

#### 10.5.2 认证 Fixtures

```python
@pytest.fixture
def auth_headers():
    return {"X-API-Key": "writer_test_key_12345"}

@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    with patch.object(settings, 'auth_skip_localhost', True):
        with TestClient(app) as test_client:
            yield test_client

    app.dependency_overrides.clear()
```

#### 10.5.3 AI Mock Fixtures

```python
@pytest.fixture
def mock_ai_service():
    service = MagicMock()

    async def mock_generate(*args, **kwargs):
        chunks = ["这是", "AI", "生成的", "测试", "内容。"]
        for chunk in chunks:
            yield chunk

    service.generate = mock_generate

    async def mock_review_settings(*args, **kwargs):
        return {
            "review_content": "测试审查结果：设定一致。",
            "raw_response": {"choices": [{"message": {"content": "测试"}}]},
        }

    service.review_settings = mock_review_settings
    return service
```

### 10.6 各层测试策略详解

#### 10.6.1 单元测试策略

**Pydantic 模型验证测试**:
```python
class TestGenerateRequest:
    def test_valid_request(self):
        req = GenerateRequest(
            prompt="测试提示",
            operation="continue",
            chapter_id=1,
            human_ai_ratio=70,
            style="default"
        )
        assert req.prompt == "测试提示"

    def test_empty_prompt_raises(self):
        with pytest.raises(ValueError, match="cannot be empty"):
            GenerateRequest(prompt="", operation="continue")

    def test_invalid_operation_raises(self):
        with pytest.raises(ValueError, match="must be one of"):
            GenerateRequest(prompt="测试", operation="invalid_op")

    def test_human_ai_ratio_out_of_range(self):
        with pytest.raises(ValueError, match="between 0 and 100"):
            GenerateRequest(prompt="测试", operation="continue", human_ai_ratio=150)
```

**缓存服务测试**:
```python
class TestLRUCache:
    def test_get_set_basic(self):
        cache = LRUCache(max_size=3)
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"

    def test_ttl_expiration(self):
        cache = LRUCache(max_size=3, default_ttl=0)
        cache.set("key1", "value1", ttl=0)
        import time
        time.sleep(0.01)
        assert cache.get("key1") is None

    def test_lru_eviction(self):
        cache = LRUCache(max_size=2)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.set("c", 3)
        assert cache.get("a") is None
        assert cache.get("b") == 2
        assert cache.get("c") == 3
```

#### 10.6.2 集成测试策略

**API 端点测试**:
```python
class TestCharacterAPI:
    async def test_create_character(self, client, auth_headers):
        response = client.post(
            "/api/v1/settings/characters",
            json={"name": "测试角色", "gender": "male", "tier": "核心"},
            headers=auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "测试角色"
        assert "id" in data

    async def test_list_characters_pagination(self, client, auth_headers):
        response = client.get(
            "/api/v1/settings/characters?skip=0&limit=10",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data
        assert "total" in data["pagination"]

    async def test_delete_character(self, client, auth_headers, db_session):
        # 创建测试角色
        char = Character(name="待删除", gender="male")
        db_session.add(char)
        await db_session.flush()

        response = client.delete(
            f"/api/v1/settings/characters/{char.id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["success"] is True
```

**WebSocket 测试**:
```python
class TestWebSocket:
    async def test_chat_websocket(self, client):
        with client.websocket_connect("/ws/chat/1") as websocket:
            websocket.send_json({"type": "ping"})
            data = websocket.receive_json()
            assert data["type"] == "pong"

    async def test_websocket_auth_failure(self, client):
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/ws/chat/1") as websocket:
                pass
```

#### 10.6.3 Agent 测试策略

**Mock AI 响应测试**:
```python
class TestContextAgent:
    async def test_execute_with_mock_provider(self, mock_ai_service):
        agent = ContextAgent(provider=mock_ai_service)
        context = AgentContext(
            workflow_id="test-1",
            shared_memory={"chapter_id": 1}
        )
        result = await agent.run(context)
        assert result.status == AgentStatus.COMPLETED
        assert "core_task" in result.data

    async def test_missing_context_fails(self, mock_ai_service):
        agent = ContextAgent(provider=mock_ai_service)
        context = AgentContext(workflow_id="test-2")
        # 缺少必需的 shared_memory 键
        result = await agent.run(context)
        assert result.status == AgentStatus.FAILED
```

#### 10.6.4 安全测试策略

```python
class TestSecurity:
    async def test_auth_bypass_without_key(self, client):
        response = client.get("/api/v1/settings/characters")
        assert response.status_code == 401

    async def test_invalid_api_key(self, client):
        response = client.get(
            "/api/v1/settings/characters",
            headers={"X-API-Key": "invalid_key"}
        )
        assert response.status_code == 403

    async def test_rate_limiting(self, client, auth_headers):
        # 快速发送超过限流阈值的请求
        for _ in range(65):
            response = client.get(
                "/api/v1/settings/characters",
                headers=auth_headers
            )
        assert response.status_code == 429

    async def test_sql_injection_protection(self, client, auth_headers):
        response = client.get(
            "/api/v1/settings/characters?name='; DROP TABLE characters; --",
            headers=auth_headers
        )
        # 应返回 400 或空结果，不应导致数据库错误
        assert response.status_code in [200, 400]
```

### 10.7 测试数据工厂

```python
# tests/factories.py
class CharacterFactory:
    _counter = 0

    @classmethod
    def build(cls, **overrides):
        cls._counter += 1
        return {
            "name": overrides.get("name", f"角色{cls._counter}"),
            "gender": overrides.get("gender", "male"),
            "personality": overrides.get("personality", "勇敢"),
            "desires": overrides.get("desires", "成为最强"),
            "flaws": overrides.get("flaws", "冲动"),
            "description": overrides.get("description", "主角"),
            "tier": overrides.get("tier", "核心"),
            "cultivation_realm": overrides.get("cultivation_realm", "筑基期"),
        }

    @classmethod
    async def create(cls, db_session, **overrides):
        from backend.models.entities import Character
        data = cls.build(**overrides)
        char = Character(**data)
        db_session.add(char)
        await db_session.flush()
        await db_session.refresh(char)
        return char


class ChapterFactory:
    _counter = 0

    @classmethod
    def build(cls, **overrides):
        cls._counter += 1
        return {
            "title": overrides.get("title", f"第{cls._counter}章"),
            "summary": overrides.get("summary", "章节摘要"),
            "status": overrides.get("status", "pending"),
            "word_count": overrides.get("word_count", 0),
            "chapter_order": overrides.get("chapter_order", cls._counter),
        }

    @classmethod
    async def create(cls, db_session, **overrides):
        from backend.models.entities import Chapter
        data = cls.build(**overrides)
        chapter = Chapter(**data)
        db_session.add(chapter)
        await db_session.flush()
        await db_session.refresh(chapter)
        return chapter
```

### 10.8 性能测试策略

```python
# tests/performance/test_load.py
import pytest
import asyncio
import time

class TestLoad:
    async def test_concurrent_ai_requests(self, client, auth_headers):
        """测试并发 AI 请求性能。"""
        start = time.time()

        async def make_request():
            return client.post(
                "/api/v1/ai/generate",
                json={"prompt": "测试", "operation": "continue"},
                headers=auth_headers
            )

        # 10 个并发请求
        tasks = [make_request() for _ in range(10)]
        responses = await asyncio.gather(*tasks)

        elapsed = time.time() - start
        assert elapsed < 30.0  # 10 个并发请求应在 30 秒内完成

    async def test_cache_performance(self):
        """测试缓存命中率。"""
        cache = TieredCache(...)

        # 预热缓存
        for i in range(100):
            await cache.set(f"key_{i}", f"value_{i}")

        # 测试命中率
        hits = 0
        for i in range(100):
            if await cache.get(f"key_{i}") is not None:
                hits += 1

        hit_rate = hits / 100
        assert hit_rate > 0.95  # 命中率应 > 95%
```

---

## 11. 实施路线图

### 11.1 总体时间线

```
Phase 1: 基础加固 (4周)          Phase 2: 核心重构 (5周)
├─ 严重 Bug 修复                   ├─ Repository 层提取
├─ 安全加固                        ├─ Service 层构建
├─ 性能基础优化                    ├─ AI Provider 抽象
├─ 测试基础设施                    ├─ 数据模型扩展
└─ 代码质量提升                    └─ 事件总线引入

Phase 3: 功能增强 (5周)          Phase 4: 生态完善 (2周)
├─ Agent 系统重构                  ├─ 观测与监控
├─ 六维检查深化                    ├─ 性能调优
├─ 新 Agent 开发                   ├─ 文档完善
├─ 高级功能补充                    └─ 发布准备
└─ API 完善
```

### 11.2 Phase 1: 基础加固（第 1-4 周）

**目标**: 修复严重问题，建立安全基础，搭建测试框架

| 周次 | 任务 | 预估工时 | 负责人 | 验收标准 |
|------|------|----------|--------|----------|
| W1-1 | 修复 main.py `docs_policy` 参数 | 2h | 后端 | 应用正常启动 |
| W1-2 | 修复 disconnect() 字典操作异常 | 2h | 后端 | WebSocket 断开无异常 |
| W1-3 | 全局替换 `datetime.utcnow` | 4h | 后端 | 无废弃警告 |
| W1-4 | 复用 `httpx.AsyncClient`（AIService/MiniMaxAPIClient） | 8h | 后端 | HTTP 连接复用，性能提升 |
| W1-5 | 替换 `threading.Lock` 为 `asyncio.Lock` | 2h | 后端 | 限流中间件并发安全 |
| W1-6 | 为 tasks router 添加 `require_auth` | 1h | 后端 | 未认证返回 401 |
| W1-7 | 修复 ZIP 导入参数签名 | 2h | 后端 | 可正常上传 ZIP |
| W2-1 | 实现系统密钥环存储 API Key | 6h | 后端 | 密钥不再存储于 `.env` |
| W2-2 | 实现 SQLite 应用层字段加密 | 10h | 后端 | 敏感字段加密存储 |
| W2-3 | ZIP 导入 Zip Slip 防护 | 3h | 后端 | 恶意 ZIP 被拦截 |
| W2-4 | WebSocket Origin 验证 | 2h | 后端 | 非法 Origin 被拒绝 |
| W3-1 | 启用 SQLite WAL 模式 | 2h | 后端 | 读写并发性能提升 |
| W3-2 | 连接池调优（移除 NullPool） | 2h | 后端 | 开发环境性能提升 |
| W3-3 | 添加数据库索引 | 4h | 后端 | 查询性能提升 |
| W3-4 | 修复导出序列化方式 | 2h | 后端 | 导出不含内部属性 |
| W4-1 | 搭建 pytest + async 测试框架 | 4h | 后端 | 测试可运行 |
| W4-2 | 创建 conftest.py fixtures | 6h | 后端 | 数据库/认证/AI mock 可用 |
| W4-3 | 编写核心单元测试（schemas/cache/auth） | 12h | 后端 | 覆盖率 30%+ |
| W4-4 | 编写核心集成测试（settings/chapters） | 12h | 后端 | 主要端点覆盖 |

**Phase 1 里程碑**:
- [ ] 所有 P0 严重问题修复
- [ ] 安全基础（密钥环 + 字段加密）完成
- [ ] 性能基础（WAL + 连接池）完成
- [ ] 测试框架搭建，覆盖率 30%+
- [ ] 代码质量评分从 6/10 提升至 7/10

### 11.3 Phase 2: 核心重构（第 5-9 周）

**目标**: 引入分层架构，重构核心模块，扩展数据模型

| 周次 | 任务 | 预估工时 | 负责人 | 验收标准 |
|------|------|----------|--------|----------|
| W5-1 | 创建 Repository 基础接口和工厂 | 6h | 后端 | `repositories/base.py` 完成 |
| W5-2 | 实现 CharacterRepository | 4h | 后端 | 角色数据访问抽象 |
| W5-3 | 实现 ChapterRepository | 4h | 后端 | 章节数据访问抽象 |
| W5-4 | 实现 StoryRepository / DraftRepository | 6h | 后端 | 故事/草稿数据访问抽象 |
| W6-1 | 创建 Application Service 基类 | 4h | 后端 | `application/services/` 结构完成 |
| W6-2 | 实现 CharacterService | 6h | 后端 | 角色业务逻辑集中 |
| W6-3 | 实现 StoryService | 8h | 后端 | 故事结构业务逻辑集中 |
| W6-4 | 实现 AIService（基于 Provider 抽象） | 10h | 后端 | 支持多 Provider 切换 |
| W7-1 | 实现 AIProvider 抽象接口 | 4h | 后端 | `infrastructure/ai/providers.py` |
| W7-2 | 实现 MiniMaxProvider | 4h | 后端 | 功能与现有等价 |
| W7-3 | 实现 OpenAICompatibleProvider | 6h | 后端 | 支持 OpenAI/DeepSeek/本地模型 |
| W7-4 | 实现 ProviderRouter | 4h | 后端 | 按任务类型自动路由 |
| W8-1 | 创建 Project / GenreConfiguration 模型 | 6h | 后端 | 新增表可创建 |
| W8-2 | 创建 Scene / Foreshadowing / Timeline 模型 | 8h | 后端 | 新增表可创建 |
| W8-3 | 创建 Tag / AIGeneratedContent / EditHistory 模型 | 6h | 后端 | 新增表可创建 |
| W8-4 | 编写 Alembic 迁移脚本 | 8h | 后端 | 现有数据可迁移 |
| W9-1 | 实现 AsyncEventBus | 4h | 后端 | 事件订阅/发布/处理 |
| W9-2 | 实现事件处理器（缓存失效/统计更新） | 4h | 后端 | 跨模块操作解耦 |
| W9-3 | 实现简易 DI 容器 | 4h | 后端 | 组件可注入 |
| W9-4 | 路由层迁移至 Service 层 | 12h | 后端 | 路由层无直接 DB 操作 |

**Phase 2 里程碑**:
- [ ] Repository + Service 分层完成
- [ ] AI Provider 抽象层完成，支持至少 2 个 Provider
- [ ] 数据模型从 18 扩展至 30 个
- [ ] 事件总线 + DI 容器引入
- [ ] 测试覆盖率 50%+

### 11.4 Phase 3: 功能增强（第 10-14 周）

**目标**: 重构 Agent 系统，深化检查维度，开发新功能

| 周次 | 任务 | 预估工时 | 负责人 | 验收标准 |
|------|------|----------|--------|----------|
| W10-1 | 重构 BaseAgent / AgentContext / AgentResult | 6h | 后端 | 统一 Agent 接口 |
| W10-2 | 重构 BaseChecker（分层检查机制） | 8h | 后端 | 快速扫描 + 深度分析 |
| W10-3 | 实现 CheckerPipeline（六维并行+聚合） | 8h | 后端 | 综合评分/问题分级 |
| W11-1 | Context Agent 增强（Strand/反幻觉） | 8h | 后端 | 执行包含 strand_type |
| W11-2 | Data Agent 增强（消歧/增量） | 8h | 后端 | 实体消歧准确率提升 |
| W11-3 | 实现 OutlineLawEnforcer | 4h | 后端 | 大纲违反可被检测 |
| W11-4 | 实现 SettingPhysicsEnforcer | 4h | 后端 | 设定违反可被检测 |
| W12-1 | 实现 ReviewAgent（多轮审查） | 8h | 后端 | 粗审+细审+交叉验证 |
| W12-2 | 实现 PlotAgent（情节规划） | 6h | 后端 | 伏笔设计/高潮规划 |
| W12-3 | 实现 StyleAgent（风格分析/迁移） | 6h | 后端 | 风格指纹/迁移 |
| W12-4 | 实现 ChatAgent（主动提问） | 6h | 后端 | 信息熵策略提问 |
| W13-1 | 实现 AgentOrchestrator | 8h | 后端 | 工作流拓扑排序执行 |
| W13-2 | 定义核心工作流（写作/审查/初始化） | 6h | 后端 | 3 个工作流可运行 |
| W13-3 | 实现 StrandTracker | 6h | 后端 | Strand 比例追踪/红线检查 |
| W14-1 | 实现三级缓存（TieredCache） | 8h | 后端 | L1/L2/L3 缓存可用 |
| W14-2 | 实现大文本外部存储（ContentStorage） | 6h | 后端 | 内容存文件，DB 存引用 |
| W14-3 | 实现流式导出 | 4h | 后端 | 大型项目导出不 OOM |
| W14-4 | API 完善（分页/搜索/统计端点） | 8h | 后端 | 缺失端点补齐 |

**Phase 3 里程碑**:
- [ ] Agent 系统重构完成，支持 7 种 Agent
- [ ] 六维检查深化，支持分层检查
- [ ] 3 个核心工作流可运行
- [ ] 三级缓存 + 大文本外存完成
- [ ] 测试覆盖率 70%+

### 11.5 Phase 4: 生态完善（第 15-16 周）

**目标**: 完善观测、调优性能、补齐文档

| 周次 | 任务 | 预估工时 | 负责人 | 验收标准 |
|------|------|----------|--------|----------|
| W15-1 | 实现 AgentExecutionLog / WorkflowExecution | 6h | 后端 | 执行可追踪 |
| W15-2 | 实现性能监控（延迟/Token/成功率） | 6h | 后端 | 瓶颈可识别 |
| W15-3 | Provider 故障自动降级 | 4h | 后端 | 主 Provider 故障自动切换 |
| W15-4 | 启动预加载热点数据 | 2h | 后端 | 启动后缓存已预热 |
| W16-1 | 性能压测与调优 | 8h | 后端 | 响应时间达标 |
| W16-2 | API 文档完善（OpenAPI 示例） | 4h | 后端 | 所有端点有示例 |
| W16-3 | 架构文档更新 | 4h | 后端 | 文档与代码一致 |
| W16-4 | 发布检查清单 | 4h | 后端 | 发布就绪 |

**Phase 4 里程碑**:
- [ ] Agent 执行可观测
- [ ] 性能达标（50 并发 < 5s）
- [ ] 文档完善
- [ ] 生产就绪

### 11.6 总体工时估算

| 阶段 | 周数 | 预估工时 | 关键产出 |
|------|------|----------|----------|
| Phase 1: 基础加固 | 4 | 80h | 安全基础 + 测试框架 |
| Phase 2: 核心重构 | 5 | 100h | 分层架构 + 多 Provider |
| Phase 3: 功能增强 | 5 | 100h | Agent 系统 + 高级功能 |
| Phase 4: 生态完善 | 2 | 40h | 观测 + 文档 |
| **总计** | **16** | **320h** | **生产就绪后端** |

### 11.7 关键路径分析

**关键路径**（决定总工期的任务链）：

```
W1-1 (修复严重Bug)
    -> W1-4 (HTTP连接复用)
        -> W2-1 (密钥环存储)
            -> W2-2 (字段加密)
                -> W3-1 (WAL模式)
                    -> W4-1 (测试框架)
                        -> W5-1 (Repository基类)
                            -> W6-1 (Service基类)
                                -> W7-1 (AIProvider抽象)
                                    -> W8-1 (Project模型)
                                        -> W9-1 (事件总线)
                                            -> W10-1 (Agent重构)
                                                -> W13-1 (编排器)
                                                    -> W15-1 (观测系统)
                                                        -> W16-4 (发布准备)
```

**非关键路径**（可并行执行）：
- 前端适配（与后端重构并行）
- 文档编写（与开发并行）
- 测试用例编写（与开发并行）

### 11.8 资源需求

| 资源类型 | 需求 | 说明 |
|----------|------|------|
| 后端开发 | 1-2 人 | 核心架构重构 |
| 前端开发 | 1 人 | API 适配、新功能界面 |
| 测试 | 0.5 人 | 测试用例编写、自动化 |
| AI Prompt 工程 | 0.5 人 | Agent Prompt 优化 |
| MiniMax API | 按需 | 开发测试用 |
| OpenAI API | 按需 | Provider 适配测试 |
| 开发机器 | 1 台 | Windows/macOS/Linux |

### 11.9 交付物清单

**Phase 1 交付物**:
- [ ] 修复后的代码库（无严重 Bug）
- [ ] 密钥环管理模块
- [ ] 字段加密模块
- [ ] WAL 模式配置
- [ ] 测试框架（pytest + fixtures）
- [ ] 覆盖率报告（30%+）

**Phase 2 交付物**:
- [ ] Repository 层（所有实体）
- [ ] Application Service 层（所有模块）
- [ ] AI Provider 抽象层（MiniMax + OpenAI）
- [ ] 扩展后的数据模型（30 个表）
- [ ] Alembic 迁移脚本
- [ ] 事件总线 + DI 容器
- [ ] 覆盖率报告（50%+）

**Phase 3 交付物**:
- [ ] Agent 基类 + 编排器
- [ ] 7 种 Agent 实现
- [ ] 六维 Checker 重构
- [ ] 三级缓存
- [ ] 大文本外部存储
- [ ] 完整 API（107 端点）
- [ ] 覆盖率报告（70%+）

**Phase 4 交付物**:
- [ ] Agent 执行日志系统
- [ ] 性能监控面板
- [ ] Provider 自动降级
- [ ] 完整 API 文档（OpenAPI）
- [ ] 架构文档更新
- [ ] 发布检查清单

### 11.10 质量门禁

每个 Phase 结束前必须通过以下检查：

| 检查项 | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|--------|---------|---------|---------|---------|
| 代码质量评分 | >= 7/10 | >= 7.5/10 | >= 8/10 | >= 8.5/10 |
| 测试覆盖率 | >= 30% | >= 50% | >= 70% | >= 70% |
| 安全成熟度 | >= 4/5 | >= 4/5 | >= 4.5/5 | >= 5/5 |
| 性能成熟度 | >= 4/5 | >= 4/5 | >= 4.5/5 | >= 5/5 |
| 严重 Bug 数 | 0 | 0 | 0 | 0 |
| API 文档完整度 | >= 50% | >= 70% | >= 90% | 100% |

---

## 12. 风险与缓解措施

### 12.1 技术风险

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| Alembic 迁移失败导致数据丢失 | 中 | 高 | 每次迁移前自动备份；分阶段迁移；迁移后验证 |
| 多 Provider 抽象层引入兼容性 Bug | 中 | 中 | 保留 MiniMax 作为默认；充分 Mock 测试；灰度切换 |
| Agent 编排器复杂度导致性能下降 | 中 | 中 | 并行执行设计；超时控制；降级策略 |
| SQLite 并发瓶颈在极端场景下暴露 | 低 | 中 | WAL 模式；连接池限制；桌面单用户场景下概率极低 |
| 应用层加密影响查询性能 | 中 | 低 | 仅加密敏感字段；索引字段不加密；可切换 SQLCipher |

### 12.2 业务风险

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| AI 生成质量不达用户预期 | 高 | 高 | Context Contract 标准化；反幻觉机制；质量评分反馈 |
| 重构期间引入回归 Bug | 高 | 中 | 测试覆盖率目标 70%+；分阶段重构；每阶段充分测试 |
| 竞品快速跟进差异化功能 | 中 | 中 | 深耕垂直场景；快速迭代；建立用户粘性 |
| 用户数据隐私担忧 | 中 | 高 | 本地存储优先；明确隐私政策；密钥环安全存储 |
| API 供应商（MiniMax）服务变更 | 低 | 高 | 多 Provider 支持；Provider Router 自动降级 |

### 12.3 实施风险

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 工期延误 | 中 | 中 | 分阶段交付；每阶段有独立价值；预留缓冲时间 |
| 团队对分层架构不熟悉 | 中 | 中 | 代码审查；架构文档；示例代码 |
| 测试数据工厂维护成本高 | 低 | 低 | 自动化工厂生成；共享 fixtures |
| 前端与后端接口不同步 | 中 | 中 | OpenAPI 文档驱动；版本控制；联合测试 |

### 12.4 风险矩阵可视化

```
影响
 高 |  [AI质量不达预期]        [数据丢失]
    |       [隐私担忧]          [API供应商变更]
    |
 中 |  [竞品跟进]  [回归Bug]  [工期延误]  [接口不同步]
    |            [架构不熟悉]
    |
 低 |  [SQLite并发]  [加密影响性能]  [测试工厂成本]
    |
    +-------------------------------------------------
      低          中           高         极高
                    可能性
```

### 12.5 应急预案

#### 12.5.1 Alembic 迁移失败应急

**场景**: 迁移脚本执行失败，数据库处于不一致状态。

**应急步骤**:
1. 立即停止应用，防止进一步数据损坏
2. 从自动备份恢复数据库（备份策略：每次迁移前自动备份）
3. 分析迁移失败原因，修复迁移脚本
4. 在测试环境验证修复后的迁移脚本
5. 重新执行迁移

**预防措施**:
- 每次迁移前自动创建 `.backup/writer.db.{timestamp}`
- 迁移脚本在测试数据库上验证通过后再执行生产环境
- 复杂迁移拆分为多个小步骤

#### 12.5.2 AI Provider 故障应急

**场景**: MiniMax API 服务不可用或响应异常。

**应急步骤**:
1. Provider Router 自动检测故障（错误率 > 10% 或超时 > 30s）
2. 自动切换到备选 Provider（OpenAI / Anthropic）
3. 记录故障日志，通知开发团队
4. 主 Provider 恢复后，自动切回（可配置）

**降级策略**:
- 关键任务（章节写作）：必须成功，所有 Provider 都失败时返回友好错误
- 非关键任务（审查）：可延迟执行，队列中等待 Provider 恢复
- 缓存命中：优先返回缓存结果，减少 API 依赖

#### 12.5.3 性能瓶颈应急

**场景**: 某接口响应时间突然增加，影响用户体验。

**应急步骤**:
1. 通过性能监控识别瓶颈（数据库查询 / AI 调用 / 序列化）
2. 数据库瓶颈：添加索引、优化查询、启用缓存
3. AI 调用瓶颈：启用缓存、调整流式缓冲区、降级到轻量模型
4. 序列化瓶颈：减少嵌套序列化、使用延迟加载

**监控指标**:
- API 响应时间 P50/P95/P99
- 数据库查询时间 Top 10
- AI 调用延迟和 Token 消耗
- 缓存命中率

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| **Agent** | 自主执行特定任务的 AI 实体，如 ContextAgent、DataAgent |
| **Checker** | 质量检查器，对内容进行六维度评估 |
| **Context Contract** | 创作执行包的标准化格式，确保 AI 输出一致性 |
| **DraftVersion** | 章节的草稿版本，支持历史回溯 |
| **FTS5** | SQLite 全文搜索扩展 |
| **IF Line** | 配角故事线（If Line），与主线同步发展 |
| **Project** | 作品项目，顶层数据聚合根 |
| **Provider** | AI 服务提供商，如 MiniMax、OpenAI |
| **Repository** | 数据访问层抽象，封装数据库操作 |
| **Service** | 应用服务层，编排业务逻辑 |
| **Strand** | 故事线类型（Quest/Fire/Constellation），用于节奏控制 |
| **WAL** | Write-Ahead Logging，SQLite 的并发优化模式 |

### 13.2 参考文档链接

| 文档 | 路径 | 说明 |
|------|------|------|
| Agent系统与AI工作流设计 | `docs/design/agent-system.md` | Agent 类型、编排模式、六维检查、反幻觉 |
| 参考项目架构分析 | `docs/design/reference-analysis.md` | reference-webnovel 等项目的可复用设计 |
| 代码质量审查报告 | `docs/design/code-review.md` | 现有代码的详细审查与问题清单 |
| 数据模型与数据库架构 | `docs/design/data-model.md` | ER 图、模型设计、迁移策略 |
| 行业功能模块研究 | `docs/design/industry-research.md` | 竞品分析、功能缺口、差异化定位 |
| 安全加固与性能优化 | `docs/design/security-performance.md` | 安全检查清单、性能优化方案 |
| API路由与端点架构 | `docs/design/api-design.md` | 107 个端点、版本策略、错误处理 |
| 服务层与业务逻辑架构 | `docs/design/service-layer.md` | 分层架构、Repository 模式、事件驱动 |
| 测试策略与覆盖方案 | `docs/design/test-strategy.md` | 测试金字塔、fixtures、CI/CD 集成 |

### 13.3 关键代码位置速查

```
认证:          src/backend/middleware/auth.py
限流:          src/backend/middleware/rate_limit.py
配置:          src/backend/config.py
数据库:        src/backend/database.py
CORS:          src/backend/main.py
WebSocket:     src/backend/main.py
模型:          src/backend/models/entities.py
AI服务:        src/backend/services/ai_service.py
缓存:          src/backend/services/cache_service.py
导出导入:      src/backend/services/export_import.py
任务队列:      src/backend/services/task_queue.py
ContextAgent:  src/backend/agents/context_agent.py
DataAgent:     src/backend/agents/data_agent.py
Checkers:      src/backend/agents/checkers/
API客户端:     src/backend/agents/utils.py
```

### 13.4 依赖清单

**生产依赖新增**:
```toml
keyring = "^25.0"          # 系统密钥环
pyzipper = "^0.3"          # AES 加密 ZIP
cryptography = "^42.0"     # 字段加密
```

**开发依赖新增**:
```toml
pytest = "^8.0.0"
pytest-asyncio = "^0.23.0"
pytest-cov = "^4.1.0"
pytest-benchmark = "^4.0.0"
httpx = "^0.27.0"
factory-boy = "^3.3.0"
faker = "^22.0.0"
ruff = "^0.1.0"
mypy = "^1.8.0"
```

### 13.5 决策矩阵汇总

| ADR | 决策 | 状态 |
|-----|------|------|
| ADR-001 | 保持 RESTful，不引入 GraphQL | 已决定 |
| ADR-002 | 引入 Repository + Service 分层 | 已决定 |
| ADR-003 | 多 AI Provider 抽象层 | 已决定 |
| ADR-004 | SQLite 保持为主数据库 | 已决定 |
| ADR-005 | 应用层字段加密（优先于 SQLCipher） | 已决定 |
| ADR-006 | 内存事件总线（无外部 MQ） | 已决定 |
| ADR-007 | Agent 基类+编排器模式 | 已决定 |
| ADR-008 | 测试金字塔 70/25/5 | 已决定 |
| ADR-009 | Project 聚合根 | 已决定 |
| ADR-010 | 采纳 reference-webnovel 核心设计 | 已决定 |
| ADR-011 | 引入 Project 聚合根与多作品支持 | 已决定 |
| ADR-012 | 章节写作流程标准化 | 已决定 |
| ADR-013 | 数据加密采用应用层方案（优先） | 已决定 |
| ADR-014 | 缓存采用三级架构 | 已决定 |
| ADR-015 | 后台任务队列增强 | 已决定 |

### 13.6 核心设计模式汇总

#### 13.6.1 Repository 模式

```python
# repositories/base.py
from typing import TypeVar, Generic, Protocol
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")

class Repository(Protocol, Generic[T]):
    """Repository 接口定义。"""

    async def get_by_id(self, id: int) -> T | None: ...
    async def list(self, skip: int = 0, limit: int = 100) -> list[T]: ...
    async def create(self, data: dict) -> T: ...
    async def update(self, id: int, data: dict) -> T | None: ...
    async def delete(self, id: int) -> bool: ...
```

#### 13.6.2 Service 模式

```python
# application/services/base.py
from abc import ABC

class BaseService(ABC):
    """应用服务基类。"""

    def __init__(self, event_bus: EventBus | None = None):
        self._events = event_bus

    async def _publish(self, event: DomainEvent) -> None:
        if self._events:
            await self._events.publish(event)
```

#### 13.6.3 依赖注入模式

```python
# di.py
from typing import TypeVar, Type

T = TypeVar("T")

class DIContainer:
    """简易依赖注入容器。"""

    def __init__(self):
        self._registrations: dict[type, callable] = {}
        self._singletons: dict[type, object] = {}

    def register(self, interface: type[T], factory: callable, singleton: bool = False):
        self._registrations[interface] = (factory, singleton)

    def resolve(self, interface: type[T]) -> T:
        if interface in self._singletons:
            return self._singletons[interface]

        factory, singleton = self._registrations[interface]
        instance = factory(self)

        if singleton:
            self._singletons[interface] = instance

        return instance

# 注册
container = DIContainer()
container.register(AIProvider, lambda c: MiniMaxProvider(), singleton=True)
container.register(CacheRepository, lambda c: CacheRepository(), singleton=True)
container.register(AIService, lambda c: AIService(
    provider=c.resolve(AIProvider),
    cache_repo=c.resolve(CacheRepository),
))

# 使用
ai_service = container.resolve(AIService)
```

#### 13.6.4 事件驱动模式

```python
# infrastructure/events/event_bus.py
import asyncio
from typing import Callable

class AsyncEventBus:
    """异步内存事件总线。"""

    def __init__(self):
        self._subscribers: dict[str, list[Callable]] = {}
        self._queue: asyncio.Queue = asyncio.Queue()
        self._running = False

    def subscribe(self, event_type: str, handler: Callable):
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)

    async def publish(self, event: DomainEvent):
        await self._queue.put(event)

    async def start(self):
        self._running = True
        while self._running:
            event = await self._queue.get()
            handlers = self._subscribers.get(event.type, [])
            await asyncio.gather(*[h(event) for h in handlers], return_exceptions=True)

    def stop(self):
        self._running = False
```

#### 13.6.5 策略模式（AI Provider）

```python
# infrastructure/ai/providers.py
from typing import Protocol, AsyncIterator

class AIProvider(Protocol):
    """AI Provider 抽象接口。"""

    async def complete(self, prompt: str, temperature: float = 0.7) -> str: ...
    async def stream_generate(self, prompt: str, temperature: float = 0.7) -> AsyncIterator[str]: ...
    async def embed(self, text: str) -> list[float]: ...


class MiniMaxProvider:
    """MiniMax API 实现。"""

    def __init__(self, api_key: str, base_url: str = "https://api.minimax.chat"):
        self.api_key = api_key
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=60.0)

    async def complete(self, prompt: str, temperature: float = 0.7) -> str:
        ...

    async def stream_generate(self, prompt: str, temperature: float = 0.7) -> AsyncIterator[str]:
        ...


class OpenAICompatibleProvider:
    """OpenAI 兼容 API 实现（支持 OpenAI / DeepSeek / 本地模型）。"""

    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=60.0)

    async def complete(self, prompt: str, temperature: float = 0.7) -> str:
        ...

    async def stream_generate(self, prompt: str, temperature: float = 0.7) -> AsyncIterator[str]:
        ...
```

### 13.7 性能基准参考

| 指标 | 当前 | Phase 2 目标 | Phase 4 目标 |
|------|------|-------------|-------------|
| API 响应时间 P50 | ~200ms | ~150ms | ~100ms |
| API 响应时间 P95 | ~2s | ~1s | ~500ms |
| AI 生成首字延迟 | ~3s | ~2s | ~1.5s |
| 数据库查询 P95 | ~100ms | ~50ms | ~30ms |
| 缓存命中率 | ~30% | ~60% | ~80% |
| 并发请求处理 | ~10/s | ~30/s | ~50/s |
| 启动时间 | ~5s | ~3s | ~2s |
| 内存占用 | ~200MB | ~200MB | ~250MB |

### 13.8 行业竞品功能对比

基于 `industry-research.md` 的研究：

| 功能 | Scrivener | 橙瓜码字 | 墨者 | 壹写作 | **我们的目标** |
|------|-----------|----------|------|--------|--------------|
| 本地存储 | 是 | 否 | 否 | 否 | **是** |
| AI 辅助 | 无 | 有 | 有 | 有 | **有（深度）** |
| IF 线支持 | 无 | 无 | 无 | 无 | **有（独创）** |
| 关系图谱 | 无 | 无 | 无 | 无 | **有** |
| 伏笔追踪 | 无 | 无 | 无 | 无 | **有** |
| 人机比例 | 无 | 无 | 无 | 无 | **有（独创）** |
| 版本控制 | Snapshots | 无 | 无 | 无 | **有（增强）** |
| 导出格式 | 多格式 | 有限 | 有限 | 有限 | **JSON/YAML/ZIP** |
| 敏感词检测 | 无 | 有 | 有 | 无 | **有（P2）** |
| 全文搜索 | 有 | 有 | 有 | 有 | **有（FTS5）** |

### 13.9 文档变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-04-21 | 初始版本，综合 9 份子文档 | worker-4 |

### 13.10 待决策事项

| 事项 | 描述 | 建议 | 截止日期 |
|------|------|------|----------|
| ORM 选择 | 是否从 SQLAlchemy 迁移到 Prisma | 保持 SQLAlchemy | Phase 1 |
| 前端状态管理 | Zustand vs Redux vs Jotai | 保持 Zustand | Phase 1 |
| 富文本编辑器 | Tiptap vs BlockNote vs Slate | Tiptap | Phase 2 |
| 关系图谱库 | react-force-graph-3d vs D3 | react-force-graph-3d | Phase 3 |
| 桌面打包方案 | PyInstaller vs Tauri | Tauri（长期） | Phase 4 |

---

> **文档结束**
>
> 本文档由 worker-4 汇总生成，综合了 backend-arch-review 团队 9 名 worker 的研究成果。
> 生成日期: 2026-04-21
> 文档总行数: 目标 2000+ 行
>
> **输入子文档**:
> - `docs/design/agent-system.md` - Agent 系统与 AI 工作流架构
> - `docs/design/reference-analysis.md` - 参考项目架构分析
> - `docs/design/code-review.md` - 代码质量深度审查
> - `docs/design/data-model.md` - 数据模型与数据库架构
> - `docs/design/industry-research.md` - 行业功能模块研究
> - `docs/design/security-performance.md` - 安全加固与性能优化
> - `docs/design/api-design.md` - API 路由与端点架构
> - `docs/design/service-layer.md` - 服务层与业务逻辑架构
> - `docs/design/test-strategy.md` - 测试策略与覆盖方案

> **文档结束**
>
> 本文档由 worker-4 汇总生成，综合了 backend-arch-review 团队 9 名 worker 的研究成果。
> 生成日期: 2026-04-21
