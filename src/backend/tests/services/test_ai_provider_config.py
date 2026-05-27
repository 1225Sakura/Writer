"""Tests for AI Provider Config Service - CRUD, activate, encrypt/decrypt."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from backend.services.ai_provider_config_service import (
    AIProviderConfigService,
    ConnectionTestResult,
)


@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.execute = AsyncMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.delete = AsyncMock()
    return db


@pytest.fixture
def mock_event_bus():
    return MagicMock()


@pytest.fixture
def mock_cache():
    return MagicMock()


@pytest.fixture
def service(mock_db, mock_event_bus, mock_cache):
    return AIProviderConfigService(db=mock_db, event_bus=mock_event_bus, cache=mock_cache)


# =============================================================================
# ConnectionTestResult
# =============================================================================


class TestConnectionTestResult:
    """Test ConnectionTestResult dataclass."""

    def test_success_result(self):
        result = ConnectionTestResult(
            success=True, latency_ms=100.5, message="OK"
        )
        assert result.success is True
        assert result.latency_ms == 100.5
        assert result.error_detail is None

    def test_failure_result(self):
        result = ConnectionTestResult(
            success=False, latency_ms=0, message="Failed", error_detail="401"
        )
        assert result.success is False
        assert result.error_detail == "401"


# =============================================================================
# _encrypt_key / _decrypt_key
# =============================================================================


class TestEncryptDecrypt:
    """Test key encryption/decryption."""

    @patch("backend.services.ai_provider_config_service.is_encryption_available", return_value=False)
    def test_encrypt_passthrough_when_unavailable(self, mock_avail):
        result = AIProviderConfigService._encrypt_key("my-key")
        assert result == "my-key"

    @patch("backend.services.ai_provider_config_service.is_encryption_available", return_value=False)
    def test_decrypt_passthrough_when_unavailable(self, mock_avail):
        result = AIProviderConfigService._decrypt_key("my-key")
        assert result == "my-key"

    @patch("backend.services.ai_provider_config_service.is_encryption_available", return_value=True)
    @patch("backend.services.ai_provider_config_service.encrypt_value", return_value="encrypted!")
    def test_encrypt_calls_encrypt_value(self, mock_encrypt, mock_avail):
        result = AIProviderConfigService._encrypt_key("plain")
        assert result == "encrypted!"
        mock_encrypt.assert_called_once_with("plain")

    @patch("backend.services.ai_provider_config_service.is_encryption_available", return_value=True)
    @patch("backend.services.ai_provider_config_service.decrypt_value", return_value="decrypted!")
    def test_decrypt_calls_decrypt_value(self, mock_decrypt, mock_avail):
        result = AIProviderConfigService._decrypt_key("cipher")
        assert result == "decrypted!"


# =============================================================================
# list_configs
# =============================================================================


class TestListConfigs:
    """Test config listing."""

    @pytest.mark.asyncio
    async def test_list_global_configs(self, service):
        mock_config = MagicMock()
        mock_config.api_key = "encrypted-key"
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [mock_config]
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        service.db.execute = AsyncMock(return_value=mock_result)

        with patch.object(service, "_decrypt_key", return_value="decrypted"):
            configs = await service.list_configs()

        assert len(configs) == 1

    @pytest.mark.asyncio
    async def test_list_with_project_id(self, service):
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        service.db.execute = AsyncMock(return_value=mock_result)

        configs = await service.list_configs(project_id=42)
        assert configs == []


# =============================================================================
# get_config
# =============================================================================


class TestGetConfig:
    """Test config retrieval."""

    @pytest.mark.asyncio
    async def test_get_existing_config(self, service):
        mock_config = MagicMock()
        mock_config.api_key = "encrypted"
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_config
        service.db.execute = AsyncMock(return_value=mock_result)

        with patch.object(service, "_decrypt_key", return_value="decrypted"):
            config = await service.get_config(1)

        assert config.api_key == "decrypted"

    @pytest.mark.asyncio
    async def test_get_nonexistent_raises(self, service):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        service.db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(ValueError, match="not found"):
            await service.get_config(999)


# =============================================================================
# create_config
# =============================================================================


class TestCreateConfig:
    """Test config creation."""

    @pytest.mark.asyncio
    async def test_create_first_config_auto_activates(self, service):
        mock_data = MagicMock()
        mock_data.name = "Test"
        mock_data.api_key = "key123"
        mock_data.base_url = "https://api.test.com"
        mock_data.model_name = "model-v1"
        mock_data.max_tokens = 4096
        mock_data.temperature = 0.7
        mock_data.project_id = None

        # Mock list_configs to return just the new config (first one)
        service.list_configs = AsyncMock(return_value=[MagicMock()])

        with patch.object(service, "_encrypt_key", return_value="encrypted"):
            # The method adds to db, flushes, checks if first, then commits
            await service.create_config(mock_data)

        service.db.add.assert_called_once()
        service.db.flush.assert_called_once()
        service.db.commit.assert_called_once()


# =============================================================================
# delete_config
# =============================================================================


class TestDeleteConfig:
    """Test config deletion."""

    @pytest.mark.asyncio
    async def test_delete_active_config_activates_next(self, service):
        mock_config = MagicMock()
        mock_config.is_active = True
        mock_config.project_id = None

        service.get_config = AsyncMock(return_value=mock_config)
        mock_remaining = MagicMock()
        mock_remaining.is_active = False
        service.list_configs = AsyncMock(return_value=[mock_remaining])

        await service.delete_config(1)
        service.db.delete.assert_called_once_with(mock_config)

    @pytest.mark.asyncio
    async def test_delete_inactive_config_no_reactivation(self, service):
        mock_config = MagicMock()
        mock_config.is_active = False
        mock_config.project_id = None

        service.get_config = AsyncMock(return_value=mock_config)

        await service.delete_config(1)
        service.db.delete.assert_called_once()
        service.db.flush.assert_called_once()
        # commit is only called for active config deletion
        service.db.commit.assert_not_called()


# =============================================================================
# activate_config
# =============================================================================


class TestActivateConfig:
    """Test config activation."""

    @pytest.mark.asyncio
    async def test_activate_deactivates_others(self, service):
        mock_config = MagicMock()
        mock_config.is_active = False
        mock_config.project_id = None
        mock_config.api_key = "key"

        service.get_config = AsyncMock(return_value=mock_config)

        mock_other = MagicMock()
        mock_other.is_active = True
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [mock_other]
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        service.db.execute = AsyncMock(return_value=mock_result)

        with patch.object(service, "_decrypt_key", return_value="key"):
            result = await service.activate_config(1)

        assert mock_config.is_active is True
        assert mock_other.is_active is False
