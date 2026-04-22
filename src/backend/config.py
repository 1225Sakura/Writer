# Auto Novel Writer - Configuration
# Python 3.11+

import logging
import os
from pydantic_settings import BaseSettings
from pathlib import Path


def _get_database_url() -> str:
    """Get database URL, handling both dev and packaged paths."""
    # Check backend/data/ first (for dev and packaged fallback)
    db_path = Path(__file__).parent / 'data' / 'writer.db'
    if not db_path.exists():
        # In packaged app, launcher creates DB at resources/data/writer.db
        alt_path = Path(__file__).parent.parent / 'data' / 'writer.db'
        if alt_path.exists():
            db_path = alt_path
    return f"sqlite+aiosqlite:///{db_path.resolve()}"


def _get_cache_dir() -> Path:
    """Get cache directory, handling both dev and packaged paths."""
    cache_path = Path(__file__).parent / 'data' / 'cache'
    if not cache_path.exists():
        # Try resources/data path for packaged app
        alt_path = Path(__file__).parent.parent / 'data' / 'cache'
        if alt_path.exists() or Path(__file__).parent.parent.exists():
            cache_path = alt_path
    cache_path.mkdir(parents=True, exist_ok=True)
    return cache_path.resolve()


def _get_log_dir() -> Path:
    """Get log directory, handling both dev and packaged paths."""
    log_path = Path(__file__).parent / 'logs'
    if not log_path.exists():
        # Try resources path for packaged app
        alt_path = Path(__file__).parent.parent / 'logs'
        if alt_path.exists() or Path(__file__).parent.parent.exists():
            log_path = alt_path
    log_path.mkdir(parents=True, exist_ok=True)
    return log_path.resolve()


class Settings(BaseSettings):
    """Application settings."""

    # Database
    database_url: str = _get_database_url()

    # API Keys — read from .env first (pydantic-settings), then override with
    # keyring if available so the system keyring always takes precedence.
    minimax_api_key: str | None = None
    minimax_api_url: str = "https://api.minimax.chat/v1"

    # Local Auth
    api_key: str | None = None
    auth_skip_localhost: bool = True

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # App
    app_name: str = "Writer API"
    app_version: str = "1.0.0"

    # Cache
    cache_dir: Path = _get_cache_dir()
    cache_default_ttl: int = 300  # 5 minutes
    cache_styles_ttl: int = 3600  # 1 hour (static data)

    # AI Settings
    ai_temperature: float = 0.7  # Default sampling temperature
    ai_timeout: int = 30  # API request timeout in seconds

    # Review Settings
    review_score_threshold: int = 20
    review_issue_count_threshold: int = 3

    # Agent Settings
    agent_max_retries: int = 3
    agent_retry_delay: float = 1.0

    # Rate Limiting
    rate_limit_storage: str = "memory"  # "memory" or "redis"
    redis_url: str | None = None
    rate_limit_default: int = 60  # requests per window
    rate_limit_window: float = 60.0  # window in seconds
    rate_limit_checker: int = 10  # stricter limit for AI checker endpoints
    rate_limit_checker_window: float = 60.0

    # Logging
    log_level: str = "INFO"
    log_json_format: bool = False
    log_dir: Path = _get_log_dir()
    log_max_bytes: int = 10 * 1024 * 1024  # 10MB per file
    log_backup_count: int = 7  # Number of backup files
    log_slow_request_threshold_ms: int = 1000  # Log requests > 1s as slow
    log_sql_level: str = "DEBUG"  # SQL query log level
    log_module_levels: dict = {
        "writer-api.middleware": "INFO",
        "writer-api.api": "INFO",
        "writer-api.db": "DEBUG",
        "sqlalchemy": "WARNING",
        "uvicorn": "INFO",
        "uvicorn.access": "WARNING",
    }

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Instantiate settings from .env / environment first
settings = Settings()

# ---------------------------------------------------------------------------
# Keyring override — system keyring always wins over .env for secrets
# ---------------------------------------------------------------------------
try:
    from utils.keyring_storage import get_api_key_with_fallback
except ImportError:  # pragma: no cover
    get_api_key_with_fallback = None  # type: ignore[assignment]

if get_api_key_with_fallback is not None:
    # Override with keyring values if they exist; otherwise keep the .env value.
    _minimax = get_api_key_with_fallback("minimax_api_key", settings.minimax_api_key)
    if _minimax is not None:
        settings.minimax_api_key = _minimax

    _api_key = get_api_key_with_fallback("api_key", settings.api_key)
    if _api_key is not None:
        settings.api_key = _api_key
