# API 路由设计审查报告

**审查任务**: #8 - 审查现有 API 路由设计和端点
**审查时间**: 2026-04-22
**审查范围**: `src/backend/api/v1/endpoints/`
**路由总数**: 27个路由模块

---

## 一、API 架构概览

### 1.1 路由文件清单

| 文件 | 前缀 | 标签 | 功能说明 |
|------|------|------|----------|
| `auth.py` | `/api/v1/auth` | auth | API密钥管理 |
| `chat.py` | `/api/v1/chat` | chat | 聊天会话管理(界面1) |
| `settings.py` | `/api/v1/settings` | settings | 世界设定管理(界面2) |
| `chapters.py` | `/api/v1/chapters` | chapters | 章节/大纲/IF线/伏笔(界面3) |
| `ai.py` | `/api/v1/ai` | ai | AI生成、审查、检查器 |
| `agents.py` | `/api/v1/agents` | agents | AI Agent执行 |
| `workflows.py` | `/api/v1/workflows` | workflows | 工作流执行管理 |
| `styles.py` | `/api/v1/styles` | styles | 文笔风格定义 |
| `health.py` | `/api/v1/health` | health | 健康检查 |
| `metrics.py` | `/api/v1/metrics` | metrics | 性能指标 |
| `tasks.py` | - | tasks | 异步任务管理 |
| `cache.py` | - | cache | 缓存管理 |
| `stats.py` | - | stats | 统计数据 |
| `context_rank.py` | - | context_rank | 上下文排序 |
| `snapshots.py` | - | snapshots | 数据快照 |
| `pacing.py` | - | pacing | 节奏分析 |
| `genres.py` | - | genres | 题材分类 |
| `graph.py` | - | graph | 知识图谱 |
| `context.py` | - | context | 上下文管理 |
| `constraints.py` | - | constraints | 约束管理 |
| `observability.py` | - | observability | 可观测性 |
| `engagement.py` | - | engagement | 读者互动 |
| `export_import.py` | - | export_import | 导出/导入 |
| `__init__.py` | - | - | 代理模块(遗留兼容) |

### 1.2 API 版本管理

- **当前版本**: `/api/v1`
- **版本策略**: 集中式版本控制，所有端点统一前缀
- **遗留迁移**: `src/backend/routes/` 目录保留为代理模块，通过 `__getattr__` 懒加载重定向到新位置

---

## 二、RESTful 设计分析

### 2.1 符合 RESTful 规范的端点

#### auth.py - 认证端点
```
POST   /auth/key           - 创建/获取API密钥
POST   /auth/key/refresh   - 刷新API密钥
GET    /auth/status        - 认证状态
```
**评价**: ✅ 符合 RESTful 规范，资源语义清晰

#### styles.py - 风格端点
```
GET    /styles/            - 列出所有风格
GET    /styles/{style_id}  - 获取特定风格
```
**评价**: ✅ 标准资源操作，无冗余

#### settings.py - 设定管理端点
```
GET    /settings/characters           - 列出角色
POST   /settings/characters           - 创建角色
GET    /settings/characters/{id}      - 获取角色
PATCH  /settings/characters/{id}      - 更新角色
DELETE /settings/characters/{id}      - 删除角色

GET    /settings/characters/{id}/relationships  - 角色关系
POST   /settings/characters/{id}/relationships  - 创建关系

GET    /settings/characters/{id}/storylines      - 角色故事线
POST   /settings/characters/{id}/storylines     - 创建故事线

GET    /settings/items       - 物品 CRUD
GET    /settings/locations   - 地点 CRUD
GET    /settings/factions    - 势力 CRUD
GET    /settings/world       - 世界观 CRUD
GET    /settings/rules       - 规则 CRUD

GET    /settings/writing     - 写作设置(单例)
PATCH  /settings/writing     - 更新写作设置
```
**评价**: ✅ 层级关系正确，使用子资源处理关联实体

