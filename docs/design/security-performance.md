# 安全加固与性能优化方案

> **项目**: Auto Novel Writer - 自动化写作软件后端
> **技术栈**: FastAPI + async SQLAlchemy + SQLite(aiosqlite)
> **日期**: 2026-04-21
> **版本**: v1.0

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [安全检查清单](#2-安全检查清单)
3. [性能优化方案](#3-性能优化方案)
4. [实施优先级](#4-实施优先级)
5. [附录：代码审计详情](#5-附录代码审计详情)

---

## 1. 执行摘要

本方案基于对 `src/backend/` 现有代码的深度审计，涵盖认证、限流、配置、数据库、WebSocket、导出导入等模块。当前后端已具备基础安全框架（API Key 认证、CORS、限流、请求日志），但在桌面应用特有的密钥管理、SQLite 数据加密、大文本存储等方面存在明显短板。性能方面，SQLite 并发、连接池配置、缓存策略均有优化空间。

**总体评估**:
- **安全成熟度**: 3/5（基础框架存在，缺少数据层加密和桌面级密钥管理）
- **性能成熟度**: 3/5（基础监控存在，缺少针对性优化）

---

## 2. 安全检查清单

### 2.1 API 密钥安全存储

| # | 检查项 | 状态 | 风险等级 | 修复方案 |
|---|--------|------|----------|----------|
| 2.1.1 | `.env` 文件明文存储 `api_key` | 高风险 | 高 | 使用系统密钥环替代 `.env` |
| 2.1.2 | `minimax_api_key` 明文存储于 `.env` | 高风险 | 高 | 使用系统密钥环 + 加密存储 |
| 2.1.3 | API Key 生成后无持久化机制 | 中风险 | 中 | 生成后写入系统密钥环 |
| 2.1.4 | 内存中 `_api_key_cache` 无过期机制 | 低风险 | 低 | 添加 TTL 或进程退出清理 |

**详细分析**:

当前 `config.py` 通过 `pydantic-settings` 从 `.env` 读取密钥：

```python
# config.py (当前)
class Settings(BaseSettings):
    api_key: str | None = None
    minimax_api_key: str | None = None
```

桌面应用（Windows/macOS/Linux）不应使用 `.env` 存储敏感密钥，原因：
- `.env` 文件可被用户直接读取
- 打包后 `.env` 仍存在于文件系统中
- 不符合桌面应用安全最佳实践

**推荐方案**:

```python
# security/keyring_manager.py
"""跨平台密钥环管理，替代 .env 存储敏感密钥."""

import keyring
import secrets
from typing import Optional

SERVICE_NAME = "auto-novel-writer"
API_KEY_USERNAME = "local_api_key"
MINIMAX_KEY_USERNAME = "minimax_api_key"


class KeyringManager:
    """使用系统密钥环安全存储 API 密钥.

    Windows -> Credential Manager
    macOS   -> Keychain
    Linux   -> Secret Service / kwallet
    """

    @staticmethod
    def get_api_key() -> Optional[str]:
        return keyring.get_password(SERVICE_NAME, API_KEY_USERNAME)

    @staticmethod
    def set_api_key(key: str) -> None:
        keyring.set_password(SERVICE_NAME, API_KEY_USERNAME, key)

    @staticmethod
    def get_minimax_key() -> Optional[str]:
        return keyring.get_password(SERVICE_NAME, MINIMAX_KEY_USERNAME)

    @staticmethod
    def set_minimax_key(key: str) -> None:
        keyring.set_password(SERVICE_NAME, MINIMAX_KEY_USERNAME, key)

    @staticmethod
    def generate_and_store_api_key() -> str:
        key = f"writer_{secrets.token_urlsafe(32)}"
        KeyringManager.set_api_key(key)
        return key

    @staticmethod
    def delete_all_keys() -> None:
        """卸载时清理所有密钥."""
        try:
            keyring.delete_password(SERVICE_NAME, API_KEY_USERNAME)
        except keyring.errors.PasswordDeleteError:
            pass
        try:
            keyring.delete_password(SERVICE_NAME, MINIMAX_KEY_USERNAME)
        except keyring.errors.PasswordDeleteError:
            pass
```

**配置迁移策略**:

```python
# config.py (建议)
class Settings(BaseSettings):
    # 数据库 URL 可保留在 .env（非敏感）
    database_url: str = "sqlite+aiosqlite:///..."

    # 密钥从密钥环读取，不再从 .env 读取
    # api_key: str | None = None          # 移除
    # minimax_api_key: str | None = None  # 移除

    # 首次启动时从 .env 迁移到密钥环（向后兼容）
    _legacy_api_key: str | None = None  # 内部使用，读取后删除
```

**依赖**: `pip install keyring`

---

### 2.2 SQLite 数据加密

| # | 检查项 | 状态 | 风险等级 | 修复方案 |
|---|--------|------|----------|----------|
| 2.2.1 | 数据库文件完全未加密 | 高风险 | 高 | 启用 SQLCipher 加密 |
| 2.2.2 | 导出文件（JSON/YAML/ZIP）无加密 | 中风险 | 中 | 导出时支持密码加密 ZIP |
| 2.2.3 | 无数据完整性校验 | 低风险 | 低 | 添加 HMAC 或校验和 |

**详细分析**:

当前数据库路径：`data/writer.db`，完全明文存储。用户的创作内容（小说正文、设定）可被任何有文件访问权限的程序读取。

**推荐方案 - SQLCipher 集成**:

```python
# database.py (建议)
from sqlalchemy import event
from sqlalchemy.engine import Engine

# 使用 pysqlcipher3 替代 aiosqlite 以支持加密
# 或继续使用 aiosqlite + sqlite3 的加密扩展

ENCRYPTION_KEY: str | None = None  # 从密钥环获取


def get_encryption_key() -> str:
    """获取数据库加密密钥."""
    global ENCRYPTION_KEY
    if ENCRYPTION_KEY is None:
        from security.keyring_manager import KeyringManager
        key = KeyringManager.get_db_encryption_key()
        if key is None:
            # 首次启动：生成新密钥
            import secrets
            key = secrets.token_hex(32)
            KeyringManager.set_db_encryption_key(key)
        ENCRYPTION_KEY = key
    return ENCRYPTION_KEY


# 如果使用 sqlcipher:
# engine = create_async_engine(
#     "sqlite+aiosqlite:///...",
#     connect_args={"password": get_encryption_key()}
# )

# 更实际的方案：使用 sqlite3 的 SEE (SQLite Encryption Extension)
# 或开源替代方案：sqlcipher
```

**备选方案**（若 SQLCipher 集成复杂）:

应用层加密敏感字段：

```python
# security/field_encryption.py
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64


class FieldEncryption:
    """应用层字段加密，用于特别敏感的内容（如小说正文）."""

    def __init__(self, master_key: bytes):
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"auto-novel-writer-salt",  # 实际应使用随机 salt
            iterations=480000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(master_key))
        self._fernet = Fernet(key)

    def encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        return self._fernet.decrypt(ciphertext.encode()).decode()
```

**建议**: 优先实现应用层字段加密（实施成本低），后续版本迁移到 SQLCipher。

---

### 2.3 输入验证与防注入

| # | 检查项 | 状态 | 风险等级 | 修复方案 |
|---|--------|------|----------|----------|
| 2.3.1 | SQL 注入防护（使用 ORM + 参数化查询） | 已防护 | 低 | 保持现状 |
| 2.3.2 | XSS 防护（输出未做 HTML 转义） | 中风险 | 中 | 添加输出编码中间件 |
| 2.3.3 | 导入数据反序列化安全（YAML `safe_load` 已使用） | 已防护 | 低 | 保持现状 |
| 2.3.4 | ZIP 导入存在 Zip Slip 风险 | 中风险 | 中 | 验证 ZIP 内文件路径 |
| 2.3.5 | 导入数据缺少深度大小限制 | 中风险 | 中 | 添加递归深度和大小限制 |
| 2.3.6 | 文件名未做安全过滤（导出文件） | 低风险 | 低 | 过滤非法字符 |

**详细分析**:

当前 `services/export_import.py` 使用 `yaml.safe_load()`（正确），但 ZIP 导入未做路径遍历防护：

```python
# export_import.py (当前) - 潜在风险
with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as zf:
    # 未验证 zf.namelist() 中的路径
    if "project_data.json" in zf.namelist():
        with zf.open("project_data.json") as f:
            return json.loads(f.read().decode('utf-8'))
```

**修复代码**:

```python
# security/zip_validator.py
import zipfile
import os

MAX_ZIP_SIZE = 50 * 1024 * 1024  # 50MB
MAX_FILES_IN_ZIP = 100
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB per file


class ZipValidationError(ValueError):
    pass


def validate_zip_archive(zip_bytes: bytes) -> None:
    """验证 ZIP 文件安全性，防止 Zip Slip 和炸弹攻击."""

    if len(zip_bytes) > MAX_ZIP_SIZE:
        raise ZipValidationError(f"ZIP file too large: {len(zip_bytes)} bytes")

    with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as zf:
        if len(zf.namelist()) > MAX_FILES_IN_ZIP:
            raise ZipValidationError(f"Too many files in ZIP: {len(zf.namelist())}")

        for name in zf.namelist():
            # 防止路径遍历
            if os.path.isabs(name) or ".." in name:
                raise ZipValidationError(f"Invalid file path in ZIP: {name}")

            # 检查文件大小（解压前）
            info = zf.getinfo(name)
            if info.file_size > MAX_FILE_SIZE:
                raise ZipValidationError(f"File too large: {name}")
            if info.compress_size > MAX_FILE_SIZE:
                raise ZipValidationError(f"Compressed file too large: {name}")

            # 压缩比检查（防止 ZIP 炸弹）
            if info.file_size > 0:
                ratio = info.file_size / max(info.compress_size, 1)
                if ratio > 100:  # 压缩比超过 100:1 视为可疑
                    raise ZipValidationError(f"Suspicious compression ratio: {name}")
```

**导出文件名安全过滤**:

```python
# routes/export_import.py (建议)
import re

SAFE_FILENAME_RE = re.compile(r'[^\w\-.]')


def sanitize_filename(name: str, max_length: int = 100) -> str:
    """清理文件名，移除非法字符."""
    sanitized = SAFE_FILENAME_RE.sub('_', name)
    return sanitized[:max_length]
```

---

### 2.4 CORS 配置安全性

| # | 检查项 | 状态 | 风险等级 | 修复方案 |
|---|--------|------|----------|----------|
| 2.4.1 | `allow_origins` 限定 localhost | 已防护 | 低 | 保持现状 |
| 2.4.2 | `allow_methods=["*"]` 过于宽松 | 低风险 | 低 | 限定具体方法 |
| 2.4.3 | `allow_headers=["*"]` 过于宽松 | 低风险 | 低 | 限定具体头部 |
| 2.4.4 | 生产环境未验证 origin | 中风险 | 中 | 生产环境禁用通配 |

**当前配置** (`main.py:403-409`):

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # ["http://localhost:5173", ...]
    allow_credentials=True,
    allow_methods=["*"],  # 过于宽松
    allow_headers=["*"],  # 过于宽松
)
```

**建议配置**:

```python
# main.py (建议)
from fastapi.middleware.cors import CORSMiddleware

# 开发环境
DEV_CORS = {
    "allow_origins": ["http://localhost:5173", "http://127.0.0.1:5173"],
    "allow_credentials": True,
    "allow_methods": ["GET", "POST", "PUT", "DELETE", "PATCH"],
    "allow_headers": [
        "Content-Type",
        "Authorization",
        "X-API-Key",
        "X-Request-ID",
        "X-Correlation-ID",
    ],
    "max_age": 600,
}

# 生产环境（打包后）- 只允许本地文件或特定端口
PROD_CORS = {
    "allow_origins": ["http://localhost:*", "app://*"],  # Electron/Tauri 协议
    "allow_credentials": True,
    "allow_methods": ["GET", "POST", "PUT", "DELETE", "PATCH"],
    "allow_headers": [
        "Content-Type",
        "Authorization",
        "X-API-Key",
        "X-Request-ID",
        "X-Correlation-ID",
    ],
    "max_age": 600,
}
```

---

### 2.5 WebSocket 认证安全

| # | 检查项 | 状态 | 风险等级 | 修复方案 |
|---|--------|------|----------|----------|
| 2.5.1 | WebSocket 通过 query param 传递 API Key | 中风险 | 中 | 改为通过 header/subprotocol 传递 |
| 2.5.2 | WebSocket 连接无 origin 验证 | 中风险 | 中 | 验证 Origin header |
| 2.5.3 | `verify_websocket_auth` 对 localhost 完全跳过 | 低风险 | 低 | 添加配置开关 |
| 2.5.4 | WebSocket 消息无签名验证 | 低风险 | 低 | 可选：消息签名 |

**当前代码** (`main.py:29-39`):

```python
async def verify_websocket_auth(api_key: Optional[str]) -> bool:
    if getattr(settings, 'auth_skip_localhost', True):
        return True  # 完全跳过
    # ...
```

**建议改进**:

```python
# middleware/websocket_auth.py
from fastapi import WebSocket, HTTPException, status
from starlette.websockets import WebSocketState
import secrets


async def verify_websocket_auth(websocket: WebSocket) -> bool:
    """增强的 WebSocket 认证.

    优先从 subprotocol 获取 token，其次从 query param.
    """
    # 1. 验证 Origin（防止 CSWSH）
    origin = websocket.headers.get("origin", "")
    allowed_origins = settings.cors_origins
    if origin and origin not in allowed_origins:
        return False

    # 2. 开发环境跳过
    client_host = websocket.client.host if websocket.client else None
    if settings.auth_skip_localhost and _is_localhost(client_host):
        return True

    # 3. 从 subprotocol 获取 token（推荐方式）
    subprotocols = websocket.headers.get("sec-websocket-protocol", "").split(", ")
    token = None
    for proto in subprotocols:
        if proto.startswith("token."):
            token = proto[6:]  # 去掉 "token." 前缀
            break

    # 4. 回退到 query param
    if token is None:
        token = websocket.query_params.get("api_key")

    if not token:
        return False

    valid_key = await get_or_create_api_key()
    return secrets.compare_digest(token, valid_key)
```

**前端连接方式**:

```javascript
// 前端 WebSocket 连接
const ws = new WebSocket(
    `ws://localhost:8000/ws/chat/${sessionId}`,
    [`token.${apiKey}`, "chat-v1"]  // 通过 subprotocol 传递 token
);
```

---

### 2.6 导出文件安全性

| # | 检查项 | 状态 | 风险等级 | 修复方案 |
|---|--------|------|----------|----------|
| 2.6.1 | 导出 JSON/YAML 无完整性签名 | 低风险 | 低 | 添加导出签名 |
| 2.6.2 | 导出 ZIP 无密码保护 | 中风险 | 中 | 支持密码加密 ZIP |
| 2.6.3 | 导出内容未做敏感信息过滤 | 低风险 | 低 | 可选：过滤 API Key |
| 2.6.4 | 导入未验证数据版本兼容性 | 中风险 | 中 | 严格版本检查 |

**密码加密 ZIP 导出**:

```python
# services/export_import.py (建议)
import pyzipper  # 替代 zipfile，支持 AES 加密


def export_to_encrypted_zip(data: dict, password: str, format: str = "json") -> bytes:
    """导出为 AES-256 加密的 ZIP 文件."""
    if format == "yaml":
        export_data = export_to_yaml(data)
        filename = "project_data.yaml"
    else:
        export_data = export_to_json(data)
        filename = "project_data.json"

    zip_buffer = io.BytesIO()
    with pyzipper.AESZipFile(
        zip_buffer,
        'w',
        compression=pyzipper.ZIP_DEFLATED,
        encryption=pyzipper.WZ_AES,
    ) as zf:
        zf.setpassword(password.encode('utf-8'))
        zf.writestr(filename, export_data)
        zf.writestr("export_info.json", json.dumps({
            "format": format,
            "exported_at": datetime.utcnow().isoformat(),
            "encrypted": True,
        }, ensure_ascii=False))
    return zip_buffer.getvalue()
```

---

### 2.7 安全审计总结

```
高优先级（立即修复）:
  [ ] 2.1.1 使用系统密钥环替代 .env 存储 API Key
  [ ] 2.1.2 使用系统密钥环存储 MiniMax API Key
  [ ] 2.2.1 实现 SQLite 数据库加密（SQLCipher 或应用层加密）

中优先级（近期修复）:
  [ ] 2.2.2 导出 ZIP 支持密码加密
  [ ] 2.3.4 ZIP 导入添加 Zip Slip 防护
  [ ] 2.3.5 导入数据添加深度和大小限制
  [ ] 2.5.1 WebSocket 认证改为 subprotocol 传递
  [ ] 2.5.2 WebSocket 添加 Origin 验证
  [ ] 2.6.4 严格导入版本兼容性检查

低优先级（后续优化）:
  [ ] 2.1.4 API Key 内存缓存添加 TTL
  [ ] 2.2.3 添加数据完整性校验
  [ ] 2.3.2 添加 XSS 输出编码中间件
  [ ] 2.3.6 导出文件名安全过滤
  [ ] 2.4.2/2.4.3 CORS 方法/头部限定
  [ ] 2.5.3/2.5.4 WebSocket 配置和签名
  [ ] 2.6.1/2.6.3 导出签名和敏感信息过滤
```

---

## 3. 性能优化方案

### 3.1 SQLite 并发性能优化

#### 3.1.1 WAL 模式启用

**当前状态**: `database.py` 未配置 WAL 模式。

**分析**: SQLite 默认使用 rollback journal 模式，写操作会锁定整个数据库。WAL (Write-Ahead Logging) 模式允许读操作和写操作并发执行，大幅提升并发性能。

**实施方案**:

```python
# database.py (建议)
from sqlalchemy import event
from sqlalchemy.engine import Engine


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """启用 SQLite WAL 模式和其他优化."""
    cursor = dbapi_conn.cursor()

    # WAL 模式：读写并发
    cursor.execute("PRAGMA journal_mode=WAL")

    # 同步模式：NORMAL 在 WAL 下安全且更快
    cursor.execute("PRAGMA synchronous=NORMAL")

    # 临时表存储在内存中
    cursor.execute("PRAGMA temp_store=MEMORY")

    # 内存中缓存页数（约 20MB）
    cursor.execute("PRAGMA cache_size=-5000")

    # 外键约束
    cursor.execute("PRAGMA foreign_keys=ON")

    # 内存映射 I/O（提升大查询性能）
    cursor.execute("PRAGMA mmap_size=268435456")  # 256MB

    cursor.close()
```

**WAL 模式注意事项**:
- WAL 文件会增长，需要定期 checkpoint
- 添加后台 checkpoint 任务：

```python
# services/db_maintenance.py
import asyncio
from sqlalchemy import text
from database import engine


async def wal_checkpoint_task(interval_seconds: float = 300.0):
    """定期执行 WAL checkpoint，防止 WAL 文件无限增长."""
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            async with engine.begin() as conn:
                await conn.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))
        except Exception as e:
            logger.warning(f"WAL checkpoint failed: {e}")
```

#### 3.1.2 连接池调优

**当前配置分析**:

```python
# database.py (当前)
# 生产环境
engine = create_async_engine(
    settings.database_url,
    pool_size=5,
    max_overflow=10,
    ...
)
# 开发环境
engine = create_async_engine(
    settings.database_url,
    poolclass=NullPool,  # 无连接池
)
```

**问题**:
- 开发环境使用 `NullPool`，每次请求都创建/关闭连接，性能差
- 生产环境 `pool_size=5` 对于桌面应用可能过多
- 缺少 `pool_pre_ping` 在生产环境外的配置

**建议配置**:

```python
# database.py (建议)
from sqlalchemy.pool import NullPool, QueuePool

# 桌面应用：单用户，连接池不需要太大
# 使用固定大小连接池，避免 NullPool 的开销

POOL_SIZE = 3          # 基础连接数
MAX_OVERFLOW = 2       # 额外连接数（总最大 5）
POOL_RECYCLE = 3600    # 1 小时回收
POOL_TIMEOUT = 10      # 等待连接超时（秒）

engine = create_async_engine(
    settings.database_url,
    echo=False,
    future=True,
    pool_pre_ping=True,      # 验证连接有效性
    pool_recycle=POOL_RECYCLE,
    pool_timeout=POOL_TIMEOUT,
    pool_size=POOL_SIZE,
    max_overflow=MAX_OVERFLOW,
    # 不使用 NullPool，即使是开发环境
)
```

#### 3.1.3 索引优化

**已有索引** (`alembic/versions/20260421_1600_add_performance_indexes.py`):
- `idx_chapters_chapter_order`
- `idx_chapters_status`
- `idx_if_lines_linked_character_id`
- `idx_characters_tier`
- `idx_items_owner`
- `idx_locations_importance`
- `idx_factions_type`
- `idx_rules_type`
- `idx_plot_threads_status`
- `idx_chat_messages_created_at`

**建议补充索引**:

```sql
-- 复合索引：按状态过滤后按顺序排序（常见查询模式）
CREATE INDEX idx_chapters_status_order ON chapters(status, chapter_order);

-- 全文搜索索引（用于正文内容搜索）
-- SQLite FTS5 扩展
CREATE VIRTUAL TABLE chapters_fts USING fts5(
    title, summary,
    content='chapters',
    content_rowid='id'
);

-- 聊天消息按会话+时间索引
CREATE INDEX idx_chat_messages_session_created ON chat_messages(session_id, created_at);

-- 草稿版本按章节+版本号索引
CREATE INDEX idx_draft_versions_chapter_version ON draft_versions(chapter_id, version_number);

-- AI 审查结果按章节索引
CREATE INDEX idx_ai_inspections_chapter ON ai_inspection_results(chapter_id, created_at);
```

---

### 3.2 大文本存储优化

#### 3.2.1 章节内容分块存储

**当前问题**: `DraftVersion.content` 使用 `Column(Text)`，大章节（数万字）作为单行存储：
- 查询时加载完整内容到内存
- 更新时重写整行
- 历史版本累积导致数据库膨胀

**优化方案 - 内容分块**:

```python
# models/entities.py (建议)
class ChapterContent(Base):
    """章节内容分块存储，支持大文本高效读写."""
    __tablename__ = "chapter_contents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)  # 块序号
    chunk_size = Column(Integer, nullable=False)   # 块字节大小
    content = Column(Text, nullable=False)         # 块内容（建议每块 4KB-8KB）
    checksum = Column(String(64))                  # SHA-256 校验和

    __table_args__ = (
        Index('idx_chapter_content_chapter_chunk', 'chapter_id', 'chunk_index'),
    )


class DraftVersion(Base):
    """简化：DraftVersion 只存元数据，内容引用 chapter_contents."""
    __tablename__ = "draft_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False)
    content_snapshot_id = Column(Integer, ForeignKey("content_snapshots.id"))
    word_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class ContentSnapshot(Base):
    """内容快照：引用一组 chapter_contents 块."""
    __tablename__ = "content_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    total_size = Column(Integer, nullable=False)
    chunk_count = Column(Integer, nullable=False)
    checksum = Column(String(64), nullable=False)  # 整体校验和
    created_at = Column(DateTime, default=datetime.utcnow)
```

**简化方案**（推荐先实施）:

使用 SQLite 外部内容存储（BLOB 存储到单独文件）：

```python
# services/content_storage.py
import hashlib
from pathlib import Path

CONTENT_DIR = Path("data/contents")


class ContentStorage:
    """大文本外部存储，数据库只存引用."""

    def __init__(self, base_dir: Path = CONTENT_DIR):
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _get_path(self, chapter_id: int, version: int) -> Path:
        """按章节 ID 分目录存储，避免单目录文件过多."""
        subdir = self.base_dir / f"{(chapter_id // 1000):04d}"
        subdir.mkdir(exist_ok=True)
        return subdir / f"{chapter_id}_v{version}.txt"

    def save(self, chapter_id: int, version: int, content: str) -> dict:
        path = self._get_path(chapter_id, version)
        path.write_text(content, encoding='utf-8')
        return {
            "path": str(path.relative_to(self.base_dir)),
            "size": len(content.encode('utf-8')),
            "checksum": hashlib.sha256(content.encode()).hexdigest()[:16],
        }

    def load(self, chapter_id: int, version: int) -> str:
        path = self._get_path(chapter_id, version)
        if not path.exists():
            raise FileNotFoundError(f"Content not found: {path}")
        return path.read_text(encoding='utf-8')

    def delete(self, chapter_id: int, version: int) -> None:
        path = self._get_path(chapter_id, version)
        if path.exists():
            path.unlink()
```

#### 3.2.2 文本压缩存储

```python
# utils/compression.py
import zlib
import lz4.frame  # 更快的压缩算法


def compress_text(text: str, algorithm: str = "lz4") -> bytes:
    data = text.encode('utf-8')
    if algorithm == "lz4":
        return lz4.frame.compress(data)
    return zlib.compress(data, level=6)


def decompress_text(compressed: bytes, algorithm: str = "lz4") -> str:
    if algorithm == "lz4":
        return lz4.frame.decompress(compressed).decode('utf-8')
    return zlib.decompress(compressed).decode('utf-8')
```

---

### 3.3 缓存策略优化

#### 3.3.1 热点数据识别与分级缓存

**当前状态**: 已有 LRU in-memory + diskcache hybrid（根据 CLAUDE.md）。

**优化方案**:

```python
# cache/tiered_cache.py
from functools import wraps
import time
from typing import Optional, Callable
import diskcache


class TieredCache:
    """三级缓存：L1(内存) -> L2(本地磁盘) -> L3(数据库).

    热点数据策略：
    - 文笔风格列表：L1，极少变化
    - 角色/物品列表：L2，频繁读取
    - 章节内容：L2 + 按需加载
    - 聊天消息：L1（最近会话），TTL 5分钟
    - AI 生成结果：L2，TTL 1小时
    """

    def __init__(self, cache_dir: str = "data/cache"):
        self.l1 = {}  # 内存缓存
        self.l1_ttl = {}  # L1 TTL 记录
        self.l2 = diskcache.Cache(cache_dir)

        # 热点统计
        self.access_stats = {}

    def get(self, key: str, default=None):
        # L1 检查
        if key in self.l1:
            if time.time() < self.l1_ttl.get(key, 0):
                self._record_access(key)
                return self.l1[key]
            else:
                del self.l1[key]

        # L2 检查
        if key in self.l2:
            value = self.l2[key]
            # 热点数据提升回 L1
            if self._is_hot(key):
                self.l1[key] = value
            self._record_access(key)
            return value

        return default

    def set(self, key: str, value, l1_ttl: int = 0, l2_ttl: int = 3600):
        if l1_ttl > 0:
            self.l1[key] = value
            self.l1_ttl[key] = time.time() + l1_ttl
        self.l2.set(key, value, expire=l2_ttl)

    def _is_hot(self, key: str, threshold: int = 3) -> bool:
        return self.access_stats.get(key, 0) >= threshold

    def _record_access(self, key: str):
        self.access_stats[key] = self.access_stats.get(key, 0) + 1
```

#### 3.3.2 缓存装饰器

```python
# cache/decorators.py
from functools import wraps
from .tiered_cache import TieredCache

cache = TieredCache()


def cached(key_template: str, l1_ttl: int = 0, l2_ttl: int = 3600):
    """缓存装饰器，支持动态 key."""
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            cache_key = key_template.format(*args, **kwargs)
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            result = await func(*args, **kwargs)
            cache.set(cache_key, result, l1_ttl, l2_ttl)
            return result

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            cache_key = key_template.format(*args, **kwargs)
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            result = func(*args, **kwargs)
            cache.set(cache_key, result, l1_ttl, l2_ttl)
            return result

        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    return decorator


# 使用示例
@cached("styles:list", l1_ttl=3600, l2_ttl=86400)
async def get_writing_styles():
    ...

@cached("character:{character_id}", l1_ttl=300, l2_ttl=1800)
async def get_character(character_id: int):
    ...
```

---

### 3.4 AI 流式响应优化

#### 3.4.1 SSE 流式输出优化

```python
# services/ai_streaming.py
from fastapi import Request
from fastapi.responses import StreamingResponse
import asyncio


async def optimized_stream_response(
    generator,
    request: Request,
    chunk_size: int = 256,  # 每次发送的字符数
    flush_interval: float = 0.05,  # 最小刷新间隔（秒）
):
    """优化的 SSE 流式响应.

    - 批量发送减少 I/O
    - 支持客户端断开检测
    - 自适应刷新频率
    """
    buffer = []
    last_flush = asyncio.get_event_loop().time()

    async def event_stream():
        nonlocal last_flush
        try:
            async for chunk in generator:
                buffer.append(chunk)

                now = asyncio.get_event_loop().time()
                total_len = sum(len(c) for c in buffer)

                # 触发条件：缓冲区满 或 时间到
                if total_len >= chunk_size or (now - last_flush) >= flush_interval:
                    data = "".join(buffer)
                    buffer.clear()
                    last_flush = now
                    yield f"data: {json.dumps({'content': data})}\n\n"

                # 检查客户端是否断开
                if await request.is_disconnected():
                    break

            # 发送剩余内容
            if buffer:
                data = "".join(buffer)
                yield f"data: {json.dumps({'content': data})}\n\n"

            yield "data: [DONE]\n\n"

        except asyncio.CancelledError:
            # 客户端断开，优雅处理
            pass

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 Nginx 缓冲（如使用）
        },
    )
