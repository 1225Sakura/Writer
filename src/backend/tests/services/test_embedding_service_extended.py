"""Extended tests for EmbeddingService — Phase 5 Tier 2.

Covers additional edge cases for: API embed error paths, local fallback,
batch processing, serialization round-trips, dimension reporting,
convenience functions, and singleton management.
"""

import pytest
import numpy as np
from unittest.mock import AsyncMock, MagicMock, patch

from backend.services.embedding_service import (
    EmbeddingService,
    get_embedding_service,
    embed_texts,
    embed_texts_sync,
    DEFAULT_EMBEDDING_DIM,
    LOCAL_EMBEDDING_DIM,
)
from backend.utils.exceptions import EmbeddingError


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def service():
    return EmbeddingService(api_key="test-key", api_url="https://test.api/v1")


@pytest.fixture
def no_api_service():
    return EmbeddingService(api_key=None)


# =============================================================================
# Initialization edge cases
# =============================================================================


class TestInitializationExtended:
    """Extended initialization tests."""

    def test_default_model_name(self, service):
        assert service.model == "embo-01"

    def test_default_local_model_name(self, service):
        assert service.local_model == "all-MiniLM-L6-v2"

    def test_default_timeout(self, service):
        assert service.timeout == 30.0

    def test_custom_timeout(self):
        svc = EmbeddingService(timeout=60.0)
        assert svc.timeout == 60.0

    def test_local_model_initially_none(self, service):
        assert service._local_model is None

    def test_local_available_initially_none(self, service):
        assert service._local_available is None


# =============================================================================
# Embed via API edge cases
# =============================================================================


