# 服务层与业务逻辑架构设计文档

## 1. 当前架构评估

### 1.1 现有代码结构

```
src/backend/
├── services/
│   ├── ai_service.py          # MiniMax API 封装
│   ├── cache_service.py       # 混合缓存 (LRU + Disk)
│   ├── export_import.py       # 导入导出逻辑
│   └── task_queue.py          # 后台任务队列
├── agents/
│   ├── context_agent.py       # 创作执行包生成
│   ├── data_agent.py          # 实体提取与结构化
│   ├── checkers/              # 质量检查器 (6个)
│   └── utils.py               # Agent 基础工具
├── routes/
│   ├── chapters.py            # 章节/大纲/IF线路由
│   ├── settings.py            # 设定管理路由
│   ├── ai.py                  # AI 生成/审查路由
│   ├── chat.py                # 聊天会话路由
│   └── export_import.py       # 导入导出路由
├── models/entities.py         # SQLAlchemy 实体
├── database.py                # 数据库连接
└── config.py                  # 配置管理
```

### 1.2 评估发现的问题

| 维度 | 现状 | 问题 | 风险等级 |
|------|------|------|----------|
| **业务逻辑与路由分离** | 路由层直接操作数据库 (`db.execute`, `db.add`) | 无 Service 层，业务逻辑散落在路由中 | 高 |
| **Repository 模式** | 未使用，路由直接调用 SQLAlchemy | 数据访问与业务逻辑耦合 | 高 |
| **事务管理** | 依赖 `get_db()` 自动 commit/rollback | 复杂业务缺乏显式事务控制 | 中 |
| **服务依赖** | 直接实例化 (`AIService(...)`) | 无依赖注入，难以测试和替换 | 高 |
| **AI Provider 抽象** | 仅支持 MiniMax | 硬编码 API 调用，无法切换 Provider | 高 |
| **缓存策略** | 全局单例 `cache_service` | 缓存与业务逻辑混合，难以统一管理 | 中 |
| **事件机制** | 无 | 无法解耦跨模块操作 | 中 |
| **后台任务** | 基础 asyncio Queue | 无任务优先级、无定时任务、无重试策略 UI | 中 |

### 1.3 关键代码异味示例

**路由层直接操作数据库（settings.py:320-391）:**

```python
# 反模式：路由层包含完整 CRUD 逻辑
@router.get("/characters")
async def list_characters(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    query = select(Character)
    if tier:
        query = query.where(Character.tier == tier)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()
```

**AI Service 硬编码（ai_service.py:88-119）:**

```python
# 反模式：HTTP 客户端与 Provider 耦合
async with httpx.AsyncClient(timeout=60.0) as client:
    async with client.stream("POST", f"{self.base_url}/text/chatcompletion_v2", ...) as response:
        # 仅支持 MiniMax 的响应格式
```

**Checker 重复的数据库查询模式（所有 checkers）:**

```python
# 反模式：每个 Checker 独立查询 Chapter + DraftVersion
result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
chapter = result.scalar_one_or_none()
result = await db.execute(select(DraftVersion).where(...))
draft = result.scalar_one_or_none()
```

---

## 2. 目标服务层架构

### 2.1 总体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              API Routes 层                               │
│  (请求验证、参数解析、HTTP 响应组装，无业务逻辑)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                           Application Services 层                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐ │
│  │ StoryService │ │CharacterSvc  │ │ ChapterSvc   │ │  ChatService    │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐ │
│  │  AIService   │ │ExportService │ │SettingService│ │  TaskService    │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│                           Domain Services 层                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐ │
│  │ContextBuilder│ │EntityExtractor│ │QualityChecker│ │ StyleManager    │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│                           Repository 层                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐ │
│  │CharacterRepo │ │  StoryRepo   │ │  ChatRepo    │ │  CacheRepo      │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│                           Infrastructure 层                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐ │
│  │  SQLite/DB   │ │ AI Provider  │ │  File Store  │ │  Event Bus      │ │
│  │  (SQLAlchemy)│ │  (Abstract)  │ │  (Export)    │ │  (Async)        │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 分层职责

| 层级 | 职责 | 禁止事项 |
|------|------|----------|
| **Routes** | HTTP 请求/响应、参数校验、认证授权、限流 | 直接操作数据库、包含业务逻辑 |
| **App Services** | 编排领域服务、事务管理、缓存策略、权限检查 | 直接 SQL 查询、原始 HTTP 调用 |
| **Domain Services** | 核心业务逻辑、AI 编排、规则引擎 | 依赖具体存储实现 |
| **Repositories** | 数据访问抽象、查询构建、ORM 映射 | 包含业务规则 |
| **Infrastructure** | 数据库连接、API 客户端、文件 I/O、消息队列 | 引用上层业务逻辑 |

---

## 3. 领域服务划分

### 3.1 服务矩阵

| 服务 | 职责 | 依赖 | 对应路由 |
|------|------|------|----------|
| `StoryService` | 大纲管理、章节 CRUD、IF 线同步、版本控制 | StoryRepo, ChapterRepo, IFLineRepo | chapters.py |
| `CharacterService` | 角色 CRUD、关系管理、故事线追踪 | CharacterRepo, RelationshipRepo | settings.py |
| `WorldService` | 世界设定、物品、地点、势力、规则管理 | WorldRepo, ItemRepo, LocationRepo, FactionRepo, RuleRepo | settings.py |
| `ChatService` | 会话管理、消息处理、实体提取协调 | ChatRepo, EntityRepo | chat.py |
| `AIService` | AI 生成、风格管理、多 Provider 调度 | AIProvider, CacheRepo | ai.py |
| `ReviewService` | 设定审查、章节检查、质量评分 | AIService, StoryService | ai.py |
| `ExportService` | 项目导出/导入、格式转换、冲突解决 | 所有 Repositories | export_import.py |
| `TaskService` | 后台任务提交、状态查询、取消 | TaskRepo, TaskQueue | tasks.py |
| `SettingService` | 写作设置、全局配置 | WritingSettingsRepo | settings.py |
| `CacheService` | 缓存读写、失效策略、统计 | CacheRepo | cache.py |

### 3.2 服务类定义