```

#### 3.4.2 连接池与超时优化

```python
# config.py (建议添加)
class Settings(BaseSettings):
    # ... 现有配置 ...

    # AI 流式响应优化
    ai_stream_chunk_size: int = 256
    ai_stream_flush_interval_ms: int = 50
    ai_request_timeout: int = 120  # AI API 请求超时（秒）
    ai_connect_timeout: int = 10   # AI API 连接超时（秒）
    ai_max_retries: int = 3        # 失败重试次数
    ai_retry_backoff: float = 1.5  # 退避系数

    # HTTP 客户端连接池
    http_pool_size: int = 10
    http_pool_max_size: int = 20
```

---

### 3.5 启动时间优化

#### 3.5.1 懒加载策略

```python
# main.py (建议)
from fastapi import FastAPI

# 延迟导入重型模块
_ai_service = None
_embedding_service = None


def get_ai_service():
    global _ai_service
    if _ai_service is None:
        from services.ai import AIService
        _ai_service = AIService()
    return _ai_service


def get_embedding_service():
    global _embedding_service
    if _embedding_service is None:
        from services.embeddings import EmbeddingService
        _embedding_service = EmbeddingService()
    return _embedding_service
```

#### 3.5.2 数据库连接延迟初始化

```python
# database.py (建议)
_engine = None
_session_maker = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings.database_url,
            echo=False,
            future=True,
            pool_pre_ping=True,
            pool_recycle=3600,
            pool_timeout=10,
            pool_size=3,
            max_overflow=2,
        )
    return _engine


