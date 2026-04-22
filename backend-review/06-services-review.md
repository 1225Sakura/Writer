# 服务层审查报告 (Services Layer Review)

**审查范围:** `src/backend/services/` 和 `src/backend/core/services/`
**审查时间:** 2026-04-22
**审查人:** reviewer-1

---

## 一、服务概览与职责划分

### 1.1 服务分类

服务层按职责可分为以下几类：

| 类别 | 服务 | 状态 |
|------|------|------|
| **核心业务服务** | `CharacterService`, `ChapterService`, `OutlineService`, `ChatService` | 已迁移至 `core/services/` |
| **数据访问层** | `database_service.py` | 遗留模块，CRUD函数式 |
| **AI/生成服务** | `AIService`, `ProviderRouter`, `MiniMaxProvider`, `OpenAICompatibleProvider` | 完整实现 |
| **缓存服务** | `CacheService`, `TieredCache` | LRU+L2磁盘+L3数据库三层 |
| **预热服务** | `PreloadService` | 应用启动时加载热点数据 |
| **RAG/检索** | `RAGAdapter`, `ContextManager` | 向量+BM25混合检索 |
| **可观测性** | `MetricsService`, `Observability` | 指标采集+历史时序 |
| **工作流** | `WorkflowExecutionService` | 工作流执行持久化 |

### 1.2 服务入口代理模式

多个服务使用了**代理模块模式**（proxy module），实际实现已迁移至 `core/services/`:

```
services/chat_service.py  →  backend.core.services.chat.chat_service
services/chapter_service.py →  backend.core.services.chapter.chapter_service
services/ai_service.py    →  backend.core.services.ai.ai_service
```

这种模式的好处是保持向后兼容，但需要注意避免代码重复和职责混乱。

---

## 二、职责划分评估

### 2.1 清晰之处

**1. 分层清晰**
- `core/services/` 下的服务负责业务逻辑（CRUD+事件发布）
- `services/` 下的服务负责基础设施（缓存、可观测性、预热）

**2. 单一职责执行良好**
- `MetricsService`: 仅负责指标采集
- `PreloadService`: 仅负责启动预热
- `WorkflowExecutionService`: 仅负责工作流执行记录

**3. 事件驱动设计**
核心服务（Character/Chapter/Outline）使用 `AsyncEventBus` 发布实体变更事件：
```python
await self.event_bus.publish(ENTITY_CREATED, {"entity_type": "character", "id": ...})
```

### 2.2 问题与改进建议

**问题1: `database_service.py` 是遗留的贫血模式**

`src/backend/services/database_service.py` 是一个**模块级函数集合**，不是类服务。它直接暴露 `async def get_character()`, `async def create_character()` 等函数，内部管理自己的 session。这与 `core/services/` 下的类服务模式不一致。

**建议**: 逐步废弃此模块，将所有调用迁移到 `CharacterService`/`ChapterService` 等类服务。

**问题2: 服务粒度不统一**

部分服务是类服务（如 `CharacterService`），部分仍是模块级函数（如 `database_service.py` 中的函数）。这导致：
- 依赖注入方式不统一
- 测试时 mock 方式不一致

**建议**: 统一使用类服务模式。

**问题3: `cache_service` 同时承担两套职责**

`CacheService` 既是一个完整的缓存服务（包含LRU、磁盘缓存），又通过模块级便捷函数（如 `get_cached_character`）暴露。这种设计导致：
- 缓存键管理分散
- 缓存逻辑与业务逻辑耦合

**建议**: 保留 `CacheService` 作为基础设施，将便捷函数逐步迁移到各自对应的服务类中。

---

## 三、业务逻辑封装

### 3.1 核心服务（Character/Chapter/Outline）

这些服务遵循统一模式：

```python
class XxxService:
    def __init__(self, db: AsyncSession, event_bus: AsyncEventBus):
        self.db = db
        self.event_bus = event_bus
        self.repo = XxxRepository(db)

    async def create_xxx(self, data: dict) -> Xxx:
        instance = await self.repo.create(data)
        await cache_service.ainvalidate_tag("xxx")
        await self.event_bus.publish(ENTITY_CREATED, ...)
        return instance
```

**优点**:
- 统一的生命周期管理
- 事件发布机制完善
- 缓存失效自动处理

**缺点**:
- 每个服务都直接依赖 `cache_service`，违反依赖倒置
- 事件总线是直接实例引用，难以测试

### 3.2 `WorkflowExecutionService`

专门负责工作流执行记录，包含 `create_execution`, `complete_execution`, `log_agent_execution` 等方法。设计良好，职责单一。

### 3.3 `AIService`

AI服务封装完善，支持：
- 多Provider自动路由与故障转移
- 系统提示词模板化（Style prompts）
- 温度参数根据 `human_ai_ratio` 动态计算
- 结果缓存避免重复API调用

---

## 四、外部API调用（MiniMax等）

### 4.1 ProviderRouter 故障转移机制

`ProviderRouter` 实现了完整的**多Provider故障转移**：

```python
async def generate_stream(...):
    for provider in self._ordered_providers("generate"):
        try:
            stream = provider.generate_stream(...)
            first_chunk = await stream.__anext__()  # 提前验证连接
            ...
```

**健康检查机制**:
- 滑动窗口错误率监控（5分钟窗口，50%阈值）
- 降级冷却期（60秒）
- 自动恢复

**问题**: 流式传输场景下，一旦开始从某Provider yield数据，中途失败无法透明转移到其他Provider（设计已知）。

### 4.2 MiniMaxProvider

```python
class MiniMaxProvider(AIProvider):
    async def generate_stream(self, prompt, style, operation):
        # 调用 MiniMax Chat API v1
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/text/chatcompletion_v2",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=payload,
                timeout=self.timeout
            )
```