```python
# services/story_service.py
class StoryService:
    """故事结构管理服务：大纲、章节、IF线、版本。"""

    def __init__(
        self,
        story_repo: StoryRepository,
        chapter_repo: ChapterRepository,
        ifline_repo: IFLineRepository,
        draft_repo: DraftRepository,
        cache_repo: CacheRepository,
        event_bus: EventBus,
    ):
        self._story_repo = story_repo
        self._chapter_repo = chapter_repo
        self._ifline_repo = ifline_repo
        self._draft_repo = draft_repo
        self._cache = cache_repo
        self._events = event_bus

    async def create_outline(self, data: OutlineCreateDTO) -> OutlineDTO:
        """创建大纲，触发领域事件。"""
        outline = await self._story_repo.create(data)
        await self._events.publish(OutlineCreatedEvent(outline_id=outline.id))
        await self._cache.invalidate("outlines:*")
        return OutlineDTO.from_entity(outline)

    async def get_chapter_with_context(self, chapter_id: int) -> ChapterContextDTO:
        """获取章节及其完整上下文（用于写作界面）。"""
        chapter = await self._chapter_repo.get_by_id(chapter_id)
        if not chapter:
            raise ChapterNotFoundError(chapter_id)

        outline = await self._story_repo.get_by_id(chapter.outline_id) if chapter.outline_id else None
        previous = await self._chapter_repo.get_previous(chapter_id)
        drafts = await self._draft_repo.get_by_chapter(chapter_id, limit=5)

        return ChapterContextDTO(
            chapter=ChapterDTO.from_entity(chapter),
            outline=OutlineDTO.from_entity(outline) if outline else None,
            previous_chapter=ChapterDTO.from_entity(previous) if previous else None,
            recent_drafts=[DraftDTO.from_entity(d) for d in drafts],
        )

    async def sync_if_line(self, if_line_id: int, source_chapter_id: int) -> SyncResult:
        """同步 IF 线与主线进度。"""
        if_line = await self._ifline_repo.get_by_id(if_line_id)
        if not if_line:
            raise IFLineNotFoundError(if_line_id)

        if if_line.sync_mode == "manual":
            return SyncResult(status="skipped", reason="manual_mode")

        # 获取主线章节关键事件
        source_chapter = await self._chapter_repo.get_by_id(source_chapter_id)
        # 触发 IF 线内容生成
        await self._events.publish(IFLineSyncRequestedEvent(
            if_line_id=if_line_id,
            source_chapter_id=source_chapter_id,
        ))
        return SyncResult(status="queued")

    async def create_draft_version(
        self,
        chapter_id: int,
        content: str,
        ai_generated: bool = False,
    ) -> DraftVersionDTO:
        """创建新版本，自动递增版本号。"""
        latest = await self._draft_repo.get_latest(chapter_id)
        version_number = (latest.version_number + 1) if latest else 1

        draft = await self._draft_repo.create(
            chapter_id=chapter_id,
            content=content,
            version_number=version_number,
            ai_generated=ai_generated,
        )

        # 更新章节字数统计
        word_count = len(content)
        await self._chapter_repo.update_word_count(chapter_id, word_count)

        await self._events.publish(DraftCreatedEvent(
            chapter_id=chapter_id,
            version_number=version_number,
            ai_generated=ai_generated,
        ))
        return DraftVersionDTO.from_entity(draft)
```

```python
# services/character_service.py
class CharacterService:
    """角色管理服务：角色、关系、故事线。"""

    def __init__(
        self,
        character_repo: CharacterRepository,
        relationship_repo: RelationshipRepository,
        storyline_repo: StorylineRepository,
        cache_repo: CacheRepository,
        event_bus: EventBus,
    ):
        self._character_repo = character_repo
        self._relationship_repo = relationship_repo
        self._storyline_repo = storyline_repo
        self._cache = cache_repo
        self._events = event_bus

    async def create_character(self, data: CharacterCreateDTO) -> CharacterDTO:
        """创建角色，检查名称唯一性。"""
        existing = await self._character_repo.get_by_name(data.name)
        if existing:
            raise DuplicateCharacterError(data.name)

        character = await self._character_repo.create(data)
        await self._cache.invalidate("characters:*")
        await self._events.publish(CharacterCreatedEvent(character_id=character.id))
        return CharacterDTO.from_entity(character)

    async def update_character_relationships(
        self,
        character_id: int,
        relationships: list[RelationshipUpdateDTO],
    ) -> list[RelationshipDTO]:
        """批量更新角色关系，维护双向一致性。"""
        character = await self._character_repo.get_by_id(character_id)
        if not character:
            raise CharacterNotFoundError(character_id)

        async with self._character_repo.unit_of_work() as uow:
            # 删除旧关系
            await self._relationship_repo.delete_by_character(character_id)
            # 创建新关系
            results = []
            for rel in relationships:
                # 验证目标角色存在
                target = await self._character_repo.get_by_id(rel.target_id)
                if not target:
                    raise CharacterNotFoundError(rel.target_id)

                new_rel = await self._relationship_repo.create(
                    character_id=character_id,
                    target_id=rel.target_id,
                    type=rel.type,
                    description=rel.description,
                )
                results.append(RelationshipDTO.from_entity(new_rel))

            await uow.commit()

        await self._cache.invalidate(f"character:{character_id}:relationships")
        return results

    async def get_character_network(self, character_id: int) -> CharacterNetworkDTO:
        """获取角色的关系网络（用于可视化）。"""
        cache_key = f"character:{character_id}:network"
        cached = await self._cache.get(cache_key)
        if cached:
            return CharacterNetworkDTO.parse_raw(cached)

        character = await self._character_repo.get_by_id(character_id)
        if not character:
            raise CharacterNotFoundError(character_id)

        relationships = await self._relationship_repo.get_by_character(character_id)
        storylines = await self._storyline_repo.get_by_character(character_id)

        # 构建网络节点和边
        nodes = [CharacterNodeDTO.from_entity(character)]
        edges = []
        for rel in relationships:
            target = await self._character_repo.get_by_id(rel.target_id)
            if target:
                nodes.append(CharacterNodeDTO.from_entity(target))
                edges.append(RelationshipEdgeDTO.from_entity(rel))

        network = CharacterNetworkDTO(nodes=nodes, edges=edges, storylines=[...])
        await self._cache.set(cache_key, network.json(), ttl=300)
        return network
```