#### chapters.py - 章节管理端点
```
GET    /chapters/outlines            - 大纲列表
POST   /chapters/outlines            - 创建大纲
GET    /chapters/outlines/{id}       - 获取大纲
PATCH  /chapters/outlines/{id}       - 更新大纲
DELETE /chapters/outlines/{id}       - 删除大纲

GET    /chapters/                    - 章节列表
POST   /chapters/                    - 创建章节
GET    /chapters/{id}                - 获取章节
PATCH  /chapters/{id}                - 更新章节
DELETE /chapters/{id}                - 删除章节

GET    /chapters/{id}/drafts              - 草稿版本
POST   /chapters/{id}/drafts              - 创建草稿
GET    /chapters/{id}/drafts/{version}    - 获取特定版本

GET    /chapters/{id}/inspections         - AI审查结果
POST   /chapters/{id}/inspections         - 创建审查结果

GET    /chapters/if-lines           - IF线列表(在 /{chapter_id} 之前注册)
POST   /chapters/if-lines           - 创建IF线
GET    /chapters/if-lines/{id}      - 获取IF线
PATCH  /chapters/if-lines/{id}     - 更新IF线
DELETE /chapters/if-lines/{id}      - 删除IF线

GET    /chapters/plot-threads       - 伏笔列表(在 /{chapter_id} 之前注册)
POST   /chapters/plot-threads       - 创建伏笔
GET    /chapters/plot-threads/{id} - 获取伏笔
PATCH  /chapters/plot-threads/{id} - 更新伏笔
DELETE /chapters/plot-threads/{id}  - 删除伏笔
```
**评价**: ✅ 路由顺序正确处理(IF线和伏笔必须在 `/{chapter_id}` 之前注册)

### 2.2 RESTful 设计问题

#### chat.py - 聊天端点
```
POST   /chat/sessions              - 创建会话
GET    /chat/sessions              - 列出会话
GET    /chat/sessions/{id}         - 获取会话
DELETE /chat/sessions/{id}         - 删除会话

POST   /chat/sessions/{id}/messages        - 发送消息
GET    /chat/sessions/{id}/messages        - 获取消息
POST   /chat/sessions/{id}/send             - 发送并获取AI回复(异常)

GET    /chat/sessions/{id}/entities         - 获取提取的实体
PATCH  /chat/entities/{id}/confirm          - 确认实体(路径不一致)
GET    /chat/sessions/{id}/summary          - 获取会话摘要
```

**问题**:
- `/chat/sessions/{id}/send` 应为 `POST` 而非独立的 `/send` 端点
- `/chat/entities/{id}/confirm` 路径与 `/chat/sessions/{id}/entities` 不一致
- 实体确认端点使用 `chat/entities` 但其他实体相关端点使用 `chat/sessions/{id}/entities`

#### ai.py - AI端点
```
POST   /ai/generate          - AI生成(流式响应)
POST   /ai/review            - AI审查设定
POST   /ai/extract-entities  - 提取实体
POST   /ai/chapters/{id}/inspect  - AI审查章节

POST   /ai/context           - 构建写作执行包
POST   /ai/extract           - 提取结构化实体

POST   /ai/check/consistency    - 一致性检查
POST   /ai/check/continuity     - 连续性检查
POST   /ai/check/pacing         - 节奏检查
POST   /ai/check/ooc            - OOC检查
POST   /ai/check/high-point     - 高潮检查
POST   /ai/check/reader-pull    - 读者吸引力检查

GET    /ai/health            - AI提供商健康状态
POST   /ai/failover           - 手动故障转移
```

**问题**:
- `ai/check/*` 端点使用子路径但没有统一的 `check` 资源集合
- 应考虑 `/ai/chapters/{id}/check` 或 `/ai/checks` 资源集合
- `ai/context` 和 `ai/extract` 功能类似，应考虑合并

#### agents.py - Agent端点
```
POST   /agents/style        - 风格分析
POST   /agents/review       - 质量审查
POST   /agents/plot         - 剧情分析
GET    /agents/checkers     - 检查器列表
POST   /agents/check        - 运行检查器
POST   /agents/check-all    - 运行所有检查器
```

**问题**:
- `/agents/style`, `/agents/review`, `/agents/plot` 使用动词而非名词
- 应考虑 `/agents/style-analysis`, `/agents/review-agent`, `/agents/plot-agent`

#### workflows.py - 工作流端点
```
POST   /workflows/{name}/execute   - 执行工作流
GET    /workflows/{name}/status/{id}  - 获取状态
GET    /workflows/                - 列出工作流
GET    /workflows/executions      - 列出执行记录
GET    /workflows/executions/{id}/logs  - 获取日志
```

**问题**:
- `/{name}/execute` 中 `execute` 是动词但路径中没有资源集合
- 应考虑 `/workflows/{name}/executions` 作为资源，POST 创建新执行
- `/workflows/executions/{id}/logs` 中 `executions` 路径片段缺少 `s`

---

## 三、请求/响应格式分析

### 3.1 请求模型验证

**良好实践**:
- 所有请求模型使用 Pydantic v2 `BaseModel`
- 使用 `field_validator` 进行输入验证
- `model_config` 中包含 `json_schema_extra` 示例
- 使用 `Field()` 描述字段含义

