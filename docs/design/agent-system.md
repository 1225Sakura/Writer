# Agent 系统与 AI 工作流架构设计文档

> 版本: v1.0  
> 日期: 2026-04-21  
> 项目: Auto Novel Writer（自动化写作软件）  
> 技术栈: Python FastAPI + React 18 + SQLite + MiniMax API（可扩展）

---

## 目录

1. [设计目标与核心原则](#1-设计目标与核心原则)
2. [总体架构](#2-总体架构)
3. [Agent 类型与职责](#3-agent-类型与职责)
4. [Agent 协作工作流（编排模式）](#4-agent-协作工作流编排模式)
5. [六维检查深度实现](#5-六维检查深度实现)
6. [Strand Weave 节奏控制集成](#6-strand-weave-节奏控制集成)
7. [反幻觉机制](#7-反幻觉机制)
8. [多 AI Provider 支持架构](#8-多-ai-provider-支持架构)
9. [Agent 配置系统](#9-agent-配置系统)
10. [数据流与状态管理](#10-数据流与状态管理)
11. [接口设计](#11-接口设计)
12. [实施路线图](#12-实施路线图)

---

## 1. 设计目标与核心原则

### 1.1 设计目标

- **可扩展性**: 新增 Agent 类型无需修改核心编排逻辑
- **可配置性**: 按题材/流派/作者偏好灵活配置 Agent 行为
- **可观测性**: 完整的 Agent 执行日志、决策链路追踪
- **可靠性**: 反幻觉机制确保 AI 输出不偏离设定
- **性能**: 并行执行、结果缓存、智能降级

### 1.2 核心原则

| 原则 | 说明 |
|------|------|
| **大纲即法律** | ContextAgent 强制加载章节大纲，AI 不得擅自偏离 |
| **设定即物理** | ConsistencyChecker 实时校验，违反设定的内容必须标记 |
| **发明需识别** | DataAgent 自动提取新实体，入库前需消歧与确认 |
| ** Strand 红线** | Quest/Fire/Constellation 比例与断档必须受控 |
| **人机协作** | AI 辅助而非替代，人机比例实时可调 |

---

## 2. 总体架构

### 2.1 架构全景图

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              前端 (React 18)                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ 界面1: 聊天  │  │ 界面2: 设定  │  │ 界面3: 写作  │  │ 检查面板 / 报告     │ │
│  │ 初始化      │  │ 编辑器      │  │ 编辑器      │  │                     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         └─────────────────┴─────────────────┘                    │            │
│                              │                                   │            │
│                    Zustand 状态管理                              │            │
│                              │                                   │            │
└──────────────────────────────┼───────────────────────────────────┼────────────┘
                               │                                   │
                               ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FastAPI 后端服务                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        Agent Orchestrator                              │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │  │
│  │  │ Workflow │  │  State   │  │  Config  │  │  Event Bus (async)   │  │  │
│  │  │ Engine   │  │  Manager │  │  Loader  │  │                      │  │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘  │  │
│  │       └─────────────┴─────────────┘                   │              │  │
│  │                         │                             │              │  │
│  └─────────────────────────┼─────────────────────────────┼──────────────┘  │
│                            │                             │                 │
│  ┌─────────────────────────┼─────────────────────────────┼───────────────┐ │
│  │      Agent 层            │                             │               │ │
│  │  ┌─────────┐ ┌────────┐ │ ┌────────┐ ┌────────┐      │               │ │
│  │  │Context  │ │ Data   │ │ │ Review │ │ Plot   │      │               │ │
│  │  │ Agent   │ │ Agent  │ │ │ Agent  │ │ Agent  │      │               │ │
│  │  └────┬────┘ └────┬───┘ │ └───┬────┘ └───┬────┘      │               │ │
│  │  ┌────┴────┐ ┌────┴───┐ │ ┌───┴────┐ ┌───┴────┐      │               │ │
│  │  │ Style   │ │ Chat   │ │ │Checker │ │ IFLine │      │               │ │
│  │  │ Agent   │ │ Agent  │ │ │Pipeline│ │ Agent  │      │               │ │
│  │  └─────────┘ └────────┘ │ └────────┘ └────────┘      │               │ │
│  │                         │                             │               │ │
│  │  ┌────────────────────────────────────────────────────┘               │ │
│  │  │  六维 Checker 集群 (并行执行)                                        │ │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │ │
│  │  │  │Consistency│ │Continuity│ │  Pacing  │ │   OOC    │              │ │
│  │  │  │ Checker   │ │ Checker  │ │ Checker  │ │ Checker  │              │ │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │ │
│  │  │  ┌──────────┐ ┌──────────┐                                         │ │
│  │  │  │High-Point│ │Reader-Pull│                                         │ │
│  │  │  │ Checker  │ │ Checker  │                                         │ │
│  │  │  └──────────┘ └──────────┘                                         │ │
│  │  └────────────────────────────────────────────────────────────────────┘ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                            │                                                 │
│  ┌─────────────────────────┼───────────────────────────────────────────────┐ │
│  │      Provider 抽象层      │                                               │ │
│  │  ┌─────────┐ ┌────────┐ │ ┌────────┐ ┌────────┐                        │ │
│  │  │MiniMax  │ │OpenAI  │ │ │ Claude │ │Local   │  ← 统一接口，可插拔     │ │
│  │  │Provider │ │Provider│ │ │Provider│ │Provider│                        │ │
│  │  └─────────┘ └────────┘ │ └────────┘ └────────┘                        │ │
│  │       │           │      │      │          │                            │ │
│  │       └───────────┴──────┴──────┴──────────┘                            │ │
│  │                         │                                               │ │
│  │              ┌──────────┴──────────┐                                    │ │
│  │              │   Provider Router    │  ← 按任务类型/成本/质量路由        │ │
│  │              │  (负载均衡 + 降级)    │                                    │ │
│  │              └─────────────────────┘                                    │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                            │                                                 │
│  ┌─────────────────────────┼───────────────────────────────────────────────┐ │
│  │      服务层              │                                               │ │
│  │  ┌─────────┐ ┌────────┐ │ ┌────────┐ ┌────────┐ ┌────────┐             │ │
│  │  │AIService│ │Cache   │ │ │ RAG    │ │Export/ │ │Logging │             │ │
│  │  │         │ │Service │ │ │Service │ │Import  │ │Service │             │ │
│  │  └─────────┘ └────────┘ │ └────────┘ └────────┘ └────────┘             │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                            │                                                 │
│  ┌─────────────────────────┼───────────────────────────────────────────────┐ │
│  │      数据层              │                                               │ │
│  │  ┌─────────┐ ┌────────┐ │ ┌────────┐ ┌────────┐                        │ │
│  │  │ SQLite  │ │ Vector │ │ │ BM25   │ │ Graph  │                        │ │
│  │  │ (主库)  │ │ Store  │ │ │ Index  │ │ Store  │                        │ │
│  │  └─────────┘ └────────┘ │ └────────┘ └────────┘                        │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件说明

| 组件 | 职责 | 现有状态 |
|------|------|---------|
| Agent Orchestrator | 工作流编排、状态管理、事件分发 | 待实现 |
| Context Agent | 生成创作执行包 | 已实现，需增强 |
| Data Agent | 实体提取、状态追踪 | 已实现，需增强 |
| Review Agent | 设定审查、一致性检查 | 框架已存在，需深化 |
| Plot Agent | 情节规划、伏笔管理 | 待实现 |
| Style Agent | 文笔风格分析、迁移 | 待实现 |
| Chat Agent | 聊天初始化对话管理 | 待实现 |
| IFLine Agent | IF 线同步写作管理 | 待实现 |
| Checker Pipeline | 六维并行检查 | 框架已存在，需深化 |
| Provider Router | 多 AI Provider 路由 | 待实现 |

---

## 3. Agent 类型与职责

### 3.1 Agent 基类设计

```python
# src/backend/agents/base.py

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
    WAITING = "waiting"  # 等待其他 Agent 输出


class AgentPriority(Enum):
    CRITICAL = 0   # 必须成功，失败则终止工作流
    HIGH = 1       # 重要，失败可降级继续
    NORMAL = 2     # 常规，失败可跳过
    LOW = 3        # 可选，失败不影响主流程


@dataclass
class AgentContext:
    """Agent 执行上下文，贯穿整个工作流。"""
    workflow_id: str
    chapter_id: Optional[int] = None
    story_id: Optional[int] = None
    user_preferences: dict = field(default_factory=dict)
    genre_config: Optional[dict] = None
    session_history: list = field(default_factory=list)
    shared_memory: dict = field(default_factory=dict)  # Agent 间共享数据
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
    hallucination_score: float = 0.0  # 0-1, 越高越可能幻觉


class BaseAgent(ABC):
    """Agent 抽象基类。所有 Agent 必须继承此类。"""

    agent_type: str = "base"
    priority: AgentPriority = AgentPriority.NORMAL
    required_context_keys: list[str] = []

    def __init__(
        self,
        provider: "AIProvider",
        config: Optional[dict] = None,
    ):
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

    async def run(
        self,
        context: AgentContext,
        timeout_ms: int = 60000,
    ) -> AgentResult:
        """带超时、重试、日志的标准执行入口。"""
        start_time = time.time()
        self.status = AgentStatus.RUNNING

        # 上下文验证
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

### 3.2 Agent 类型详述

#### 3.2.1 Context Agent（创作上下文 Agent）

**现有状态**: 已实现基础版本 (`src/backend/agents/context_agent.py`)

**增强方向**:
- 接入 Strand Weave 节奏数据，在执行包中标注本章 Strand 类型
- 接入反幻觉校验，执行包必须包含 `outline_anchor`（大纲锚点）
- 支持多 Provider 选择（复杂上下文用强模型，简单上下文用快模型）
- 缓存策略：同大纲相邻章节共享部分上下文

**输出格式增强**:

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

#### 3.2.2 Data Agent（数据提取 Agent）

**现有状态**: 已实现基础版本 (`src/backend/agents/data_agent.py`)

**增强方向**:
- 实体消歧：同名实体自动识别是否为同一实体
- 增量更新：仅提取新增/变更的实体和关系
- 状态版本化：实体状态变化历史追踪
- 与 RAG 系统集成：提取的实体自动入向量库

**新增提取维度**:

```python
class DataAgent(BaseAgent):
    """增强版数据提取 Agent。"""

    agent_type = "data"
    priority = AgentPriority.HIGH

    async def execute(self, context: AgentContext) -> AgentResult:
        chapter_content = context.shared_memory.get("chapter_content", "")

        # 并行执行所有提取任务
        results = await asyncio.gather(
            self._extract_entities(chapter_content),
            self._extract_relationships(chapter_content),
            self._track_state_changes(chapter_content),
            self._slice_scenes(chapter_content),
            self._generate_summary(chapter_content),
            self._extract_dialogue_patterns(chapter_content),      # 新增
            self._extract_emotional_arc(chapter_content),          # 新增
            self._identify_strand_distribution(chapter_content),   # 新增
            self._detect_new_inventions(chapter_content),          # 新增（反幻觉）
        )

        # 实体消歧
        disambiguated = await self._disambiguate_entities(results[0])

        # 反幻觉标记
        inventions = results[7]
        hallucination_score = len(inventions) / max(len(results[0]), 1)

        return AgentResult(
            status=AgentStatus.COMPLETED,
            data={
                "entities": disambiguated,
                "relationships": results[1],
                "state_changes": results[2],
                "scenes": results[3],
                "summary": results[4],
                "dialogue_patterns": results[5],
                "emotional_arc": results[6],
                "strand_distribution": results[7],
            },
            warnings=[f"Detected {len(inventions)} new inventions"] if inventions else [],
            hallucination_score=hallucination_score,
        )
```

#### 3.2.3 Review Agent（设定审查 Agent）—— 新增

**职责**: 对世界观、角色、情节进行深度审查，不仅发现问题，还提供修复建议。

```python
class ReviewAgent(BaseAgent):
    """设定审查 Agent，执行深度一致性审查。"""

    agent_type = "review"
    priority = AgentPriority.HIGH
    required_context_keys = ["settings_data", "characters", "locations", "rules"]

    async def execute(self, context: AgentContext) -> AgentResult:
        # 多轮审查：粗审 -> 细审 -> 交叉验证
        round1 = await self._coarse_review(context)
        round2 = await self._detailed_review(context, round1)
        round3 = await self._cross_validation(context, round2)

        return AgentResult(
            status=AgentStatus.COMPLETED,
            data={
                "review_rounds": [round1, round2, round3],
                "final_issues": round3["issues"],
                "fix_suggestions": round3["fixes"],
                "severity_distribution": round3["severity"],
            },
        )

    async def _coarse_review(self, context: AgentContext) -> dict:
        """第一轮：快速扫描明显矛盾。"""
        # 使用轻量级模型，快速返回
        pass

    async def _detailed_review(self, context: AgentContext, coarse: dict) -> dict:
        """第二轮：针对粗审发现的问题深度分析。"""
        # 使用强模型，详细分析
        pass

    async def _cross_validation(self, context: AgentContext, detailed: dict) -> dict:
        """第三轮：交叉验证修复建议的可行性。"""
        pass
```

#### 3.2.4 Plot Agent（情节规划 Agent）—— 新增

**职责**: 管理情节线、伏笔、高潮点规划。

```python
class PlotAgent(BaseAgent):
    """情节规划 Agent。"""

    agent_type = "plot"
    priority = AgentPriority.CRITICAL

    async def execute(self, context: AgentContext) -> AgentResult:
        operation = context.shared_memory.get("plot_operation", "plan")

        if operation == "plan":
            return await self._plan_arc(context)
        elif operation == "foreshadow":
            return await self._design_foreshadowing(context)
        elif operation == "climax":
            return await self._plan_climax(context)
        elif operation == "resolve":
            return await self._resolve_threads(context)

    async def _plan_arc(self, context: AgentContext) -> AgentResult:
        """规划故事弧线，确保 Strand 比例合理。"""
        # 输出：章节级别的 Strand 分配计划
        pass

    async def _design_foreshadowing(self, context: AgentContext) -> AgentResult:
        """设计伏笔布局。"""
        # 输出：伏笔创建章节 -> 揭示章节的映射
        pass
```

#### 3.2.5 Style Agent（文笔风格 Agent）—— 新增

**职责**: 分析、迁移、调节文笔风格。

```python
class StyleAgent(BaseAgent):
    """文笔风格 Agent。"""

    agent_type = "style"
    priority = AgentPriority.NORMAL

    async def execute(self, context: AgentContext) -> AgentResult:
        operation = context.shared_memory.get("style_operation", "analyze")

        if operation == "analyze":
            return await self._analyze_style(context)
        elif operation == "transfer":
            return await self._transfer_style(context)
        elif operation == "adapt":
            return await self._adapt_to_ratio(context)

    async def _analyze_style(self, context: AgentContext) -> AgentResult:
        """分析文本风格特征。"""
        # 输出：风格指纹（词汇偏好、句式结构、修辞手法、节奏特征）
        pass

    async def _transfer_style(self, context: AgentContext) -> AgentResult:
        """将文本迁移到目标风格。"""
        # 输入：原文 + 目标风格（江南/卡夫卡/加缪/自定义）
        pass

    async def _adapt_to_ratio(self, context: AgentContext) -> AgentResult:
        """根据人机比例调整 AI 介入程度。"""
        # 人机比例高 -> 轻量建议
        # 人机比例低 -> 深度改写
        pass
```

#### 3.2.6 Chat Agent（聊天初始化 Agent）—— 新增

**职责**: 管理界面1的 AI 主动提问流程，收集世界观设定。

```python
class ChatAgent(BaseAgent):
    """聊天初始化 Agent。"""

    agent_type = "chat"
    priority = AgentPriority.NORMAL

    async def execute(self, context: AgentContext) -> AgentResult:
        phase = context.shared_memory.get("chat_phase", "discovery")

        if phase == "discovery":
            return await self._generate_question(context)
        elif phase == "clarify":
            return await self._clarify_ambiguity(context)
        elif phase == "summarize":
            return await self._summarize_settings(context)
        elif phase == "transition":
            return await self._suggest_transition(context)

    async def _generate_question(self, context: AgentContext) -> AgentResult:
        """基于已收集信息，生成下一个最有价值的问题。"""
        # 使用信息熵策略：优先询问对世界观影响最大的未确定项
        pass
```

#### 3.2.7 IFLine Agent（IF 线管理 Agent）—— 新增

**职责**: 管理 IF 线（配角故事线）的同步写作。

```python
class IFLineAgent(BaseAgent):
    """IF 线同步写作 Agent。"""

    agent_type = "ifline"
    priority = AgentPriority.NORMAL

    async def execute(self, context: AgentContext) -> AgentResult:
        mode = context.shared_memory.get("ifline_mode", "sync_check")

        if mode == "sync_check":
            return await self._check_sync_status(context)
        elif mode == "generate":
            return await self._generate_ifline_chapter(context)
        elif mode == "merge":
            return await self._merge_timelines(context)

    async def _check_sync_status(self, context: AgentContext) -> AgentResult:
        """检查 IF 线与主线的同步状态。"""
        # 输出：时间线偏差、角色状态冲突、事件顺序问题
        pass

    async def _generate_ifline_chapter(self, context: AgentContext) -> AgentResult:
        """为 IF 线生成章节内容（人机比例低时自动执行）。"""
        pass
```

---

## 4. Agent 协作工作流（编排模式）

### 4.1 编排器设计

```python
# src/backend/agents/orchestrator.py

from typing import Callable
from enum import Enum
import asyncio


class WorkflowType(Enum):
    CHAPTER_WRITE = "chapter_write"       # 章节写作工作流
    CHAPTER_REVIEW = "chapter_review"     # 章节审查工作流
    SETTINGS_INIT = "settings_init"       # 设定初始化工作流
    IFLINE_SYNC = "ifline_sync"           # IF 线同步工作流
    FULL_INSPECTION = "full_inspection"   # 全量检查工作流


class DependencyType(Enum):
    SEQUENTIAL = "sequential"     # A -> B，B 依赖 A 完成
    PARALLEL = "parallel"         # A, B 同时执行
    CONDITIONAL = "conditional"   # 条件分支
    RETRY = "retry"               # 失败重试
    FALLBACK = "fallback"         # 降级方案


@dataclass
class WorkflowStep:
    """工作流步骤定义。"""
    step_id: str
    agent_type: str
    dependencies: list[str] = field(default_factory=list)
    dependency_type: DependencyType = DependencyType.SEQUENTIAL
    condition: Optional[Callable] = None  # CONDITIONAL 类型的判断函数
    fallback_step: Optional[str] = None   # FALLBACK 类型的降级步骤
    timeout_ms: int = 60000
    retry_count: int = 2


class AgentOrchestrator:
    """Agent 编排器，负责协调多个 Agent 的执行。"""

    def __init__(self, provider_router: "ProviderRouter"):
        self.provider_router = provider_router
        self.agents: dict[str, type[BaseAgent]] = {}
        self.workflows: dict[WorkflowType, list[WorkflowStep]] = {}
        self.event_bus = asyncio.Queue()

    def register_agent(self, agent_class: type[BaseAgent]) -> None:
        """注册 Agent 类型。"""
        self.agents[agent_class.agent_type] = agent_class

    def define_workflow(
        self,
        workflow_type: WorkflowType,
        steps: list[WorkflowStep],
    ) -> None:
        """定义工作流。"""
        self.workflows[workflow_type] = steps

    async def execute_workflow(
        self,
        workflow_type: WorkflowType,
        context: AgentContext,
    ) -> dict[str, AgentResult]:
        """执行工作流。"""
        steps = self.workflows.get(workflow_type, [])
        results: dict[str, AgentResult] = {}
        completed_steps: set[str] = set()

        # 拓扑排序确定执行顺序
        execution_order = self._topological_sort(steps)

        for batch in execution_order:
            # 同批次步骤并行执行
            batch_tasks = []
            for step in batch:
                agent_class = self.agents.get(step.agent_type)
                if not agent_class:
                    raise ValueError(f"Unknown agent type: {step.agent_type}")

                provider = self.provider_router.select_provider(
                    task_type=step.agent_type,
                    priority=agent_class.priority,
                )
                agent = agent_class(provider=provider)
                batch_tasks.append(self._execute_step(agent, step, context, results))

            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)

            for step, result in zip(batch, batch_results):
                if isinstance(result, Exception):
                    # 处理失败
                    if step.fallback_step:
                        fallback_result = await self._execute_fallback(
                            step, context, results
                        )
                        results[step.step_id] = fallback_result
                    else:
                        results[step.step_id] = AgentResult(
                            agent_id="",
                            agent_type=step.agent_type,
                            status=AgentStatus.FAILED,
                            priority=AgentPriority.NORMAL,
                            issues=[str(result)],
                        )
                else:
                    results[step.step_id] = result
                    # 将结果写入共享内存
                    context.shared_memory[step.step_id] = result.data

                completed_steps.add(step.step_id)

        return results

    def _topological_sort(
        self, steps: list[WorkflowStep]
    ) -> list[list[WorkflowStep]]:
        """将步骤按依赖关系分层，同层可并行。"""
        # 返回: [[step1, step2], [step3], [step4, step5]]
        pass
```

### 4.2 核心工作流定义

#### 4.2.1 章节写作工作流 (CHAPTER_WRITE)

```text
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

依赖关系:
- Step 1 -> Step 2 (SEQUENTIAL)
- Step 2 -> Step 3 (SEQUENTIAL)
- Step 3 -> Step 4 (SEQUENTIAL)
- Step 4 -> Step 5 (CONDITIONAL: score < 80 时进入人工确认)
- Step 5 -> Step 6 (SEQUENTIAL)
```

#### 4.2.2 章节审查工作流 (CHAPTER_REVIEW)

```text
┌─────────────┐
│   Input:    │
│ Chapter ID  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│           并行执行六维检查                     │
│  ┌────────┐ ┌────────┐ ┌────────┐          │
│  │Consistency│Continuity│  Pacing  │          │
│  │ Checker  │ │ Checker│ │ Checker│          │
│  └────────┘ └────────┘ └────────┘          │
│  ┌────────┐ ┌────────┐ ┌────────┐          │
│  │   OOC   │ │High-Point│Reader-Pull│         │
│  │ Checker │ │ Checker │ │ Checker │         │
│  └────────┘ └────────┘ └────────┘          │
└─────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│           结果聚合与评分                       │
│  - 综合评分 = weighted_average(六维评分)      │
│  - 问题去重与分级                            │
│  - 生成修复建议优先级队列                     │
└─────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│           反幻觉校验                          │
│  - 检查 AI 建议是否违反设定                   │
│  - 标记 invention_flags                     │
└─────────────────────────────────────────────┘
```

#### 4.2.3 设定初始化工作流 (SETTINGS_INIT)

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  1. Chat    │────▶│  2. Data    │────▶│  3. Review  │
│    Agent    │     │    Agent    │     │    Agent    │
│ (主动提问)   │     │ (提取实体)   │     │ (一致性审查) │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  4. Plot    │
                                        │    Agent    │
                                        │ (情节骨架)   │
                                        └─────────────┘
```

---

## 5. 六维检查深度实现

### 5.1 现有实现分析

当前六维检查器 (`src/backend/agents/checkers/`) 存在以下问题：
1. **浅层实现**: 每个 Checker 仅做单次 AI 调用，缺乏深度分析
2. **无交叉验证**: 各 Checker 独立运行，结果未交叉验证
3. **无历史追踪**: 检查结果未与历史数据关联
4. **评分主观**: 评分完全依赖 AI，缺乏量化指标

### 5.2 深度实现方案

#### 5.2.1 Checker 基类重构

```python
# src/backend/agents/checkers/base_checker.py

from abc import abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class CheckDimension:
    """检查维度定义。"""
    name: str
    weight: float  # 在综合评分中的权重
    threshold: int  # 及格线
    critical: bool  # 是否关键维度（不及格则整体不通过）


@dataclass
class CheckIssue:
    """检查问题标准格式。"""
    severity: str  # "critical" | "major" | "minor" | "suggestion"
    category: str  # 问题分类
    location: str  # 问题位置（章节/段落/行号）
    description: str  # 问题描述
    evidence: str  # 证据引用（原文片段）
    fix_suggestion: str  # 修复建议
    rule_violated: Optional[str] = None  # 违反的规则


class BaseChecker(BaseAgent):
    """检查器基类。"""

    agent_type = "checker"
    priority = AgentPriority.HIGH

    # 每个 Checker 定义自己的维度
    dimension: CheckDimension

    # 检查深度配置
    analysis_depth: str = "standard"  # "quick" | "standard" | "deep"

    async def execute(self, context: AgentContext) -> AgentResult:
        chapter_id = context.shared_memory.get("chapter_id")
        content = context.shared_memory.get("chapter_content", "")

        # 第一层：快速扫描
        quick_result = await self._quick_scan(content)

        # 如果快速扫描发现问题，进入深度分析
        if quick_result["has_issues"] and self.analysis_depth != "quick":
            deep_result = await self._deep_analysis(content, quick_result)
            final_result = self._merge_results(quick_result, deep_result)
        else:
            final_result = quick_result

        # 量化评分（不完全依赖 AI）
        score = self._calculate_score(final_result)

        return AgentResult(
            status=AgentStatus.COMPLETED,
            data={
                "dimension": self.dimension.name,
                "score": score,
                "issues": final_result.get("issues", []),
                "suggestions": final_result.get("suggestions", []),
                "metrics": final_result.get("metrics", {}),
            },
            hallucination_score=final_result.get("hallucination_score", 0),
        )

    @abstractmethod
    async def _quick_scan(self, content: str) -> dict:
        """快速扫描，返回是否有问题。"""
        pass

    @abstractmethod
    async def _deep_analysis(self, content: str, quick_result: dict) -> dict:
        """深度分析。"""
        pass

    def _calculate_score(self, result: dict) -> int:
        """计算量化评分。"""
        base_score = 100
        for issue in result.get("issues", []):
            if issue["severity"] == "critical":
                base_score -= 25
            elif issue["severity"] == "major":
                base_score -= 15
            elif issue["severity"] == "minor":
                base_score -= 5
            else:
                base_score -= 1
        return max(0, min(100, base_score))
```

#### 5.2.2 各 Checker 深度实现

##### ConsistencyChecker（一致性检查器）

```python
class ConsistencyChecker(BaseChecker):
    """深度一致性检查器。"""

    dimension = CheckDimension(
        name="consistency",
        weight=0.20,
        threshold=70,
        critical=True,
    )

    async def _quick_scan(self, content: str) -> dict:
        """快速扫描：提取所有涉及设定的事实声明。"""
        # 使用轻量级模型提取：地点提及、实力描述、物品使用、势力关系
        pass

    async def _deep_analysis(self, content: str, quick_result: dict) -> dict:
        """深度分析：
        1. 与数据库中的设定逐项比对
        2. 检查时间线逻辑
        3. 检查战力体系一致性
        4. 检查物品归属链
        """
        # 加载完整世界观数据
        world_data = await self._load_world_data()

        # 逐项验证
        violations = []
        for claim in quick_result["claims"]:
            verified = await self._verify_claim(claim, world_data)
            if not verified["valid"]:
                violations.append({
                    "severity": "critical" if verified["type"] == "power_level" else "major",
                    "location": claim["location"],
                    "description": f"设定冲突: {claim['text']}",
                    "evidence": verified["expected"],
                    "fix_suggestion": verified["suggestion"],
                    "rule_violated": verified["rule"],
                })

        return {
            "has_issues": len(violations) > 0,
            "issues": violations,
            "metrics": {
                "claims_checked": len(quick_result["claims"]),
                "violations_found": len(violations),
                "violation_rate": len(violations) / max(len(quick_result["claims"]), 1),
            },
        }
```

##### ContinuityChecker（连续性检查器）

```python
class ContinuityChecker(BaseChecker):
    """深度连续性检查器。"""

    dimension = CheckDimension(
        name="continuity",
        weight=0.15,
        threshold=65,
        critical=False,
    )

    async def _quick_scan(self, content: str) -> dict:
        """快速扫描：检测场景转换、时间跳跃、角色状态变化。"""
        pass

    async def _deep_analysis(self, content: str, quick_result: dict) -> dict:
        """深度分析：
        1. 与前 3 章内容比对
        2. 检查角色状态延续性（情绪、服装、伤势）
        3. 检查伏笔呼应状态
        4. 检查时间线一致性
        """
        # 加载前序章节数据
        previous_chapters = await self._load_previous_chapters(limit=3)

        # 状态延续性检查
        state_issues = await self._check_state_continuity(content, previous_chapters)

        # 伏笔追踪
        plot_thread_status = await self._track_plot_threads(content, previous_chapters)

        return {
            "has_issues": len(state_issues) > 0,
            "issues": state_issues,
            "plot_thread_status": plot_thread_status,
            "metrics": {
                "scenes_checked": quick_result.get("scene_count", 0),
                "state_transitions": len(state_issues),
            },
        }
```

##### PacingChecker（节奏检查器）

```python
class PacingChecker(BaseChecker):
    """深度节奏检查器，集成 Strand Weave。"""

    dimension = CheckDimension(
        name="pacing",
        weight=0.15,
        threshold=60,
        critical=False,
    )

    # Strand 理想比例
    STRAND_TARGETS = {
        "quest": 0.60,
        "fire": 0.20,
        "constellation": 0.20,
    }

    # Strand 红线
    STRAND_RED_LINES = {
        "quest": {"max_consecutive": 5, "max_gap": 3},
        "fire": {"max_consecutive": 3, "max_gap": 10},
        "constellation": {"max_consecutive": 4, "max_gap": 15},
    }

    async def _quick_scan(self, content: str) -> dict:
        """快速扫描：识别内容所属的 Strand 类型。"""
        # 按段落/场景标注 Strand 类型
        pass

    async def _deep_analysis(self, content: str, quick_result: dict) -> dict:
        """深度分析：
        1. 计算本章 Strand 比例
        2. 检查历史 Strand 分布（是否违反红线）
        3. 分析节奏曲线（张弛度）
        4. 预测未来章节 Strand 需求
        """
        # 本章比例
        current_ratios = quick_result["strand_ratios"]

        # 历史分布（最近 20 章）
        history = await self._load_strand_history(limit=20)

        # 红线检查
        red_line_issues = self._check_red_lines(history)

        # 比例偏差
        ratio_issues = []
        for strand, target in self.STRAND_TARGETS.items():
            actual = current_ratios.get(strand, 0)
            deviation = abs(actual - target)
            if deviation > 0.15:  # 15% 偏差阈值
                ratio_issues.append({
                    "severity": "major" if deviation > 0.25 else "minor",
                    "description": f"{strand} 比例 {actual:.0%} 偏离目标 {target:.0%}",
                    "fix_suggestion": f"调整 {strand} 内容至 {target:.0%} 左右",
                })

        return {
            "has_issues": len(red_line_issues) > 0 or len(ratio_issues) > 0,
            "issues": red_line_issues + ratio_issues,
            "strand_ratios": current_ratios,
            "analysis": self._generate_analysis(current_ratios, history),
            "metrics": {
                "quest_ratio": current_ratios.get("quest", 0),
                "fire_ratio": current_ratios.get("fire", 0),
                "constellation_ratio": current_ratios.get("constellation", 0),
            },
        }

    def _check_red_lines(self, history: list[dict]) -> list[dict]:
        """检查 Strand 红线。"""
        issues = []
        for strand, limits in self.STRAND_RED_LINES.items():
            # 检查连续出现次数
            consecutive = self._count_consecutive(history, strand)
            if consecutive > limits["max_consecutive"]:
                issues.append({
                    "severity": "major",
                    "description": f"{strand} 连续出现 {consecutive} 章，超过红线 {limits['max_consecutive']}",
                    "fix_suggestion": f"接下来 {consecutive - limits['max_consecutive']} 章避免 {strand} 主线",
                })

            # 检查断档次数
            gap = self._count_gap(history, strand)
            if gap > limits["max_gap"]:
                issues.append({
                    "severity": "major",
                    "description": f"{strand} 已断档 {gap} 章，超过红线 {limits['max_gap']}",
                    "fix_suggestion": f"下一章应包含 {strand} 内容",
                })
        return issues
```

##### OOCChecker（角色一致性检查器）

```python
class OOCChecker(BaseChecker):
    """深度角色一致性检查器。"""

    dimension = CheckDimension(
        name="ooc",
        weight=0.20,
        threshold=75,
        critical=True,
    )

    async def _quick_scan(self, content: str) -> dict:
        """快速扫描：提取所有角色行为描述。"""
        pass

    async def _deep_analysis(self, content: str, quick_result: dict) -> dict:
        """深度分析：
        1. 加载角色完整档案（性格、欲望、缺陷、历史行为模式）
        2. 逐行为分析是否符合人设
        3. 考虑情境压力（极端情境下行为偏离可接受）
        4. 识别角色成长弧线上的合理变化
        """
        character_id = context.shared_memory.get("character_id")
        character = await self._load_character_profile(character_id)

        violations = []
        for action in quick_result["actions"]:
            # 检查是否属于角色成长弧线上的合理变化
            arc_context = await self._get_arc_context(character_id, action)

            ooc_score = await self._calculate_ooc_score(action, character, arc_context)

            if ooc_score > 0.7:  # 70% 以上偏离度才判定为 OOC
                violations.append({
                    "severity": "critical" if ooc_score > 0.9 else "major",
                    "location": action["location"],
                    "expected_behavior": self._infer_expected_behavior(action, character),
                    "actual_behavior": action["description"],
                    "reason": f"行为偏离度 {ooc_score:.0%}，不符合角色 '{character.name}' 的 {character.personality} 性格",
                })
            elif ooc_score > 0.5:
                # 警告级别，可能是角色成长
                violations.append({
                    "severity": "minor",
                    "location": action["location"],
                    "expected_behavior": "",
                    "actual_behavior": action["description"],
                    "reason": f"行为有 {ooc_score:.0%} 偏离，可能是角色成长或情境压力导致",
                })

        return {
            "has_issues": len(violations) > 0,
            "issues": [v for v in violations if v["severity"] != "minor"],
            "warnings": [v for v in violations if v["severity"] == "minor"],
            "violations": violations,
            "metrics": {
                "actions_checked": len(quick_result["actions"]),
                "ooc_violations": len([v for v in violations if v["severity"] in ("critical", "major")]),
                "max_ooc_score": max([v.get("ooc_score", 0) for v in violations], default=0),
            },
        }
```

##### HighPointChecker（爽点检查器）

```python
class HighPointChecker(BaseChecker):
    """深度爽点/高潮检查器。"""

    dimension = CheckDimension(
        name="high_point",
        weight=0.15,
        threshold=60,
        critical=False,
    )

    async def _quick_scan(self, content: str) -> dict:
        """快速扫描：识别潜在高潮点位置。"""
        pass

    async def _deep_analysis(self, content: str, quick_result: dict) -> dict:
        """深度分析：
        1. 高潮点强度评估（1-10）
        2. 高潮点间距分析（不能太密也不能太稀）
        3. 情绪曲线分析（张弛结合）
        4. 铺垫充分度评估
        5. 结尾钩子强度
        """
        high_points = quick_result["high_points"]

        # 间距分析
        spacing_issues = self._analyze_spacing(high_points)

        # 情绪曲线
        emotional_curve = await self._analyze_emotional_curve(content)

        # 铺垫分析
        buildup_analysis = await self._analyze_buildup(content, high_points)

        # 结尾钩子
        ending_hook = await self._analyze_ending_hook(content)

        # 兴奋点密度评分
        word_count = len(content)
        hp_count = len(high_points)
        density = hp_count / (word_count / 1000)  # 每千字高潮数

        density_rating = "适中"
        if density < 0.5:
            density_rating = "稀疏"
        elif density > 2.0:
            density_rating = "密集"

        return {
            "has_issues": len(spacing_issues) > 0 or density_rating == "稀疏",
            "issues": spacing_issues,
            "high_points": high_points,
            "excitement_density": density_rating,
            "ending_hook": ending_hook,
            "metrics": {
                "high_point_count": hp_count,
                "density_per_1k": round(density, 2),
                "avg_intensity": sum(hp["intensity"] for hp in high_points) / max(hp_count, 1),
                "emotional_variance": emotional_curve["variance"],
            },
        }
```

##### ReaderPullChecker（追读力检查器）

```python
class ReaderPullChecker(BaseChecker):
    """深度追读力检查器。"""

    dimension = CheckDimension(
        name="reader_pull",
        weight=0.15,
        threshold=65,
        critical=False,
    )

    async def _quick_scan(self, content: str) -> dict:
        """快速扫描：识别钩子、悬念、冲突点。"""
        pass

    async def _deep_analysis(self, content: str, quick_result: dict) -> dict:
        """深度分析：
        1. 开篇钩子评估（前 500 字必须有强钩子）
        2. 结尾悬念评估（最后 300 字必须留悬念）
        3. 认知差/信息差分析
        4. 情感共鸣点识别
        5. 冲突驱动力评估
        """
        hooks = quick_result["hooks"]

        # 开篇钩子
        opening = content[:500]
        opening_hook = await self._evaluate_opening_hook(opening)

        # 结尾悬念
        ending = content[-300:] if len(content) > 300 else content
        ending_hook = await self._evaluate_ending_hook(ending)

        # 认知差
        curiosity_gaps = await self._identify_curiosity_gaps(content)

        # 冲突驱动
        conflict_drivers = await self._identify_conflict_drivers(content)

        issues = []
        if opening_hook["strength"] < 7:
            issues.append({
                "severity": "major",
                "description": f"开篇钩子强度仅 {opening_hook['strength']}/10，不足以吸引读者",
                "fix_suggestion": "在开篇 300 字内加入冲突、悬念或反常事件",
            })

        if ending_hook["strength"] < 6:
            issues.append({
                "severity": "major",
                "description": f"结尾悬念强度仅 {ending_hook['strength']}/10，追读动力不足",
                "fix_suggestion": "在章节结尾设置未解之谜、危机或情感冲击",
            })

        return {
            "has_issues": len(issues) > 0,
            "issues": issues,
            "hooks": hooks,
            "opening_hook": opening_hook["description"],
            "ending_hook": ending_hook["description"],
            "curiosity_gaps": curiosity_gaps,
            "metrics": {
                "opening_hook_strength": opening_hook["strength"],
                "ending_hook_strength": ending_hook["strength"],
                "hook_count": len(hooks),
                "curiosity_gap_count": len(curiosity_gaps),
                "conflict_driver_count": len(conflict_drivers),
            },
        }
```

### 5.3 Checker Pipeline 聚合逻辑

```python
class CheckerPipeline:
    """六维检查流水线。"""

    DIMENSION_WEIGHTS = {
        "consistency": 0.20,
        "continuity": 0.15,
        "pacing": 0.15,
        "ooc": 0.20,
        "high_point": 0.15,
        "reader_pull": 0.15,
    }

    async def run(self, chapter_id: int, db: AsyncSession) -> dict:
        """并行执行六维检查，聚合结果。"""
        # 并行执行所有 Checker
        checkers = [
            ConsistencyChecker(self.provider),
            ContinuityChecker(self.provider),
            PacingChecker(self.provider),
            OOCChecker(self.provider),
            HighPointChecker(self.provider),
            ReaderPullChecker(self.provider),
        ]

        context = AgentContext(
            workflow_id=f"check_{chapter_id}",
            chapter_id=chapter_id,
            shared_memory={"chapter_id": chapter_id},
        )

        results = await asyncio.gather(
            *[checker.run(context) for checker in checkers],
            return_exceptions=True,
        )

        # 聚合结果
        dimension_scores = {}
        all_issues = []
        all_suggestions = []

        for checker, result in zip(checkers, results):
            if isinstance(result, Exception):
                dimension_scores[checker.dimension.name] = 0
                all_issues.append(f"{checker.dimension.name} 检查失败: {str(result)}")
            else:
                dimension_scores[checker.dimension.name] = result.data.get("score", 0)
                all_issues.extend(result.data.get("issues", []))
                all_suggestions.extend(result.data.get("suggestions", []))

        # 计算综合评分
        composite_score = sum(
            dimension_scores.get(dim, 0) * weight
            for dim, weight in self.DIMENSION_WEIGHTS.items()
        )

        # 问题分级与去重
        prioritized_issues = self._prioritize_issues(all_issues)

        # 生成修复建议优先级队列
        fix_queue = self._generate_fix_queue(prioritized_issues, all_suggestions)

        return {
            "chapter_id": chapter_id,
            "composite_score": round(composite_score),
            "dimension_scores": dimension_scores,
            "grade": self._score_to_grade(composite_score),
            "issues": prioritized_issues,
            "suggestions": all_suggestions,
            "fix_queue": fix_queue,
            "passed": composite_score >= 60 and all(
                dimension_scores.get(dim, 0) >= checker.dimension.threshold
                for checker in checkers
            ),
        }

    def _score_to_grade(self, score: float) -> str:
        if score >= 90: return "S"
        if score >= 80: return "A"
        if score >= 70: return "B"
        if score >= 60: return "C"
        if score >= 40: return "D"
        return "F"

    def _prioritize_issues(self, issues: list[dict]) -> list[dict]:
        """按严重程度和修复成本排序。"""
        severity_order = {"critical": 0, "major": 1, "minor": 2, "suggestion": 3}
        return sorted(issues, key=lambda x: severity_order.get(x.get("severity", "suggestion"), 4))

    def _generate_fix_queue(self, issues: list[dict], suggestions: list[str]) -> list[dict]:
        """生成修复优先级队列。"""
        queue = []
        for issue in issues:
            if issue.get("severity") in ("critical", "major"):
                queue.append({
                    "priority": "high",
                    "issue": issue["description"],
                    "suggestion": issue.get("fix_suggestion", ""),
                    "auto_fixable": self._is_auto_fixable(issue),
                })
        return queue

    def _is_auto_fixable(self, issue: dict) -> bool:
        """判断问题是否可自动修复。"""
        # 简单的文本替换类问题可自动修复
        # 结构性问题需要人工介入
        auto_fixable_types = ["typo", "format", "minor_inconsistency"]
        return issue.get("category") in auto_fixable_types
```

---

## 6. Strand Weave 节奏控制集成

### 6.1 Strand 数据模型

```python
# 新增数据库表

class StrandRecord(Base):
    """章节 Strand 记录。"""
    __tablename__ = "strand_records"

    id = Column(Integer, primary_key=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=False)
    quest_ratio = Column(Float, default=0.0)
    fire_ratio = Column(Float, default=0.0)
    constellation_ratio = Column(Float, default=0.0)
    dominant_strand = Column(String)  # "quest" | "fire" | "constellation"
    created_at = Column(DateTime, default=datetime.utcnow)


class StrandRedLineLog(Base):
    """Strand 红线告警记录。"""
    __tablename__ = "strand_red_line_logs"

    id = Column(Integer, primary_key=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=False)
    strand_type = Column(String, nullable=False)
    violation_type = Column(String)  # "consecutive" | "gap"
    violation_count = Column(Integer)
    red_line_value = Column(Integer)
    resolved = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
```

### 6.2 Strand 追踪服务

```python
class StrandTracker:
    """Strand 节奏追踪服务。"""

    TARGET_RATIOS = {"quest": 0.60, "fire": 0.20, "constellation": 0.20}
    RED_LINES = {
        "quest": {"max_consecutive": 5, "max_gap": 3},
        "fire": {"max_consecutive": 3, "max_gap": 10},
        "constellation": {"max_consecutive": 4, "max_gap": 15},
    }

    def __init__(self, db: AsyncSession):
        self.db = db

    async def record_chapter_strands(self, chapter_id: int, ratios: dict) -> None:
        """记录章节的 Strand 比例。"""
        dominant = max(ratios, key=ratios.get)
        record = StrandRecord(
            chapter_id=chapter_id,
            quest_ratio=ratios.get("quest", 0),
            fire_ratio=ratios.get("fire", 0),
            constellation_ratio=ratios.get("constellation", 0),
            dominant_strand=dominant,
        )
        self.db.add(record)

    async def check_red_lines(self, chapter_id: int) -> list[dict]:
        """检查是否违反 Strand 红线。"""
        # 获取最近 20 章的 Strand 记录
        history = await self._get_recent_strands(limit=20)

        violations = []
        for strand, limits in self.RED_LINES.items():
            # 检查连续
            consecutive = self._count_consecutive(history, strand)
            if consecutive > limits["max_consecutive"]:
                violations.append({
                    "strand": strand,
                    "type": "consecutive",
                    "count": consecutive,
                    "limit": limits["max_consecutive"],
                })

            # 检查断档
            gap = self._count_gap(history, strand)
            if gap > limits["max_gap"]:
                violations.append({
                    "strand": strand,
                    "type": "gap",
                    "count": gap,
                    "limit": limits["max_gap"],
                })

        return violations

    async def suggest_next_strand(self, outline_id: int) -> dict:
        """建议下一章的 Strand 类型。"""
        history = await self._get_outline_strands(outline_id)

        # 计算各 Strand 的紧急度
        urgency = {}
        for strand, limits in self.RED_LINES.items():
            gap = self._count_gap(history, strand)
            urgency[strand] = gap / limits["max_gap"]  # 越接近 1 越紧急

        # 同时考虑目标比例偏差
        current_avg = self._calculate_average_ratios(history)
        for strand, target in self.TARGET_RATIOS.items():
            deviation = target - current_avg.get(strand, 0)
            urgency[strand] += max(0, deviation * 2)  # 偏低的 Strand 更紧急

        # 推荐最紧急的 Strand
        recommended = max(urgency, key=urgency.get)

        return {
            "recommended_strand": recommended,
            "urgency_scores": urgency,
            "current_averages": current_avg,
            "reason": f"{recommended} 的紧急度最高 ({urgency[recommended]:.2f})",
        }
```

### 6.3 Strand 与 Context Agent 集成

Context Agent 生成执行包时，自动查询 StrandTracker 获取：
1. 本章推荐的 Strand 类型
2. 历史 Strand 分布
3. 红线告警状态

这些信息会写入执行包的 `core_task.strand_type` 和 `core_task.strand_weight` 字段，指导 AI 生成符合节奏要求的内容。

---

## 7. 反幻觉机制

### 7.1 三定律实现

#### 定律一：大纲即法律

```python
class OutlineLawEnforcer:
    """大纲法律执行器。"""

    async def enforce(self, chapter_id: int, ai_content: str, outline: Outline) -> dict:
        """验证 AI 生成内容是否遵循大纲。"""
        # 1. 提取大纲核心约束
        constraints = await self._extract_outline_constraints(outline)

        # 2. 验证内容是否满足约束
        violations = []
        for constraint in constraints:
            if not self._satisfies_constraint(ai_content, constraint):
                violations.append({
                    "type": "outline_violation",
                    "constraint": constraint["description"],
                    "severity": constraint["severity"],
                })

        # 3. 如果存在严重违反，拒绝内容并返回修正指令
        critical_violations = [v for v in violations if v["severity"] == "critical"]

        return {
            "passed": len(critical_violations) == 0,
            "violations": violations,
            "correction_instruction": self._generate_correction(violations) if critical_violations else None,
        }

    def _extract_outline_constraints(self, outline: Outline) -> list[dict]:
        """从大纲提取可验证的约束。"""
        # 例如：本章必须包含的事件、必须出场的角色、必须揭示的信息
        pass
```

#### 定律二：设定即物理

```python
class SettingPhysicsEnforcer:
    """设定物理执行器。"""

    async def enforce(self, content: str, world_settings: dict) -> dict:
        """验证内容是否违反世界观设定。"""
        # 1. 提取内容中的所有事实声明
        claims = await self._extract_factual_claims(content)

        # 2. 与设定数据库逐项比对
        violations = []
        for claim in claims:
            verified = await self._verify_against_settings(claim, world_settings)
            if not verified["valid"]:
                violations.append({
                    "type": "setting_violation",
                    "claim": claim["text"],
                    "expected": verified["expected"],
                    "actual": verified["actual"],
                })

        return {
            "passed": len(violations) == 0,
            "violations": violations,
            "claim_count": len(claims),
            "violation_rate": len(violations) / max(len(claims), 1),
        }
```

#### 定律三：发明需识别

```python
class InventionIdentifier:
    """新发明识别器。"""

    async def identify(self, content: str, known_entities: list[str]) -> dict:
        """识别内容中的新实体/设定。"""
        # 1. 提取所有实体提及
        mentions = await self._extract_entity_mentions(content)

        # 2. 与已知实体比对
        new_inventions = []
        for mention in mentions:
            if not self._is_known_entity(mention, known_entities):
                new_inventions.append({
                    "name": mention["name"],
                    "type": mention["type"],
                    "context": mention["context"],
                    "confidence": mention["confidence"],
                })

        # 3. 分类处理
        auto_acceptable = [i for i in new_inventions if i["confidence"] > 0.9]
        need_review = [i for i in new_inventions if 0.5 < i["confidence"] <= 0.9]
        likely_hallucination = [i for i in new_inventions if i["confidence"] <= 0.5]

        return {
            "new_inventions": new_inventions,
            "auto_acceptable": auto_acceptable,
            "need_review": need_review,
            "likely_hallucination": likely_hallucination,
            "hallucination_score": len(likely_hallucination) / max(len(mentions), 1),
        }
```

### 7.2 反幻觉流水线

```text
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

---

## 8. 多 AI Provider 支持架构

### 8.1 Provider 抽象接口

```python
# src/backend/agents/providers/base.py

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator, Optional


@dataclass
class ProviderConfig:
    """Provider 配置。"""
    name: str
    api_key: str
    base_url: str
    default_model: str
    max_tokens: int = 4096
    timeout: float = 60.0
    cost_per_1k_input: float = 0.0
    cost_per_1k_output: float = 0.0
    supports_streaming: bool = True
    supports_json_mode: bool = False
    context_window: int = 128000


@dataclass
class GenerationRequest:
    """标准化生成请求。"""
    system_prompt: str
    user_content: str
    temperature: float = 0.5
    max_tokens: Optional[int] = None
    response_format: Optional[str] = None  # "json" | "text"
    stream: bool = False


@dataclass
class GenerationResult:
    """标准化生成结果。"""
    content: str
    tokens_input: int = 0
    tokens_output: int = 0
    model: str = ""
    provider: str = ""
    latency_ms: int = 0
    finish_reason: str = ""


class AIProvider(ABC):
    """AI Provider 抽象基类。"""

    def __init__(self, config: ProviderConfig):
        self.config = config

    @abstractmethod
    async def generate(self, request: GenerationRequest) -> GenerationResult:
        """非流式生成。"""
        pass

    @abstractmethod
    async def generate_stream(
        self, request: GenerationRequest
    ) -> AsyncIterator[str]:
        """流式生成。"""
        pass

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        """获取文本嵌入向量。"""
        pass

    def estimate_cost(self, tokens_input: int, tokens_output: int) -> float:
        """估算调用成本。"""
        return (
            tokens_input / 1000 * self.config.cost_per_1k_input +
            tokens_output / 1000 * self.config.cost_per_1k_output
        )
```

### 8.2 具体 Provider 实现

```python
# src/backend/agents/providers/minimax.py

import httpx
import json

from .base import AIProvider, ProviderConfig, GenerationRequest, GenerationResult


class MiniMaxProvider(AIProvider):
    """MiniMax API Provider。"""

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.client = httpx.AsyncClient(
            base_url=config.base_url,
            timeout=config.timeout,
            headers={
                "Authorization": f"Bearer {config.api_key}",
                "Content-Type": "application/json",
            },
        )

    async def generate(self, request: GenerationRequest) -> GenerationResult:
        payload = {
            "model": self.config.default_model,
            "messages": [
                {"role": "system", "content": request.system_prompt},
                {"role": "user", "content": request.user_content},
            ],
            "temperature": request.temperature,
            "max_tokens": request.max_tokens or self.config.max_tokens,
        }

        if request.response_format == "json":
            # MiniMax 可能不支持原生 JSON mode，需要 prompt engineering
            payload["messages"][0]["content"] += "\n\n你必须返回有效的 JSON 格式。"

        response = await self.client.post("/text/chatcompletion_v2", json=payload)
        response.raise_for_status()
        data = response.json()

        choice = data.get("choices", [{}])[0]
        message = choice.get("message", {})

        return GenerationResult(
            content=message.get("content", ""),
            tokens_input=data.get("usage", {}).get("prompt_tokens", 0),
            tokens_output=data.get("usage", {}).get("completion_tokens", 0),
            model=self.config.default_model,
            provider="minimax",
            finish_reason=choice.get("finish_reason", ""),
        )

    async def generate_stream(self, request: GenerationRequest) -> AsyncIterator[str]:
        payload = {
            "model": self.config.default_model,
            "messages": [
                {"role": "system", "content": request.system_prompt},
                {"role": "user", "content": request.user_content},
            ],
            "temperature": request.temperature,
            "stream": True,
        }

        async with self.client.stream("POST", "/text/chatcompletion_v2", json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        if "content" in delta:
                            yield delta["content"]
                    except (json.JSONDecodeError, KeyError):
                        continue

    async def embed(self, texts: list[str]) -> list[list[float]]:
        # MiniMax 可能不支持 embedding，需要 fallback
        raise NotImplementedError("MiniMax embedding not supported, use fallback provider")
```

```python
# src/backend/agents/providers/openai.py

class OpenAIProvider(AIProvider):
    """OpenAI API Provider。"""

    async def generate(self, request: GenerationRequest) -> GenerationResult:
        # OpenAI 标准接口实现
        pass

    async def embed(self, texts: list[str]) -> list[list[float]]:
        # OpenAI embedding 实现
        pass


# src/backend/agents/providers/anthropic.py

class AnthropicProvider(AIProvider):
    """Anthropic Claude Provider。"""

    async def generate(self, request: GenerationRequest) -> GenerationResult:
        # Claude 接口实现
        pass
```

### 8.3 Provider Router

```python
# src/backend/agents/providers/router.py

from typing import Optional
import random


class ProviderRouter:
    """Provider 路由器，按任务类型/成本/质量/可用性选择 Provider。"""

    def __init__(self):
        self.providers: dict[str, AIProvider] = {}
        self.routing_rules: list[dict] = []
        self.fallback_chain: list[str] = []

    def register_provider(self, name: str, provider: AIProvider) -> None:
        """注册 Provider。"""
        self.providers[name] = provider

    def add_routing_rule(
        self,
        task_type: str,
        preferred_providers: list[str],
        criteria: str = "quality",  # "quality" | "cost" | "speed" | "balanced"
    ) -> None:
        """添加路由规则。"""
        self.routing_rules.append({
            "task_type": task_type,
            "preferred_providers": preferred_providers,
            "criteria": criteria,
        })

    def select_provider(
        self,
        task_type: str,
        priority: AgentPriority = AgentPriority.NORMAL,
        required_capabilities: list[str] = None,
    ) -> AIProvider:
        """选择最适合的 Provider。"""
        # 1. 找到支持所需能力的 Provider
        capable = []
        for name, provider in self.providers.items():
            if self._has_capabilities(provider, required_capabilities):
                capable.append((name, provider))

        if not capable:
            raise ValueError("No provider has required capabilities")

        # 2. 应用路由规则
        rule = self._find_rule(task_type)
        if rule:
            for preferred in rule["preferred_providers"]:
                for name, provider in capable:
                    if name == preferred:
                        return provider

        # 3. 按优先级选择
        if priority == AgentPriority.CRITICAL:
            # 关键任务选最强模型
            return self._select_by_quality(capable)
        elif priority == AgentPriority.HIGH:
            # 高质量任务选质量优先
            return self._select_by_quality(capable)
        elif priority == AgentPriority.NORMAL:
            # 常规任务选平衡
            return self._select_balanced(capable)
        else:
            # 低优先级选成本最低
            return self._select_by_cost(capable)

    def _select_by_quality(self, capable: list) -> AIProvider:
        """选择质量最高的 Provider。"""
        # 按模型能力排序
        quality_rank = {"claude": 3, "openai": 2, "minimax": 1}
        return max(capable, key=lambda x: quality_rank.get(x[0], 0))[1]

    def _select_by_cost(self, capable: list) -> AIProvider:
        """选择成本最低的 Provider。"""
        return min(capable, key=lambda x: x[1].config.cost_per_1k_output)[1]

    def _select_balanced(self, capable: list) -> AIProvider:
        """选择平衡的 Provider。"""
        # 简单的轮询
        return random.choice([p for _, p in capable])
```

### 8.4 配置示例

```python
# config.py 扩展

class Settings(BaseSettings):
    # ... 现有配置 ...

    # Multi-Provider 配置
    ai_primary_provider: str = "minimax"
    ai_fallback_providers: list[str] = ["openai"]

    # MiniMax
    minimax_api_key: str | None = None
    minimax_api_url: str = "https://api.minimax.chat/v1"
    minimax_model: str = "MiniMax-Text-01"

    # OpenAI (可选)
    openai_api_key: str | None = None
    openai_api_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o"

    # Anthropic (可选)
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-4-6"

    # Embedding (用于 RAG)
    embed_provider: str = "openai"  # 或 "minimax" 或本地
    embed_api_key: str | None = None
    embed_model: str = "text-embedding-3-small"

    # Provider 路由规则
    provider_routing_rules: dict = {
        "context_generation": ["minimax", "openai"],
        "deep_analysis": ["openai", "anthropic"],
        "quick_check": ["minimax"],
        "embedding": ["openai"],
    }
```

---

## 9. Agent 配置系统

### 9.1 按题材/流派配置

```python
# src/backend/agents/configs/genre_configs.py

GENRE_CONFIGS = {
    "修仙": {
        "context_agent": {
            "power_system emphasis": True,
            "cultivation_realm_tracking": True,
            "required_fields": ["power_limits", "cultivation_breakthrough"],
        },
        "consistency_checker": {
            "check_dimensions": ["power_level", "realm_rules", "item_rarity", "sect_relations"],
            "severity_weights": {"power_level": 2.0, "realm_rules": 1.5},
        },
        "pacing_checker": {
            "strand_targets": {"quest": 0.55, "fire": 0.25, "constellation": 0.20},
            "red_lines": {
                "quest": {"max_consecutive": 4, "max_gap": 3},
                "fire": {"max_consecutive": 3, "max_gap": 8},
            },
        },
        "style_agent": {
            "default_styles": ["古典", "热血", "细腻"],
            "dialogue_patterns": ["古风对白", "修炼术语"],
        },
    },

    "都市异能": {
        "context_agent": {
            "power_system_emphasis": True,
            "modern_setting_constraints": True,
            "required_fields": ["power_limits", "social_context"],
        },
        "consistency_checker": {
            "check_dimensions": ["power_level", "social_rules", "modern_logic"],
        },
        "pacing_checker": {
            "strand_targets": {"quest": 0.50, "fire": 0.30, "constellation": 0.20},
        },
    },

    "言情": {
        "context_agent": {
            "emotional_depth_emphasis": True,
            "relationship_tracking": True,
            "required_fields": ["emotional_base", "relationship_dynamics"],
        },
        "consistency_checker": {
            "check_dimensions": ["character_emotion", "relationship_logic", "social_context"],
        },
        "pacing_checker": {
            "strand_targets": {"quest": 0.30, "fire": 0.50, "constellation": 0.20},
            "red_lines": {
                "fire": {"max_consecutive": 5, "max_gap": 3},
            },
        },
        "ooc_checker": {
            "emotion_consistency_weight": 2.0,
        },
    },

    "系统流": {
        "context_agent": {
            "system_rules_emphasis": True,
            "progression_tracking": True,
            "required_fields": ["system_rules", "progression_goals"],
        },
        "consistency_checker": {
            "check_dimensions": ["system_rules", "reward_logic", "progression_pacing"],
            "severity_weights": {"system_rules": 3.0},  # 系统规则违反是致命错误
        },
    },
}
```

### 9.2 配置加载与合并

```python
class AgentConfigLoader:
    """Agent 配置加载器。"""

    def __init__(self):
        self.base_config = self._load_base_config()
        self.genre_configs = GENRE_CONFIGS
        self.user_overrides = {}

    def load_config(
        self,
        genre: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> dict:
        """加载合并后的配置。"""
        config = self.base_config.copy()

        # 合并题材配置
        if genre and genre in self.genre_configs:
            config = self._deep_merge(config, self.genre_configs[genre])

        # 合并用户自定义配置
        if user_id and user_id in self.user_overrides:
            config = self._deep_merge(config, self.user_overrides[user_id])

        return config

    def _deep_merge(self, base: dict, override: dict) -> dict:
        """深度合并字典。"""
        result = base.copy()
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        return result
```

### 9.3 用户级配置持久化

```python
# 新增数据库表

class AgentConfiguration(Base):
    """用户级 Agent 配置。"""
    __tablename__ = "agent_configurations"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False)
    genre = Column(String, default="default")
    config_json = Column(Text, nullable=False)  # JSON 格式配置
    is_default = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

---

## 10. 数据流与状态管理

### 10.1 Agent 间数据流

```text
┌─────────────────────────────────────────────────────────────────┐
│                        共享内存 (Shared Memory)                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ chapter_id  │ │chapter_content│ │ outline_data│               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ characters  │ │ world_settings│ │ plot_threads│               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ style_config│ │human_ai_ratio│ │ genre_config│               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │context_result│ │checker_results│ │data_result  │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 事件总线

```python
class AgentEventBus:
    """Agent 事件总线，用于异步通信。"""

    def __init__(self):
        self.subscribers: dict[str, list[Callable]] = {}
        self.event_queue = asyncio.Queue()

    def subscribe(self, event_type: str, handler: Callable) -> None:
        """订阅事件。"""
        if event_type not in self.subscribers:
            self.subscribers[event_type] = []
        self.subscribers[event_type].append(handler)

    async def publish(self, event_type: str, data: dict) -> None:
        """发布事件。"""
        await self.event_queue.put({"type": event_type, "data": data})

    async def process_events(self) -> None:
        """处理事件队列。"""
        while True:
            event = await self.event_queue.get()
            handlers = self.subscribers.get(event["type"], [])
            for handler in handlers:
                try:
                    await handler(event["data"])
                except Exception as e:
                    logger.error(f"Event handler error: {e}")
```

### 10.3 执行日志与追踪

```python
# 新增数据库表

class AgentExecutionLog(Base):
    """Agent 执行日志。"""
    __tablename__ = "agent_execution_logs"

    id = Column(Integer, primary_key=True)
    workflow_id = Column(String, nullable=False)
    agent_id = Column(String, nullable=False)
    agent_type = Column(String, nullable=False)
    status = Column(String, nullable=False)
    input_summary = Column(Text)
    output_summary = Column(Text)
    issues_found = Column(Integer, default=0)
    execution_time_ms = Column(Integer)
    tokens_used = Column(Integer)
    provider = Column(String)
    hallucination_score = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)


class WorkflowExecution(Base):
    """工作流执行记录。"""
    __tablename__ = "workflow_executions"

    id = Column(Integer, primary_key=True)
    workflow_id = Column(String, nullable=False, unique=True)
    workflow_type = Column(String, nullable=False)
    chapter_id = Column(Integer, ForeignKey("chapters.id"))
    status = Column(String, nullable=False)
    composite_score = Column(Integer)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    total_execution_time_ms = Column(Integer)
    total_tokens_used = Column(Integer)
```

---

## 11. 接口设计

### 11.1 Agent Orchestrator API

```python
# src/backend/routes/agents.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Literal

router = APIRouter(prefix="/agents", tags=["agents"])


class WorkflowRequest(BaseModel):
    workflow_type: Literal[
        "chapter_write",
        "chapter_review",
        "settings_init",
        "ifline_sync",
        "full_inspection",
    ]
    chapter_id: Optional[int] = None
    story_id: Optional[int] = None
    genre: Optional[str] = "default"
    human_ai_ratio: Optional[int] = 50


class WorkflowResponse(BaseModel):
    workflow_id: str
    status: str
    results: dict
    execution_time_ms: int


@router.post("/workflow", response_model=WorkflowResponse)
async def execute_workflow(
    request: WorkflowRequest,
    db: AsyncSession = Depends(get_db),
):
    """执行 Agent 工作流。"""
    orchestrator = get_orchestrator()

    context = AgentContext(
        workflow_id=f"wf_{uuid.uuid4().hex[:12]}",
        chapter_id=request.chapter_id,
        story_id=request.story_id,
        user_preferences={
            "human_ai_ratio": request.human_ai_ratio,
            "genre": request.genre,
        },
        genre_config=load_genre_config(request.genre),
    )

    workflow_type = WorkflowType(request.workflow_type)
    results = await orchestrator.execute_workflow(workflow_type, context)

    return WorkflowResponse(
        workflow_id=context.workflow_id,
        status="completed",
        results={k: v.data for k, v in results.items()},
        execution_time_ms=sum(v.execution_time_ms for v in results.values()),
    )


@router.get("/workflow/{workflow_id}/status")
async def get_workflow_status(workflow_id: str):
    """获取工作流执行状态。"""
    pass


@router.post("/workflow/{workflow_id}/cancel")
async def cancel_workflow(workflow_id: str):
    """取消工作流执行。"""
    pass
```

### 11.2 六维检查 API（增强现有）

```python
# src/backend/routes/ai.py 扩展

class FullInspectionRequest(BaseModel):
    chapter_id: int
    depth: Literal["quick", "standard", "deep"] = "standard"
    focus_dimensions: Optional[list[str]] = None  # 只检查指定维度


class FullInspectionResponse(BaseModel):
    chapter_id: int
    composite_score: int
    grade: str
    dimension_scores: dict[str, int]
    issues: list[dict]
    suggestions: list[str]
    fix_queue: list[dict]
    passed: bool
    execution_time_ms: int


@router.post("/inspect/full", response_model=FullInspectionResponse)
async def full_inspection(
    request: FullInspectionRequest,
    db: AsyncSession = Depends(get_db),
):
    """执行完整六维检查。"""
    pipeline = CheckerPipeline(get_provider_router())
    result = await pipeline.run(request.chapter_id, db)

    return FullInspectionResponse(**result)
```

### 11.3 Provider 管理 API

```python
# src/backend/routes/providers.py

class ProviderStatusResponse(BaseModel):
    name: str
    available: bool
    latency_ms: Optional[int]
    queue_depth: int


@router.get("/providers/status")
async def get_provider_status() -> list[ProviderStatusResponse]:
    """获取所有 Provider 状态。"""
    router = get_provider_router()
    statuses = []
    for name, provider in router.providers.items():
        # 健康检查
        try:
            # 发送一个简单请求测试可用性
            available = True
            latency = 0
        except Exception:
            available = False
            latency = None

        statuses.append(ProviderStatusResponse(
            name=name,
            available=available,
            latency_ms=latency,
            queue_depth=0,  # 可扩展为实际队列深度
        ))
    return statuses
```

---

## 12. 实施路线图

### Phase 1: 基础重构（2 周）

| 任务 | 说明 |
|------|------|
| 重构 BaseAgent | 实现新的抽象基类，统一 Agent 接口 |
| 重构 BaseChecker | 实现分层检查机制（快速扫描 + 深度分析） |
| Provider 抽象层 | 实现 AIProvider 基类、MiniMaxProvider |
| 配置系统 | 实现 AgentConfigLoader、题材配置 |

### Phase 2: 核心增强（2 周）

| 任务 | 说明 |
|------|------|
| Context Agent 增强 | 接入 Strand 数据、反幻觉校验 |
| Data Agent 增强 | 实体消歧、增量更新、状态版本化 |
| 六维检查深化 | 实现分层检查、量化评分、交叉验证 |
| Strand Tracker | 实现 Strand 记录、红线检查、推荐系统 |

### Phase 3: 新 Agent 开发（2 周）

| 任务 | 说明 |
|------|------|
| Review Agent | 多轮审查、修复建议 |
| Plot Agent | 情节规划、伏笔管理 |
| Style Agent | 风格分析、迁移、人机比例适配 |
| Chat Agent | 主动提问、信息熵策略 |
| IFLine Agent | IF 线同步、时间线合并 |

### Phase 4: 编排与集成（2 周）

| 任务 | 说明 |
|------|------|
| Agent Orchestrator | 工作流引擎、拓扑排序、事件总线 |
| 反幻觉流水线 | OutlineLawEnforcer、SettingPhysicsEnforcer、InventionIdentifier |
| 多 Provider 支持 | OpenAI/Anthropic Provider、Provider Router |
| API 路由扩展 | 新端点、增强现有端点 |

### Phase 5: 观测与优化（1 周）

| 任务 | 说明 |
|------|------|
| 执行日志系统 | AgentExecutionLog、WorkflowExecution |
| 性能监控 | 延迟、Token 消耗、成功率 |
| 缓存优化 | 结果缓存、上下文缓存 |
| 降级策略 | Provider 故障自动切换 |

---

## 附录

### A. 文件结构规划

```
src/backend/agents/
├── __init__.py
├── base.py                    # BaseAgent, AgentContext, AgentResult
├── orchestrator.py            # AgentOrchestrator, WorkflowEngine
├── event_bus.py               # AgentEventBus
├── config.py                  # AgentConfigLoader, genre configs
│
├── providers/                 # 多 Provider 支持
│   ├── __init__.py
│   ├── base.py                # AIProvider 抽象基类
│   ├── minimax.py             # MiniMax Provider
│   ├── openai.py              # OpenAI Provider
│   ├── anthropic.py           # Anthropic Provider
│   └── router.py              # ProviderRouter
│
├── context_agent.py           # ContextAgent（增强）
├── data_agent.py              # DataAgent（增强）
├── review_agent.py            # ReviewAgent（新增）
├── plot_agent.py              # PlotAgent（新增）
├── style_agent.py             # StyleAgent（新增）
├── chat_agent.py              # ChatAgent（新增）
├── ifline_agent.py            # IFLineAgent（新增）
│
├── checkers/                  # 六维检查器
│   ├── __init__.py
│   ├── base_checker.py        # BaseChecker（重构）
│   ├── consistency_checker.py # ConsistencyChecker（深化）
│   ├── continuity_checker.py  # ContinuityChecker（深化）
│   ├── pacing_checker.py      # PacingChecker（深化）
│   ├── ooc_checker.py         # OOCChecker（深化）
│   ├── high_point_checker.py  # HighPointChecker（深化）
│   └── reader_pull_checker.py # ReaderPullChecker（深化）
│
├── hallucination/             # 反幻觉机制
│   ├── __init__.py
│   ├── outline_enforcer.py    # OutlineLawEnforcer
│   ├── setting_enforcer.py    # SettingPhysicsEnforcer
│   └── invention_identifier.py # InventionIdentifier
│
├── strand/                    # Strand Weave
│   ├── __init__.py
│   ├── tracker.py             # StrandTracker
│   └── models.py              # StrandRecord, StrandRedLineLog
│
└── utils.py                   # 共享工具（保留现有）
```

### B. 数据库迁移

```sql
-- Strand 记录表
CREATE TABLE strand_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL REFERENCES chapters(id),
    quest_ratio REAL DEFAULT 0,
    fire_ratio REAL DEFAULT 0,
    constellation_ratio REAL DEFAULT 0,
    dominant_strand TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Strand 红线告警
CREATE TABLE strand_red_line_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL REFERENCES chapters(id),
    strand_type TEXT NOT NULL,
    violation_type TEXT,
    violation_count INTEGER,
    red_line_value INTEGER,
    resolved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Agent 配置表
CREATE TABLE agent_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    genre TEXT DEFAULT 'default',
    config_json TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Agent 执行日志
CREATE TABLE agent_execution_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    agent_type TEXT NOT NULL,
    status TEXT NOT NULL,
    input_summary TEXT,
    output_summary TEXT,
    issues_found INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    tokens_used INTEGER,
    provider TEXT,
    hallucination_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 工作流执行记录
CREATE TABLE workflow_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT NOT NULL UNIQUE,
    workflow_type TEXT NOT NULL,
    chapter_id INTEGER REFERENCES chapters(id),
    status TEXT NOT NULL,
    composite_score INTEGER,
    started_at DATETIME,
    completed_at DATETIME,
    total_execution_time_ms INTEGER,
    total_tokens_used INTEGER
);
```

---

> 本文档为 Agent 系统与 AI 工作流的完整架构设计，涵盖了从现有代码重构到新功能开发的全部规划。实施时应按路线图分阶段推进，确保每个阶段的稳定性后再进入下一阶段。
