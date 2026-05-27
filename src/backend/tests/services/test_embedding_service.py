"""Tests for EmbeddingService - dual-mode embedding generation."""

import pytest
import numpy as np
from unittest.mock import AsyncMock, MagicMock, patch
from backend.services.embedding_service import (
    EmbeddingService,
    get_embedding_service,
    embed_texts,
    DEFAULT_EMBEDDING_DIM,
    LOCAL_EMBEDDING_DIM,
)


@pytest.fixture
def service():
    """Create an EmbeddingService with mocked API key."""
    return EmbeddingService(api_key="test-key", api_url="https://test.api/v1")


@pytest.fixture
def no_api_service():
    """Create an EmbeddingService without API key."""
    return EmbeddingService(api_key=None)


# =============================================================================
# Initialization
# =============================================================================

class TestInitialization:
    """Test service initialization."""

    def test_default_dimensions(self, service):
        """Default dimensions are set correctly."""
        assert service.embedding_dim == DEFAULT_EMBEDDING_DIM
        assert service.local_embedding_dim == LOCAL_EMBEDDING_DIM

    def test_custom_dimensions(self):
        """Custom dimensions are stored."""
        svc = EmbeddingService(embedding_dim=512, local_embedding_dim=256)
        assert svc.embedding_dim == 512
        assert svc.local_embedding_dim == 256

    def test_batch_size_stored(self, service):
        """Batch size is stored."""
        assert service.batch_size == 32

    def test_custom_batch_size(self):
        svc = EmbeddingService(batch_size=64)
        assert svc.batch_size == 64


# =============================================================================
# Serialize / Deserialize
# =============================================================================

class TestSerializeDeserialize:
    """Test embedding serialization."""

    def test_serialize_embedding_to_bytes(self, service):
        """Numpy array is serialized to float32 bytes."""
        arr = np.array([1.0, 2.0, 3.0], dtype=np.float32)
        data = service.serialize_embedding(arr)
        assert isinstance(data, bytes)
        assert len(data) == 3 * 4  # 3 floats * 4 bytes each

    def test_deserialize_embedding_from_bytes(self, service):
        """Bytes are deserialized back to numpy array."""
        arr = np.array([1.0, 2.0, 3.0], dtype=np.float32)
        data = arr.tobytes()
        restored = service.deserialize_embedding(data)
        np.testing.assert_array_almost_equal(restored, arr)

    def test_roundtrip_serialize_deserialize(self, service):
        """Serialize then deserialize produces original array."""
        original = np.random.randn(1536).astype(np.float32)
        data = service.serialize_embedding(original)
        restored = service.deserialize_embedding(data)
        np.testing.assert_array_almost_equal(restored, original)


# =============================================================================
# Embed via API
# =============================================================================

class TestEmbedViaAPI:
    """Test API embedding path."""

    @pytest.mark.asyncio
    async def test_embed_via_api_success(self, service):
        """Successful API call returns embeddings."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "data": [
                {"index": 0, "embedding": [0.1] * 1536},
                {"index": 1, "embedding": [0.2] * 1536},
            ]
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock(post=AsyncMock(return_value=mock_response))
            )
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
            results = await service._embed_via_api(["text1", "text2"])

        assert len(results) == 2
        assert results[0] is not None
        assert results[1] is not None

    @pytest.mark.asyncio
    async def test_embed_via_api_handles_missing_embeddings(self, service):
        """API returning fewer results pads with None."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "data": [{"index": 0, "embedding": [0.1] * 1536}]
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock(post=AsyncMock(return_value=mock_response))
            )
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
            results = await service._embed_via_api(["text1", "text2"])

        assert len(results) == 2
        assert results[0] is not None
        assert results[1] is None


# =============================================================================
# Embed main path
# =============================================================================

class TestEmbedMainPath:
    """Test the main embed() method."""

    @pytest.mark.asyncio
    async def test_embed_empty_list_returns_empty(self, service):
        """Empty text list returns empty results."""
        results = await service.embed([])
        assert results == []

    @pytest.mark.asyncio
    async def test_embed_falls_back_when_api_fails(self, service):
        """When API fails with EmbeddingError and no local model, returns None."""
        from backend.utils.exceptions import EmbeddingError
        original = service._embed_via_api
        service._embed_via_api = AsyncMock(side_effect=EmbeddingError("API failed"))
        service._local_available = False
        try:
            results = await service.embed(["test"])
            assert results == [None]
        finally:
            service._embed_via_api = original

    @pytest.mark.asyncio
    async def test_embed_returns_none_when_no_provider(self, no_api_service):
        """Returns None for each text when no provider is available."""
        no_api_service._local_available = False
        results = await no_api_service.embed(["text1", "text2"])
        assert results == [None, None]


# =============================================================================
# get_embedding_dim
# =============================================================================

class TestGetEmbeddingDim:
    """Test dimension reporting."""

    def test_api_mode_returns_api_dim(self, service):
        """With API key and no local, returns API dimension."""
        service._local_available = False
        assert service.get_embedding_dim() == DEFAULT_EMBEDDING_DIM

    def test_local_mode_returns_local_dim(self, service):
        """With local available, returns local dimension."""
        service._local_available = True
        assert service.get_embedding_dim() == LOCAL_EMBEDDING_DIM


# =============================================================================
# Singleton
# =============================================================================

class TestSingleton:
    """Test singleton pattern."""

    def test_get_embedding_service_returns_instance(self):
        """get_embedding_service returns an EmbeddingService."""
        # Reset singleton
        import backend.services.embedding_service as mod
        mod._embedding_service = None
        svc = get_embedding_service()
        assert isinstance(svc, EmbeddingService)
        # Cleanup
        mod._embedding_service = None