**问题**:

1. **ai.py - GenerateRequest**
```python
@field_validator('operation')
@classmethod
def validate_operation(cls, v: str) -> str:
    if v not in VALID_OPERATIONS:
        raise ValueError(f'Operation must be one of: {", ".join(sorted(VALID_OPERATIONS))}')
    return v
```
验证消息应为中文保持一致性

2. **agents.py - StyleAnalysisRequest**
```python
content: str = Field(..., description="Text content to analyze style", max_length=100000)
style_reference: Optional[str] = Field(None, description="Reference style name (e.g., '江南', '卡夫卡')")
```
描述使用英文，与其他端点不一致

### 3.2 响应模型一致性

**良好实践**:
- 使用独立的 Response 模型类
- 响应包含适当的元数据
- 使用 `response_model` 声明类型

**问题**:

1. **不一致的错误响应**: 部分端点返回 `{"message": "..."}`，部分返回 `{"detail": "..."}`
   - FastAPI 默认使用 `detail` 字段，建议统一

2. **ai.py 端点返回类型不明确**:
```python
async def generate_content(...):
    return StreamingResponse(...)  # 没有声明 response_model
```

### 3.3 分页规范

**settings.py, chat.py, chapters.py**:
```python
skip: int = 0
limit: int = 100
```
✅ 使用标准分页参数

**可改进点**:
- 缺少总计数返回 (`X-Total-Count` header 或响应体中的 `total`)
- 缺少分页元数据 (`has_more`, `total_pages`)

---

## 四、错误处理机制

### 4.1 HTTP 状态码使用

| 状态码 | 用途 | 端点示例 |
|--------|------|----------|
| 200 | 成功(GET, PATCH) | settings.py, chapters.py |
| 201 | 成功创建(POST) | settings.py, chapters.py |
| 202 | 异步接受(workflows) | workflows.py |
| 400 | 请求验证失败 | agents.py, ai.py |
| 401 | 未认证 | auth.py |
| 404 | 资源不存在 | 所有端点 |
| 429 | 速率限制 | chat.py, agents.py, ai.py |
| 500 | 服务器错误 | agents.py |
| 503 | 服务不可用 | workflows.py, agents.py |

**评价**: ✅ 状态码使用基本正确

### 4.2 错误响应格式

**标准 FastAPI 错误**:
```python
raise HTTPException(status_code=404, detail="Not found")
```
响应: `{"detail": "Not found"}`

**自定义错误**:
```python
# workflows.py
return {"execution_id": ..., "status": "failed", "message": "Workflow failed: ..."}
```

**问题**:
- 缺少统一的错误响应模型
- 部分端点返回 `message` 而非 `detail`
- 建议定义 `ErrorResponse` 模型:
```python
class ErrorResponse(BaseModel):
    error: str = Field(..., description="错误类型")
    detail: str = Field(..., description="错误详情")
    code: Optional[str] = Field(None, description="错误代码")
```

### 4.3 异常处理

**良好实践**:
```python
try:
    result = await checker.check(...)
except Exception as e:
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Checker '{request.checker_name}' failed: {str(e)}"
    )
```

**问题**:
- 某些端点捕获所有异常但不记录日志
- 某些端点直接返回 500 而不区分异常类型

---

## 五、速率限制

### 5.1 实现方式

**chat.py - 内存存储**:
```python
rate_limit_store: dict[str, list[float]] = {}

def check_rate_limit(client_ip: str, max_requests: int = 30, window_seconds: float = 60.0) -> bool:
    # 简单滑动窗口实现
```

**agents.py, ai.py - 中间件**:
```python
from backend.middleware.rate_limit import check_checker_rate_limit

def require_checker_rate_limit(request: Request) -> None:
    allowed, limit, remaining = check_checker_rate_limit(client_ip)
    if not allowed:
        raise HTTPException(status_code=429, ...)
```

### 5.2 限流端点

| 端点 | 限制 | 窗口 |
|------|------|------|
| `GET /chat/sessions` | 60请求 | 60秒 |
| `POST /chat/sessions/{id}/messages` | 30请求 | 60秒 |
| `POST /chat/sessions/{id}/send` | 20请求 | 60秒 |
| `POST /agents/check*` | 较严格 | 60秒 |
| `POST /ai/check*` | 较严格 | 60秒 |

### 5.3 问题

1. **内存存储限制**: 进程重启后丢失，不适合多实例部署
2. **无全局配置**: 限制值硬编码
3. **无精细控制**: 无法按用户/项目限制

---

## 六、认证授权

### 6.1 认证方式

