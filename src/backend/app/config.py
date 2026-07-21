"""Auto Novel Writer — Backend Configuration (Pydantic Settings v2)

Decision Matrix (2026-07-14):
- Pydantic Settings vs dynaconf vs python-dotenv: Pydantic Settings wins (FastAPI native, type-safe, v2 mature)
- sync vs async: sync SQLAlchemy 2.0 (SQLite local desktop, no async pool complexity needed)
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str = "Writer Backend"
    app_version: str = "1.0.0"
    debug: bool = False

    # Server (Electron main.ts expects 127.0.0.1:8000)
    host: str = "127.0.0.1"
    port: int = 8000

    # Database (SQLite single-file, WAL mode)
    database_url: str = "sqlite:///./data/writer.db"

    # Data directory (Electron sets WRITER_DATA_DIR)
    data_dir: Path = Path("./data")

    # AI defaults
    default_ai_provider_id: int | None = None
    max_context_tokens: int = 8000
    max_output_tokens: int = 4096

    # Security (API key for local desktop auth — X-API-Key header)
    # v0.4 P0-Sec1a: default key generated on first launch + stored in OS keychain
    # The literal default "writer-local-key-change-me" was REMOVED (P-A02a)
    # Key persistence: written to OS keychain via python-keyring on first init;
    # subsequent launches read from keychain. If keychain unavailable, fallback to
    # userData/.secret_file with chmod 0600 (P0-Sec1a D.2.7).
    api_key: str = ""

    # AI (Anthropic SDK with MiniMax proxy)
    anthropic_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"),
    )
    anthropic_base_url: str = "https://api.minimaxi.com/anthropic"
    anthropic_model: str = "MiniMax-M3"

    # Electron integration
    electron_mode: bool = False


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
