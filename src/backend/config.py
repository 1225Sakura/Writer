# Auto Novel Writer - Configuration
# Python 3.11+

from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """Application settings."""

    # Database
    database_url: str = f"sqlite+aiosqlite:///{(Path(__file__).parent.parent.parent / 'data' / 'writer.db').resolve()}"

    # API Keys
    minimax_api_key: str | None = None
    minimax_api_url: str = "https://api.minimax.chat/v1"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # App
    app_name: str = "Writer API"
    app_version: str = "1.0.0"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
