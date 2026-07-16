"""AI provider connection-test schemas."""
from app.schemas.base import BaseSchema


class AIProviderTestRequest(BaseSchema):
    api_key: str
    base_url: str = "https://api.minimaxi.com/anthropic"
    model_name: str = "MiniMax-M3"


class AIProviderTestResponse(BaseSchema):
    success: bool
    latency_ms: int = 0
    message: str
    error_detail: str | None = None
