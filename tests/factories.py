"""
Simple factory functions for creating test data.

No external dependencies (factory-boy, etc.) — just plain Python functions
that return SQLAlchemy model instances ready to be added to a session.
"""

from datetime import datetime
from typing import Optional

from backend.core.domain.entities import (
    Character,
    CharacterRelationship,
    CharacterStoryline,
    Chapter,
    ChatMessage,
    ChatSession,
    DraftVersion,
    ExtractedEntity,
    Faction,
    IFLine,
    Item,
    Location,
    Outline,
    PlotThread,
    Rule,
    WorldSetting,
    WritingSettings,
)


# ---------------------------------------------------------------------------
# Character factories
# ---------------------------------------------------------------------------

def CharacterFactory(
    *,
    name: str = "测试角色",
    gender: Optional[str] = "male",
    personality: Optional[str] = "冷静沉稳",
    desires: Optional[str] = "追求长生",
    flaws: Optional[str] = "过于自负",
    description: Optional[str] = "这是一个测试角色",
    tier: Optional[str] = "核心",
    cultivation_realm: Optional[str] = "筑基期",
    **kwargs,
) -> Character:
    """Create a Character instance."""
    return Character(
        name=name,
        gender=gender,
        personality=personality,
        desires=desires,
        flaws=flaws,
        description=description,
        tier=tier,
        cultivation_realm=cultivation_realm,
        **kwargs,
    )


def CharacterRelationshipFactory(
    *,
    character_id: int,
    target_id: int,
    type: str = "friend",
    description: Optional[str] = "好友关系",
    **kwargs,
) -> CharacterRelationship:
    """Create a CharacterRelationship instance."""
    return CharacterRelationship(
        character_id=character_id,
        target_id=target_id,
        type=type,
        description=description,
        **kwargs,
    )


def CharacterStorylineFactory(
    *,
    character_id: int,
    title: str = "角色故事线",
    arc: Optional[str] = "从凡人到仙人的成长之路",
    progress: int = 0,
    **kwargs,
) -> CharacterStoryline:
    """Create a CharacterStoryline instance."""
    return CharacterStoryline(
        character_id=character_id,
        title=title,
        arc=arc,
        progress=progress,
        **kwargs,
    )


# ---------------------------------------------------------------------------
# World entity factories
# ---------------------------------------------------------------------------

def ItemFactory(
    *,
    name: str = "测试物品",
    description: Optional[str] = "一件普通的测试物品",
    owner: Optional[str] = "测试角色",
    location: Optional[str] = "青云山",
    **kwargs,
) -> Item:
    """Create an Item instance."""
    return Item(
        name=name,
        description=description,
        owner=owner,
        location=location,
        **kwargs,
    )


def LocationFactory(
    *,
    name: str = "测试地点",
    description: Optional[str] = "一个风景秀丽的测试地点",
    importance: Optional[str] = "重要",
    **kwargs,
) -> Location:
    """Create a Location instance."""
    return Location(
        name=name,
        description=description,
        importance=importance,
        **kwargs,
    )


def FactionFactory(
    *,
    name: str = "测试势力",
    description: Optional[str] = "一个强大的测试势力",
    type: Optional[str] = "正派",
    **kwargs,
) -> Faction:
    """Create a Faction instance."""
    return Faction(
        name=name,
        description=description,
        type=type,
        **kwargs,
    )


def WorldSettingFactory(
    *,
    name: str = "测试世界观",
    description: Optional[str] = "这是一个测试用的世界观设定",
    details_json: Optional[str] = None,
    **kwargs,
) -> WorldSetting:
    """Create a WorldSetting instance."""
    return WorldSetting(
        name=name,
        description=description,
        details_json=details_json or '{"era": "古代", "magic_system": "修仙"}',
        **kwargs,
    )


def RuleFactory(
    *,
    name: str = "测试规则",
    description: Optional[str] = "这是一条测试规则",
    type: Optional[str] = "修炼规则",
    **kwargs,
) -> Rule:
    """Create a Rule instance."""
    return Rule(
        name=name,
        description=description,
        type=type,
        **kwargs,
    )