```python
# services/ai_service.py
class AIService:
    """AI 生成服务：多 Provider 调度、风格管理、缓存。"""

    def __init__(
        self,
        provider: AIProvider,
        cache_repo: CacheRepository,
        settings_repo: WritingSettingsRepository,
    ):
        self._provider = provider
        self._cache = cache_repo
        self._settings = settings_repo

    async def generate(
        self,
        prompt: str,
        operation: WritingOperation,
        human_ai_ratio: int | None = None,
        style: str | None = None,
        use_cache: bool = True,
    ) -> AsyncIterator[str]:
        """流式生成内容，支持缓存和参数继承。"""
        # 继承全局设置
        if human_ai_ratio is None or style is None:
            settings = await self._settings.get()
            human_ai_ratio = human_ai_ratio or int(settings.human_ai_ratio * 100)
            style = style or settings.writing_style

        # 缓存检查（仅非流式或完整结果缓存）
        if use_cache:
            cache_key = self._make_cache_key(prompt, operation, style, human_ai_ratio)
            cached = await self._cache.get(f"ai:{cache_key}")
            if cached:
                yield cached["content"]
                return

        temperature = self._calculate_temperature(human_ai_ratio)
        system_prompt = self._get_system_prompt(style)
        instruction = self._get_operation_instruction(operation)
        full_prompt = f"{system_prompt}\n\n{instruction}\n\n{prompt}"

        chunks = []
        async for chunk in self._provider.stream_generate(
            prompt=full_prompt,
            temperature=temperature,
        ):
            chunks.append(chunk)
            yield chunk

        # 缓存完整结果
        if use_cache:
            full_content = "".join(chunks)
            await self._cache.set(
                f"ai:{cache_key}",
                {"content": full_content, "operation": operation.value},
                ttl=3600,
            )

    async def review_settings(self, settings_data: dict) -> ReviewResultDTO:
        """审查设定一致性。"""
        cache_key = self._make_cache_key(str(settings_data), "review", "default", 50)
        cached = await self._cache.get(f"ai:{cache_key}")
        if cached:
            return ReviewResultDTO.parse_obj(cached)

        result = await self._provider.complete(
            system_prompt=REVIEW_SYSTEM_PROMPT,
            user_content=str(settings_data),
            temperature=0.5,
        )

        review = ReviewResultDTO(
            review_content=result.content,
            raw_response=result.raw,
        )
        await self._cache.set(f"ai:{cache_key}", review.dict(), ttl=3600)
        return review

    def _calculate_temperature(self, human_ai_ratio: int) -> float:
        """根据人机比例计算 temperature。"""
        return 0.3 + 0.7 * (1 - human_ai_ratio / 100)

    def _get_system_prompt(self, style: str) -> str:
        """获取风格对应的系统提示。"""
        return STYLE_PROMPTS.get(style, STYLE_PROMPTS["default"])

    def _make_cache_key(self, *parts) -> str:
        """生成缓存键。"""
        import hashlib
        data = "|".join(str(p) for p in parts)
        return hashlib.md5(data.encode()).hexdigest()
```

```python
# services/review_service.py
class ReviewService:
    """质量审查服务：协调多个 Checker，生成综合报告。"""

    def __init__(
        self,
        ai_service: AIService,
        story_service: StoryService,
        character_service: CharacterService,
        checkers: dict[str, QualityChecker],
    ):
        self._ai = ai_service
        self._story = story_service
        self._character = character_service
        self._checkers = checkers

    async def inspect_chapter(self, chapter_id: int) -> InspectionReportDTO:
        """对章节进行全面审查。"""
        chapter = await self._story.get_chapter_with_context(chapter_id)
        if not chapter:
            raise ChapterNotFoundError(chapter_id)

        # 并行执行所有检查器
        checks = await asyncio.gather(
            self._checkers["consistency"].check(chapter_id),
            self._checkers["continuity"].check(chapter_id),
            self._checkers["pacing"].check(chapter_id),
            self._checkers["high_point"].check(chapter_id),
            self._checkers["reader_pull"].check(chapter_id),
            return_exceptions=True,
        )

        results = {}
        for name, result in zip(["consistency", "continuity", "pacing", "high_point", "reader_pull"], checks):
            if isinstance(result, Exception):
                results[name] = CheckResultDTO(score=0, issues=[f"检查失败: {result}"], suggestions=[])
            else:
                results[name] = CheckResultDTO.parse_obj(result)

        # 计算综合评分
        total_score = sum(r.score for r in results.values()) / len(results)

        return InspectionReportDTO(
            chapter_id=chapter_id,
            overall_score=int(total_score),
            checks=results,
            summary=self._generate_summary(results),
        )

    def _generate_summary(self, results: dict[str, CheckResultDTO]) -> str:
        """生成审查总结。"""
        issues = []
        for name, result in results.items():
            if result.score < 60:
                issues.append(f"{name}: 需要改进 ({result.score}分)")
            elif result.score < 80:
                issues.append(f"{name}: 良好 ({result.score}分)")
            else:
                issues.append(f"{name}: 优秀 ({result.score}分)")
        return "\n".join(issues)
```

---

## 4. Repository 层设计

### 4.1 Repository 接口定义

```python
# repositories/base.py
from typing import TypeVar, Generic, Protocol
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")

class Repository(Protocol, Generic[T]):
    """基础 Repository 接口。"""

    async def get_by_id(self, id: int) -> T | None: ...
    async def list(self, skip: int = 0, limit: int = 100, **filters) -> list[T]: ...
    async def create(self, data: dict) -> T: ...
    async def update(self, id: int, data: dict) -> T | None: ...
    async def delete(self, id: int) -> bool: ...
    async def exists(self, id: int) -> bool: ...


class UnitOfWork(Protocol):
    """工作单元接口。"""

    async def __aenter__(self): ...
    async def __aexit__(self, exc_type, exc_val, exc_tb): ...
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...
```

```python
# repositories/character_repository.py
class CharacterRepository:
    """角色数据访问。"""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_id(self, id: int) -> Character | None:
        result = await self._session.execute(
            select(Character).where(Character.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Character | None:
        result = await self._session.execute(
            select(Character).where(Character.name == name)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        skip: int = 0,
        limit: int = 100,
        tier: str | None = None,
    ) -> list[Character]:
        query = select(Character)
        if tier:
            query = query.where(Character.tier == tier)
        result = await self._session.execute(query.offset(skip).limit(limit))
        return result.scalars().all()

    async def create(self, data: CharacterCreateDTO) -> Character:
        character = Character(**data.model_dump())
        self._session.add(character)
        await self._session.flush()
        await self._session.refresh(character)
        return character

    async def update(self, id: int, data: dict) -> Character | None:
        character = await self.get_by_id(id)
        if not character:
            return None
        for key, value in data.items():
            setattr(character, key, value)
        character.updated_at = datetime.utcnow()
        await self._session.flush()
        return character

    async def delete(self, id: int) -> bool:
        character = await self.get_by_id(id)
        if not character:
            return False
        await self._session.delete(character)
        return True

    async def get_with_relations(self, id: int) -> Character | None:
        result = await self._session.execute(
            select(Character)
            .options(
                selectinload(Character.relationships),
                selectinload(Character.storylines),
            )
            .where(Character.id == id)
        )
        return result.scalar_one_or_none()
```

