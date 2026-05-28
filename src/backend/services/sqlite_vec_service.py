"""sqlite-vec vector storage service.

Provides native vector similarity search using sqlite-vec's vec0 virtual table,
replacing manual cosine similarity computation in rag_adapter.py.

Requires: sqlite-vec >= 0.1.9
"""

from __future__ import annotations

import logging
import os
import sqlite3
from typing import List, Optional, Tuple

import sqlite_vec

logger = logging.getLogger(__name__)


class SQLiteVecService:
    """sqlite-vec vector storage service using vec0 virtual table."""

    def __init__(self, db_path: str = "data/rag/vectors.db", dimension: int = 1536):
        """Initialize sqlite-vec service.

        Args:
            db_path: Path to the SQLite database file
            dimension: Embedding dimension (default 1536 for MiniMax embo-01)
        """
        self.db_path = db_path
        self.dimension = dimension
        self._ensure_dir()
        self._init_db()

    def _ensure_dir(self) -> None:
        """Create parent directories if they don't exist."""
        parent = os.path.dirname(self.db_path)
        if parent:
            os.makedirs(parent, exist_ok=True)

    def _get_conn(self) -> sqlite3.Connection:
        """Get a connection with sqlite-vec loaded."""
        conn = sqlite3.connect(self.db_path)
        conn.enable_load_extension(True)
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)
        return conn

    def _init_db(self) -> None:
        """Initialize vec0 virtual table."""
        with self._get_conn() as conn:
            conn.execute(f"""
                CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
                    chunk_id TEXT PRIMARY KEY,
                    embedding float[{self.dimension}]
                )
            """)
            conn.commit()
        logger.info(
            "sqlite-vec initialized: db=%s, dimension=%d", self.db_path, self.dimension
        )

    def insert_embedding(self, chunk_id: str, embedding: bytes) -> None:
        """Insert a single embedding (raw float32 bytes).

        Args:
            chunk_id: Unique chunk identifier
            embedding: Raw float32 bytes (dimension * 4 bytes)
        """
        with self._get_conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO vec_chunks(chunk_id, embedding) VALUES (?, ?)",
                (chunk_id, embedding),
            )
            conn.commit()

    def insert_embeddings_batch(self, items: List[Tuple[str, bytes]]) -> int:
        """Insert multiple embeddings in a single transaction.

        Args:
            items: List of (chunk_id, embedding_bytes) tuples

        Returns:
            Number of embeddings inserted
        """
        if not items:
            return 0
        with self._get_conn() as conn:
            conn.executemany(
                "INSERT OR REPLACE INTO vec_chunks(chunk_id, embedding) VALUES (?, ?)",
                items,
            )
            conn.commit()
            return len(items)

    def search_similar(
        self, query_embedding: bytes, limit: int = 10
    ) -> List[Tuple[str, float]]:
        """Search for similar embeddings using vector distance.

        Args:
            query_embedding: Raw float32 bytes for the query vector
            limit: Maximum number of results

        Returns:
            List of (chunk_id, distance) pairs ordered by ascending distance
        """
        with self._get_conn() as conn:
            results = conn.execute(
                "SELECT chunk_id, distance FROM vec_chunks WHERE embedding MATCH ? ORDER BY distance LIMIT ?",
                (query_embedding, limit),
            ).fetchall()
            return results

    def get_embedding(self, chunk_id: str) -> Optional[bytes]:
        """Retrieve embedding by chunk_id.

        Args:
            chunk_id: Unique chunk identifier

        Returns:
            Raw float32 bytes or None if not found
        """
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT embedding FROM vec_chunks WHERE chunk_id = ?",
                (chunk_id,),
            ).fetchone()
            return row[0] if row else None

    def count(self) -> int:
        """Return total number of stored embeddings."""
        with self._get_conn() as conn:
            return conn.execute("SELECT COUNT(*) FROM vec_chunks").fetchone()[0]

    def delete(self, chunk_id: str) -> bool:
        """Delete embedding by chunk_id.

        Args:
            chunk_id: Unique chunk identifier

        Returns:
            True if a row was deleted, False otherwise
        """
        with self._get_conn() as conn:
            cursor = conn.execute(
                "DELETE FROM vec_chunks WHERE chunk_id = ?", (chunk_id,)
            )
            conn.commit()
            return cursor.rowcount > 0
