# Auto Novel Writer - 测试策略与测试覆盖方案

> 版本: 1.0
> 日期: 2026-04-21
> 技术栈: FastAPI + async SQLAlchemy + SQLite + pytest

---

## 1. 测试金字塔

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

---

## 2. 目录结构

```
tests/
├── conftest.py                    # 全局 fixtures、数据库引擎、异步事件循环
├── factories.py                   # 测试数据工厂 (factory-boy / 自定义)
├── fixtures/
│   ├── database.py               # 数据库 fixtures
│   ├── auth.py                   # 认证 fixtures
│   ├── cache.py                  # 缓存 fixtures
│   └── ai_mock.py               # AI 服务 mock fixtures
├── unit/
│   ├── test_models.py            # SQLAlchemy 模型验证
│   ├── test_schemas.py           # Pydantic 请求/响应模型
│   ├── test_cache_service.py     # 缓存服务单元测试
│   ├── test_rate_limit.py        # 限流逻辑单元测试
│   ├── test_export_import.py     # 导出导入序列化/反序列化
│   ├── test_ai_service.py        # AI 服务 (mock API)
│   ├── test_auth.py              # 认证逻辑
│   └── test_utils.py             # 工具函数 (_to_dict, hash_prompt 等)
├── integration/
│   ├── test_api_chat.py          # /api/v1/chat/* 端点
│   ├── test_api_settings.py      # /api/v1/settings/* 端点
│   ├── test_api_chapters.py      # /api/v1/chapters/* 端点
│   ├── test_api_ai.py            # /api/v1/ai/* 端点
│   ├── test_api_auth.py          # /api/v1/auth/* 端点
│   ├── test_api_export_import.py # /api/v1/export/* 端点
│   ├── test_api_health.py        # /health 端点
│   ├── test_middleware.py        # 中间件集成
│   └── test_websocket.py         # WebSocket 集成
├── agents/
│   ├── test_context_agent.py     # ContextAgent (mock AI)
│   ├── test_data_agent.py        # DataAgent (mock AI)
│   └── test_checkers.py          # Checker 系列 (mock AI)
├── e2e/
│   └── test_full_workflow.py     # 端到端用户流程
├── performance/
│   ├── test_load.py              # locust / httpx 压测脚本
│   └── test_cache_performance.py # 缓存性能基准
└── security/
    ├── test_auth_bypass.py       # 认证绕过测试
    ├── test_rate_limit.py        # 限流有效性
    ├── test_input_validation.py  # 输入验证/注入
    └── test_export_safety.py     # 导出数据安全
```

---

## 3. pytest 配置 (pytest.ini)

```ini
[pytest]
asyncio_mode = auto
asyncio_default_fixture_loop_scope = function
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts =
    -v
    --tb=short
    --strict-markers
    --cov=src/backend
    --cov-report=term-missing
    --cov-report=html:htmlcov
    --cov-report=xml:coverage.xml
    --cov-fail-under=70
markers =
    unit: 单元测试 (快速, 无外部依赖)
    integration: 集成测试 (需要数据库)
    e2e: 端到端测试 (完整流程)
    slow: 慢速测试 (AI 相关, 网络请求)
    websocket: WebSocket 测试
    security: 安全测试
    performance: 性能测试
```

---

## 4. 核心 Fixtures (conftest.py)

### 4.1 异步事件循环与数据库引擎

```python
import pytest_asyncio
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from httpx import AsyncClient
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch

from backend.main import app
from backend.database import Base, get_db
from backend.config import settings

# 测试数据库 (内存 SQLite)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="session")
async def engine():
    """创建测试数据库引擎."""
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
    """每个测试用例独立的异步数据库会话 (自动回滚)."""
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


@pytest.fixture
def client(db_session):
    """FastAPI TestClient with overridden DB dependency."""
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    # 绕过 localhost 认证
    with patch.object(settings, 'auth_skip_localhost', True):
        with TestClient(app) as test_client:
            yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers():
    """测试用 API Key 请求头."""
    return {"X-API-Key": "writer_test_key_12345"}
```

### 4.2 测试数据工厂

```python
# tests/factories.py
from datetime import datetime

class CharacterFactory:
    """角色数据工厂."""
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
    """章节数据工厂."""
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


class ChatSessionFactory:
    """聊天会话数据工厂."""
    @classmethod
    async def create(cls, db_session):
        from backend.models.entities import ChatSession
        session = ChatSession()
        db_session.add(session)
        await db_session.flush()
        await db_session.refresh(session)
        return session
```