```python
# repositories/chapter_repository.py
class ChapterRepository:
    """章节数据访问。"""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_id(self, id: int) -> Chapter | None:
        result = await self._session.execute(
            select(Chapter).where(Chapter.id == id)
        )
        return result.scalar_one_or_none()

    async def get_previous(self, chapter_id: int) -> Chapter | None:
        """获取前一章节。"""
        chapter = await self.get_by_id(chapter_id)
        if not chapter or not chapter.outline_id:
            return None
        result = await self._session.execute(
            select(Chapter)
            .where(
                Chapter.outline_id == chapter.outline_id,
                Chapter.chapter_order == chapter.chapter_order - 1,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_outline(
        self,
        outline_id: int,
        status: str | None = None,
    ) -> list[Chapter]:
        query = select(Chapter).where(Chapter.outline_id == outline_id)
        if status:
            query = query.where(Chapter.status == status)
        result = await self._session.execute(
            query.order_by(Chapter.chapter_order.asc())
        )
        return result.scalars().all()

    async def update_word_count(self, chapter_id: int, word_count: int) -> None:
        await self._session.execute(
            update(Chapter)
            .where(Chapter.id == chapter_id)
            .values(word_count=word_count, updated_at=datetime.utcnow())
        )

    async def get_statistics(self, outline_id: int) -> ChapterStatsDTO:
        """获取大纲的章节统计。"""
        result = await self._session.execute(
            select(
                func.count(Chapter.id).label("total"),
                func.sum(Chapter.word_count).label("total_words"),
                func.avg(Chapter.word_count).label("avg_words"),
            )
            .where(Chapter.outline_id == outline_id)
        )
        row = result.one()
        return ChapterStatsDTO(
            total_chapters=row.total or 0,
            total_words=row.total_words or 0,
            average_words=row.avg_words or 0,
        )
```

### 4.2 Repository 工厂

```python
# repositories/factory.py
class RepositoryFactory:
    """Repository 工厂，用于依赖注入。"""

    def __init__(self, session: AsyncSession):
        self._session = session

    @property
    def character(self) -> CharacterRepository:
        return CharacterRepository(self._session)

    @property
    def chapter(self) -> ChapterRepository:
        return ChapterRepository(self._session)

    @property
    def story(self) -> StoryRepository:
        return StoryRepository(self._session)

    @property
    def draft(self) -> DraftRepository:
        return DraftRepository(self._session)

    @property
    def ifline(self) -> IFLineRepository:
        return IFLineRepository(self._session)

    @property
    def chat(self) -> ChatRepository:
        return ChatRepository(self._session)

    @property
    def writing_settings(self) -> WritingSettingsRepository:
        return WritingSettingsRepository(self._session)
```

---

## 5. Unit of Work 模式

### 5.1 实现

```python
# infrastructure/unit_of_work.py
from contextlib import asynccontextmanager
from typing import AsyncGenerator

class SQLAlchemyUnitOfWork:
    """SQLAlchemy 实现的工作单元。"""

    def __init__(self, session_factory: async_sessionmaker):
        self._session_factory = session_factory
        self._session: AsyncSession | None = None

    async def __aenter__(self):
        self._session = self._session_factory()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            await self._session.rollback()
        else:
            await self._session.commit()
        await self._session.close()
        self._session = None

    async def commit(self):
        await self._session.commit()

    async def rollback(self):
        await self._session.rollback()

    @property
    def session(self) -> AsyncSession:
        return self._session

    @property
    def repositories(self) -> RepositoryFactory:
        return RepositoryFactory(self._session)


@asynccontextmanager
async def unit_of_work() -> AsyncGenerator[SQLAlchemyUnitOfWork, None]:
    """快捷上下文管理器。"""
    async with SQLAlchemyUnitOfWork(async_session_maker) as uow:
        yield uow
```

### 5.2 使用示例

```python
# 在服务层中使用
async def transfer_character_faction(
    self,
    character_id: int,
    from_faction_id: int,
    to_faction_id: int,
) -> None:
    async with unit_of_work() as uow:
        repos = uow.repositories

        character = await repos.character.get_by_id(character_id)
        if not character:
            raise CharacterNotFoundError(character_id)

        # 更新角色所属势力
        await repos.character.update(character_id, {"faction_id": to_faction_id})

        # 记录势力变更历史
        await repos.faction_history.create({
            "character_id": character_id,
            "from_faction_id": from_faction_id,
            "to_faction_id": to_faction_id,
            "changed_at": datetime.utcnow(),
        })

        # 更新势力成员数
        await repos.faction.decrement_member_count(from_faction_id)
        await repos.faction.increment_member_count(to_faction_id)

        # 所有操作在一个事务中提交
```

---

## 6. 事件驱动架构

### 6.1 领域事件定义

```python
# domain/events.py
from dataclasses import dataclass
from datetime import datetime
from typing import Any

@dataclass(frozen=True)
class DomainEvent:
    """基础领域事件。"""
    occurred_at: datetime = datetime.utcnow()

@dataclass(frozen=True)
class OutlineCreatedEvent(DomainEvent):
    outline_id: int

@dataclass(frozen=True)
class ChapterCreatedEvent(DomainEvent):
    chapter_id: int
    outline_id: int | None

@dataclass(frozen=True)
class DraftCreatedEvent(DomainEvent):
    chapter_id: int
    version_number: int
    ai_generated: bool

@dataclass(frozen=True)
class CharacterCreatedEvent(DomainEvent):
    character_id: int

@dataclass(frozen=True)
class CharacterUpdatedEvent(DomainEvent):
    character_id: int
    changed_fields: list[str]

@dataclass(frozen=True)
class IFLineSyncRequestedEvent(DomainEvent):
    if_line_id: int
    source_chapter_id: int

@dataclass(frozen=True)
class SettingsChangedEvent(DomainEvent):
    setting_type: str
    old_value: Any
    new_value: Any

@dataclass(frozen=True)
class CacheInvalidationEvent(DomainEvent):
    patterns: list[str]
```

