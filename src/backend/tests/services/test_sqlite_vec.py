"""Tests for sqlite_vec_service.

Each test uses a temporary database to avoid side effects.
"""

from __future__ import annotations

import os
import struct
import tempfile

import numpy as np
import pytest

from backend.services.sqlite_vec_service import SQLiteVecService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

DIM = 1536


def _random_embedding(dim: int = DIM) -> bytes:
    """Generate random float32 bytes."""
    return np.random.randn(dim).astype(np.float32).tobytes()


@pytest.fixture()
def svc(tmp_path):
    """Provide a SQLiteVecService backed by a temporary database."""
    db_path = os.path.join(str(tmp_path), "test_vectors.db")
    return SQLiteVecService(db_path=db_path, dimension=DIM)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestInitCreatesVec0Table:
    def test_vec_chunks_table_exists(self, svc: SQLiteVecService):
        import sqlite3
        import sqlite_vec

        conn = sqlite3.connect(svc.db_path)
        conn.enable_load_extension(True)
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)
        tables = {
            r[0]
            for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' OR type='table'"
            ).fetchall()
        }
        # vec0 creates a regular table named after the virtual table
        assert "vec_chunks" in tables
        conn.close()


class TestInsertAndSearch:
    def test_insert_then_search_returns_same_chunk(self, svc: SQLiteVecService):
        chunk_id = "chunk-001"
        emb = _random_embedding()
        svc.insert_embedding(chunk_id, emb)

        results = svc.search_similar(emb, limit=5)
        assert len(results) >= 1
        assert results[0][0] == chunk_id
        # Distance to itself should be 0 (or very close)
        assert results[0][1] < 1e-6

    def test_search_returns_closest_first(self, svc: SQLiteVecService):
        emb_a = _random_embedding()
        emb_b = _random_embedding()
        svc.insert_embedding("a", emb_a)
        svc.insert_embedding("b", emb_b)

        # Query with emb_a — should return "a" first
        results = svc.search_similar(emb_a, limit=2)
        assert len(results) == 2
        assert results[0][0] == "a"
        assert results[1][0] == "b"
        assert results[0][1] <= results[1][1]


class TestInsertBatch:
    def test_batch_insert_returns_count(self, svc: SQLiteVecService):
        items = [(f"chunk-{i}", _random_embedding()) for i in range(10)]
        count = svc.insert_embeddings_batch(items)
        assert count == 10
        assert svc.count() == 10

    def test_batch_insert_empty_list(self, svc: SQLiteVecService):
        assert svc.insert_embeddings_batch([]) == 0


class TestDelete:
    def test_delete_removes_embedding(self, svc: SQLiteVecService):
        svc.insert_embedding("to-delete", _random_embedding())
        assert svc.count() == 1

        assert svc.delete("to-delete") is True
        assert svc.count() == 0

    def test_delete_nonexistent_returns_false(self, svc: SQLiteVecService):
        assert svc.delete("no-such-id") is False


class TestCount:
    def test_count_empty(self, svc: SQLiteVecService):
        assert svc.count() == 0

    def test_count_after_inserts(self, svc: SQLiteVecService):
        for i in range(5):
            svc.insert_embedding(f"chunk-{i}", _random_embedding())
        assert svc.count() == 5


class TestSearchSimilarOrdering:
    def test_results_ordered_by_ascending_distance(self, svc: SQLiteVecService):
        # Insert several random embeddings
        ids = []
        for i in range(20):
            cid = f"chunk-{i:03d}"
            ids.append(cid)
            svc.insert_embedding(cid, _random_embedding())

        query_emb = _random_embedding()
        results = svc.search_similar(query_emb, limit=10)

        assert len(results) == 10
        distances = [d for _, d in results]
        assert distances == sorted(distances), "Results should be ordered by ascending distance"


class TestGetEmbedding:
    def test_returns_bytes_for_existing(self, svc: SQLiteVecService):
        emb = _random_embedding()
        svc.insert_embedding("exists", emb)
        assert svc.get_embedding("exists") == emb

    def test_returns_none_for_missing(self, svc: SQLiteVecService):
        assert svc.get_embedding("missing") is None
