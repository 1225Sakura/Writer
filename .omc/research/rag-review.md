# RAG Pipeline Review (US-015)

Reviewed: `rag_service.py`, `embedding_service.py`, `query_router.py`, `context_ranker.py`
Supporting: `chunk_strategy.py`, `context_weights.py`

---

## 1. Critical: Full-Table Scan in Vector Search Fallback

**File:** `rag_service.py`, lines 557-586

When `sqlite-vec` is not installed, `_vector_search` falls back to loading **every row with a non-null embedding** from the `vectors` table into Python, then computing cosine similarity in a loop:

```python
SELECT chunk_id, chapter_id, scene_index, content,
       embedding, parent_chunk_id, chunk_type, source_file
FROM vectors
WHERE embedding IS NOT NULL
```

This is an O(N) full-table scan with deserialization per row. For a novel with hundreds of chapters and paragraph-level chunking, this could mean thousands of rows loaded into memory per query. The `chapter_id <= ?` filter helps only marginally since most searches will span the full corpus.

**Impact:** Performance degrades linearly with corpus size. At ~1000 chunks (modest novel), each search deserializes 1000 numpy arrays. At ~5000+ chunks this becomes a real bottleneck.

**Mitigation:** The sqlite-vec path (KNN index) is the proper fix and is already implemented. The fallback is acceptable for small corpora. Consider adding a warning log when the fallback path is triggered so users know performance will degrade.

---

## 2. Bug: Duplicate Data Storage (3 tables for same data)

**File:** `rag_service.py`, lines 154-207

`add_chunks` inserts each chunk into **three** separate tables:
1. `context_chunks` (line 154) -- the main table
2. `vectors` (line 173) -- "backward compatibility"
3. `vec_items` (line 193) -- sqlite-vec KNN

This means every chunk write does 3x the I/O, and the `vectors` table is a full duplicate of `context_chunks`. The BM25 search reads from `vectors` while the delete function deletes from both. This is a maintenance hazard -- if one insert fails silently, the tables diverge.

**Recommendation:** Consolidate to a single source table (`context_chunks`) and use `vec_items` only for the KNN index. The `vectors` table should be deprecated.

---

## 3. Bug: FTS5 Content Sync Table Not Populated Correctly

**File:** `rag_service.py`, lines 277-284

The FTS5 virtual table is created with `content='context_chunks'` and `content_rowid='id'`, meaning it's a **content-sync table** that should read from `context_chunks`. However, `_rebuild_fts` (line 399) inserts directly into the FTS table with `INSERT OR REPLACE`:

```python
INSERT OR REPLACE INTO chunks_fts (chunk_id, content) VALUES (?, ?)
```

For content-sync FTS5 tables, you should INSERT into the **content table** (`context_chunks`) and then use `INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild')` to sync. Direct inserts into a content-sync FTS table will not work as expected -- the FTS index may not reflect the content table, and vice versa.

**Fix:** Either:
- Remove `content='context_chunks'` from the FTS5 creation to make it an independent table, OR
- Stop inserting directly into `chunks_fts` and instead rebuild from `context_chunks` after bulk inserts

---

## 4. No Embedding Cache

**File:** `embedding_service.py`

There is no caching of embeddings. Every search query re-embeds the query string via API call or local model inference. For repeated or similar queries, this wastes API calls and adds latency.

**Impact:** Low for single-user desktop app, but still wasteful. A simple in-memory LRU cache keyed on text hash would eliminate redundant API calls for repeated queries.

**Recommendation:** Add a small LRU cache (e.g., 256 entries) for query embeddings. Chapter chunk embeddings are stored in the DB so they don't need caching.

---

## 5. Thread Safety: Shared Mutable Connections

**File:** `rag_service.py`, lines 92-110

`RAGService` holds `_conn` and `_fts_conn` as instance-level SQLite connections. The service is a singleton (line 900-905). If multiple async tasks call search/add concurrently, they share the same connection objects. SQLite connections are not thread-safe by default.

The `_bm25_search` is wrapped in `asyncio.to_thread` (line 476), meaning it runs in a thread pool. This thread accesses `_get_fts_conn()` while the main async thread may be using `_get_conn()` -- both pointing to the same database file through different connections, which is fine for reads but problematic for concurrent writes during `add_chunks`.

**Impact:** Potential `OperationalError: database is locked` under concurrent load. For a single-user desktop app this is low-risk but worth noting.