### 6.2 事件总线实现

```python
# infrastructure/event_bus.py
import asyncio
from typing import Callable, Awaitable, Type

EventHandler = Callable[[DomainEvent], Awaitable[None]]

class AsyncEventBus:
    """异步内存事件总线（桌面应用足够）。"""

    def __init__(self):
        self._handlers: dict[Type[DomainEvent], list[EventHandler]] = {}
        self._queue: asyncio.Queue[tuple[DomainEvent, list[EventHandler]]] = asyncio.Queue()
        self._worker_task: asyncio.Task | None = None

    def subscribe(self, event_type: Type[DomainEvent], handler: EventHandler) -> None:
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)

    def unsubscribe(self, event_type: Type[DomainEvent], handler: EventHandler) -> None:
        if event_type in self._handlers:
            self._handlers[event_type] = [h for h in self._handlers[event_type] if h != handler]

    async def publish(self, event: DomainEvent) -> None:
        handlers = self._handlers.get(type(event), [])
        if handlers:
            await self._queue.put((event, handlers))

    async def start(self) -> None:
        self._worker_task = asyncio.create_task(self._process_events())

    async def stop(self) -> None:
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass

    async def _process_events(self) -> None:
        while True:
            try:
                event, handlers = await self._queue.get()
                # 并行执行所有处理器
                await asyncio.gather(
                    *[self._safe_handle(handler, event) for handler in handlers],
                    return_exceptions=True,
                )
                self._queue.task_done()
            except asyncio.CancelledError:
                break

    async def _safe_handle(self, handler: EventHandler, event: DomainEvent) -> None:
        try:
            await handler(event)
        except Exception as e:
            logger.error(f"Event handler failed for {type(event).__name__}: {e}")


# 全局事件总线实例
event_bus = AsyncEventBus()
```

### 6.3 事件处理器注册

```python
# application/event_handlers.py
async def on_character_created(event: CharacterCreatedEvent) -> None:
    """角色创建后：清除角色列表缓存。"""
    await cache_repo.delete_pattern("characters:*")

async def on_draft_created(event: DraftCreatedEvent) -> None:
    """草稿创建后：更新章节统计、触发 IF 线同步。"""
    if event.ai_generated:
        # 记录 AI 生成统计
        await stats_repo.increment_ai_generation_count(event.chapter_id)

async def on_settings_changed(event: SettingsChangedEvent) -> None:
    """设置变更后：清除相关缓存。"""
    if event.setting_type == "writing_style":
        await cache_repo.delete_pattern("ai:*")

# 注册处理器
event_bus.subscribe(CharacterCreatedEvent, on_character_created)
event_bus.subscribe(DraftCreatedEvent, on_draft_created)
event_bus.subscribe(SettingsChangedEvent, on_settings_changed)
```

---

## 7. CQRS 读写分离

### 7.1 设计决策

本项目为本地桌面应用，数据量有限（单用户、单项目），**不建议引入完整的 CQRS 架构**（会增加不必要的复杂性）。但以下场景可采用**轻量级读写分离**：

| 场景 | 读模型 | 写模型 | 实现方式 |
|------|--------|--------|----------|
| 角色关系网络可视化 | 预计算的节点/边结构 | 角色/关系实体 | 缓存读模型 |
| 章节统计面板 | 聚合统计（字数、进度） | 章节实体 | 数据库视图/缓存 |
| 大纲时间线 | 排序后的章节列表+状态 | 章节实体 | 查询优化 |
| AI 审查历史 | 评分趋势图数据 | 审查结果实体 | 物化视图 |

### 7.2 轻量级实现

```python
# services/query_service.py
class QueryService:
    """查询服务（只读），优化复杂查询场景。"""

    def __init__(self, session: AsyncSession, cache: CacheRepository):
        self._session = session
        self._cache = cache

    async def get_character_network(self, character_id: int) -> dict:
        """获取角色关系网络（读模型）。"""
        cache_key = f"query:network:{character_id}"
        cached = await self._cache.get(cache_key)
        if cached:
            return cached

        # 单次查询获取所有需要的数据
        result = await self._session.execute(
            select(Character, CharacterRelationship, Character)
            .join(CharacterRelationship, Character.id == CharacterRelationship.character_id)
            .join(Character, CharacterRelationship.target_id == Character.id)
            .where(Character.id == character_id)
        )

        nodes = []
        edges = []
        for row in result.all():
            source, rel, target = row
            nodes.extend([
                {"id": source.id, "name": source.name, "type": "source"},
                {"id": target.id, "name": target.name, "type": "target"},
            ])
            edges.append({
                "source": source.id,
                "target": target.id,
                "type": rel.type,
            })

        network = {"nodes": nodes, "edges": edges}
        await self._cache.set(cache_key, network, ttl=300)
        return network

    async def get_outline_statistics(self, outline_id: int) -> dict:
        """获取大纲统计（读模型）。"""
        result = await self._session.execute(
            select(
                func.count(Chapter.id).label("chapter_count"),
                func.sum(Chapter.word_count).label("total_words"),
                func.count(func.distinct(Chapter.status)).label("status_count"),
            )
            .where(Chapter.outline_id == outline_id)
        )
        row = result.one()
        return {
            "chapter_count": row.chapter_count,
            "total_words": row.total_words or 0,
            "completion_rate": await self._calculate_completion_rate(outline_id),
        }
```

---

## 8. AI 服务抽象层

### 8.1 Provider 接口

```python
# infrastructure/ai/providers.py
from typing import AsyncIterator, Protocol
from dataclasses import dataclass

@dataclass
class AICompletionResult:
    content: str
    model: str
    usage: dict | None = None
    raw: dict | None = None

class AIProvider(Protocol):
    """AI Provider 抽象接口。"""

    async def complete(
        self,
        system_prompt: str,
        user_content: str,
        temperature: float = 0.5,
        max_tokens: int | None = None,
    ) -> AICompletionResult: ...

    async def stream_generate(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> AsyncIterator[str]: ...

    async def embed(self, text: str) -> list[float]: ...

    @property
    def name(self) -> str: ...

    @property
    def max_context_length(self) -> int: ...
```

### 8.2 MiniMax 实现

