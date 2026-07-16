"""AI provider service: CRUD, API-key protection, and connection testing."""
from anthropic import Anthropic

from app.config import get_settings
from app.core.security import encrypt_api_key
from app.models import AIProvider
from app.repositories.ai_provider import AIProviderRepository
from app.schemas.ai import AIProviderCreate, AIProviderUpdate
from app.schemas.ai_provider_test import AIProviderTestRequest, AIProviderTestResponse


class AIProviderService:
    def __init__(self, repo: AIProviderRepository):
        self._repo = repo

    def get(self, id: int) -> AIProvider | None:
        return self._repo.get(id)

    def list(self, skip: int = 0, limit: int = 100) -> list[AIProvider]:
        return self._repo.list(skip=skip, limit=limit)

    def create(self, data: AIProviderCreate) -> AIProvider:
        values = data.model_dump(exclude_unset=True)
        api_key = values.pop("api_key", None)
        provider = AIProvider(**values)
        if api_key:
            provider.api_key_encrypted = encrypt_api_key(api_key)
        return self._repo.create(provider)

    def update(self, id: int, data: AIProviderUpdate) -> AIProvider | None:
        provider = self._repo.get(id)
        if not provider:
            return None
        changes = data.model_dump(exclude_unset=True)
        api_key = changes.pop("api_key", None)
        if api_key:
            provider.api_key_encrypted = encrypt_api_key(api_key)
        return self._repo.update(provider, changes)

    def delete(self, id: int) -> bool:
        return self._repo.delete(id)

    def test_connection(self, data: AIProviderTestRequest) -> AIProviderTestResponse:
        settings = get_settings()
        client = Anthropic(
            api_key=data.api_key,
            base_url=data.base_url or settings.anthropic_base_url,
        )
        try:
            client.messages.create(
                model=data.model_name or settings.anthropic_model,
                max_tokens=10,
                messages=[{"role": "user", "content": "ping"}],
            )
            return AIProviderTestResponse(
                success=True,
                message="Connection successful",
            )
        except Exception as exc:
            return AIProviderTestResponse(
                success=False,
                message="Connection failed",
                error_detail=str(exc),
            )
