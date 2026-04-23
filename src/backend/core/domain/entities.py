# Auto Novel Writer - SQLAlchemy Models
# Mapped to schema.sql

import sys

# When this file is imported under both 'models.entities' and
# 'backend.models.entities', Python executes it twice.  Reuse the
# already-executed module to prevent SQLAlchemy "table already defined"
# errors.
_ALIASES = ("models.entities", "backend.models.entities", "core.domain.entities", "backend.core.domain.entities")
_SKIP_DEFINITIONS = False
for _alias in _ALIASES:
    if _alias != __name__:
        _existing = sys.modules.get(_alias)
        if _existing is not None:
            # Copy all exported names into this module's namespace so that
            # 'from X.models.entities import Y' still works.
            globals().update({
                k: v for k, v in _existing.__dict__.items()
                if not k.startswith("_")
            })
            _SKIP_DEFINITIONS = True
            break

from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime, ForeignKey, Index
)
from sqlalchemy.orm import relationship

from database import Base


if not _SKIP_DEFINITIONS:
    # ============================================
    # Project & Genre Configuration
    # ============================================

    class Project(Base):
        __tablename__ = "projects"

        id = Column(Integer, primary_key=True, autoincrement=True)
        name = Column(String(255), nullable=False)
        description = Column(Text)
        genre = Column(String(100))
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


    class GenreConfiguration(Base):
        __tablename__ = "genre_configurations"

        id = Column(Integer, primary_key=True, autoincrement=True)
        genre = Column(String(100), nullable=False, unique=True)
        config_json = Column(Text, nullable=False)
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


    # ============================================
    # Background Tasks
    # ============================================

    class BackgroundTask(Base):
        __tablename__ = "background_tasks"

        id = Column(String, primary_key=True)
        type = Column(String, nullable=False)
        status = Column(String, nullable=False, default="pending")
        payload = Column(Text)
        result = Column(Text)
        error = Column(Text)
        retries = Column(Integer, default=0)
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


    # ============================================
    # Characters & Relationships
    # ============================================

    class Character(Base):
        __tablename__ = "characters"

        id = Column(Integer, primary_key=True, autoincrement=True)
        project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
        name = Column(String, nullable=False)
        gender = Column(String)
        personality = Column(Text)
        desires = Column(Text)
        flaws = Column(Text)
        description = Column(Text)
        tier = Column(String)
        cultivation_realm = Column(String)
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

        relationships = relationship(
            "CharacterRelationship",
            foreign_keys="CharacterRelationship.character_id",
            back_populates="character",
            cascade="all, delete-orphan",
        )
        storylines = relationship(
            "CharacterStoryline",
            back_populates="character",
            cascade="all, delete-orphan",
        )


    class CharacterRelationship(Base):
        __tablename__ = "character_relationships"

        id = Column(Integer, primary_key=True, autoincrement=True)
        project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
        character_id = Column(Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
        target_id = Column(Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
        type = Column(String, nullable=False)
        description = Column(Text)

        character = relationship("Character", foreign_keys=[character_id], back_populates="relationships")


    class CharacterStoryline(Base):
        __tablename__ = "character_storylines"

        id = Column(Integer, primary_key=True, autoincrement=True)
        project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
        character_id = Column(Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
        title = Column(String, nullable=False)
        arc = Column(Text)
        progress = Column(Integer, default=0)

        character = relationship("Character", back_populates="storylines")


    # ============================================
    # World Entities
    # ============================================

    class Item(Base):
        __tablename__ = "items"

        id = Column(Integer, primary_key=True, autoincrement=True)
        project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
        name = Column(String, nullable=False)
        description = Column(Text)
        owner = Column(String)
        location = Column(String)
        tags = Column(Text)  # JSON-encoded list of tag strings


    class Location(Base):
        __tablename__ = "locations"

        id = Column(Integer, primary_key=True, autoincrement=True)
        project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
        name = Column(String, nullable=False)
        description = Column(Text)
        importance = Column(String)
        tags = Column(Text)  # JSON-encoded list of tag strings


    class Faction(Base):
        __tablename__ = "factions"

        id = Column(Integer, primary_key=True, autoincrement=True)
        project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
        name = Column(String, nullable=False)
        description = Column(Text)
        type = Column(String)
        tags = Column(Text)  # JSON-encoded list of tag strings


    class WorldSetting(Base):
        __tablename__ = "world_settings"

        id = Column(Integer, primary_key=True, autoincrement=True)
        project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
        name = Column(String, nullable=False)
        description = Column(Text)
        details_json = Column(Text)
        tags = Column(Text)  # JSON-encoded list of tag strings


    class Rule(Base):
        __tablename__ = "rules"

        id = Column(Integer, primary_key=True, autoincrement=True)
        project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
        name = Column(String, nullable=False)
        description = Column(Text)
        type = Column(String)
        tags = Column(Text)  # JSON-encoded list of tag strings


    # ============================================
    # Story Structure
    # ============================================

    class Outline(Base):
        __tablename__ = "outlines"

        id = Column(Integer, primary_key=True, autoincrement=True)
        project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
        title = Column(String, nullable=False)
        description = Column(Text)

        chapters = relationship("Chapter", back_populates="outline")


    class Chapter(Base):
        __tablename__ = "chapters"

        id = Column(Integer, primary_key=True, autoincrement=True)
        project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
        outline_id = Column(Integer, ForeignKey("outlines.id", ondelete="SET NULL"))
        title = Column(String)
        summary = Column(Text)
        status = Column(String, default="pending")
        word_count = Column(Integer, default=0)
        chapter_order = Column(Integer, default=0)
        content_storage_id = Column(String(64), nullable=True)
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

        outline = relationship("Outline", back_populates="chapters")
        draft_versions = relationship("DraftVersion", back_populates="chapter", cascade="all, delete-orphan")
        ai_inspections = relationship("AIInspectionResult", back_populates="chapter", cascade="all, delete-orphan")


    class IFLine(Base):
        __tablename__ = "if_lines"

        id = Column(Integer, primary_key=True, autoincrement=True)
        project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
        title = Column(String, nullable=False)
        linked_character_id = Column(Integer, ForeignKey("characters.id", ondelete="SET NULL"))
        description = Column(Text)
        sync_mode = Column(String, default="auto")
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


    # ============================================
    # Chat / Conversation (Interface 1)
    # ============================================

    class ChatSession(Base):
        __tablename__ = "chat_sessions"

        id = Column(Integer, primary_key=True, autoincrement=True)
        project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
        title = Column(String(255), nullable=True)
        status = Column(String(50), default="active")
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

        messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
        extracted_entities = relationship("ExtractedEntity", back_populates="session", cascade="all, delete-orphan")


    class ChatMessage(Base):
        __tablename__ = "chat_messages"

        id = Column(Integer, primary_key=True, autoincrement=True)
        project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
        session_id = Column(Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
        role = Column(String, nullable=False)
        content = Column(Text, nullable=False)
        created_at = Column(DateTime, default=datetime.utcnow)

        session = relationship("ChatSession", back_populates="messages")


    class ExtractedEntity(Base):
        __tablename__ = "extracted_entities"

        id = Column(Integer, primary_key=True, autoincrement=True)
        project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
        session_id = Column(Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
        type = Column(String, nullable=False)
        name = Column(String, nullable=False)
        description = Column(Text)
        confirmed = Column(Integer, default=0)
        created_at = Column(DateTime, default=datetime.utcnow)

        session = relationship("ChatSession", back_populates="extracted_entities")


    # ============================================
    # Writing & Versioning (Interface 3)
    # ============================================

    class DraftVersion(Base):
        __tablename__ = "draft_versions"

        id = Column(Integer, primary_key=True, autoincrement=True)
        project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
        chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
        content = Column(Text, nullable=False)
        content_storage_id = Column(String(64), nullable=True)
        version_number = Column(Integer, nullable=False)
        created_at = Column(DateTime, default=datetime.utcnow)

        chapter = relationship("Chapter", back_populates="draft_versions")


    class PlotThread(Base):
        __tablename__ = "plot_threads"

        id = Column(Integer, primary_key=True, autoincrement=True)
        project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
        title = Column(String, nullable=False)
        description = Column(Text)
        status = Column(String, default="active")
        created_chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"))
        reveal_chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"))
        created_at = Column(DateTime, default=datetime.utcnow)


    class AIInspectionResult(Base):
        __tablename__ = "ai_inspection_results"

        id = Column(Integer, primary_key=True, autoincrement=True)
        project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
        chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
        inspection_type = Column(String, nullable=False)
        issues_json = Column(Text)
        suggestions_json = Column(Text)
        auto_fixed = Column(Integer, default=0)
        created_at = Column(DateTime, default=datetime.utcnow)

        chapter = relationship("Chapter", back_populates="ai_inspections")


    class WritingSettings(Base):
        __tablename__ = "writing_settings"

        id = Column(Integer, primary_key=True, autoincrement=True)
        project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
        human_ai_ratio = Column(Float, default=0.5)
        writing_style = Column(String, default="default")
        target_word_count = Column(Integer, default=3000)
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


    # ============================================
    # Workflow Execution Tracking
    # ============================================

    class WorkflowExecution(Base):
        __tablename__ = "workflow_executions"

        id = Column(Integer, primary_key=True, autoincrement=True)
        workflow_name = Column(String, nullable=False)
        status = Column(String, default="pending")
        started_at = Column(DateTime, default=datetime.utcnow)
        completed_at = Column(DateTime, nullable=True)
        results_json = Column(Text, nullable=True)
        error_message = Column(Text, nullable=True)

        agent_logs = relationship(
            "AgentExecutionLog",
            back_populates="workflow_execution",
            cascade="all, delete-orphan",
        )


    class AgentExecutionLog(Base):
        __tablename__ = "agent_execution_logs"

        id = Column(Integer, primary_key=True, autoincrement=True)
        workflow_execution_id = Column(
            Integer,
            ForeignKey("workflow_executions.id", ondelete="CASCADE"),
            nullable=False,
        )
        agent_name = Column(String, nullable=False)
        stage_name = Column(String, nullable=False)
        status = Column(String, default="pending")
        result_json = Column(Text, nullable=True)
        started_at = Column(DateTime, default=datetime.utcnow)
        completed_at = Column(DateTime, nullable=True)

        workflow_execution = relationship("WorkflowExecution", back_populates="agent_logs")