```python
# infrastructure/ai/minimax_provider.py
class MiniMaxProvider:
    """MiniMax API Provider。"""

    NAME = "minimax"
    MAX_CONTEXT = 8192
    DEFAULT_MODEL = "MiniMax-Text-01"

    def __init__(self, api_key: str, base_url: str = "https://api.minimax.chat/v1"):
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")

    @property
    def name(self) -> str:
        return self.NAME

    @property
    def max_context_length(self) -> int:
        return self.MAX_CONTEXT

    async def complete(
        self,
        system_prompt: str,
        user_content: str,
        temperature: float = 0.5,
        max_tokens: int | None = None,
    ) -> AICompletionResult:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self._base_url}/text/chatcompletion_v2",
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.DEFAULT_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content},
                    ],
                    "temperature": temperature,
                    **({"max_tokens": max_tokens} if max_tokens else {}),
                },
            )
            response.raise_for_status()
            data = response.json()

            message = data.get("choices", [{}])[0].get("message", {})
            return AICompletionResult(
                content=message.get("content", ""),
                model=self.DEFAULT_MODEL,
                usage=data.get("usage"),
                raw=data,
            )

    async def stream_generate(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{self._base_url}/text/chatcompletion_v2",
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.DEFAULT_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": temperature,
                    "stream": True,
                    **({"max_tokens": max_tokens} if max_tokens else {}),
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            if "choices" in chunk and len(chunk["choices"]) > 0:
                                delta = chunk["choices"][0].get("delta", {})
                                if "content" in delta:
                                    yield delta["content"]
                        except (json.JSONDecodeError, KeyError):
                            continue

    async def embed(self, text: str) -> list[float]:
        # MiniMax 暂不支持 embedding，返回空列表
        return []
```

### 8.3 OpenAI 兼容 Provider

```python
# infrastructure/ai/openai_provider.py
class OpenAICompatibleProvider:
    """OpenAI API 兼容 Provider（支持 OpenAI、DeepSeek、本地模型等）。"""

    def __init__(self, api_key: str, base_url: str, model: str = "gpt-4"):
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model

    @property
    def name(self) -> str:
        return f"openai:{self._model}"

    @property
    def max_context_length(self) -> int:
        return 128000 if "gpt-4" in self._model else 8192

    async def complete(self, system_prompt: str, user_content: str, temperature: float = 0.5, max_tokens: int | None = None) -> AICompletionResult:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self._base_url}/v1/chat/completions",
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content},
                    ],
                    "temperature": temperature,
                },
            )
            response.raise_for_status()
            data = response.json()
            return AICompletionResult(
                content=data["choices"][0]["message"]["content"],
                model=self._model,
                usage=data.get("usage"),
                raw=data,
            )

    async def stream_generate(self, prompt: str, temperature: float = 0.7, max_tokens: int | None = None) -> AsyncIterator[str]:
        # 类似 MiniMax 实现，使用 OpenAI 流式格式
        ...

    async def embed(self, text: str) -> list[float]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self._base_url}/v1/embeddings",
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={"model": "text-embedding-3-small", "input": text},
            )
            response.raise_for_status()
            data = response.json()
            return data["data"][0]["embedding"]
```

### 8.4 Provider 工厂

```python
# infrastructure/ai/factory.py
from backend.config import settings

def create_ai_provider(provider_type: str | None = None) -> AIProvider:
    """创建 AI Provider 实例。"""
    provider_type = provider_type or settings.ai_provider or "minimax"

    if provider_type == "minimax":
        if not settings.minimax_api_key:
            raise ConfigurationError("MiniMax API key not configured")
        return MiniMaxProvider(
            api_key=settings.minimax_api_key,
            base_url=settings.minimax_api_url,
        )
    elif provider_type == "openai":
        if not settings.openai_api_key:
            raise ConfigurationError("OpenAI API key not configured")
        return OpenAICompatibleProvider(
            api_key=settings.openai_api_key,
            base_url=settings.openai_api_url or "https://api.openai.com",
            model=settings.openai_model or "gpt-4",
        )
    elif provider_type == "local":
        return OpenAICompatibleProvider(
            api_key="dummy",
            base_url=settings.local_model_url or "http://localhost:8000",
            model=settings.local_model_name or "default",
        )
    else:
        raise ConfigurationError(f"Unknown AI provider: {provider_type}")
```

---

## 9. 后台任务处理

### 9.1 增强的任务队列

```python
# infrastructure/tasks/enhanced_queue.py
from enum import IntEnum
from datetime import datetime, timedelta

class TaskPriority(IntEnum):
    CRITICAL = 0   # 用户操作阻塞
    HIGH = 1       # AI 生成
    NORMAL = 2     # 导出/导入
    LOW = 3        # 清理/维护

@dataclass
class ScheduledTask:
    id: str
    type: str
    priority: TaskPriority
    payload: dict
    scheduled_at: datetime
    retry_count: int = 0
    max_retries: int = 3
    dependencies: list[str] = field(default_factory=list)

class EnhancedTaskQueue:
    """增强型任务队列：优先级、定时任务、依赖管理。"""

    def __init__(self, max_workers: int = 3):
        self._queue: asyncio.PriorityQueue[tuple[int, str, ScheduledTask]] = asyncio.PriorityQueue()
        self._tasks: dict[str, ScheduledTask] = {}
        self._results: dict[str, Any] = {}
        self._workers: list[asyncio.Task] = []
        self._running = False
        self._max_workers = max_workers
        self._scheduled: list[ScheduledTask] = []  # 定时任务列表

    async def submit(
        self,
        task_type: str,
        payload: dict,
        priority: TaskPriority = TaskPriority.NORMAL,
        delay_seconds: int = 0,
        dependencies: list[str] | None = None,
    ) -> str:
        task_id = str(uuid.uuid4())
        task = ScheduledTask(
            id=task_id,
            type=task_type,
            priority=priority,
            payload=payload,
            scheduled_at=datetime.utcnow() + timedelta(seconds=delay_seconds),
            dependencies=dependencies or [],
        )
        self._tasks[task_id] = task

        if delay_seconds > 0:
            self._scheduled.append(task)
        else:
            await self._queue.put((priority.value, task_id, task))

        return task_id

    async def start(self):
        self._running = True
        # 启动定时任务调度器
        self._scheduler_task = asyncio.create_task(self._schedule_loop())
        # 启动工作线程
        self._workers = [
            asyncio.create_task(self._worker_loop(f"worker-{i}"))
            for i in range(self._max_workers)
        ]

    async def _schedule_loop(self):
        """定时任务调度循环。"""
        while self._running:
            now = datetime.utcnow()
            ready = [t for t in self._scheduled if t.scheduled_at <= now]
            for task in ready:
                await self._queue.put((task.priority.value, task.id, task))
                self._scheduled.remove(task)
            await asyncio.sleep(1)

    async def _worker_loop(self, name: str):
        """工作线程。"""
        while self._running:
            try:
                priority, task_id, task = await asyncio.wait_for(
                    self._queue.get(), timeout=1.0
                )
            except asyncio.TimeoutError:
                continue

            # 检查依赖是否完成
            if task.dependencies:
                pending = [d for d in task.dependencies if d not in self._results]
                if pending:
                    # 重新入队，延迟处理
                    task.scheduled_at = datetime.utcnow() + timedelta(seconds=5)
                    self._scheduled.append(task)
                    self._queue.task_done()
                    continue

            try:
                result = await self._execute_task(task)
                self._results[task_id] = {"status": "completed", "result": result}
            except Exception as e:
                task.retry_count += 1
                if task.retry_count <= task.max_retries:
                    backoff = 2 ** task.retry_count
                    task.scheduled_at = datetime.utcnow() + timedelta(seconds=backoff)
                    self._scheduled.append(task)
                    self._results[task_id] = {"status": "retrying", "error": str(e)}
                else:
                    self._results[task_id] = {"status": "failed", "error": str(e)}

            self._queue.task_done()

    async def _execute_task(self, task: ScheduledTask) -> Any:
        handler = _task_handlers.get(task.type)
        if not handler:
            raise ValueError(f"No handler for task type: {task.type}")
        return await handler(task.payload)
```