# ---------------------------------------------------------------------------
# Story structure factories
# ---------------------------------------------------------------------------

def OutlineFactory(
    *,
    title: str = "测试大纲",
    description: Optional[str] = "这是一个测试大纲",
    **kwargs,
) -> Outline:
    """Create an Outline instance."""
    return Outline(
        title=title,
        description=description,
        **kwargs,
    )


def ChapterFactory(
    *,
    outline_id: Optional[int] = None,
    title: Optional[str] = "第一章 测试",
    summary: Optional[str] = "本章讲述测试内容",
    status: str = "pending",
    word_count: int = 0,
    chapter_order: int = 1,
    **kwargs,
) -> Chapter:
    """Create a Chapter instance."""
    return Chapter(
        outline_id=outline_id,
        title=title,
        summary=summary,
        status=status,
        word_count=word_count,
        chapter_order=chapter_order,
        **kwargs,
    )


def IFLineFactory(
    *,
    title: str = "测试IF线",
    linked_character_id: Optional[int] = None,
    description: Optional[str] = "这是一条测试IF线",
    sync_mode: str = "auto",
    **kwargs,
) -> IFLine:
    """Create an IFLine instance."""
    return IFLine(
        title=title,
        linked_character_id=linked_character_id,
        description=description,
        sync_mode=sync_mode,
        **kwargs,
    )


# ---------------------------------------------------------------------------
# Chat / Conversation factories
# ---------------------------------------------------------------------------

def ChatSessionFactory(**kwargs) -> ChatSession:
    """Create a ChatSession instance."""
    return ChatSession(**kwargs)


def ChatMessageFactory(
    *,
    session_id: int,
    role: str = "user",
    content: str = "这是一条测试消息",
    **kwargs,
) -> ChatMessage:
    """Create a ChatMessage instance."""
    return ChatMessage(
        session_id=session_id,
        role=role,
        content=content,
        **kwargs,
    )


def ExtractedEntityFactory(
    *,
    session_id: int,
    type: str = "character",
    name: str = "提取的角色",
    description: Optional[str] = "从聊天中提取的实体",
    confirmed: int = 0,
    **kwargs,
) -> ExtractedEntity:
    """Create an ExtractedEntity instance."""
    return ExtractedEntity(
        session_id=session_id,
        type=type,
        name=name,
        description=description,
        confirmed=confirmed,
        **kwargs,
    )


# ---------------------------------------------------------------------------
# Writing & Versioning factories
# ---------------------------------------------------------------------------

def DraftVersionFactory(
    *,
    chapter_id: int,
    content: str = "这是测试草稿内容。",
    version_number: int = 1,
    **kwargs,
) -> DraftVersion:
    """Create a DraftVersion instance."""
    return DraftVersion(
        chapter_id=chapter_id,
        content=content,
        version_number=version_number,
        **kwargs,
    )


def PlotThreadFactory(
    *,
    title: str = "测试伏笔",
    description: Optional[str] = "这是一条测试伏笔线索",
    status: str = "active",
    created_chapter_id: Optional[int] = None,
    reveal_chapter_id: Optional[int] = None,
    **kwargs,
) -> PlotThread:
    """Create a PlotThread instance."""
    return PlotThread(
        title=title,
        description=description,
        status=status,
        created_chapter_id=created_chapter_id,
        reveal_chapter_id=reveal_chapter_id,
        **kwargs,
    )


def WritingSettingsFactory(
    *,
    human_ai_ratio: float = 0.5,
    writing_style: str = "default",
    target_word_count: int = 3000,
    **kwargs,
) -> WritingSettings:
    """Create a WritingSettings instance."""
    return WritingSettings(
        human_ai_ratio=human_ai_ratio,
        writing_style=writing_style,
        target_word_count=target_word_count,
        **kwargs,
    )
