"""AI provider repository and service tests."""
from unittest.mock import MagicMock, patch

from app.core.security import decrypt_api_key
from app.schemas.ai import AIProviderCreate


def test_create_provider(db_session):
    from app.repositories.ai_provider import AIProviderRepository
    from app.services.ai_provider import AIProviderService

    service = AIProviderService(AIProviderRepository(db_session))
    provider = service.create(
        AIProviderCreate(
            name="MiniMax",
            api_key="sk-test-secret",
            base_url="https://api.minimaxi.com/anthropic",
            model_name="MiniMax-M3",
        )
    )

    assert provider.api_key_encrypted != "sk-test-secret"
    # v0.5 Phase 1 Track A: decrypt_api_key returns SecretStr; use .get()
    assert decrypt_api_key(provider.api_key_encrypted).get() == "sk-test-secret"


def test_list_providers(db_session):
    from app.repositories.ai_provider import AIProviderRepository
    from app.services.ai_provider import AIProviderService

    service = AIProviderService(AIProviderRepository(db_session))
    service.create(AIProviderCreate(name="Primary", model_name="MiniMax-M3"))
    service.create(AIProviderCreate(name="Backup", model_name="MiniMax-M3"))

    providers = service.list()

    assert [provider.name for provider in providers] == ["Primary", "Backup"]


def test_test_connection(db_session):
    from app.repositories.ai_provider import AIProviderRepository
    from app.schemas.ai_provider_test import AIProviderTestRequest
    from app.services.ai_provider import AIProviderService

    service = AIProviderService(AIProviderRepository(db_session))
    request = AIProviderTestRequest(
        api_key="sk-test-secret",
        base_url="https://api.minimaxi.com/anthropic",
        model_name="MiniMax-M3",
    )
    mock_client = MagicMock()

    with patch("app.services.ai_provider.Anthropic") as mock_anthropic:
        mock_anthropic.return_value = mock_client
        result = service.test_connection(request)

    assert result.success is True
    mock_anthropic.assert_called_once_with(
        api_key="sk-test-secret",
        base_url="https://api.minimaxi.com/anthropic",
    )
    mock_client.messages.create.assert_called_once_with(
        model="MiniMax-M3",
        max_tokens=10,
        messages=[{"role": "user", "content": "ping"}],
    )
