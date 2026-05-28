"""AI Provider Config Service — CRUD + activate + test connection."""

from __future__ import annotations

import time
from typing import Optional, List

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.domain.entities import AIProviderConfig
from backend.core.domain.schemas.request_schemas import (
    AIProviderConfigCreateRequest,
    AIProviderConfigUpdateRequest,
    AIProviderConfigTestRequest,
)
from backend.utils.event_bus import AsyncEventBus
from backend.infrastructure.cache.cache_service import CacheService
from backend.utils.exceptions import AIServiceError
from backend.infrastructure.security.encryption import (
    encrypt_value,
    decrypt_value,
    is_encryption_available,
)


class ConnectionTestResult:
    def __init__(self, success: bool, latency_ms: float, message: str, error_detail: Optional[str] = None):
        self.success = success
        self.latency_ms = latency_ms
        self.message = message
        self.error_detail = error_detail


class AIProviderConfigService:
    """Service for AI provider configuration operations."""

    def __init__(self, db: AsyncSession, event_bus: AsyncEventBus, cache: CacheService):
        self.db = db
        self.event_bus = event_bus
        self.cache = cache

    @staticmethod
    def _encrypt_key(plaintext: str) -> str:
        """Encrypt an API key if encryption is available, otherwise return as-is."""
        if is_encryption_available():
            return encrypt_value(plaintext)
        return plaintext

    @staticmethod
    def _decrypt_key(ciphertext: str) -> str:
        """Decrypt an API key if encryption is available, otherwise return as-is."""
        if is_encryption_available():
            return decrypt_value(ciphertext)
        return ciphertext

    async def list_configs(self, project_id: Optional[int] = None) -> List[AIProviderConfig]:
        """List global configs + project-level configs.  API keys are decrypted transparently."""
        stmt = select(AIProviderConfig).order_by(AIProviderConfig.is_active.desc(), AIProviderConfig.id)
        if project_id is not None:
            stmt = stmt.where(
                (AIProviderConfig.project_id == project_id) | (AIProviderConfig.project_id.is_(None))
            )
        else:
            stmt = stmt.where(AIProviderConfig.project_id.is_(None))
        result = await self.db.execute(stmt)
        configs = list(result.scalars().all())
        # Decrypt keys for callers
        for cfg in configs:
            cfg.api_key = self._decrypt_key(cfg.api_key)
        return configs

    async def get_config(self, config_id: int) -> AIProviderConfig:
        """Get a single config by ID.  API key is decrypted transparently."""
        stmt = select(AIProviderConfig).where(AIProviderConfig.id == config_id)
        result = await self.db.execute(stmt)
        config = result.scalar_one_or_none()
        if not config:
            raise ValueError(f"AI Provider Config {config_id} not found")
        config.api_key = self._decrypt_key(config.api_key)
        return config

    async def create_config(self, data: AIProviderConfigCreateRequest) -> AIProviderConfig:
        """Create a new config. If it's the first one, auto-activate."""
        config = AIProviderConfig(
            name=data.name,
            api_key=self._encrypt_key(data.api_key),
            base_url=data.base_url,
            model_name=data.model_name,
            max_tokens=data.max_tokens,
            temperature=data.temperature,
            project_id=data.project_id,
            is_active=False,
        )
        self.db.add(config)
        await self.db.flush()

        # Auto-activate if this is the first config in scope
        existing = await self.list_configs(data.project_id)
        if len(existing) == 1:
            config.is_active = True

        await self.db.commit()
        await self.db.refresh(config)
        return config

    async def update_config(self, config_id: int, data: AIProviderConfigUpdateRequest) -> AIProviderConfig:
        """Update an existing config.  Encrypts api_key if provided."""
        config = await self.get_config(config_id)
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if key == "api_key" and value is not None:
                value = self._encrypt_key(value)
            setattr(config, key, value)
        await self.db.commit()
        await self.db.refresh(config)
        # Decrypt for the caller
        config.api_key = self._decrypt_key(config.api_key)
        return config

    async def delete_config(self, config_id: int) -> None:
        """Delete a config. If it was active, activate the next one or clear."""
        config = await self.get_config(config_id)
        was_active = config.is_active
        project_id = config.project_id

        await self.db.delete(config)
        await self.db.flush()

        if was_active:
            # Try to activate the next config in the same scope
            remaining = await self.list_configs(project_id)
            if remaining:
                remaining[0].is_active = True
            await self.db.commit()

    async def activate_config(self, config_id: int) -> AIProviderConfig:
        """Set as active config (deactivate others in same scope)."""
        # get_config already decrypts
        config = await self.get_config(config_id)

        # Deactivate all configs in the same scope
        stmt = select(AIProviderConfig).where(
            AIProviderConfig.project_id == config.project_id,
            AIProviderConfig.is_active == True,
        )
        result = await self.db.execute(stmt)
        for other in result.scalars().all():
            other.is_active = False

        config.is_active = True
        await self.db.commit()
        await self.db.refresh(config)
        # Decrypt for caller
        config.api_key = self._decrypt_key(config.api_key)
        return config

    async def test_connection(self, config_id: int) -> ConnectionTestResult:
        """Test a saved config's connection.  API key is decrypted via get_config."""
        config = await self.get_config(config_id)
        return await self._do_test(config.api_key, config.base_url, config.model_name)

    async def test_connection_with_params(self, params: AIProviderConfigTestRequest) -> ConnectionTestResult:
        """Test connection with unsaved params."""
        return await self._do_test(params.api_key, params.base_url, params.model_name)

    async def _do_test(self, api_key: str, base_url: str, model_name: str) -> ConnectionTestResult:
        """Core test logic — send minimal request and measure latency."""
        base_url = base_url.rstrip("/")

        # Select endpoint path based on provider
        if "minimax" in base_url.lower():
            url = f"{base_url}/text/chatcompletion_v2"
        else:
            url = f"{base_url}/chat/completions"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model_name,
            "messages": [{"role": "user", "content": "ok"}],
            "max_tokens": 1,
            "stream": False,
        }

        start = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                latency_ms = (time.monotonic() - start) * 1000

                if response.status_code == 200:
                    return ConnectionTestResult(
                        success=True,
                        latency_ms=round(latency_ms, 1),
                        message=f"连接成功 (延迟 {latency_ms:.0f}ms)",
                    )
                elif response.status_code == 401:
                    return ConnectionTestResult(
                        success=False,
                        latency_ms=round(latency_ms, 1),
                        message="API Key 无效，请检查后重试",
                        error_detail=f"HTTP {response.status_code}",
                    )
                else:
                    return ConnectionTestResult(
                        success=False,
                        latency_ms=round(latency_ms, 1),
                        message=f"服务器返回错误 (HTTP {response.status_code})",
                        error_detail=response.text[:200],
                    )
        except httpx.ConnectError:
            latency_ms = (time.monotonic() - start) * 1000
            return ConnectionTestResult(
                success=False,
                latency_ms=round(latency_ms, 1),
                message="无法连接到服务器，请检查 Base URL",
                error_detail="ConnectError",
            )
        except httpx.TimeoutException:
            latency_ms = (time.monotonic() - start) * 1000
            return ConnectionTestResult(
                success=False,
                latency_ms=round(latency_ms, 1),
                message="连接超时，请检查网络和 Base URL",
                error_detail="Timeout",
            )
        except AIServiceError as e:
            latency_ms = (time.monotonic() - start) * 1000
            return ConnectionTestResult(
                success=False,
                latency_ms=round(latency_ms, 1),
                message="连接测试失败",
                error_detail=str(e)[:200],
            )
