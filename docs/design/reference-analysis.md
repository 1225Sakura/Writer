# 参考项目架构分析与可复用设计提取报告

**分析日期**: 2026-04-21
**分析范围**: `D:\writer\read\` 下所有参考项目
**目标项目**: Auto Novel Writer (我们的实现)
**参考项目**:
- `reference-webnovel` - Claude Code 插件式网文写作系统 (最核心参考)
- `ai-book-writer` - AutoGen 多智能体图书生成系统
- `AI_Novel` - Flask 单文件小说生成工具
- `crewAI-examples` - CrewAI 多智能体框架示例

---

## 一、数据模型设计对比

### 1.1 核心实体关系对比

| 维度 | reference-webnovel | ai-book-writer | AI_Novel | **我们的实现** | 差距分析 |
|------|-------------------|----------------|----------|--------------|---------|
| **项目组织** | Workspace -> 多小说项目 -> 卷/章/设定 | 单项目单本书 | 单项目单本书 (works_library/) | 单项目单本书 (SQLite) | 缺少多项目/多卷支持 |
| **角色模型** | 完整档案 (外貌/性格/动机/冲突) | 基础信息 | 基础信息 | 基础信息 (name/gender/personality) | 缺少角色弧光追踪、详细档案 |
| **关系模型** | 实体关系图谱 + 别名消歧 | 无 | 无 | CharacterRelationship 表 | 缺少别名/消歧系统 |
| **世界观** | 设定集目录 + state.json | World Builder Agent | worldview.md | WorldSetting/Rule/Item/Location | 缺少设定版本控制和继承 |
| **大纲结构** | 总纲 -> 卷纲 -> 章纲 (三级) | 扁平章节列表 | 扁平章节列表 | Outline -> Chapter (两级) | 缺少卷级中间层 |
| **IF线** | 无原生支持 | 无 | 无 | IFLine 表 + sync_mode | 领先参考项目 |
| **伏笔追踪** | plot_threads.foreshadowing (结构化) | 无 | 无 | PlotThread 表 | 结构相似但缺少状态机 |
| **版本控制** | 无 (文件级覆盖) | 无 | 无 | DraftVersion 表 | **显著领先** |
| **状态管理** | state.json + index.db + vectors.db | 内存状态 | 内存状态 | SQLite 统一存储 | 我们的持久化更好，但参考项目的分层索引更专业 |

### 1.2 参考项目可借鉴的数据模型设计

#### A. reference-webnovel 的 `state.json` 结构

```json
{
  "progress": { "current_chapter": 100, "current_volume": 3 },
  "protagonist_state": { "realm": "斗师", "location": "云岚宗" },
  "strand_tracker": { "quest": 58, "fire": 22, "constellation": 20 },
  "chapter_meta": {
    "0099": {
      "hook": { "type": "危机钩", "content": "...", "strength": "strong" },
      "pattern": { "opening": "对话开场", "emotion_rhythm": "低→高" },
      "ending": { "time": "前一夜", "location": "萧炎房间", "emotion": "平静准备" }
    }
  },
  "plot_threads": {
    "foreshadowing": [
      { "content": "三年之约", "planted_chapter": 1, "target_chapter": 100, "status": "active" }
    ]
  }
}
```

**建议采纳**: 将 `chapter_meta` 和 `strand_tracker` 的概念引入我们的 `chapters` 表，新增 JSON 字段存储钩子、节奏模式、结束状态等元数据。

#### B. reference-webnovel 的 `index.db` 实体索引

| 表/概念 | 用途 | 可借鉴度 |
|---------|------|---------|
| 实体表 + 别名表 | 支持"萧炎"/"他"/"萧家小子"指向同一实体 | 高 |
| 状态变化历史 | 追踪角色每次状态变更的时间线 | 高 |
| 关系图谱 | 实体间多维度关系 (enemy/ally/family/...) | 中 (我们已有基础) |
| 债务追踪 (chase_debt) | 追读力债务系统，逾期每章+10%利息 | 高 |
| 章节阅读力 (chapter_reading_power) | 每章的追读力评分和模式统计 | 高 |

**建议采纳**: 新增 `entity_aliases` 表、`state_change_history` 表、`reading_power` 表。

---

## 二、API 设计模式对比

### 2.1 接口风格对比

| 维度 | reference-webnovel | ai-book-writer | **我们的实现** | 评价 |
|------|-------------------|----------------|--------------|------|
| **接口类型** | CLI 命令 + Skill 调用 | Python API (AutoGen) | REST API (FastAPI) | 我们的 Web API 更适合桌面应用 |
| **认证方式** | 无 (本地插件) | 无 | API Key + localhost 跳过 | 合理 |
| **流式输出** | 无 (文件写入) | 无 | WebSocket + SSE | **显著领先** |
| **错误处理** | 脚本级错误码 | 异常抛出 | HTTP 状态码 + 结构化错误 | 标准 |
| **版本控制** | 无 | 无 | 导出/导入 JSON/YAML/ZIP | **显著领先** |

### 2.2 reference-webnovel 的 CLI 命令设计 (可借鉴)

```bash
/webnovel-init              # 初始化项目
/webnovel-plan [卷号]        # 生成卷级规划
/webnovel-write [章号]       # 完整章节创作流程
/webnovel-review [范围]      # 多维质量审查
/webnovel-query [关键词]     # 查询实体/伏笔/节奏
/webnovel-resume            # 断点恢复
/webnovel-dashboard         # 可视化面板
/webnovel-learn [内容]       # 提取写作模式到项目记忆
```

**建议采纳**: 将 CLI 命令映射为 API 端点，例如:
- `POST /api/chapters/{id}/write` -> 触发完整写作流程
- `POST /api/chapters/{id}/review` -> 触发六维审查
- `GET /api/query?keyword=xxx` -> 查询实体/伏笔

### 2.3 请求/响应模式对比

| 模式 | reference-webnovel | 我们的实现 | 建议 |
|------|-------------------|-----------|------|
| 写作请求 | 文件系统操作 | `POST /ai/generate` (流式) | 保持流式，增加"执行包"概念 |
| 审查请求 | 批处理脚本 | `POST /api/chapters/{id}/review` | 支持批量审查范围 (1-5) |
| 上下文获取 | `extract-context --chapter N --format json` | `GET /api/chapters/{id}/context` | 增加创作执行包输出格式 |
| 实体查询 | `index get-core-entities` | `GET /api/characters`, `/api/locations` | 增加模糊搜索和别名解析 |

---

## 三、工作流引擎设计对比

### 3.1 Agent 架构对比

| 项目 | Agent 数量 | 架构模式 | 协作方式 | 可借鉴度 |
|------|-----------|---------|---------|---------|
| **reference-webnovel** | 8 (Context + Data + 6 Checkers) | 双Agent读写 + 六维并行审查 | 文件系统 + state.json 状态共享 | 极高 |
| **ai-book-writer** | 7 (Planner + WorldBuilder + Writer + Editor + MemoryKeeper + OutlineCreator + UserProxy) | AutoGen GroupChat | 群聊对话轮询 | 中 |
| **AI_Novel** | 0 (单流程脚本) | 无Agent | 顺序执行 | 低 |
| **crewAI-examples** | 2-4/项目 | CrewAI Task 分配 | 角色+任务+工具 | 中 |
| **我们的实现** | 8 (Context + Data + 6 Checkers) | 独立类，API调用 | 数据库状态共享 | 高 |

### 3.2 reference-webnovel 的核心工作流 (强烈推荐借鉴)

```
/webnovel-write 100 的完整流程:

Step -1: CLI 入口校验
Step 0:  ContextManager 快照优先 (复用缓存)
Step 0.5: Context Contract 提取 (内置 Step 1.5)
Step 0.6: 时间线读取 (卷级时间线表)
Step 1:  读取大纲与状态
Step 2:  追读力与债务分析
Step 3:  实体与伏笔读取
Step 4:  摘要与推断补全
Step 5:  组装创作执行包
Step 6:  逻辑红线校验 (6条红线)
        -> 通过 -> Step 2A 直写
        -> 失败 -> 回到 Step 5 重组

写作后 (Data Agent):
Step A: 加载上下文
Step B: AI 实体提取
Step C: 实体消歧 (置信度策略)
Step D: 写入 index.db + state.json
Step E: 生成章节摘要文件
Step F: AI 场景切片
Step G: RAG 向量索引
Step H: 风格样本评估 (score>=80)
Step I: 债务利息计算
Step J: 生成处理报告 (含性能日志)
```

**关键可复用设计**:

1. **Context Contract (上下文契约)**: 将创作执行包标准化为 8 个板块，确保 AI 输出一致性
2. **六维并行审查**: Consistency / Pacing / OOC / Continuity / HighPoint / ReaderPull
3. **逻辑红线校验**: 6 条硬规则防止 AI 幻觉
4. **置信度策略**: 实体消歧的分级处理 (>0.8 自动采用, 0.5-0.8 记录warning, <0.5 人工确认)
5. **性能观测**: 每个步骤记录耗时，自动识别瓶颈

### 3.3 我们的 Agent 实现 vs 参考项目的差距

| 能力 | reference-webnovel | 我们的实现 | 差距 |
|------|-------------------|-----------|------|
| ContextAgent 输出 | 8板块完整执行包 | 基础上下文组装 | 缺少时间约束、追读力策略、红线校验 |
| DataAgent 消歧 | 置信度分级 + 别名系统 | 简单实体匹配 | 缺少别名消歧、置信度评估 |
| Checker 触发 | 写作后自动 + 用户手动 | API 手动调用 | 缺少自动触发机制 |
| 审查报告聚合 | 六维综合评分 | 单维度独立调用 | 缺少综合质量报告 |
| 债务追踪 | chase_debt 利息系统 | 无 | 完全缺失 |
| RAG 检索 | vector + bm25 + hybrid + graph_hybrid | 无 | 完全缺失 |

---

## 四、版本控制策略对比

| 维度 | reference-webnovel | ai-book-writer | **我们的实现** |
|------|-------------------|----------------|--------------|
| **正文版本** | 文件覆盖 (无版本) | 文件覆盖 | DraftVersion 表 (版本号) |
| **大纲版本** | 文件覆盖 | 文件覆盖 | 无独立版本 |
| **设定版本** | 文件覆盖 | 无 | 无 |
| **导出格式** | 无 | 无 | JSON / YAML / ZIP |
| **增量导出** | 无 | 无 | 支持 (since 参数) |
| **冲突处理** | 无 | 无 | 基础冲突检测 |

**建议**:
1. 为 Outline、WorldSetting 增加版本历史表
2. 参考 `reference-webnovel` 的 `.webnovel/` 目录结构，在导出 ZIP 中保留摘要、向量索引等衍生数据
3. 增加"快照"概念，支持回滚到任意写作状态

---

## 五、导出导入方案对比

### 5.1 现有实现对比

| 功能 | reference-webnovel | **我们的实现** |
|------|-------------------|--------------|
| 导出格式 | 无原生导出 | JSON / YAML / ZIP |
| 导入验证 | 无 | JSON Schema 验证 |
| 导入模式 | 无 | merge / replace / skip |
| 冲突检测 | 无 | 基础冲突报告 |
| 跨项目迁移 | 手动复制目录 | 通过导出/导入实现 |

### 5.2 建议增强 (参考 reference-webnovel 的项目结构)

reference-webnovel 的项目目录结构:
```
project-root/
├── .webnovel/            # 运行时数据
│   ├── state.json        # 进度、配置、节奏追踪
│   ├── index.db          # 实体、别名、关系、状态变化
│   ├── vectors.db        # RAG 向量
│   ├── summaries/        # 章节摘要
│   └── observability/    # 性能日志
├── 正文/                  # 正文章节 (Markdown)
├── 大纲/                  # 总纲与卷纲
└── 设定集/                # 世界观、角色、力量体系
```

**建议采纳**: 在 ZIP 导出中增加 `.webnovel/` 元数据目录，包含:
- `chapter_meta.json` - 每章的钩子、模式、结束状态
- `reading_power.jsonl` - 追读力历史数据
- `style_samples.json` - 风格样本库

---

## 六、协作/并发模型对比

| 维度 | reference-webnovel | ai-book-writer | **我们的实现** |
|------|-------------------|----------------|--------------|
| **并发模型** | 单用户 (Claude Code 会话) | 单用户 | 单用户桌面应用 |
| **多设备同步** | 无 | 无 | 无 (本地 SQLite) |
| **WebSocket** | 无 | 无 | 有 (心跳、队列、限流) |
| **任务队列** | 无 | 无 | 有 (TaskQueueService) |
| **人机比例** | 无 | 无 | 滑块控制 (0-100%) |

**我们的优势**:
- WebSocket 实时通信 (带心跳、断线重连、消息队列)
- 任务队列支持异步 AI 操作
- 人机比例实时调节

**建议增强**:
- 参考 `reference-webnovel` 的 Strand Weave 节奏系统，将人机比例与故事线类型关联
- 增加"协作模式"概念: 主线(人主导) vs IF线(AI主导) 的不同比例策略

---

## 七、RAG 与检索架构对比

| 维度 | reference-webnovel | **我们的实现** |
|------|-------------------|--------------|
| **Embedding** | Qwen3-Embedding-8B | 无 |
| **Reranker** | jina-reranker-v3 | 无 |
| **检索策略** | auto / vector / bm25 / hybrid / graph_hybrid | 无 |
| **索引内容** | 章节摘要 + 场景切片 + 向量 | 无 |
| **父子索引** | summary(父) -> scene(子) | 无 |

**建议采纳**:
1. 引入 Embedding 模型 (可选本地轻量模型如 bge-small-zh)
2. 实现章节摘要的自动向量化
3. 支持基于内容的相似章节检索
4. 为设定审查提供 RAG 辅助 (自动召回相关设定)

---

## 八、可观测性与日志对比

| 维度 | reference-webnovel | **我们的实现** |
|------|-------------------|--------------|
| **性能日志** | data_agent_timing.jsonl + call_trace.jsonl | 慢请求日志 (>1s) |
| **分步耗时** | A-J 每个步骤的毫秒级记录 | 无 |
| **瓶颈识别** | 自动 Top3 瓶颈分析 | 无 |
| **结构化日志** | 无 | 有 (JSON/文本可选) |
| **模块级日志** | 无 | 有 (按模块配置级别) |

**建议采纳**:
1. 为 Agent 操作增加分步耗时记录
2. 增加 Agent 执行追踪 (类似 call_trace.jsonl)
3. 在审查报告中包含性能指标

---

## 九、建议采纳清单 (按优先级排序)

### P0 - 核心架构改进 (必须)

| # | 建议 | 来源 | 影响范围 | 工作量 |
|---|------|------|---------|--------|
| 1 | **Context Contract 标准化**: 将 ContextAgent 输出规范为 8 板块执行包 | reference-webnovel | `agents/context_agent.py` | 中 |
| 2 | **六维审查自动触发**: 写作完成后自动触发六维 Checker | reference-webnovel | `routes/ai.py`, `services/ai_service.py` | 中 |
| 3 | **逻辑红线校验**: 在 ContextAgent 输出前增加 6 条红线校验 | reference-webnovel | `agents/context_agent.py` | 中 |
| 4 | **章节元数据增强**: chapters 表增加 hooks/patterns/ending JSON 字段 | reference-webnovel | `models/entities.py`, `schema.sql` | 小 |
| 5 | **实体别名系统**: 新增 entity_aliases 表，支持消歧 | reference-webnovel | `models/entities.py`, `agents/data_agent.py` | 中 |

### P1 - 重要功能增强 (推荐)

| # | 建议 | 来源 | 影响范围 | 工作量 |
|---|------|------|---------|--------|
| 6 | **卷级大纲结构**: Outline 增加 volume 层级 | reference-webnovel | `models/entities.py`, `schema.sql` | 中 |
| 7 | **追读力债务系统**: 新增 chase_debt 表和利息计算 | reference-webnovel | 新增模型 + 服务 | 中 |
| 8 | **章节摘要文件**: 每章生成 `.webnovel/summaries/ch{NNNN}.md` | reference-webnovel | `services/`, `routes/` | 小 |
| 9 | **状态变化历史**: 新增 state_change_history 表 | reference-webnovel | `models/entities.py` | 小 |
| 10 | **RAG 基础框架**: 引入轻量 Embedding，章节摘要向量化 | reference-webnovel | 新增服务 | 大 |
| 11 | **写作流程 API**: `POST /api/chapters/{id}/write` 完整流程端点 | reference-webnovel CLI | `routes/chapters.py` | 中 |

### P2 - 优化与增强 (可选)

| # | 建议 | 来源 | 影响范围 | 工作量 |
|---|------|------|---------|--------|
| 12 | **Agent 性能观测**: 分步耗时记录和瓶颈分析 | reference-webnovel | `agents/utils.py` | 小 |
| 13 | **风格样本库**: score>=80 的章节提取风格样本 | reference-webnovel | `services/ai_service.py` | 中 |
| 14 | **项目记忆系统**: `.webnovel/project_memory.json` 存储写作模式 | reference-webnovel | 新增服务 | 中 |
| 15 | **导出增强**: ZIP 包含 `.webnovel/` 元数据目录 | reference-webnovel | `services/export_import.py` | 小 |
| 16 | **时间线约束**: 卷级时间线表和章节时间锚点 | reference-webnovel | `models/entities.py` | 小 |

### P3 - 长期规划 (未来)

| # | 建议 | 来源 | 影响范围 |
|---|------|------|---------|
| 17 | **多项目支持**: Workspace -> 多小说项目 | reference-webnovel | 架构级变更 |
| 18 | **本地 Embedding 模型**: 完全离线的 RAG 检索 | reference-webnovel | 模型集成 |
| 19 | **CrewAI 集成**: 可选的 CrewAI 工作流引擎 | crewAI-examples | Agent 层 |
| 20 | **可视化 Dashboard**: 只读项目状态面板 | reference-webnovel | 前端 |

---

## 十、总结

### 我们的优势
1. **现代 Web 架构**: FastAPI + SQLAlchemy + WebSocket，适合桌面应用封装
2. **版本控制**: DraftVersion 表实现正文版本管理
3. **导出导入**: JSON/YAML/ZIP 多格式支持
4. **流式输出**: WebSocket 实时 AI 生成体验
5. **IF线支持**: 原生 IFLine 表，领先所有参考项目

### 主要差距
1. **Agent 工作流深度**: reference-webnovel 的 Context Contract、红线校验、债务追踪等概念非常成熟
2. **数据闭环**: reference-webnovel 的 Data Agent 实现了从正文提取 -> 消歧 -> 索引 -> 向量的完整闭环
3. **RAG 检索**: 完全缺失，reference-webnovel 的 hybrid 检索策略值得借鉴
4. **项目结构**: 缺少 `.webnovel/` 元数据目录的多层数据组织

### 最关键的三项改进
1. **引入 Context Contract**: 将 AI 写作上下文标准化，大幅提升生成质量一致性
2. **完善 Data Agent 闭环**: 实现实体提取 -> 消歧 -> 持久化 -> 索引的完整数据流
3. **增加追读力系统**: 债务追踪和章节阅读力评估，这是网文写作的核心竞争力
