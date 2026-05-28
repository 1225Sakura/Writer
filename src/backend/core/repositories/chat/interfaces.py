# Auto Novel Writer - Chat Repository Interface
# Abstract interfaces for ChatSession and ChatMessage persistence operations

from abc import ABC, abstractmethod
from typing import Optional, List

from backend.core.domain.entities import ChatSession, ChatMessage, ExtractedEntity


class ChatSessionRepositoryInterface(ABC):
    """Abstract interface for ChatSession repository operations."""

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[ChatSession]:
        """Fetch a chat session by primary key."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> ChatSession:
        """Create and persist a new chat session."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[ChatSession]:
        """Update a chat session by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete a chat session by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def list(self, skip: int = 0, limit: int = 20, **filters) -> List[ChatSession]:
        """List chat sessions with optional pagination and filters."""
        ...

    @abstractmethod
    async def get_with_messages(self, id: int) -> Optional[ChatSession]:
        """Fetch a chat session with messages eagerly loaded."""
        ...


class ChatMessageRepositoryInterface(ABC):
    """Abstract interface for ChatMessage repository operations."""

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[ChatMessage]:
        """Fetch a chat message by primary key."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> ChatMessage:
        """Create and persist a new chat message."""
        ...

    @abstractmethod
    async def get_by_session(self, session_id: int, skip: int = 0, limit: int = 100) -> List[ChatMessage]:
        """Fetch messages for a session, ordered by creation time (oldest first)."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[ChatMessage]:
        """Update a chat message by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete a chat message by primary key. Returns True if deleted."""
        ...


class ExtractedEntityRepositoryInterface(ABC):
    """Abstract interface for ExtractedEntity repository operations."""

    @abstractmethod
    async def create(self, data: dict) -> ExtractedEntity:
        """Create and persist a new extracted entity."""
        ...

    @abstractmethod
    async def get_by_session(self, session_id: int, **filters) -> List[ExtractedEntity]:
        """Fetch extracted entities for a session with optional filters."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[ExtractedEntity]:
        """Update an extracted entity by primary key."""
        ...