### 9.2 任务类型注册

```python
# application/task_handlers.py
from infrastructure.tasks.enhanced_queue import EnhancedTaskQueue

queue = EnhancedTaskQueue(max_workers=3)

@queue.register("ai_generate")
async def handle_ai_generate(payload: dict) -> dict:
    """处理 AI 生成任务。"""
    provider = create_ai_provider(payload.get("provider"))
    ai_service = AIService(provider, cache_repo, settings_repo)

    chunks = []
    async for chunk in ai_service.generate(
        prompt=payload["prompt"],
        operation=WritingOperation(payload["operation"]),
        human_ai_ratio=payload.get("human_ai_ratio"),
        style=payload.get("style"),
    ):
        chunks.append(chunk)

    return {"content": "".join(chunks)}

@queue.register("if_line_sync")
async def handle_if_line_sync(payload: dict) -> dict:
    """处理 IF 线同步任务。"""
    async with unit_of_work() as uow:
        story_service = StoryService(...)
        result = await story_service.sync_if_line(
            payload["if_line_id"],
            payload["source_chapter_id"],
        )
        return result.dict()

@queue.register("batch_export")
async def handle_batch_export(payload: dict) -> dict:
    """处理批量导出任务。"""
    export_service = ExportService(...)
    data = await export_service.export_project(
        incremental=payload.get("incremental", False),
    )
    return {"format": payload.get("format", "json"), "data": data}

@queue.register("cleanup_old_drafts")
async def handle_cleanup(payload: dict) -> dict:
    """清理旧草稿版本。"""
    async with unit_of_work() as uow:
        draft_repo = DraftRepository(uow.session)
        deleted = await draft_repo.delete_old_versions(
            max_age_days=payload.get("max_age_days", 30),
            keep_minimum=payload.get("keep_minimum", 5),
        )
        return {"deleted_count": deleted}
```

---

## 10. 依赖注入容器

### 10.1 容器实现

```python
# infrastructure/di_container.py
from typing import TypeVar, Type, Callable

T = TypeVar("T")

class DIContainer:
    """简易依赖注入容器。"""

    def __init__(self):
        self._registrations: dict[Type, Callable] = {}
        self._singletons: dict[Type, Any] = {}

    def register(self, interface: Type[T], factory: Callable[..., T]) -> None:
        self._registrations[interface] = factory

    def register_singleton(self, interface: Type[T], instance: T) -> None:
        self._singletons[interface] = instance

    def resolve(self, interface: Type[T]) -> T:
        if interface in self._singletons:
            return self._singletons[interface]

        factory = self._registrations.get(interface)
        if not factory:
            raise KeyError(f"No registration for {interface}")

        return factory(self)

    def create_scope(self) -> "DIScope":
        return DIScope(self)


class DIScope:
    """作用域容器（每次请求一个）。"""

    def __init__(self, container: DIContainer):
        self._container = container
        self._scoped: dict[Type, Any] = {}

    def resolve(self, interface: Type[T]) -> T:
        if interface in self._scoped:
            return self._scoped[interface]

        instance = self._container.resolve(interface)
        self._scoped[interface] = instance
        return instance


# 全局容器
container = DIContainer()

# 注册基础设施
def configure_container():
    container.register_singleton(EventBus, event_bus)
    container.register_singleton(CacheRepository, CacheRepository())

    container.register(AIProvider, lambda c: create_ai_provider())
    container.register(CharacterService, lambda c: CharacterService(
        character_repo=c.resolve(CharacterRepository),
        relationship_repo=c.resolve(RelationshipRepository),
        storyline_repo=c.resolve(StorylineRepository),
        cache_repo=c.resolve(CacheRepository),
        event_bus=c.resolve(EventBus),
    ))
    container.register(StoryService, lambda c: StoryService(
        story_repo=c.resolve(StoryRepository),
        chapter_repo=c.resolve(ChapterRepository),
        ifline_repo=c.resolve(IFLineRepository),
        draft_repo=c.resolve(DraftRepository),
        cache_repo=c.resolve(CacheRepository),
        event_bus=c.resolve(EventBus),
    ))
    container.register(AIService, lambda c: AIService(
        provider=c.resolve(AIProvider),
        cache_repo=c.resolve(CacheRepository),
        settings_repo=c.resolve(WritingSettingsRepository),
    ))
```

### 10.2 FastAPI 集成

