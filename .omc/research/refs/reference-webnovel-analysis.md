# Reference: reference-webnovel 分析报告

> 来源：explore-webnovel agent (D:/writer/read/reference-webnovel/)
> 日期：2026-07-09
> 用途：D-5 (多智能体) + D-6 (高级功能) 实施时参考
> 注意：GPL v3 协议，**只能借鉴设计、不能复制代码**

## 项目定位

| 项 | 值 |
|---|---|
| 类型 | Claude Code **插件**（非独立应用）|
| 场景 | 长篇网文（2000-2500 字/章 × N 章）|
| Python | ≥3.10 |
| 后端 | CLI（Python）+ Dashboard（FastAPI）|
| 数据库 | SQLite（index.db + vectors.db）+ JSON（state.json < 5KB）|
| AI | Claude（Task 子代理）+ 任意 OpenAI 兼容 embedding/rerank |
| 前端 | React 19 + Vite 6 + react-force-graph-3d |
| 协议 | GPL v3 |

## 核心架构

```
Claude Code 会话
  ↓
Skills (7 个斜杠命令) — init / plan / write / review / query / resume / dashboard / learn
  ↓
Agents (8 个) — Context / Data / 6 个 Checker
  ↓
Data Layer: state.json (热配置) + index.db (关系) + vectors.db (RAG)
```

## 8 个 Agent

| Agent | 工具 | 职责 |
|---|---|---|
| context-agent | Read, Grep, Bash | 写作前生成 8 板块任务书 + Context Contract |
| data-agent | Read, Write, Bash | 实体提取、场景切片、向量索引、摘要 |
| consistency-checker | Read, Grep, Bash | 设定一致性 |
| continuity-checker | Read, Grep | 场景与叙事连贯性 |
| ooc-checker | Read, Grep | 人物行为是否偏离人设 |
| pacing-checker | Read, Grep, Bash | Strand 比例（Quest/Fire/Constellation）|
| high-point-checker | Read, Grep, Bash | 爽点密度与质量 |
| reader-pull-checker | Read, Grep, Bash | 钩子强度、期待管理、追读力 |

## 7 个 Skill 触发词

- `/webnovel-init` - 深度初始化
- `/webnovel-plan N` - 规划大纲
- `/webnovel-write N` - **核心工作流**（Step 1→2A→2B→3→4→5→6）
- `/webnovel-review N-M` - 多 Checker 并行审查
- `/webnovel-query <keyword>` - 查询
- `/webnovel-resume` - 中断恢复
- `/webnovel-dashboard` - 启动 Dashboard
- `/webnovel-learn <text>` - 提取学习模式

## 数据模型分层

| 文件 | 大小 | 内容 |
|---|---|---|
| state.json | < 5KB | 进度、主角状态、strand_tracker、chapter_meta |
| index.db | 数千章 | 实体/关系/章节/场景/审查/债务 |
| vectors.db | 章节级 | RAG 向量 + BM25 + doc_stats |

## 关键 schema

- `entities` (id, type, canonical_name, tier, current_json)
- `aliases` (alias, entity_id) — 一对多别名
- `state_changes` (entity_id, field, old/new, reason, chapter)
- `relationships` (from/to/type/description/chapter)
- `relationship_events` (v5.5 时序回放)
- `override_contracts` (v5.3 约束合约)
- `chase_debt` (债务追踪，含利率)
- `chapter_reading_power` (钩子类型/强度/过渡章/债务余额)
- `invalid_facts` (v5.4 无效事实)
- `review_metrics` (多维度评分)
- `writing_checklist_scores`

## 双 Agent 核心循环

```
大纲 → Context Agent 召回 → 写作 → Data Agent 落库 → 下章 Context Agent 再读
```

## 13 条可借鉴点

1. **"防幻觉三定律"**：大纲即法律 + 设定即物理 + 发明需识别 → 我们 checklist agent
2. **双 Agent 架构**（Context 读 / Data 写）→ 我们已有 orchestrator，但可拆独立"实体提取 Agent"
3. **Step 硬约束模式**（禁止并步/跳步/自审/临时改名）→ 我们 prompt-based agent 可学
4. **8 板块任务书 + Context Contract 直写包** → 我们写作前上下文打包
5. **Strand Weave 节奏系统**（Quest 60% / Fire 20% / Constellation 20%）→ 我们 strand_tracker
6. **爽点 6 种执行模式 + 30/40/30 结构** → cool-points
7. **钩子 6 类型 × 强度 3 级** → chapter_meta.hook
8. **追读力债务模型**（override_contracts + chase_debt + 利息累积）→ v2 增强
9. **数据存储分层**（state.json < 5KB + index.db + vectors.db）→ 我们也分层
10. **置信度三级消歧**（>0.8 自动 / 0.5-0.8 警告 / <0.5 人工）→ 我们实体提取
11. **workflow 断点记录** → 我们 v2 加中断恢复
12. **Prompt 分级加载**（L0/L1/L2/L3 lazy load）→ 节省 token
13. **只读 Dashboard + Watchdog + SSE 实时推送** → v2 可视化

## 5 个特别优雅实现

1. **父子块索引 + BM25 fallback**（vectors.db 同时存 vectors + bm25_index + doc_stats，schema v2）
2. **data_agent_timing.jsonl** 自动记录子步骤耗时（>30s 必须输出 top-3 瓶颈）
3. **webnovel.py 入口仅转发**（sys.path.insert + 转发到 data_modules.webnovel.main）
4. **path_guard.safe_resolve**（防路径穿越 + 白名单限定）
5. **Step 0 预检闸门**（硬门槛失败立即阻断）
6. **state.json < 5KB**（配置走 JSON，主数据走 SQLite）

## 不适合/慎用

- **GPL v3 协议**：传染性，**禁止 fork，只能借鉴设计**
- **Claude Code 插件形态**：我们是 Electron 桌面应用，斜杠命令需翻译成 GUI
- **章节硬目标 2000-2500 字**：可配置化（番茄 1500-2000、起点 3000+）
- **RAG 用第三方嵌入 API**：我们需可切换 + 离线降级到 BM25

## 对我们的实施建议

| 我们的阶段 | 可借鉴点 |
|-----------|----------|
| D-1 数据层 | 数据存储分层（state.json < 5KB + SQLite + 后续可加 vectors.db）|
| D-4 AI 层 | 置信度三级消歧 |
| D-5 多智能体 | 双 Agent 架构、Step 硬约束、8 个 Agent 列表 |
| D-6 高级功能 | 爽点 6 模式、钩子 6×3、Strand 节奏、追读力债务、Context Contract |
| D-7 运维 | Watchdog + SSE 实时事件流、metrics |
| V1.1 未来 | 断点恢复、Prompt 分级加载、只读 Dashboard |

## 实施时引用

写到 D-5 / D-6 的 worker prompt 时引用本文档作为参考。
