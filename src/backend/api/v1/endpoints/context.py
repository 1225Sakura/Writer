"""Context Routes - RAG context retrieval API.

Endpoints:
  POST /context/build/{chapter_id}  - Build context pack for a chapter
  POST /context/query               - Query RAG index
  GET  /context/chunks/{chapter_id} - List indexed chunks for a chapter
  GET  /context/stats               - RAG index statistics
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.middleware.auth import require_auth
from backend.services.context_manager import ContextManager, TextChunk
from backend.core.services.ai.rag_adapter import RAGAdapter, SearchResult
from backend.utils.exceptions import AppException, DatabaseError

router = APIRouter(prefix="/context", tags=["context"], dependencies=[require_auth])


# =========================================================================
# Request / Response schemas
# =========================================================================


class ContextBuildRequest(BaseModel):
    """Request to build context for a chapter."""

    model_config = {"json_schema_extra": {"example": {"max_chars": 8000}}}

    max_chars: int = Field(8000, ge=1000, le=20000, description="Max characters for context")


class ContextBuildResponse(BaseModel):
    """Response containing built context pack."""

    model_config = {"json_schema_extra": {"example": {"chapter_id": 1, "sections": {}}}}

    chapter_id: int
    sections: Dict[str, Any]
    meta: Dict[str, Any]
    weights: Dict[str, float]


class ContextQueryRequest(BaseModel):
    """Request to query the RAG index."""

    model_config = {"json_schema_extra": {"example": {"query": "主角修炼", "strategy": "auto"}}}

    query: str = Field(..., min_length=1, max_length=1000, description="Search query")
    strategy: str = Field("auto", description="Search strategy: auto/graph_hybrid/bm25_fallback/hybrid/vector")
    top_k: int = Field(5, ge=1, le=50, description="Number of results")
    chunk_type: Optional[str] = Field(None, description="Filter by chunk type")
    chapter_id: Optional[int] = Field(None, description="Limit to chapters up to this ID")
    center_entities: Optional[List[str]] = Field(None, description="Center entities for graph search")

    @field_validator("strategy")
    @classmethod
    def validate_strategy(cls, v: str) -> str:
        allowed = {"auto", "graph_hybrid", "bm25_fallback", "hybrid", "vector", "bm25"}
        if v not in allowed:
            raise ValueError(f"strategy must be one of: {', '.join(sorted(allowed))}")
        return v


class ContextQueryResult(BaseModel):
    """Single search result."""

    chunk_id: str
    chapter_id: int
    scene_index: int
    content: str
    score: float
    source: str
    chunk_type: Optional[str] = None
    parent_chunk_id: Optional[str] = None
    source_file: Optional[str] = None


class ContextQueryResponse(BaseModel):
    """Response for RAG query."""

    query: str
    strategy: str
    results: List[ContextQueryResult]
    total: int
    degraded: bool = False
    degraded_reason: Optional[str] = None


class ContextChunkResponse(BaseModel):
    """Single chunk response."""

    chunk_id: str
    chapter_id: int
    scene_index: int
    content: str
    chunk_type: str
    parent_chunk_id: Optional[str] = None
    source_file: Optional[str] = None
    created_at: Optional[str] = None


class ContextChunksResponse(BaseModel):
    """Response listing chunks for a chapter."""

    chapter_id: int
    chunks: List[ContextChunkResponse]
    total: int


class ContextIndexRequest(BaseModel):
    """Request to index chapter content."""

    model_config = {"json_schema_extra": {"example": {"content": "章节正文...", "summary": "摘要"}}}

    content: str = Field(..., min_length=1, max_length=100000, description="Chapter content to index")
    summary: Optional[str] = Field(None, description="Optional chapter summary")
    max_chunk_size: int = Field(800, ge=100, le=2000, description="Max characters per chunk")
    overlap: int = Field(100, ge=0, le=500, description="Overlap between chunks")


class ContextIndexResponse(BaseModel):
    """Response for indexing operation."""

    chapter_id: int
    stored: int
    total_chunks: int
    degraded: bool = False
    degraded_reason: Optional[str] = None


class ContextStatsResponse(BaseModel):
    """RAG index statistics."""

    vectors: int
    terms: int
    max_chapter: int


# =========================================================================
# Dependencies
# =========================================================================


def get_context_manager() -> ContextManager:
    return ContextManager()


def get_rag_adapter(cm: ContextManager = Depends(get_context_manager)) -> RAGAdapter:
    return RAGAdapter(cm)


# =========================================================================
# Endpoints
# =========================================================================


@router.post(
    "/build/{chapter_id}",
    response_model=ContextBuildResponse,
    summary="构建章节上下文",
    description="""
    为指定章节构建完整的上下文包，包含：
    - core: 章节标题、摘要、最新草稿预览
    - scene: 出场角色信息
    - global: 世界观设定、规则
    - recent_summaries: 近期章节摘要
    - plot_threads: 活跃伏笔/剧情线
    """,
)
async def build_context(
    chapter_id: int,
    request: ContextBuildRequest,
    db: AsyncSession = Depends(get_db),
    cm: ContextManager = Depends(get_context_manager),
):
    """Build a context pack for the specified chapter."""
    try:
        pack = await cm.build_context_pack(chapter_id, db, max_chars=request.max_chars)
        assembled = cm.assemble_context(pack, max_chars=request.max_chars)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except AppException as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to build context: {str(e)}"
        )

    return ContextBuildResponse(
        chapter_id=chapter_id,
        sections=assembled.get("sections", {}),
        meta=assembled.get("meta", {}),
        weights=assembled.get("weights", {}),
    )


@router.post(
    "/index/{chapter_id}",
    response_model=ContextIndexResponse,
    summary="索引章节内容",
    description="""
    将章节内容分块并索引到RAG向量库中。
    支持自动分块、BM25索引，以及可选的向量嵌入。
    如果嵌入服务不可用，会自动降级为仅BM25索引。
    """,
)
async def index_chapter(
    chapter_id: int,
    request: ContextIndexRequest,
    cm: ContextManager = Depends(get_context_manager),
    rag: RAGAdapter = Depends(get_rag_adapter),
):
    """Index chapter content into the RAG store."""
    try:
        # Delete existing chunks for this chapter
        cm.delete_chapter_chunks(chapter_id)

        # Chunk content
        chunks = cm.chunk_chapter_content(
            chapter_id=chapter_id,
            content=request.content,
            summary=request.summary,
            max_chunk_size=request.max_chunk_size,
            overlap=request.overlap,
        )

        # Try to get embeddings
        embeddings = None
        try:
            texts = [c.content for c in chunks]
            embeddings = await rag._embed(texts)
        except AppException as exc:
            logger = __import__("logging").getLogger(__name__)
            logger.warning("Embedding failed, falling back to BM25-only indexing: %s", exc)

        stored = cm.store_chunks(chunks, embeddings)

        return ContextIndexResponse(
            chapter_id=chapter_id,
            stored=stored,
            total_chunks=len(chunks),
            degraded=rag.degraded_mode_reason is not None,
            degraded_reason=rag.degraded_mode_reason,
        )
    except AppException as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to index chapter: {str(e)}"
        )


@router.post(
    "/query",
    response_model=ContextQueryResponse,
    summary="RAG查询",
    description="""
    查询RAG索引，支持多种检索策略：
    - **auto**: 自动选择最佳策略
    - **graph_hybrid**: 图谱增强混合检索（实体关系扩展）
    - **bm25_fallback**: 纯BM25关键词检索（无需向量）
    - **hybrid**: 向量+BM25融合检索
    - **vector**: 纯向量相似度检索
    """,
)
async def query_context(
    request: ContextQueryRequest,
    rag: RAGAdapter = Depends(get_rag_adapter),
):
    """Query the RAG index with the specified strategy."""
    try:
        results = await rag.search(
            query=request.query,
            top_k=request.top_k,
            strategy=request.strategy,
            chunk_type=request.chunk_type,
            chapter_id=request.chapter_id,
            center_entities=request.center_entities,
        )
    except AppException as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG query failed: {str(e)}"
        )

    return ContextQueryResponse(
        query=request.query,
        strategy=request.strategy,
        results=[
            ContextQueryResult(
                chunk_id=r.chunk_id,
                chapter_id=r.chapter_id,
                scene_index=r.scene_index,
                content=r.content,
                score=round(r.score, 4),
                source=r.source,
                chunk_type=r.chunk_type,
                parent_chunk_id=r.parent_chunk_id,
                source_file=r.source_file,
            )
            for r in results
        ],
        total=len(results),
        degraded=rag.degraded_mode_reason is not None,
        degraded_reason=rag.degraded_mode_reason,
    )


@router.get(
    "/chunks/{chapter_id}",
    response_model=ContextChunksResponse,
    summary="获取章节分块",
    description="获取指定章节的所有已索引分块列表。",
)
async def get_chunks(
    chapter_id: int,
    cm: ContextManager = Depends(get_context_manager),
):
    """List indexed chunks for a chapter."""
    with cm._get_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT chunk_id, chapter_id, scene_index, content,
                   chunk_type, parent_chunk_id, source_file, created_at
            FROM vectors
            WHERE chapter_id = ?
            ORDER BY scene_index, chunk_id
            """,
            (chapter_id,),
        )
        rows = cursor.fetchall()

    chunks = [
        ContextChunkResponse(
            chunk_id=row[0],
            chapter_id=row[1],
            scene_index=row[2],
            content=row[3],
            chunk_type=row[4] or "scene",
            parent_chunk_id=row[5],
            source_file=row[6],
            created_at=row[7],
        )
        for row in rows
    ]

    return ContextChunksResponse(
        chapter_id=chapter_id,
        chunks=chunks,
        total=len(chunks),
    )


@router.delete(
    "/chunks/{chapter_id}",
    summary="删除章节索引",
    description="删除指定章节的所有RAG索引分块。",
)
async def delete_chunks(
    chapter_id: int,
    cm: ContextManager = Depends(get_context_manager),
):
    """Delete all indexed chunks for a chapter."""
    deleted = cm.delete_chapter_chunks(chapter_id)
    return {"chapter_id": chapter_id, "deleted": deleted}


@router.get(
    "/stats",
    response_model=ContextStatsResponse,
    summary="RAG索引统计",
    description="获取RAG向量库的统计信息：向量数、词项数、最大章节ID。",
)
async def get_stats(
    cm: ContextManager = Depends(get_context_manager),
):
    """Get RAG index statistics."""
    stats = cm.get_stats()
    return ContextStatsResponse(
        vectors=stats.get("vectors", 0),
        terms=stats.get("terms", 0),
        max_chapter=stats.get("max_chapter", 0),
    )