def get_session_maker():
    global _session_maker
    if _session_maker is None:
        _session_maker = async_sessionmaker(
            get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_maker
```

#### 3.5.3 启动预加载关键数据

```python
# services/warmup.py
import asyncio
from database import async_session_maker


async def warmup_cache():
    """启动时预加载热点数据到缓存."""
    async with async_session_maker() as session:
        # 预加载文笔风格（几乎不变）
        from services.styles import get_writing_styles
        styles = await get_writing_styles(session)
        cache.set("styles:list", styles, l1_ttl=3600)

        # 预加载最近使用的角色列表
        from services.characters import get_recent_characters
        characters = await get_recent_characters(session, limit=50)
        cache.set("characters:recent", characters, l1_ttl=300)

        logger.info(f"Warmup complete: {len(styles)} styles, {len(characters)} characters")
```

---

### 3.6 内存使用优化

#### 3.6.1 流式导出

当前 `export_project()` 一次性加载所有数据到内存，对于大型项目可能占用数百 MB。

```python
# services/export_import.py (建议)
async def export_project_streaming(
    incremental: bool = False,
    since: Optional[datetime] = None,
) -> AsyncIterator[dict]:
    """流式导出，逐实体类型产出，降低内存峰值."""
    yield {"type": "metadata", "version": "1.0", "exported_at": datetime.utcnow().isoformat()}

    async with async_session_maker() as session:
        # 逐表导出，每批限制数量
        batch_size = 100

        for offset in range(0, await _count_characters(session), batch_size):
            characters = await _get_characters_batch(session, offset, batch_size)
            for char in characters:
                yield {"type": "character", "data": char}

        # 其他实体类似...
```

#### 3.6.2 分页查询优化

```python
# utils/pagination.py
from sqlalchemy import select, func
from pydantic import BaseModel


class PaginationParams(BaseModel):
    page: int = 1
    page_size: int = 20
    max_page_size: int = 100


class PaginatedResult(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int


async def paginate(session, query, params: PaginationParams) -> PaginatedResult:
    """通用分页查询，自动限制最大页大小."""
    page_size = min(params.page_size, params.max_page_size)
    offset = (params.page - 1) * page_size

    # 使用子查询优化 COUNT
    count_query = select(func.count()).select_from(query.subquery())
    total = await session.scalar(count_query)

    result = await session.execute(query.offset(offset).limit(page_size))
    items = result.scalars().all()

    return PaginatedResult(
        items=items,
        total=total,
        page=params.page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )
```

#### 3.6.3 大结果集游标查询

```python
# 对于超大结果集，使用服务器端游标
async def stream_large_query(session, query, batch_size: int = 1000):
    """使用服务器端游标流式处理大结果集."""
    result = await session.execute(
        query.execution_options(stream_results=True, max_row_buffer=batch_size)
    )
    while True:
        rows = result.fetchmany(batch_size)
        if not rows:
            break
        for row in rows:
            yield row
```

---

## 4. 实施优先级

### P0 - 关键（影响安全或稳定性，必须立即实施）

| # | 任务 | 预估工时 | 依赖 |
|---|------|----------|------|
| P0-1 | 使用系统密钥环存储 API Key | 4h | `keyring` 库 |
| P0-2 | 使用系统密钥环存储 MiniMax API Key | 2h | P0-1 |
| P0-3 | 启用 SQLite WAL 模式 | 2h | 无 |
| P0-4 | ZIP 导入 Zip Slip 防护 | 3h | 无 |
| P0-5 | WebSocket Origin 验证 | 2h | 无 |

### P1 - 高优先级（显著提升性能或安全）

| # | 任务 | 预估工时 | 依赖 |
|---|------|----------|------|
| P1-1 | SQLite 应用层字段加密（小说正文） | 8h | P0-1 |
| P1-2 | 大文本外部存储（content_storage.py） | 6h | 无 |
| P1-3 | 连接池调优（移除 NullPool） | 2h | 无 |
| P1-4 | 分级缓存实现（tiered_cache.py） | 6h | 无 |
| P1-5 | AI 流式响应批量发送优化 | 4h | 无 |
| P1-6 | 导出 ZIP 密码加密 | 3h | 无 |
| P1-7 | WebSocket 认证改为 subprotocol | 3h | 无 |

### P2 - 中优先级（进一步优化体验）

| # | 任务 | 预估工时 | 依赖 |
|---|------|----------|------|
| P2-1 | 复合索引和 FTS5 全文搜索 | 6h | 无 |
| P2-2 | 启动懒加载优化 | 4h | 无 |
| P2-3 | 流式导出实现 | 4h | P1-2 |
| P2-4 | WAL 定期 checkpoint 任务 | 2h | P0-3 |
| P2-5 | 文本压缩存储 | 4h | P1-2 |
| P2-6 | 导入数据深度/大小限制 | 3h | 无 |
| P2-7 | CORS 方法/头部限定 | 2h | 无 |

### P3 - 低优先级（锦上添花）

| # | 任务 | 预估工时 | 依赖 |
|---|------|----------|------|
| P3-1 | 内存缓存 TTL 机制 | 2h | P1-4 |
| P3-2 | 导出文件完整性签名 | 3h | 无 |
| P3-3 | XSS 输出编码中间件 | 3h | 无 |
| P3-4 | 启动预加载热点数据 | 2h | P1-4 |
| P3-5 | 数据完整性校验（HMAC） | 4h | P1-1 |

---

## 5. 附录：代码审计详情

### 5.1 审计文件清单

| 文件 | 审计重点 | 发现 |
|------|----------|------|
| `middleware/auth.py` | API Key 生成、验证、缓存 | 使用 `secrets.compare_digest`（正确）；缺少密钥持久化安全存储 |
| `middleware/rate_limit.py` | 限流算法、并发安全 | 使用 `threading.Lock`（正确）；缺少按用户限流；cleanup 可能遗漏 |
| `config.py` | 密钥管理、敏感配置 | `.env` 明文存储密钥；无加密配置 |
| `database.py` | 连接池、事务、会话 | 开发环境使用 NullPool；未启用 WAL；无 PRAGMA 优化 |
| `main.py` | CORS、WebSocket、生命周期 | CORS 过于宽松；WebSocket auth 通过 query param；缺少 Origin 验证 |
| `middleware/logging.py` | 日志安全、敏感信息 | 日志可能包含 query_params（可能泄露敏感数据） |
| `services/export_import.py` | 反序列化、文件操作 | 使用 `yaml.safe_load`（正确）；ZIP 无路径遍历防护；无大小限制 |
| `models/entities.py` | 字段类型、索引 | 大文本使用 Text（合理）；缺少复合索引；无内容分块 |
| `middleware/performance.py` | 性能监控 | 实现良好；query_count 需要 SQLAlchemy 事件集成 |
| `middleware/request_context.py` | 上下文传播 | 使用 `contextvars`（正确）；实现规范 |

### 5.2 关键代码位置速查

```
认证:          src/backend/middleware/auth.py:87-118
限流:          src/backend/middleware/rate_limit.py:39-69
配置:          src/backend/config.py:9-59
数据库:        src/backend/database.py:14-65
CORS:          src/backend/main.py:403-409
WebSocket:     src/backend/main.py:449-571
导出导入:      src/backend/services/export_import.py:696-707
性能监控:      src/backend/middleware/performance.py:21-81
```

### 5.3 依赖建议

```toml
# pyproject.toml (新增依赖)
[tool.poetry.dependencies]
# 安全
keyring = "^25.0"          # 系统密钥环
pyzipper = "^0.3"          # AES 加密 ZIP
cryptography = "^42.0"     # 字段加密

# 性能
lz4 = "^4.3"               # 文本压缩
aiosqlite = "^0.20"        # 已存在，确认版本支持 WAL

# 可选（SQLCipher 方案）
# pysqlcipher3 = "^1.2"    # SQLCipher 加密 SQLite
```

---

*文档结束*
