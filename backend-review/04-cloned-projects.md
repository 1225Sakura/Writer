# 克隆参考项目列表

> 完成日期: 2026-04-22
> 任务: #4 克隆参考项目到本地

---

## 已克隆项目总览

| 项目 | 路径 | Stars | 状态 |
|------|------|-------|------|
| MetaGPT | `D:/writer/read/MetaGPT` | 11k+ | 成功 |
| CrewAI | `D:/writer/read/crewai` | 2k+ commits | 成功 |
| fastapi-best-architecture | `D:/writer/read/fastapi_best_architecture` | 高活跃 | 成功 |
| DS-AI | `D:/writer/read/DS-AI` | - | 成功 |
| novelWriter | - | 1.6k | **失败** (仓库不存在) |

---

## 1. MetaGPT — 多Agent框架

**路径**: `D:/writer/read/MetaGPT`

**架构特点**:
- **核心思想**: `Code = SOP(Team)` — 将标准操作程序编码到 Agent 协作流程
- **角色系统**: Product Manager / Architect / Project Manager / Engineer 分工明确
- **多Agent协作**: 基于 SOP 的层级式协作，每个 Agent 有独立记忆和状态
- **输入输出**: 输入需求 → 输出 PRD / 设计 / 任务列表 / 代码

**关键模块**:
```
metaGPT/
├── metagpt/          # 核心框架
│   ├── agents/       # Agent 实现
│   ├── prompts/     # 提示词模板
│   ├── memory/      # 记忆系统
│   └── skills/      # 技能系统
├── examples/         # 示例
└── tests/            # 测试
```

**对本项目的启示**:
- 写作流程可定义 SOP: 初始化对话 → 设定审查 → 大纲生成 → 正文生成 → 校对
- 每个 Agent 可扮演不同写作角色 (世界观构建者、角色设计师、文风编辑等)

---

## 2. CrewAI — Agent编排框架

**路径**: `D:/writer/read/crewai`

**架构特点**:
- **核心概念**: Agent (角色+目标+工具) / Task (任务) / Crew (团队) / Process (流程)
- **流程编排**: 支持顺序/并行执行，默认 Manager 模式
- **记忆系统**: Agent Memory 跨对话保持上下文
- **知识库**: 内置 Knowledge 集成
- **安全机制**: 内置 Guardrails 防护

**关键模块**:
```
crewai/
├── crewai/           # 核心框架
│   ├── agent.py      # Agent 定义
│   ├── task.py       # Task 定义
│   ├── crew.py       # Crew 编排
│   └── process.py    # 流程模式
└── examples/         # 示例
```

**对本项目的启示**:
- IF 线同步写作可借鉴 Crew 的流程编排
- Agent 记忆系统对长篇小说的上下文管理很有价值

---

## 3. fastapi-best-architecture — FastAPI最佳架构

**路径**: `D:/writer/read/fastapi_best_architecture`

**架构特点**:
- **分层架构**: Router → Service → Repository → Model
- **认证**: JWT 双令牌 (access + refresh)
- **权限**: RBAC 基于 Casbin
- **异步任务**: Celery + Redis
- **高性能**: MsgSpecJSONResponse 序列化

**关键模块**:
```
fastapi_best_architecture/
├── backend/          # 后端应用
│   ├── api/          # 路由层 (routers/)
│   ├── service/      # 服务层
│   ├── repository/   # 数据访问层
│   ├── models/       # SQLAlchemy 模型
│   ├── schemas/      # Pydantic schemas
│   └── core/         # 核心配置
├── celery_worker/    # Celery 异步任务
└── docker/           # Docker 配置
```

**对本项目的启示**:
- 路由分组: `/api/v1/agents`, `/api/v1/chat`, `/api/v1/workflow`
- 服务层独立，依赖注入
- AI 生成等长时间任务用 Celery 异步处理

---

## 4. DS-AI — 多模型路由+知识检索

**路径**: `D:/writer/read/DS-AI`

**架构特点**:
- **多模型适配**: 统一接口调用 Gemini / Claude / GPT / Grok
- **向量检索**: 内置 ChromaDB 知识库
- **写作框架**: 集成雪花写作法等中文创作框架
- **技术栈**: Go + 向量数据库

**关键模块**:
```
DS-AI/
├── core/             # 核心 (多模型路由)
├── knowledge/         # 知识库 (ChromaDB)
├── prompts/          # 提示词模板
└── scripts/          # 工具脚本
```

**对本项目的启示**:
- 多模型路由可避免单模型限制
- ChromaDB 用于设定/角色/大纲的知识检索

---

## 5. novelWriter — 克隆失败

**状态**: 仓库不存在 (`nicholawh/novelWriter`)

**备选方案**: `novelWriter` 原仓库可能已更名或私有，建议手动搜索确认正确地址。

---

## 架构对比总结

| 维度 | MetaGPT | CrewAI | fastapi-best-arch | DS-AI |
|------|---------|--------|-------------------|-------|
| **Agent协作** | SOP驱动层级式 | 流程编排(顺序/并行) | 不适用 | 多模型路由 |
| **分层架构** | 无 | 无 | Router/Service/Repo/Model | 无 |
| **记忆系统** | 有 | 有(Memory+Knowledge) | 无 | 有 |
| **适用场景** | 复杂多角色协作 | 任务导向团队 | 企业级API服务 | 知识检索+AI写作 |

---

## 参考链接

- MetaGPT: https://github.com/geekan/MetaGPT
- CrewAI: https://github.com/joaomdmoura/crewai/
- fastapi-best-architecture: https://github.com/fastapi-practices/fastapi_best_architecture
- DS-AI: https://github.com/jiqi136/DS-AI
