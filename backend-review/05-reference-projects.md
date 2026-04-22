# 参考项目与最佳实践分析

> 搜索日期: 2026-04-22
> 任务: #5 搜索参考项目和最佳实践

---

## 一、AI 写作/网文生成开源项目

### 1. novelWriter
- **GitHub**: https://github.com/nicholawh/novelwriter
- **Stars**: ~1.6k
- **技术栈**: Python + PyQt5
- **平台**: Windows / macOS / Linux
- **主要功能**: 开源纯文本编辑器，专为小说写作设计，支持 Markdown-like 语法，项目/章节结构管理
- **架构亮点**: 纯本地桌面应用，数据结构化存储，适合作为富文本编辑器的参考

### 2. novel (phoenicxai)
- **GitHub**: https://github.com/phoenicxai/novel
- **技术栈**: Go + TypeScript (turbo monorepo)
- **主要功能**: Notion 风格的 WYSIWYG 编辑器，AI 自动补全
- **架构亮点**: Go 后端 + TypeScript 前端，monorepo 结构，AI 编辑器集成

### 3. AI-writer (AI小说生成器)
- **技术栈**: Python
- **主要功能**: 输入开头文字进行 AI 续写，支持言情/玄幻等网文风格
- **局限性**: 训练数据来自网文，缺乏生活常识

### 4. 彩云小梦
- **平台**: Web
- **主要功能**: 只需提供开头，AI 自动续写故事
- **特点**: 专注中文语境，适合中文网络小说创作

### 5. DS-AI / Ai-Assistant
- **GitHub**: https://github.com/jiqi136/DS-AI
- **技术栈**: Go
- **主要功能**: 小说写作 + AI 编程助手，集成多模型 API 路由 (Gemini, Claude, GPT, Grok)
- **架构亮点**: 多模型适配系统，向量数据库 (ChromaDB) 知识检索，内置雪花写作法等创作框架

### 6. 笔灵 AI (ibiling)
- **平台**: Web (ibiling.cn)
- **主要功能**: AI 小说生成器、小说拆书、小说大纲、小说素材库
- **特点**: 基于千亿参数 DeepSeek 大模型，200+ 写作场景

---

## 二、FastAPI 后端架构最佳实践

### 1. fastapi-best-architecture
- **GitHub**: https://github.com/fastapi-practices/fastapi_best_architecture
- **Stars**: 高活跃度
- **Commit**: 800+
- **技术栈**: FastAPI + SQLAlchemy + Celery + Pydantic + Grafana + Docker
- **核心模块**:
  - 分层架构: 路由层 / 服务层 / 数据访问层 / 模型层
  - JWT 双令牌认证 (access + refresh)
  - RBAC 权限控制 (基于 Casbin)
  - Celery 异步任务队列
  - MsgSpecJSONResponse 高性能序列化
  - 插件化路由 (API Router v1)
- **架构亮点**:
  - 完整的企业级后端模板，开箱即用
  - Docker 部署支持
  - 完整的日志和监控集成
  - pre-commit 配置规范代码风格

### 2. FastAPI Best Architecture UI
- **GitHub**: https://github.com/fastapi-practices/fba_ui
- **技术栈**: Vue 3 + Ant Design Vue Next + Vben Admin
- **用途**: fastapi-best-architecture 的配套前端

### 架构设计模式总结:
```
API Layer (Routers)
    ↓
Service Layer (Business Logic)
    ↓
Repository Layer (Data Access)
    ↓
Database (SQLAlchemy ORM)
    ↓
Async Tasks (Celery + Redis)
```

---

## 三、Multi-Agent 多智能体系统框架

### 1. MetaGPT
- **GitHub**: https://github.com/geekan/MetaGPT
- **Stars**: 11k+
- **Commit**: 非常活跃
- **核心思想**: `Code = SOP(Team)` — 将 SOP (标准操作程序) 编码到 Agent 协作流程中
- **角色分配**:
  - Product Manager (产品经理)
  - Architect (架构师)
  - Project Manager (项目经理)
  - Engineer (工程师)
- **工作流程**: 输入一行需求 → 输出 PRD / 设计 / 任务列表 / 代码
- **架构亮点**:
  - 多 Agent 角色扮演 + SOP 流程化协同
  - 模拟软件开发公司完整流程
  - 支持自定义 Agent 角色和工具
  - 每个 Agent 有独立记忆和状态管理