### 4.3 Mock Fixtures

```python
# tests/fixtures/ai_mock.py
import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.fixture
def mock_ai_service():
    """Mock AI 服务，返回预定义响应."""
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

    async def mock_extract_entities(*args, **kwargs):
        return [
            {"name": "张三", "type": "character", "description": "主角"},
            {"name": "青云山", "type": "location", "description": "修仙门派"},
        ]

    service.extract_entities = mock_extract_entities
    return service


@pytest.fixture
def mock_minimax_response():
    """Mock MiniMax API HTTP 响应."""
    return {
        "choices": [{
            "message": {
                "content": '{"entities": [{"name": "测试", "type": "character"}]}'
            }
        }]
    }


@pytest.fixture
def mock_httpx_client():
    """Mock httpx.AsyncClient for AI service tests."""
    with patch('httpx.AsyncClient') as mock_client:
        instance = MagicMock()
        mock_client.return_value.__aenter__ = AsyncMock(return_value=instance)
        mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
        yield instance
```

---

## 5. 测试覆盖目标

| 层级 | 目标覆盖率 | 说明 |
|------|-----------|------|
| **路由层 (Routes)** | 100% | 所有 HTTP 端点至少测试一次成功路径和主要错误路径 |
| **服务层 (Services)** | 80%+ | database_service, ai_service, cache_service, export_import |
| **数据访问层 (Models/DB)** | 70%+ | SQLAlchemy 模型、关系、约束验证 |
| **Agent 层** | 60%+ | ContextAgent, DataAgent, Checkers (AI 结果不可预测) |
| **中间件** | 80%+ | 认证、限流、日志、CORS、错误处理 |
| **工具函数** | 90%+ | _to_dict, hash_prompt, validate_* 等 |

---

## 6. 各层测试策略

### 6.1 单元测试

#### 6.1.1 Pydantic 模型验证

```python
# tests/unit/test_schemas.py
import pytest
from backend.routes.ai import GenerateRequest, ReviewRequest
from backend.routes.settings import CharacterCreate, WritingSettingsUpdate


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
        assert req.operation == "continue"

    def test_empty_prompt_raises(self):
        with pytest.raises(ValueError, match="cannot be empty"):
            GenerateRequest(prompt="", operation="continue")

    def test_invalid_operation_raises(self):
        with pytest.raises(ValueError, match="must be one of"):
            GenerateRequest(prompt="测试", operation="invalid_op")

    def test_human_ai_ratio_out_of_range(self):
        with pytest.raises(ValueError, match="between 0 and 100"):
            GenerateRequest(prompt="测试", operation="continue", human_ai_ratio=150)

    def test_prompt_too_long(self):
        with pytest.raises(ValueError, match="exceeds maximum length"):
            GenerateRequest(prompt="x" * 20000, operation="continue")
```

#### 6.1.2 缓存服务测试

```python
# tests/unit/test_cache_service.py
import pytest
from backend.services.cache_service import LRUCache, CacheService


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
        cache.set("c", 3)  # evicts "a"
        assert cache.get("a") is None
        assert cache.get("b") == 2
        assert cache.get("c") == 3

    def test_delete_pattern(self):
        cache = LRUCache()
        cache.set("user:1", "a")
        cache.set("user:2", "b")
        cache.set("post:1", "c")
        deleted = cache.delete_pattern("user")
        assert deleted == 2
        assert cache.get("user:1") is None
        assert cache.get("post:1") == "c"
```

#### 6.1.3 认证逻辑测试

```python
# tests/unit/test_auth.py
import pytest
from unittest.mock import MagicMock, patch
from backend.middleware.auth import (
    verify_api_key, generate_api_key, _is_localhost_request,
    get_or_create_api_key, clear_api_key_cache
)


class TestAuth:
    def test_generate_api_key_format(self):
        key = generate_api_key()
        assert key.startswith("writer_")
        assert len(key) > 40

    def test_is_localhost_request(self):
        request = MagicMock()
        request.client.host = "127.0.0.1"
        assert _is_localhost_request(request) is True

        request.client.host = "192.168.1.1"
        assert _is_localhost_request(request) is False

    @pytest.mark.asyncio
    async def test_verify_api_key_localhost_skip(self):
        with patch.object(settings, 'auth_skip_localhost', True):
            request = MagicMock()
            request.client.host = "127.0.0.1"
            result = await verify_api_key(request, api_key=None)
            assert result is True

    @pytest.mark.asyncio
    async def test_verify_api_key_invalid(self):
        clear_api_key_cache()
        with patch.object(settings, 'auth_skip_localhost', False):
            request = MagicMock()
            request.client.host = "192.168.1.1"
            with pytest.raises(HTTPException) as exc:
                await verify_api_key(request, api_key="wrong_key")
            assert exc.value.status_code == 403
```