```python
from backend.middleware.auth import require_auth

router = APIRouter(prefix="/api/v1", ..., dependencies=[require_auth])
```

### 6.2 实现模式

- **全局依赖**: 多数路由通过 `dependencies=[require_auth]` 保护
- **端点级依赖**: 特定端点额外添加速率限制

### 6.3 问题

1. **健康检查端点无认证**: `/health` 端点可公开访问(合理)
2. **部分监控端点无认证**: `/metrics` 需要认证但 `/health` 不需要
3. **auth.py 自身无认证**: 获取API密钥端点不需要认证(合理，桌面应用首次启动)

---

## 七、API 设计改进建议

### 7.1 高优先级

#### 7.1.1 统一错误响应格式

建议定义标准错误响应:
```python
class APIError(BaseModel):
    code: str = Field(..., description="错误代码")
    message: str = Field(..., description="错误消息")
    details: Optional[dict] = Field(None, description="详细信息")

class ErrorResponse(BaseModel):
    error: APIError
    request_id: Optional[str] = Field(None, description="请求追踪ID")
```

#### 7.1.2 统一分页响应

```python
class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    skip: int
    limit: int
    has_more: bool
```

#### 7.1.3 修复 RESTful 路径问题

**workflows.py**:
- 现状: `POST /workflows/{name}/execute`
- 建议: `POST /workflows/{name}/executions` (创建执行)

**agents.py**:
- 现状: `POST /agents/style`, `POST /agents/review`, `POST /agents/plot`
- 建议: `POST /agents/style-analysis`, `POST /agents/review-jobs`, `POST /agents/plot-analyses`

### 7.2 中优先级

#### 7.2.1 添加 API 版本响应头

```python
headers = {
    "X-API-Version": "v1",
    "X-Request-ID": request_id,
}
```

#### 7.2.2 完善速率限制配置

- 将限制值移至配置文件
- 支持按用户/项目限制
- 考虑使用 Redis 存储(多实例部署)

#### 7.2.3 添加请求ID追踪

```python
from uuid import uuid4

request_id = request.headers.get("X-Request-ID", str(uuid4()))
```

### 7.3 低优先级

#### 7.3.1 API 文档增强

- 补充更多 OpenAPI 描述
- 添加更多请求/响应示例
- 为复杂端点添加流程说明

#### 7.3.2 考虑添加 GraphQL 端点

对于复杂查询(如角色+关系+故事线)，RESTful 可能需要多次请求

---

## 八、API 端点汇总

### 8.1 核心业务端点(界面1-3)

| 界面 | 资源 | 端点数 | 完整度 |
|------|------|--------|--------|
| 界面1 聊天 | chat/sessions, messages | 8 | 85% |
| 界面2 设定 | settings/* | 40+ | 90% |
| 界面3 写作 | chapters/* | 30+ | 85% |

### 8.2 AI/Agent 端点

| 分类 | 端点数 | 说明 |
|------|--------|------|
| AI生成 | 4 | generate, review, extract-entities, inspect |
| AI检查器 | 6 | consistency, continuity, pacing, ooc, high-point, reader-pull |
| Agent执行 | 6 | style, review, plot, checkers, check, check-all |
| 工作流 | 5 | execute, status, list, executions, logs |

### 8.3 系统端点

| 分类 | 端点数 | 说明 |
|------|--------|------|
| 认证 | 3 | key, refresh, status |
| 健康 | 3 | health, ready, live |
| 指标 | 2 | metrics, history |
| 其他 | 10+ | styles, export/import, 等 |

---

## 九、结论

### 9.1 优点

1. **结构清晰**: 使用 `/api/v1` 前缀和标签分组
2. **RESTful 基础良好**: 大部分端点遵循 RESTful 设计原则
3. **验证完善**: Pydantic 模型提供完整的请求验证
4. **错误处理**: 基本的 HTTP 状态码和异常处理
5. **速率限制**: 关键端点有速率保护
6. **认证机制**: 通过中间件统一认证

### 9.2 需改进

1. **错误响应格式不统一**: 部分端点使用 `message` 而非 `detail`
2. **RESTful 路径命名不一致**: 部分端点使用动词而非名词
3. **分页缺少元数据**: 无 `total`, `has_more` 等信息
4. **速率限制基于内存**: 不适合分布式部署
5. **文档可增强**: 部分端点缺少中文描述

### 9.3 总体评价

**评分: 7.5/10**

API 设计整体良好，遵循了 FastAPI 的最佳实践，主要问题集中在一致性和部分 RESTful 设计细节上。建议优先统一错误响应格式和修复 RESTful 路径问题。