- **对本项目的启示**:
  - 写作流程可定义 SOP: 初始化对话 → 设定审查 → 大纲生成 → 正文生成 → 校对
  - 每个 Agent 可扮演不同写作角色 (世界观构建者、角色设计师、文风编辑等)

### 2. CrewAI
- **GitHub**: https://github.com/joaomdmoura/crewai/
- **Commit**: 2,187+
- **核心概念**:
  - **Agent**: 拥有角色、目标和工具的智能体
  - **Task**: 具体任务描述，可分配给 Agent
  - **Crew**: Agent 团队，支持顺序/并行执行
  - **Process**: 流程编排模式 (默认 Manager / 也可自定义)
  - **Memory**: Agent 记忆系统，跨对话保持上下文
  - **Knowledge**: 知识库集成
- **架构亮点**:
  - 内置防护机制 (Guardrails)
  - 支持异步执行
  - 任务依赖管理
  - 回调机制 (Callbacks)
- **对本项目的启示**:
  - IF 线同步写作可借鉴 Crew 的流程编排
  - Agent 记忆系统对长篇小说的上下文管理很有价值

### 3. AutoGen (Microsoft)
- **GitHub**: 微软开源
- **特点**: 专为软件工程设计的多 Agent 协作框架
- **核心组件**: User-Agent + Assistant-Agent 双 Agent 模式

### 4. Multi-Agent 系统设计模式总结

| 模式 | 描述 | 适用场景 |
|------|------|----------|
| 层级式 (Hierarchical) | 一个 Orchestrator 负责任务分解和分配 | 复杂长篇创作流程 |
| 去中心式 (Decentralized) | Agent 之间对等通信，自组织协作 | 开放式创意写作 |
| 流水线式 (Pipeline) | 任务按阶段顺序通过不同 Agent | 编辑审稿流程 |
| 混合式 (Hybrid) | 结合层级和去中心化 | 本项目的多界面架构 |

---

## 四、中文网文工具生态

| 工具 | 类型 | 特点 |
|------|------|------|
| 笔灵 AI | 商业 SaaS | 200+ 场景，小说/论文/文案 |
| 写作猫 (秘塔) | 商业 SaaS | 智能续写、纠错、润色 |
| 彩云小梦 | 商业 SaaS | 故事续写，专注中文 |
| WriteWise | 喜马拉雅旗下 | 网文一站式创作工具 |
| Effidit (腾讯) | 商业 SaaS | 智能纠错、补全、润色 |
| 优采云 | 开源 | AI 文章生成，支持多语言 |

---

## 五、架构启示与建议

### 5.1 推荐的多 Agent 架构 (基于 MetaGPT/CrewAI 模式)

```
Orchestrator (主编 Agent)
    ├── 世界观构建 Agent
    ├── 角色设定 Agent
    ├── 大纲生成 Agent
    ├── 正文章节 Agent (可并行)
    │     ├── 主线章节 Agent
    │     └── IF 线章节 Agent
    ├── 审查校对 Agent
    └── 文风润色 Agent
```

### 5.2 FastAPI 最佳架构建议

1. **路由分组**: 按功能模块 `/api/v1/agents`, `/api/v1/chat`, `/api/v1/workflow`
2. **服务层**: 业务逻辑独立，依赖注入
3. **Celery 集成**: AI 生成等长时间任务异步处理
4. **Pydantic v2**: 请求/响应数据验证
5. **JWT 双令牌**: 安全的认证机制
6. **MsgSpec JSON**: 高性能序列化响应

### 5.3 写作工具特殊性设计

1. **长文本上下文管理**: 需要特殊的上下文窗口策略 (分段加载、压缩等)
2. **人机协作状态机**:  draft → AI_continue → user_review → confirm → next
3. **IF 线隔离**: 每个 IF 线独立 Agent 上下文，避免相互干扰
4. **写作风格迁移**:江南体/卡夫卡体等文风需要风格模板系统

---

## 六、参考链接汇总

### 开源项目
- novelWriter: https://github.com/nicholawh/novelWriter
- novel (phoenicxai): https://github.com/phoenicxai/novel
- DS-AI: https://github.com/jiqi136/DS-AI
- fastapi-best-architecture: https://github.com/fastapi-practices/fastapi_best_architecture
- MetaGPT: https://github.com/geekan/MetaGPT
- CrewAI: https://github.com/joaomdmoura/crewai/

### 工具
- 笔灵 AI: https://ibiling.cn
- 彩云小梦: https://www.caiyunai.com
- 写作猫: https://xiezuocat.com
- CrewAI 中文文档: https://docs.crewai.org.cn/