#### 6.1.4 限流逻辑测试

```python
# tests/unit/test_rate_limit.py
import pytest
import time
from backend.middleware.rate_limit import RateLimitStore


class TestRateLimitStore:
    def test_allows_under_limit(self):
        store = RateLimitStore()
        allowed, limit, remaining = store.check_rate_limit("ip1", 5, 60)
        assert allowed is True
        assert remaining == 4

    def test_blocks_over_limit(self):
        store = RateLimitStore()
        for _ in range(5):
            store.check_rate_limit("ip1", 5, 60)
        allowed, _, _ = store.check_rate_limit("ip1", 5, 60)
        assert allowed is False

    def test_window_reset(self):
        store = RateLimitStore()
        store.check_rate_limit("ip1", 1, 0.01)
        time.sleep(0.02)
        allowed, _, _ = store.check_rate_limit("ip1", 1, 0.01)
        assert allowed is True
```

### 6.2 集成测试

#### 6.2.1 API 端点测试 (以 settings 为例)

```python
# tests/integration/test_api_settings.py
import pytest
from tests.factories import CharacterFactory


class TestCharacterEndpoints:
    @pytest.mark.integration
    def test_create_character(self, client, auth_headers, db_session):
        response = client.post(
            "/api/v1/settings/characters",
            json={"name": "张三", "gender": "male", "tier": "核心"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "张三"
        assert data["id"] is not None

    @pytest.mark.integration
    def test_list_characters(self, client, auth_headers, db_session):
        # 创建测试数据
        # ... (使用 factory)
        response = client.get("/api/v1/settings/characters", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.integration
    def test_get_character_not_found(self, client, auth_headers):
        response = client.get("/api/v1/settings/characters/99999", headers=auth_headers)
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    @pytest.mark.integration
    def test_update_character(self, client, auth_headers, db_session):
        # 先创建
        create_resp = client.post(
            "/api/v1/settings/characters",
            json={"name": "李四"},
            headers=auth_headers
        )
        char_id = create_resp.json()["id"]

        # 再更新
        response = client.patch(
            f"/api/v1/settings/characters/{char_id}",
            json={"name": "李四（已修改）"},
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["name"] == "李四（已修改）"

    @pytest.mark.integration
    def test_delete_character(self, client, auth_headers, db_session):
        create_resp = client.post(
            "/api/v1/settings/characters",
            json={"name": "王五"},
            headers=auth_headers
        )
        char_id = create_resp.json()["id"]

        response = client.delete(
            f"/api/v1/settings/characters/{char_id}",
            headers=auth_headers
        )
        assert response.status_code == 200

        # 确认已删除
        get_resp = client.get(f"/api/v1/settings/characters/{char_id}", headers=auth_headers)
        assert get_resp.status_code == 404
```

#### 6.2.2 AI 路由测试 (Mock 外部 API)

```python
# tests/integration/test_api_ai.py
import pytest
from unittest.mock import patch, AsyncMock


class TestAIGenerate:
    @pytest.mark.integration
    @pytest.mark.slow
    def test_generate_streaming(self, client, auth_headers, db_session):
        with patch('backend.routes.ai.get_ai_service') as mock_get:
            mock_service = MagicMock()

            async def mock_stream():
                for chunk in ["测试", "内容"]:
                    yield chunk

            mock_service.generate = mock_stream
            mock_get.return_value = mock_service

            response = client.post(
                "/api/v1/ai/generate",
                json={"prompt": "测试", "operation": "continue"},
                headers=auth_headers
            )
            assert response.status_code == 200
            assert "测试" in response.text

    @pytest.mark.integration
    def test_generate_no_api_key_configured(self, client, auth_headers):
        with patch.object(settings, 'minimax_api_key', None):
            response = client.post(
                "/api/v1/ai/generate",
                json={"prompt": "测试", "operation": "continue"},
                headers=auth_headers
            )
            assert response.status_code == 500
            assert "API key not configured" in response.json()["detail"]
```

### 6.3 WebSocket 测试