class TestEmbedViaAPIExtended:
    """Extended API embedding tests."""

    @pytest.mark.asyncio
    async def test_embed_via_api_sorted_by_index(self, service):
        """Results are sorted by index to maintain order."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "data": [
                {"index": 1, "embedding": [0.2] * 1536},
                {"index": 0, "embedding": [0.1] * 1536},
            ]
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock(post=AsyncMock(return_value=mock_response))
            )
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
            results = await service._embed_via_api(["text1", "text2"])

        assert len(results) == 2
        # Index 0 should come first
        np.testing.assert_array_almost_equal(
            results[0], np.array([0.1] * 1536, dtype=np.float32)
        )

    @pytest.mark.asyncio
    async def test_embed_via_api_pads_missing_results(self, service):
        """Fewer results than inputs are padded with None."""
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
            results = await service._embed_via_api(["text1", "text2", "text3"])

        assert len(results) == 3
        assert results[0] is not None
        assert results[1] is None
        assert results[2] is None

    @pytest.mark.asyncio
    async def test_embed_via_api_handles_non_list_embedding(self, service):
        """Non-list embedding values are treated as None."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "data": [
                {"index": 0, "embedding": None},
                {"index": 1, "embedding": "invalid"},
            ]
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock(post=AsyncMock(return_value=mock_response))
            )
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
            results = await service._embed_via_api(["text1", "text2"])

        assert results[0] is None
        assert results[1] is None

    @pytest.mark.asyncio
    async def test_embed_via_api_empty_data(self, service):
        """Empty data list pads all with None."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {"data": []}

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock(post=AsyncMock(return_value=mock_response))
            )
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
            results = await service._embed_via_api(["text1"])

        assert len(results) == 1
        assert results[0] is None


# =============================================================================
# Embed main path edge cases
# =============================================================================


class TestEmbedMainPathExtended:
    """Extended embed() method tests."""

    @pytest.mark.asyncio
    async def test_embed_api_success_returns_results(self, service):
        """Successful API call returns embeddings without fallback."""
        mock_result = [np.array([0.1] * 1536, dtype=np.float32)]
        service._embed_via_api = AsyncMock(return_value=mock_result)
        results = await service.embed(["test"])
        assert len(results) == 1
        assert results[0] is not None

    @pytest.mark.asyncio
    async def test_embed_falls_back_to_local_on_api_error(self, service):
        """When API fails, falls back to local model."""
        from backend.utils.exceptions import EmbeddingError

        service._embed_via_api = AsyncMock(side_effect=EmbeddingError("API failed"))
        service._local_available = True
        local_result = [np.array([0.2] * 384, dtype=np.float32)]
        service._embed_via_local = MagicMock(return_value=local_result)

        results = await service.embed(["test"])
        assert results == local_result

    @pytest.mark.asyncio
    async def test_embed_no_api_key_skips_api(self, no_api_service):
        """Without API key, skips API and tries local."""
        no_api_service._local_available = False
        results = await no_api_service.embed(["text"])
        assert results == [None]

    @pytest.mark.asyncio
    async def test_embed_multiple_texts(self, service):
        """Multiple texts are processed."""
        mock_results = [
            np.array([0.1] * 1536, dtype=np.float32),
            np.array([0.2] * 1536, dtype=np.float32),
            np.array([0.3] * 1536, dtype=np.float32),
        ]
        service._embed_via_api = AsyncMock(return_value=mock_results)
        results = await service.embed(["a", "b", "c"])
        assert len(results) == 3


# =============================================================================
# Serialize / Deserialize edge cases
# =============================================================================


class TestSerializeDeserializeExtended:
    """Extended serialization tests."""

    def test_serialize_large_vector(self, service):
        arr = np.random.randn(1536).astype(np.float32)
        data = service.serialize_embedding(arr)
        assert isinstance(data, bytes)
        assert len(data) == 1536 * 4

    def test_deserialize_large_vector(self, service):
        arr = np.random.randn(1536).astype(np.float32)
        data = arr.tobytes()
        restored = service.deserialize_embedding(data)
        np.testing.assert_array_almost_equal(restored, arr)

    def test_roundtrip_preserves_values(self, service):
        original = np.array([1.23456, -7.89012, 0.0, 100.5], dtype=np.float32)
        data = service.serialize_embedding(original)
        restored = service.deserialize_embedding(data)
        np.testing.assert_array_almost_equal(restored, original, decimal=5)

    def test_serialize_non_float32_converts(self, service):
        arr = np.array([1.0, 2.0, 3.0], dtype=np.float64)
        data = service.serialize_embedding(arr)
        restored = service.deserialize_embedding(data)
        assert restored.dtype == np.float32

    def test_deserialize_single_element(self, service):
        arr = np.array([42.0], dtype=np.float32)
        data = arr.tobytes()
        restored = service.deserialize_embedding(data)
        assert len(restored) == 1
        assert restored[0] == pytest.approx(42.0)


# =============================================================================
# get_embedding_dim
# =============================================================================


class TestGetEmbeddingDimExtended:
    """Extended dimension tests."""

    def test_dim_with_api_only(self, service):
        service._local_available = False
        assert service.get_embedding_dim() == DEFAULT_EMBEDDING_DIM

    def test_dim_with_local_available(self, service):
        service._local_available = True
        assert service.get_embedding_dim() == LOCAL_EMBEDDING_DIM

    def test_dim_with_no_api_and_no_local(self):
        """When api_key is truly empty and local unavailable, returns local dim."""
        svc = EmbeddingService.__new__(EmbeddingService)
        svc.api_key = ""
        svc.api_url = ""
        svc.model = "embo-01"
        svc.local_model = "all-MiniLM-L6-v2"
        svc.embedding_dim = DEFAULT_EMBEDDING_DIM
        svc.local_embedding_dim = LOCAL_EMBEDDING_DIM
        svc.batch_size = 32
        svc.timeout = 30.0
        svc._local_model = None
        svc._local_available = False
        assert svc.get_embedding_dim() == LOCAL_EMBEDDING_DIM

    def test_custom_dimensions_preserved(self):
        svc = EmbeddingService(embedding_dim=768, local_embedding_dim=256)
        svc._local_available = False
        assert svc.get_embedding_dim() == 768
        svc._local_available = True
        assert svc.get_embedding_dim() == 256


# =============================================================================
# Convenience functions
# =============================================================================


class TestConvenienceFunctions:
    """Test module-level convenience functions."""

    @pytest.mark.asyncio
    async def test_embed_texts_calls_service(self):
        import backend.services.embedding_service as mod

        mod._embedding_service = None
        mock_svc = MagicMock()
        mock_svc.embed = AsyncMock(return_value=[np.array([1.0])])
        mod._embedding_service = mock_svc

        results = await embed_texts(["test"])
        mock_svc.embed.assert_called_once_with(["test"])
        mod._embedding_service = None

    def test_embed_texts_sync_calls_local(self):
        import backend.services.embedding_service as mod

        mod._embedding_service = None
        mock_svc = MagicMock()
        mock_svc._embed_via_local_sync = MagicMock(return_value=[np.array([1.0])])
        mod._embedding_service = mock_svc

        results = embed_texts_sync(["test"])
        mock_svc._embed_via_local_sync.assert_called_once_with(["test"])
        mod._embedding_service = None

    @pytest.mark.asyncio
    async def test_embed_texts_empty_list(self):
        import backend.services.embedding_service as mod

        mod._embedding_service = None
        mock_svc = MagicMock()
        mock_svc.embed = AsyncMock(return_value=[])
        mod._embedding_service = mock_svc

        results = await embed_texts([])
        assert results == []
        mod._embedding_service = None


# =============================================================================
# Singleton management
# =============================================================================


class TestSingletonExtended:
    """Extended singleton tests."""

    def test_get_embedding_service_creates_instance(self):
        import backend.services.embedding_service as mod

        mod._embedding_service = None
        svc = get_embedding_service()
        assert isinstance(svc, EmbeddingService)
        mod._embedding_service = None

    def test_get_embedding_service_returns_same(self):
        import backend.services.embedding_service as mod

        mod._embedding_service = None
        svc1 = get_embedding_service()
        svc2 = get_embedding_service()
        assert svc1 is svc2
        mod._embedding_service = None

    def test_singleton_reset(self):
        import backend.services.embedding_service as mod

        mod._embedding_service = None
        svc1 = get_embedding_service()
        mod._embedding_service = None
        svc2 = get_embedding_service()
        assert svc1 is not svc2
        mod._embedding_service = None


# =============================================================================
# Local availability check
# =============================================================================


class TestLocalAvailability:
    """Test local model availability detection."""

    def test_local_available_caches_result(self, service):
        """local_available property caches the check result."""
        service._local_available = True
        assert service.local_available is True
        # Should not re-check
        assert service.local_available is True

    def test_check_local_model_returns_bool(self, service):
        result = service._check_local_model()
        assert isinstance(result, bool)

    def test_local_available_false_when_import_fails(self, service):
        """Returns False when sentence_transformers is not importable."""
        with patch.dict("sys.modules", {"sentence_transformers": None}):
            result = service._check_local_model()
            assert result is False


# =============================================================================
# embed_single
# =============================================================================


class TestEmbedSingle:
    """Test single-text embedding."""

    def test_embed_single_returns_array(self, service):
        service._local_available = True
        service._local_model = MagicMock()
        service._local_model.encode.return_value = np.array(
            [[0.1] * 384], dtype=np.float32
        )
        result = service.embed_single("test text")
        assert result is not None
        assert len(result) == 384

    def test_embed_single_returns_none_on_failure(self, service):
        """Returns None when local model raises EmbeddingError."""
        service._local_available = True
        service._local_model = MagicMock()
        service._local_model.encode.side_effect = EmbeddingError("model error")
        result = service.embed_single("test text")
        assert result is None
