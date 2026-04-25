# Auto Novel Writer - Wiki Service
# Layer 3: LLM Wiki - Persistent markdown knowledge base for novel world building

import logging
from datetime import datetime
from typing import Optional, List, Any

from sqlalchemy import select, text, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.database import Base
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship

logger = logging.getLogger(__name__)


# ============================================================================
# SQLAlchemy Models
# ============================================================================

class WikiPage(Base):
    """Wiki page entity for storing world-building content."""
    __tablename__ = "wiki_pages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
    entity_type = Column(String(50), nullable=True)  # character, location, item, faction, world_setting
    entity_id = Column(Integer, nullable=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False, default="")
    version = Column(Integer, default=1)
    is_draft = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    versions = relationship(
        "WikiVersion",
        back_populates="page",
        cascade="all, delete-orphan",
        order_by="WikiVersion.version.desc()"
    )
    entity_links = relationship(
        "WikiEntityLink",
        back_populates="wiki_page",
        cascade="all, delete-orphan"
    )


class WikiVersion(Base):
    """Version history for wiki pages."""
    __tablename__ = "wiki_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    page_id = Column(Integer, ForeignKey("wiki_pages.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    change_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    page = relationship("WikiPage", back_populates="versions")


class WikiEntityLink(Base):
    """Bidirectional links between wiki pages and entities."""
    __tablename__ = "wiki_entity_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    wiki_page_id = Column(Integer, ForeignKey("wiki_pages.id", ondelete="CASCADE"), nullable=False)
    linked_entity_type = Column(String(50), nullable=False)  # character, location, item, faction, world_setting
    linked_entity_id = Column(Integer, nullable=False)
    link_type = Column(String(50), nullable=False)  # documents, references, extends

    wiki_page = relationship("WikiPage", back_populates="entity_links")


# ============================================================================
# Service Class
# ============================================================================