```python
# dependencies.py
from fastapi import Request

async def get_character_service(request: Request) -> CharacterService:
    """获取 CharacterService（每次请求创建新作用域）。"""
    scope = request.state.di_scope
    return scope.resolve(CharacterService)

async def get_story_service(request: Request) -> StoryService:
    scope = request.state.di_scope
    return scope.resolve(StoryService)

async def get_ai_service(request: Request) -> AIService:
    scope = request.state.di_scope
    return scope.resolve(AIService)

# main.py 中间件
@app.middleware("http")
async def di_scope_middleware(request: Request, call_next):
    request.state.di_scope = container.create_scope()
    response = await call_next(request)
    return response
```

---

## 11. 迁移路径

### 11.1 阶段划分

| 阶段 | 目标 | 工作量 | 优先级 |
|------|------|--------|--------|
| **Phase 1** | 提取 Repository 层，路由层改为调用 Repository | 中 | P0 |
| **Phase 2** | 创建 Application Services，路由层仅调用 Service | 中 | P0 |
| **Phase 3** | 引入 AI Provider 抽象，支持多 Provider | 低 | P1 |
| **Phase 4** | 引入事件总线，解耦缓存失效等副作用 | 低 | P1 |
| **Phase 5** | 引入 Unit of Work，优化事务管理 | 低 | P2 |
| **Phase 6** | 增强任务队列（优先级、定时任务） | 低 | P2 |

### 11.2 Phase 1 详细步骤

```
Step 1: 创建 repositories/ 目录和基础接口
Step 2: 为每个实体创建 Repository 类
Step 3: 在路由中使用 Repository 替代直接 db 操作
Step 4: 验证所有测试通过
```

### 11.3 代码迁移示例

**Before (settings.py):**

```python
@router.get("/characters")
async def list_characters(skip: int = 0, limit: int = 100, tier: str | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Character)
    if tier:
        query = query.where(Character.tier == tier)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()
```

**After (Phase 1):**

```python
@router.get("/characters")
async def list_characters(
    skip: int = 0,
    limit: int = 100,
    tier: str | None = None,
    repo: CharacterRepository = Depends(get_character_repository),
):
    return await repo.list(skip=skip, limit=limit, tier=tier)
```

**After (Phase 2):**

```python
@router.get("/characters")
async def list_characters(
    skip: int = 0,
    limit: int = 100,
    tier: str | None = None,
    service: CharacterService = Depends(get_character_service),
):
    return await service.list_characters(skip=skip, limit=limit, tier=tier)
```

---

## 12. 目录结构目标

```
src/backend/
├── api/                          # API 层 (原 routes/)
│   ├── __init__.py
│   ├── dependencies.py           # FastAPI dependencies
│   ├── chapters.py
│   ├── settings.py
│   ├── ai.py
│   ├── chat.py
│   ├── export_import.py
│   └── tasks.py
├── application/                  # 应用服务层
│   ├── __init__.py
│   ├── services/                 # 应用服务
│   │   ├── __init__.py
│   │   ├── story_service.py
│   │   ├── character_service.py
│   │   ├── world_service.py
│   │   ├── chat_service.py
│   │   ├── ai_service.py
│   │   ├── review_service.py
│   │   ├── export_service.py
│   │   ├── task_service.py
│   │   └── setting_service.py
│   ├── dto/                      # 数据传输对象
│   │   ├── __init__.py
│   │   ├── character_dto.py
│   │   ├── story_dto.py
│   │   └── ai_dto.py
│   └── event_handlers.py         # 事件处理器
├── domain/                       # 领域层
│   ├── __init__.py
│   ├── events.py                 # 领域事件
│   ├── exceptions.py             # 领域异常
│   ├── entities/                 # 领域实体 (可选，与 ORM 分离)
│   └── services/                 # 领域服务
│       ├── context_builder.py
│       ├── entity_extractor.py
│       ├── quality_checker.py
│       └── style_manager.py
├── infrastructure/               # 基础设施层
│   ├── __init__.py
│   ├── database.py               # 数据库配置
│   ├── config.py                 # 应用配置
│   ├── di_container.py           # 依赖注入
│   ├── event_bus.py              # 事件总线
│   ├── unit_of_work.py           # 工作单元
│   ├── ai/                       # AI Provider
│   │   ├── __init__.py
│   │   ├── providers.py          # 抽象接口
│   │   ├── minimax_provider.py
│   │   ├── openai_provider.py
│   │   └── factory.py
│   ├── cache/                    # 缓存实现
│   │   ├── __init__.py
│   │   ├── lru_cache.py
│   │   └── disk_cache.py
│   └── tasks/                    # 任务队列
│       ├── __init__.py
│       ├── enhanced_queue.py
│       └── handlers.py
├── repositories/                 # 数据访问层
│   ├── __init__.py
│   ├── base.py                   # 基础接口
│   ├── character_repository.py
│   ├── chapter_repository.py
│   ├── story_repository.py
│   ├── chat_repository.py
│   └── factory.py
├── models/                       # ORM 模型 (保留)
│   └── entities.py
├── agents/                       # AI Agent (保留，重构为领域服务)
│   ├── __init__.py
│   ├── context_agent.py
│   ├── data_agent.py
│   ├── checkers/
│   └── utils.py
├── middleware/                   # 中间件 (保留)
│   ├── auth.py
│   ├── rate_limit.py
│   └── logging.py
├── schemas/                      # Pydantic schemas (保留)
│   └── __init__.py
├── tests/                        # 测试
│   ├── unit/
│   ├── integration/
│   └── conftest.py
└── main.py                       # 应用入口
```

---

## 13. 总结

### 13.1 核心改进点

1. **业务逻辑与路由分离**：路由层仅负责 HTTP 协议转换，所有业务逻辑下沉到 Service 层
2. **Repository 模式**：数据访问抽象，支持测试时 Mock 替换
3. **AI Provider 抽象**：支持 MiniMax / OpenAI / 本地模型无缝切换
4. **事件驱动**：解耦跨模块操作，如缓存失效、IF 线同步触发
5. **Unit of Work**：显式事务控制，保证复杂业务的数据一致性
6. **依赖注入**：可测试、可替换的组件架构

### 13.2 预期收益

| 指标 | 现状 | 目标 |
|------|------|------|
| 路由层代码行数 | ~800/文件 | ~200/文件 |
| 单元测试覆盖率 | 低（难以 Mock） | >80% |
| 新增 AI Provider 成本 | 修改 5+ 文件 | 新增 1 个 Provider 类 |
| 复杂事务 bug 率 | 中 | 低 |
| 代码重复率 | 高（Checker 重复查询） | 低（共享 Repository） |