```python
# tests/integration/test_websocket.py
import pytest
import json
from starlette.testclient import TestClient


class TestWebSocketChat:
    @pytest.mark.websocket
    def test_websocket_connect_and_message(self, client):
        with client.websocket_connect("/ws/chat/1") as websocket:
            websocket.send_text(json.dumps({"content": "hello", "role": "user"}))
            data = websocket.receive_json()
            assert data["type"] == "message"
            assert data["content"] == "hello"

    @pytest.mark.websocket
    def test_websocket_invalid_json(self, client):
        with client.websocket_connect("/ws/chat/1") as websocket:
            websocket.send_text("not valid json {")
            data = websocket.receive_json()
            assert data["type"] == "error"
            assert data["code"] == "invalid_json"

    @pytest.mark.websocket
    def test_websocket_rate_limit(self, client):
        with client.websocket_connect("/ws/chat/1") as websocket:
            # 发送大量消息触发限流
            for _ in range(130):
                websocket.send_text(json.dumps({"content": "x", "role": "user"}))

            # 最后一条应被限流
            data = websocket.receive_json()
            # 可能收到正常消息或限流错误
```

### 6.4 Agent 层测试

```python
# tests/agents/test_context_agent.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.agents.context_agent import ContextAgent


class TestContextAgent:
    @pytest.mark.asyncio
    async def test_generate_chapter_context_not_found(self, mock_ai_service, db_session):
        agent = ContextAgent(mock_ai_service)
        with pytest.raises(ValueError, match="Chapter 999 not found"):
            await agent.generate_chapter_context(999, db_session)

    @pytest.mark.asyncio
    async def test_generate_chapter_context_success(self, mock_ai_service, db_session):
        # 创建测试章节
        from tests.factories import ChapterFactory
        chapter = await ChapterFactory.create(db_session, title="测试章节")

        # Mock API 返回有效 JSON
        mock_ai_service.api_client.call = AsyncMock(return_value=json.dumps({
            "core_task": {"goal": "测试目标", "obstacle": "测试阻力", "cost": "测试代价"},
            "承接上文": {"hooks": [], "reader_expectations": "期待"},
            "active_characters": [],
            "scene_constraints": {"locations": [], "power_limits": ""},
            "time_constraints": "",
            "style_guidance": "",
            "continuity": {"foreshadowing": [], "ongoing_threads": []},
            "engagement_strategy": ""
        }))

        agent = ContextAgent(mock_ai_service)
        result = await agent.generate_chapter_context(chapter.id, db_session)

        assert result["chapter_id"] == chapter.id
        assert "core_task" in result
        assert result["core_task"]["goal"] == "测试目标"

    @pytest.mark.asyncio
    async def test_generate_chapter_context_parse_error_fallback(self, mock_ai_service, db_session):
        from tests.factories import ChapterFactory
        chapter = await ChapterFactory.create(db_session)

        # Mock API 返回无效 JSON
        mock_ai_service.api_client.call = AsyncMock(return_value="invalid json")

        agent = ContextAgent(mock_ai_service)
        result = await agent.generate_chapter_context(chapter.id, db_session)

        # 应返回 fallback 数据
        assert result["core_task"]["goal"] == "待确定"
        assert "parse_error" in result
```

### 6.5 数据库测试

```python
# tests/integration/test_database.py
import pytest
from sqlalchemy import select
from backend.models.entities import Character, Chapter, ChatSession


class TestDatabaseConstraints:
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_character_cascade_delete(self, db_session):
        """测试角色删除时级联删除关系."""
        char = Character(name="测试角色")
        db_session.add(char)
        await db_session.flush()

        from backend.models.entities import CharacterRelationship
        rel = CharacterRelationship(
            character_id=char.id,
            target_id=char.id,
            type="self"
        )
        db_session.add(rel)
        await db_session.flush()

        await db_session.delete(char)
        await db_session.flush()

        # 验证关系已被级联删除
        result = await db_session.execute(
            select(CharacterRelationship).where(CharacterRelationship.character_id == char.id)
        )
        assert result.scalar_one_or_none() is None

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_chat_session_cascade_messages(self, db_session):
        """测试会话删除时级联删除消息."""
        session = ChatSession()
        db_session.add(session)
        await db_session.flush()

        from backend.models.entities import ChatMessage
        msg = ChatMessage(session_id=session.id, role="user", content="测试")
        db_session.add(msg)
        await db_session.flush()

        await db_session.delete(session)
        await db_session.flush()

        result = await db_session.execute(
            select(ChatMessage).where(ChatMessage.session_id == session.id)
        )
        assert result.scalar_one_or_none() is None
```