class WikiService:
    """Service for wiki page CRUD operations with version history and FTS."""

    def __init__(self, db: AsyncSession):
        """Initialize WikiService with database session."""
        self.db = db

    # ------------------------------------------------------------------------
    # CRUD Operations
    # ------------------------------------------------------------------------

    async def create_page(
        self,
        project_id: Optional[int],
        title: str,
        content: str = "",
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        is_draft: bool = False,
    ) -> WikiPage:
        """Create a new wiki page with initial version."""
        page = WikiPage(
            project_id=project_id,
            title=title,
            content=content,
            entity_type=entity_type,
            entity_id=entity_id,
            is_draft=1 if is_draft else 0,
            version=1,
        )
        self.db.add(page)
        await self.db.flush()
        await self.db.refresh(page)

        # Create initial version
        initial_version = WikiVersion(
            page_id=page.id,
            version=1,
            content=content,
            change_summary="Initial version",
        )
        self.db.add(initial_version)
        await self.db.flush()

        logger.info(f"Created wiki page: {page.id} - {title}")
        return page

    async def get_page(self, page_id: int) -> Optional[WikiPage]:
        """Get a wiki page by ID with relations loaded."""
        result = await self.db.execute(
            select(WikiPage)
            .options(selectinload(WikiPage.versions), selectinload(WikiPage.entity_links))
            .where(WikiPage.id == page_id)
        )
        return result.scalar_one_or_none()

    async def get_page_by_entity(
        self,
        entity_type: str,
        entity_id: int,
    ) -> Optional[WikiPage]:
        """Get the wiki page associated with a specific entity."""
        result = await self.db.execute(
            select(WikiPage)
            .options(selectinload(WikiPage.versions), selectinload(WikiPage.entity_links))
            .where(
                and_(
                    WikiPage.entity_type == entity_type,
                    WikiPage.entity_id == entity_id,
                    WikiPage.is_draft == 0
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_pages(
        self,
        project_id: Optional[int] = None,
        entity_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
        include_drafts: bool = False,
    ) -> List[WikiPage]:
        """List wiki pages with optional filtering."""
        query = select(WikiPage).options(
            selectinload(WikiPage.versions),
            selectinload(WikiPage.entity_links)
        )

        conditions = []
        if project_id is not None:
            conditions.append(WikiPage.project_id == project_id)
        if entity_type:
            conditions.append(WikiPage.entity_type == entity_type)
        if not include_drafts:
            conditions.append(WikiPage.is_draft == 0)

        if conditions:
            query = query.where(and_(*conditions))

        query = query.order_by(WikiPage.updated_at.desc()).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_page(
        self,
        page_id: int,
        title: Optional[str] = None,
        content: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        is_draft: Optional[bool] = None,
        change_summary: Optional[str] = None,
    ) -> Optional[WikiPage]:
        """Update a wiki page and create a new version."""
        page = await self.get_page(page_id)
        if not page:
            return None

        # Update fields
        if title is not None:
            page.title = title
        if entity_type is not None:
            page.entity_type = entity_type
        if entity_id is not None:
            page.entity_id = entity_id
        if is_draft is not None:
            page.is_draft = 1 if is_draft else 0

        # Create new version if content changed
        if content is not None and content != page.content:
            page.version += 1
            page.content = content

            version = WikiVersion(
                page_id=page.id,
                version=page.version,
                content=content,
                change_summary=change_summary or f"Updated to version {page.version}",
            )
            self.db.add(version)

        page.updated_at = datetime.utcnow()
        await self.db.flush()
        await self.db.refresh(page)

        logger.info(f"Updated wiki page: {page_id} to version {page.version}")
        return page

    async def delete_page(self, page_id: int) -> bool:
        """Delete a wiki page and its versions."""
        page = await self.get_page(page_id)
        if not page:
            return False

        await self.db.delete(page)
        await self.db.flush()
        logger.info(f"Deleted wiki page: {page_id}")
        return True

    # ------------------------------------------------------------------------
    # Version History
    # ------------------------------------------------------------------------

    async def get_versions(self, page_id: int, skip: int = 0, limit: int = 20) -> List[WikiVersion]:
        """Get version history for a wiki page."""
        result = await self.db.execute(
            select(WikiVersion)
            .where(WikiVersion.page_id == page_id)
            .order_by(WikiVersion.version.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_version(self, page_id: int, version: int) -> Optional[WikiVersion]:
        """Get a specific version of a wiki page."""
        result = await self.db.execute(
            select(WikiVersion)
            .where(and_(WikiVersion.page_id == page_id, WikiVersion.version == version))
        )
        return result.scalar_one_or_none()

    async def revert_to_version(self, page_id: int, version: int) -> Optional[WikiPage]:
        """Revert wiki page to a specific version."""
        old_version = await self.get_version(page_id, version)
        if not old_version:
            return None

        return await self.update_page(
            page_id=page_id,
            content=old_version.content,
            change_summary=f"Reverted to version {version}",
        )

    # ------------------------------------------------------------------------
    # Entity Links
    # ------------------------------------------------------------------------

    async def add_entity_link(
        self,
        wiki_page_id: int,
        linked_entity_type: str,
        linked_entity_id: int,
        link_type: str = "references",
    ) -> Optional[WikiEntityLink]:
        """Add a link between wiki page and entity."""
        page = await self.get_page(wiki_page_id)
        if not page:
            return None

        link = WikiEntityLink(
            wiki_page_id=wiki_page_id,
            linked_entity_type=linked_entity_type,
            linked_entity_id=linked_entity_id,
            link_type=link_type,
        )
        self.db.add(link)
        await self.db.flush()
        await self.db.refresh(link)

        logger.info(f"Added entity link: page={wiki_page_id}, {linked_entity_type}:{linked_entity_id}")
        return link

    async def remove_entity_link(self, link_id: int) -> bool:
        """Remove an entity link."""
        result = await self.db.execute(
            select(WikiEntityLink).where(WikiEntityLink.id == link_id)
        )
        link = result.scalar_one_or_none()
        if not link:
            return False

        await self.db.delete(link)
        await self.db.flush()
        return True

    async def get_pages_by_entity(
        self,
        entity_type: str,
        entity_id: int,
    ) -> List[WikiPage]:
        """Get all wiki pages linked to a specific entity."""
        result = await self.db.execute(
            select(WikiPage)
            .join(WikiEntityLink, WikiEntityLink.wiki_page_id == WikiPage.id)
            .where(
                and_(
                    WikiEntityLink.linked_entity_type == entity_type,
                    WikiEntityLink.linked_entity_id == entity_id,
                )
            )
        )
        return list(result.scalars().all())

    # ------------------------------------------------------------------------
    # Full-Text Search (FTS5)
    # ------------------------------------------------------------------------

    async def search_pages(
        self,
        query: str,
        project_id: Optional[int] = None,
        entity_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> List[dict]:
        """Search wiki pages using SQLite FTS5."""
        # Use FTS5 search if available, fallback to LIKE search
        fts_query = self._build_fts_query(query)

        if fts_query:
            return await self._fts_search(
                fts_query, project_id=project_id, entity_type=entity_type, skip=skip, limit=limit
            )
        else:
            return await self._like_search(
                query, project_id=project_id, entity_type=entity_type, skip=skip, limit=limit
            )

    def _build_fts_query(self, query: str) -> Optional[str]:
        """Build FTS5 query from user input."""
        if not query or len(query) < 2:
            return None

        # Escape special FTS5 characters and prepare for prefix matching
        special_chars = ['"', "'", "*", "(", ")", ":", "^", "-", "+"]
        escaped = query
        for char in special_chars:
            escaped = escaped.replace(char, " ")

        # Split into words and add prefix matching
        words = escaped.split()
        if not words:
            return None

        # Build prefix query for each word
        prefix_terms = [f"{word}*" for word in words if len(word) >= 2]
        if prefix_terms:
            return " ".join(prefix_terms)
        return None

    async def _fts_search(
        self,
        fts_query: str,
        project_id: Optional[int],
        entity_type: Optional[str],
        skip: int,
        limit: int,
    ) -> List[dict]:
        """Execute FTS5 search."""
        # Check if FTS5 virtual table exists
        fts_table_exists = await self._check_fts_table()

        if not fts_table_exists:
            # Create FTS5 virtual table if it doesn't exist
            await self._create_fts_table()
            # Populate FTS table
            await self._populate_fts_table()

        # Build and execute FTS query
        sql = """
            SELECT w.id, w.project_id, w.entity_type, w.entity_id, w.title, w.content,
                   w.version, w.is_draft, w.created_at, w.updated_at,
                   bm25(wiki_pages_fts) as rank
            FROM wiki_pages_fts
            JOIN wiki_pages w ON wiki_pages_fts.rowid = w.id
            WHERE wiki_pages_fts MATCH :query
        """

        params = {"query": fts_query}

        if project_id is not None:
            sql += " AND w.project_id = :project_id"
            params["project_id"] = project_id

        if entity_type:
            sql += " AND w.entity_type = :entity_type"
            params["entity_type"] = entity_type

        sql += " ORDER BY rank LIMIT :limit OFFSET :skip"
        params["limit"] = limit
        params["skip"] = skip

        result = await self.db.execute(text(sql), params)
        rows = result.fetchall()

        return [self._row_to_dict(row) for row in rows]

    async def _like_search(
        self,
        query: str,
        project_id: Optional[int],
        entity_type: Optional[str],
        skip: int,
        limit: int,
    ) -> List[dict]:
        """Fallback LIKE search."""
        search_pattern = f"%{query}%"

        sql = select(WikiPage)
        conditions = [
            or_(
                WikiPage.title.ilike(search_pattern),
                WikiPage.content.ilike(search_pattern),
            )
        ]

        if project_id is not None:
            conditions.append(WikiPage.project_id == project_id)
        if entity_type:
            conditions.append(WikiPage.entity_type == entity_type)

        sql = sql.where(and_(*conditions))
        sql = sql.order_by(WikiPage.updated_at.desc()).offset(skip).limit(limit)

        result = await self.db.execute(sql)
        pages = result.scalars().all()

        return [
            {
                "id": p.id,
                "project_id": p.project_id,
                "entity_type": p.entity_type,
                "entity_id": p.entity_id,
                "title": p.title,
                "content": p.content,
                "version": p.version,
                "is_draft": bool(p.is_draft),
                "created_at": p.created_at,
                "updated_at": p.updated_at,
                "rank": 0,
            }
            for p in pages
        ]

    async def _check_fts_table(self) -> bool:
        """Check if FTS5 virtual table exists."""
        result = await self.db.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='wiki_pages_fts'")
        )
        return result.scalar_one_or_none() is not None

    async def _create_fts_table(self) -> None:
        """Create FTS5 virtual table for wiki pages."""
        await self.db.execute(text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS wiki_pages_fts USING fts5(
                title,
                content,
                content='wiki_pages',
                content_rowid='id'
            )
        """))
        await self.db.flush()

    async def _populate_fts_table(self) -> None:
        """Populate FTS table with existing wiki pages."""
        await self.db.execute(text("""
            INSERT INTO wiki_pages_fts(rowid, title, content)
            SELECT id, title, content FROM wiki_pages
        """))
        await self.db.flush()

    async def rebuild_fts_index(self) -> int:
        """Rebuild the FTS index. Returns number of pages indexed."""
        if await self._check_fts_table():
            await self.db.execute(text("DROP TABLE IF EXISTS wiki_pages_fts"))

        await self._create_fts_table()
        await self._populate_fts_table()

        result = await self.db.execute(text("SELECT COUNT(*) FROM wiki_pages"))
        count = result.scalar_one_or_none() or 0
        logger.info(f"Rebuilt FTS index with {count} pages")
        return count

    def _row_to_dict(self, row) -> dict:
        """Convert SQL row to dictionary."""
        return {
            "id": row.id,
            "project_id": row.project_id,
            "entity_type": row.entity_type,
            "entity_id": row.entity_id,
            "title": row.title,
            "content": row.content,
            "version": row.version,
            "is_draft": bool(row.is_draft),
            "created_at": row.created_at,
            "updated_at": row.updated_at,
            "rank": row.rank,
        }
