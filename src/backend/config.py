# Auto Novel Writer - Configuration
# Python 3.11+

import logging
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """Application settings."""

    # Database
    database_url: str = f"sqlite+aiosqlite:///{(Path(__file__).parent.parent.parent / 'data' / 'writer.db').resolve()}"

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
    cache_dir: Path = (
        Path(__file__).parent.parent.parent / "data" / "cache"
    ).resolve()
    cache_default_ttl: int = 300  # 5 minutes
    cache_styles_ttl: int = 3600  # 1 hour (static data)

    # Logging
    log_level: str = "INFO"
    log_json_format: bool = False
    log_dir: Path = (Path(__file__).parent.parent.parent / "logs").resolve()
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