### 6.6 性能测试

```python
# tests/performance/test_load.py
import pytest
import asyncio
import time
import httpx


class TestLoad:
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_concurrent_character_list(self, client):
        """测试并发获取角色列表."""
        async def fetch():
            return client.get("/api/v1/settings/characters")

        start = time.time()
        tasks = [fetch() for _ in range(50)]
        results = await asyncio.gather(*tasks)
        elapsed = time.time() - start

        assert all(r.status_code == 200 for r in results)
        assert elapsed < 5.0  # 50 并发应在 5 秒内完成

    @pytest.mark.performance
    def test_cache_hit_performance(self):
        """测试缓存命中性能."""
        from backend.services.cache_service import LRUCache
        cache = LRUCache(max_size=1000)

        # 预热缓存
        for i in range(1000):
            cache.set(f"key{i}", f"value{i}")

        start = time.time()
        for i in range(10000):
            cache.get(f"key{i % 1000}")
        elapsed = time.time() - start

        assert elapsed < 0.1  # 10000 次缓存命中应在 100ms 内
```

### 6.7 安全测试

```python
# tests/security/test_input_validation.py
import pytest


class TestInputValidation:
    @pytest.mark.security
    def test_sql_injection_in_character_name(self, client, auth_headers):
        """测试角色名称 SQL 注入防护."""
        response = client.post(
            "/api/v1/settings/characters",
            json={"name": "'; DROP TABLE characters; --"},
            headers=auth_headers
        )
        # 应正常创建或返回验证错误，不应导致 SQL 注入
        assert response.status_code in (200, 422)

    @pytest.mark.security
    def test_xss_in_character_description(self, client, auth_headers):
        """测试角色描述 XSS 防护."""
        xss_payload = "<script>alert('xss')</script>"
        response = client.post(
            "/api/v1/settings/characters",
            json={"name": "测试", "description": xss_payload},
            headers=auth_headers
        )
        assert response.status_code == 200
        # 响应中不应包含未转义的脚本标签
        assert "<script>" not in response.text or response.json()["description"] == xss_payload

    @pytest.mark.security
    def test_auth_required_for_protected_routes(self, client):
        """测试未认证访问受保护路由."""
        with patch.object(settings, 'auth_skip_localhost', False):
            response = client.get("/api/v1/settings/characters")
            assert response.status_code == 401
```

---

## 7. Mock / Stub 策略

### 7.1 外部依赖 Mock 矩阵

| 依赖 | Mock 方式 | 用途 |
|------|----------|------|
| MiniMax API | `unittest.mock.patch('httpx.AsyncClient')` | AI 生成、审查、实体提取 |
| SQLite (生产) | `sqlite+aiosqlite:///:memory:` | 测试数据库 |
| 缓存 (diskcache) | `DISKCACHE_AVAILABLE = False` | 禁用磁盘缓存 |
| 认证 | `patch.object(settings, 'auth_skip_localhost', True)` | 跳过认证 |
| 日志 | `caplog` fixture / `logging.disable()` | 抑制日志输出 |

### 7.2 AI 服务 Mock 最佳实践

```python
# 1. 使用 fixture 统一 mock
@pytest.fixture
def mock_ai_service():
    """提供一致的 AI 服务 mock."""
    service = MagicMock()
    service.generate = AsyncMock(return_value=async_generator(["测试", "内容"]))
    service.review_settings = AsyncMock(return_value={...})
    return service

# 2. 在路由测试中 patch get_ai_service
with patch('backend.routes.ai.get_ai_service', return_value=mock_ai_service):
    response = client.post("/api/v1/ai/generate", json={...})

# 3. 在 agent 测试中直接注入
agent = ContextAgent(mock_ai_service)
```

---

## 8. CI/CD 测试集成

### 8.1 GitHub Actions 工作流

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.11', '3.12']

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Run unit tests
        run: pytest -m unit -v --cov=src/backend --cov-report=xml

      - name: Run integration tests
        run: pytest -m integration -v

      - name: Run security tests
        run: pytest -m security -v

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.xml
          fail_ci_if_error: false
```

### 8.2 测试分层执行

```bash
# 快速反馈 (开发时)
pytest -m unit -x  # 仅单元测试, 失败即停

# 提交前检查
pytest -m "unit or integration" --cov-fail-under=75

# 完整测试 (CI/CD)
pytest -v --cov=src/backend --cov-report=html