---

## 6. Reranking is Lightweight (Not a Bug, But Worth Noting)

**File:** `rag_service.py`, lines 733-766

The docstring says "cross-attention scoring" but the actual implementation is simple keyword overlap boosting:

```python
overlap = len(query_terms & content_terms)
keyword_boost = overlap / max(len(query_terms), 1) * 0.2
```

This is a 0.2-weight keyword overlap bonus. It's a reasonable heuristic for a local app, but the docstring overstates what it does. The function name and description suggest a more sophisticated model-based reranker.

**Recommendation:** Update the docstring to accurately describe the heuristic approach.

---

## 7. BM25: Custom Implementation vs FTS5 Built-in BM25

**File:** `rag_service.py`, lines 588-673

The code implements BM25 scoring manually using a `bm25_index` table and `doc_stats` table, while also creating an FTS5 virtual table. FTS5 has a built-in `bm25()` function that is more efficient and well-tested:

```sql
SELECT chunk_id, content, bm25(chunks_fts) as rank
FROM chunks_fts
WHERE chunks_fts MATCH ?
ORDER BY rank
```

The custom BM25 implementation works correctly but:
- Requires maintaining a separate `bm25_index` table with term frequencies
- Does N queries (one per unique term) instead of a single FTS5 MATCH query
- Duplicates what SQLite FTS5 already provides

**Recommendation:** Use FTS5's built-in `bm25()` function and drop the custom `bm25_index`/`doc_stats` tables. This eliminates the manual tokenization, per-term queries, and two extra tables.

---

## 8. Query Router: First-Match Wins (Minor)

**File:** `query_router.py`, lines 73-91

Intent detection uses first-match iteration over a dict. If a query contains both "关系" and "剧情", it returns "relationship" because that key comes first in `intent_patterns`. This is acceptable for the domain but could produce unexpected results for compound queries like "主角和反派的关系以及后续剧情发展".

The `split` method (line 151) exists to handle compound queries, but `route_intent` doesn't use it -- it processes the whole query as one unit.

**Impact:** Low. Compound queries are rare in practice for a writing assistant.

---

## 9. Context Ranker: Clean Implementation

**File:** `context_ranker.py`

This is well-structured. The scoring formula is straightforward:
- Recency: `1 / (1 + gap)` -- good decay function
- Frequency: `log(1 + total) / log(11)` -- capped log scale, prevents over-weighting
- Length bonus: `min(len/1200, 1.0) * cap` -- rewards fuller content, capped
- Hook hints: Binary bonus for narrative hooks

The `_with_debug_score` helper cleanly attaches debug info without polluting the main logic. No issues found.

---

## 10. Chunk Strategy: Redundant Regex Split

**File:** `chunk_strategy.py`, line 88

```python
paragraphs = re.split(r"\n{2,}|\n{3,}", text)
```

The `\n{3,}` pattern is a subset of `\n{2,}` -- three or more newlines are already matched by "two or more". The second alternative is dead code.

**Fix:** Simplify to `re.split(r"\n{2,}", text)`.

---

## Summary

| # | Severity | Issue | File |
|---|----------|-------|------|
| 1 | **High** | Full-table scan + numpy deserialize in vector fallback | rag_service.py |
| 2 | **Medium** | Triple storage of every chunk (3 tables) | rag_service.py |
| 3 | **Medium** | FTS5 content-sync table misconfigured | rag_service.py |
| 4 | **Low** | No query embedding cache | embedding_service.py |
| 5 | **Low** | Shared singleton connections, thread safety | rag_service.py |
| 6 | **Low** | Docstring overstates reranking sophistication | rag_service.py |
| 7 | **Low** | Custom BM25 duplicates FTS5 built-in | rag_service.py |
| 8 | **Info** | Query router first-match intent | query_router.py |
| 9 | **OK** | Context ranker is clean | context_ranker.py |
| 10 | **Trivial** | Dead regex alternative | chunk_strategy.py |

**Overall assessment:** The pipeline is functional and the architecture is sound (hybrid search + RRF fusion + reranking is the standard approach). The main concerns are the FTS5 misconfiguration (#3) which may cause search quality issues, and the triple-write pattern (#2) which is a maintenance risk. The fallback vector search (#1) is acceptable for a desktop app with a single novel's worth of data. No security issues found.
