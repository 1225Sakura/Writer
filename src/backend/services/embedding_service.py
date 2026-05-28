"""Embedding service for RAG vector storage.

Provides dual-mode embedding generation:
1. MiniMax API embedding (primary) - via HTTP API call
2. Local fallback using sentence-transformers/all-MiniLM-L6-v2

Both modes return numpy arrays which are stored as bytes in SQLite.
Supports batch embedding for efficiency.
"""

from __future__ import annotations

import logging
from typing import List, Optional

import numpy as np

from backend.config import settings
from backend.utils.exceptions import EmbeddingError

logger = logging.getLogger(__name__)

# Default embedding dimensions
DEFAULT_EMBEDDING_DIM: int = 1536
LOCAL_EMBEDDING_DIM: int = 384


class EmbeddingService:
    """Dual-mode embedding service with MiniMax API + local fallback."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_url: Optional[str] = None,
        model: str = "embo-01",
        local_model: str = "all-MiniLM-L6-v2",
        embedding_dim: int = DEFAULT_EMBEDDING_DIM,
        local_embedding_dim: int = LOCAL_EMBEDDING_DIM,
        batch_size: int = 32,
        timeout: float = 30.0,
    ):
        """Initialize embedding service.

        Args:
            api_key: MiniMax API key (defaults to settings.minimax_api_key)
            api_url: MiniMax API URL (defaults to settings.minimax_api_url)
            model: MiniMax embedding model name
            local_model: Local sentence-transformers model name
            embedding_dim: Expected dimension for API embeddings
            local_embedding_dim: Expected dimension for local embeddings
            batch_size: Batch size for embedding requests
            timeout: Request timeout in seconds
        """
        self.api_key = api_key or settings.minimax_api_key
        self.api_url = api_url or settings.minimax_api_url
        self.model = model
        self.local_model = local_model
        self.embedding_dim = embedding_dim
        self.local_embedding_dim = local_embedding_dim
        self.batch_size = batch_size
        self.timeout = timeout
        self._local_model = None
        self._local_available: Optional[bool] = None

    @property
    def local_available(self) -> bool:
        """Check if local embedding model is available."""
        if self._local_available is None:
            self._local_available = self._check_local_model()
        return self._local_available

    def _check_local_model(self) -> bool:
        """Check if sentence-transformers is available."""
        try:
            from sentence_transformers import SentenceTransformer
            return True
        except ImportError:
            logger.warning(
                "sentence-transformers not available. "
                "Install with: pip install sentence-transformers"
            )
            return False

    async def embed(self, texts: List[str]) -> List[Optional[np.ndarray]]:
        """Generate embeddings for texts using available provider.

        Tries MiniMax API first, falls back to local model.
        Returns list of embeddings (or None for failed embeddings).

        Args:
            texts: List of text strings to embed

        Returns:
            List of numpy arrays (or None for failed embeddings)
        """
        if not texts:
            return []

        # Try MiniMax API first
        if self.api_key:
            try:
                return await self._embed_via_api(texts)
            except EmbeddingError as exc:
                logger.warning("MiniMax embedding failed: %s", exc)

        # Fall back to local model
        if self.local_available:
            try:
                return self._embed_via_local(texts)
            except EmbeddingError as exc:
                logger.error("Local embedding also failed: %s", exc)

        logger.error("No embedding provider available")
        return [None] * len(texts)

    async def _embed_via_api(self, texts: List[str]) -> List[Optional[np.ndarray]]:
        """Call MiniMax embedding API.

        Args:
            texts: List of texts to embed

        Returns:
            List of embeddings or None for failures
        """
        import httpx

        url = f"{self.api_url}/embeddings"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        results: List[Optional[np.ndarray]] = []
        payload = {
            "model": self.model,
            "input": texts,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

            embeddings_data = data.get("data", [])
            # Sort by index to maintain order
            embeddings_data.sort(key=lambda x: x.get("index", 0))

            for item in embeddings_data:
                vec = item.get("embedding")
                if vec and isinstance(vec, list):
                    results.append(np.array(vec, dtype=np.float32))
                else:
                    results.append(None)

        # Pad if fewer results
        while len(results) < len(texts):
            results.append(None)
        return results[:len(texts)]

    def _embed_via_local(self, texts: List[str]) -> List[Optional[np.ndarray]]:
        """Generate embeddings using local sentence-transformers model.

        Args:
            texts: List of texts to embed

        Returns:
            List of embeddings
        """
        if self._local_model is None:
            from sentence_transformers import SentenceTransformer
            self._local_model = SentenceTransformer(self.local_model)

        # Batch the texts
        results: List[Optional[np.ndarray]] = []
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i + self.batch_size]
            try:
                embeddings = self._local_model.encode(
                    batch,
                    convert_to_numpy=True,
                    show_progress=False,
                )
                for emb in embeddings:
                    results.append(emb.astype(np.float32))
            except EmbeddingError as exc:
                logger.warning("Local embedding batch failed: %s", exc)
                results.extend([None] * len(batch))

        return results

    def embed_single(self, text: str) -> Optional[np.ndarray]:
        """Generate embedding for a single text (sync version).

        Args:
            text: Text to embed

        Returns:
            Numpy array or None
        """
        result = self._embed_via_local_sync([text])
        return result[0] if result else None

    def _embed_via_local_sync(self, texts: List[str]) -> List[Optional[np.ndarray]]:
        """Synchronous local embedding.

        Args:
            texts: List of texts

        Returns:
            List of embeddings
        """
        if self._local_model is None:
            from sentence_transformers import SentenceTransformer
            self._local_model = SentenceTransformer(self.local_model)

        results: List[Optional[np.ndarray]] = []
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i + self.batch_size]
            try:
                embeddings = self._local_model.encode(
                    batch,
                    convert_to_numpy=True,
                    normalize_embeddings=True,
                    show_progress=False,
                )
                for emb in embeddings:
                    results.append(emb.astype(np.float32))
            except EmbeddingError as exc:
                logger.warning("Local sync embedding failed: %s", exc)
                results.extend([None] * len(batch))

        return results

    def get_embedding_dim(self) -> int:
        """Return the expected embedding dimension based on current mode."""
        if self.api_key and not self.local_available:
            return self.embedding_dim
        return self.local_embedding_dim

    def serialize_embedding(self, embedding: np.ndarray) -> bytes:
        """Serialize embedding numpy array to bytes for storage.

        Args:
            embedding: Numpy array

        Returns:
            Bytes suitable for SQLite storage
        """
        return embedding.astype(np.float32).tobytes()

    def deserialize_embedding(self, data: bytes) -> np.ndarray:
        """Deserialize bytes back to numpy array.

        Args:
            data: Bytes from SQLite

        Returns:
            Numpy array
        """
        return np.frombuffer(data, dtype=np.float32)


# Singleton instance
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """Get or create the singleton embedding service instance."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service


async def embed_texts(texts: List[str]) -> List[Optional[np.ndarray]]:
    """Convenience function for embedding texts.

    Args:
        texts: List of text strings

    Returns:
        List of embedding arrays
    """
    service = get_embedding_service()
    return await service.embed(texts)


def embed_texts_sync(texts: List[str]) -> List[Optional[np.ndarray]]:
    """Synchronous convenience function for embedding texts.

    Args:
        texts: List of text strings

    Returns:
        List of embedding arrays
    """
    service = get_embedding_service()
    return service._embed_via_local_sync(texts)