# 特定模块
pytest tests/integration/test_api_settings.py -v

# 性能测试
pytest -m performance --benchmark-only

# 安全测试
pytest -m security -v
```

---

## 9. 测试数据管理

### 9.1 数据库迁移策略

```python
# conftest.py 中自动创建/销毁测试表
@pytest_asyncio.fixture(scope="session")
async def engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
```

### 9.2 测试隔离

- 每个测试用例使用独立的数据库事务
- 测试结束后自动回滚 (`trans.rollback()`)
- 缓存使用独立的内存实例
- 全局状态 (如 `_api_key_cache`) 在 fixture 中清理

---

## 10. 当前测试缺口分析

| 模块 | 已有测试 | 缺失测试 | 优先级 |
|------|---------|---------|--------|
| export_import | test_export_import.py | 集成测试 (路由层) | 高 |
| websocket | test_websocket.py | 压力测试、多客户端 | 中 |
| database_service | test_database_service.py | CRUD 全覆盖 | 高 |
| middleware | test_middleware.py | 性能中间件、请求上下文 | 中 |
| ai_service | - | 完整单元测试 + mock | 高 |
| cache_service | - | LRU、CacheService、装饰器 | 高 |
| agents | - | ContextAgent, DataAgent, Checkers | 中 |
| routes/chat | - | 全部端点 | 高 |
| routes/settings | - | 全部端点 | 高 |
| routes/chapters | - | 全部端点 | 高 |
| routes/ai | - | 全部端点 | 高 |
| routes/auth | - | 全部端点 | 高 |
| models/entities | - | 关系约束、级联删除 | 中 |
| security | - | 认证绕过、输入验证 | 高 |

---

## 11. 实施路线图

### Phase 1: 基础设施 (1-2 天)
- [ ] 配置 pytest + async 支持
- [ ] 创建 conftest.py (数据库 engine、session fixture)
- [ ] 创建 factories.py (CharacterFactory, ChapterFactory 等)
- [ ] 创建 mock fixtures (ai_mock, auth_mock)

### Phase 2: 核心单元测试 (3-5 天)
- [ ] 测试所有 Pydantic schemas (验证规则)
- [ ] 测试 cache_service (LRU、CacheService)
- [ ] 测试 rate_limit (RateLimitStore)
- [ ] 测试 auth 中间件 (verify_api_key, generate_api_key)
- [ ] 测试 export_import (序列化、验证、冲突解决)
- [ ] 测试 ai_service (mock httpx)

### Phase 3: 集成测试 (5-7 天)
- [ ] 测试所有路由端点 (CRUD + 错误路径)
- [ ] 测试 WebSocket (连接、消息、断开、限流)
- [ ] 测试数据库约束 (级联删除、外键)

### Phase 4: Agent 测试 (3-4 天)
- [ ] ContextAgent (mock AI 响应)
- [ ] DataAgent (mock AI 响应)
- [ ] Checkers (mock AI 响应)

### Phase 5: 安全与性能 (2-3 天)
- [ ] 安全测试 (认证、输入验证、注入)
- [ ] 性能测试 (并发、缓存命中率)
- [ ] 负载测试脚本 (locust)

---

## 12. 依赖清单 (requirements-dev.txt)

```
# 测试框架
pytest>=8.0.0
pytest-asyncio>=0.23.0
pytest-cov>=4.1.0
pytest-benchmark>=4.0.0
pytest-xdist>=3.5.0

# HTTP 测试
httpx>=0.27.0
requests>=2.31.0

# 数据库测试
aiosqlite>=0.19.0

# 性能测试
locust>=2.20.0

# 数据工厂
factory-boy>=3.3.0
faker>=22.0.0

# 代码质量
ruff>=0.1.0
mypy>=1.8.0
```

---

## 13. 关键设计决策

1. **内存数据库**: 使用 `:memory:` SQLite 避免测试污染，每个 session 创建一次表结构
2. **事务回滚**: 每个测试用例独立事务，测试结束自动回滚，保证隔离性
3. **AI Mock**: 所有 AI 相关测试使用 mock，不调用真实 API，确保测试快速稳定
4. **认证绕过**: 测试环境默认跳过 localhost 认证，安全测试单独验证认证逻辑
5. **缓存隔离**: 测试中创建独立的 CacheService 实例，避免污染生产缓存
6. **分层标记**: 使用 pytest markers 区分 unit/integration/e2e/performance/security，便于选择性执行