**问题**: API URL硬编码为 `https://api.minimax.chat/v1`，不够灵活。配置应从 `settings` 读取。

### 4.3 RAGAdapter 嵌入调用

`RAGAdapter` 直接调用 MiniMax 嵌入API：

```python
async def _embed_via_minimax(self, texts: List[str]) -> List[Optional[List[float]]]:
    url = f"{settings.minimax_api_url}/embeddings"  # 复用 minimax_api_url
```

这里复用了 MiniMax 的API URL，但嵌入端点与Chat端点可能不同，存在耦合风险。

---

## 五、缓存服务实现

### 5.1 CacheService (L1内存LRU)

```python
class LRUCache:
    def __init__(self, max_size: int = 128, default_ttl: int = 300):
        self._cache: OrderedDict[str, tuple[Any, float]] = OrderedDict()
```

**设计特点**:
- 使用 `OrderedDict` 实现LRU
- TTL过期检查在get时进行（惰性删除）
- 按实体类型分桶（character, chapter, world_setting等）

**缓存分区**:
```python
self._character_cache = LRUCache(max_size=256, default_ttl=300)
self._chapter_cache = LRUCache(max_size=128, default_ttl=180)
self._ai_result_cache = LRUCache(max_size=100, default_ttl=3600)
```

### 5.2 TieredCache (L1+L2+L3三层)

```python
class TieredCache:
    # L1: 内存LRU
    # L2: diskcache (磁盘)
    # L3: SQLite数据库 cache_entries表
```

**问题**: `_l3_get` 等方法直接使用 raw `db.execute()` 而非 SQLAlchemy，与应用其他部分不一致。

### 5.3 PreloadService 启动预热

```python
async def preload_all(self) -> dict[str, Any]:
    await self._safe_preload("settings", self.preload_settings)
    await self._safe_preload("recent_chapters", self.preload_recent_chapters)
    ...
```

**问题**: `PreloadService` 依赖 `async_session_maker` 和 `cache_service`，但初始化时传入 `tiered_cache` 为 Optional，逻辑不清晰。

---

## 六、服务间依赖关系

### 6.1 依赖图（关键路径）

```
API Routes
    ├── CharacterService (core/services/character/)
    │       └── CharacterRepository, AsyncEventBus, cache_service
    ├── ChapterService (core/services/chapter/)
    │       └── ChapterRepository, AsyncEventBus, cache_service
    ├── AIService (core/services/ai/)
    │       └── ProviderRouter → MiniMaxProvider / OpenAICompatibleProvider
    └── RAGAdapter (core/services/ai/)
            └── ContextManager, AIService
```

### 6.2 问题

**问题1: 循环依赖风险**

`RAGAdapter` 导入 `from backend.core.services.ai.ai_service import ai_service`，而 `AIService` 又导入 `RAGAdapter`（通过 `rag_adapter` 模块）。实际 `ai_service.py` 不直接依赖 `rag_adapter`，但 `services/rag_adapter.py` 指向 `core/services/ai/rag_adapter.py`，需要确认是否有循环。

**问题2: 全局单例滥用**

多个模块使用 `cache_service` 单例：
```python
# services/database_service.py
from backend.services.cache_service import cache_service, get_cached_character, ...

# core/services/character/character_service.py
from backend.services.cache_service import cache_service
```

这使得服务间隐式耦合，难以测试。

---

## 七、其他问题汇总

| # | 问题 | 严重程度 | 位置 |
|---|------|----------|------|
| 1 | `database_service.py` 是函数式遗留模块，与类服务模式不统一 | 中 | `services/database_service.py` |
| 2 | `TieredCache._l3_*` 使用 raw SQL 而非 SQLAlchemy | 低 | `services/tiered_cache.py` |
| 3 | MiniMax API URL 硬编码 | 低 | `services/ai/minimax.py` |
| 4 | 全局单例 `cache_service` 隐式耦合 | 中 | 多处 |
| 5 | `PreloadService` 初始化参数不一致 | 低 | `services/preload_service.py` |
| 6 | 代理模块（redirect）可能导致混淆 | 低 | `services/chat_service.py` 等 |

---

## 八、总结

### 8.1 优点

1. **三层缓存架构完整**: LRU + 磁盘 + 数据库，缓存策略清晰
2. **Provider路由健壮**: 自动故障转移、健康检查、指标采集
3. **RAG系统完善**: 向量+BM25混合检索，RRF融合，图增强搜索
4. **指标采集全面**: 环缓冲区设计，时序历史，WebSocket连接追踪
5. **事件驱动设计**: 实体变更通过EventBus发布

### 8.2 需要改进

1. 逐步废弃 `database_service.py` 的函数式接口，统一到类服务
2. 消除全局单例依赖，改用依赖注入
3. 统一 `TieredCache` L3层的数据库访问方式（用SQLAlchemy）
4. 配置外部API URL而非硬编码

### 8.3 架构建议

```
services/
├── infrastructure/          # 基础设施（缓存、可观测性）
│   ├── cache_service.py
│   ├── tiered_cache.py
│   ├── metrics_service.py
│   └── preload_service.py
├── ai/                     # AI相关
│   ├── provider.py
│   ├── minimax.py
│   ├── openai_compatible.py
│   └── router.py
├── rag/                    # RAG相关（可选独立模块）
│   ├── context_manager.py
│   └── rag_adapter.py
└── workflow/
    └── workflow_service.py

core/services/
├── character/
├── chapter/
├── outline/
├── chat/
└── ai/
    ├── ai_service.py
    └── rag_adapter.py (RAGAdapter在ai子目录下更合理)
```

---

*报告生成时间: 2026-04-22*
