"""Unit tests for SQLAlchemy model definitions.

Verifies table names, column definitions, and relationships
without requiring a database connection.
"""

import pytest
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship

from backend.core.domain.entities import (
    Character,
    CharacterRelationship,
    CharacterStoryline,
    Item,
    Location,
    Faction,
    WorldSetting,
    Rule,
    Outline,
    Chapter,
    IFLine,
    ChatSession,
    ChatMessage,
    ExtractedEntity,
    DraftVersion,
    PlotThread,
    AIInspectionResult,
    WritingSettings,
)


# ============================================
# Character Model
# ============================================

class TestCharacterModel:
    """Tests for Character SQLAlchemy model."""

    def test_table_name(self):
        """Has correct table name."""
        assert Character.__tablename__ == "characters"

    def test_has_id_column(self):
        """Has id primary key column."""
        assert hasattr(Character, "id")
        assert isinstance(Character.id.property.columns[0], Column)
        assert Character.id.property.columns[0].primary_key is True

    def test_has_name_column(self):
        """Has name column that is non-nullable."""
        assert hasattr(Character, "name")
        col = Character.name.property.columns[0]
        assert isinstance(col, Column)
        assert col.nullable is False

    def test_has_optional_columns(self):
        """Has optional string/text columns."""
        for attr in ("gender", "personality", "desires", "flaws",
                     "description", "tier", "cultivation_realm"):
            assert hasattr(Character, attr)

    def test_has_timestamp_columns(self):
        """Has created_at and updated_at columns."""
        assert hasattr(Character, "created_at")
        assert hasattr(Character, "updated_at")

    def test_has_relationships_attribute(self):
        """Has relationships back-reference."""
        assert hasattr(Character, "relationships")

    def test_has_storylines_attribute(self):
        """Has storylines back-reference."""
        assert hasattr(Character, "storylines")


# ============================================
# CharacterRelationship Model
# ============================================

class TestCharacterRelationshipModel:
    """Tests for CharacterRelationship SQLAlchemy model."""

    def test_table_name(self):
        """Has correct table name."""
        assert CharacterRelationship.__tablename__ == "character_relationships"

    def test_has_required_foreign_keys(self):
        """Has character_id and target_id foreign keys."""
        assert hasattr(CharacterRelationship, "character_id")
        assert hasattr(CharacterRelationship, "target_id")
        col = CharacterRelationship.character_id.property.columns[0]
        assert col.nullable is False

    def test_has_type_column(self):
        """Has non-nullable type column."""
        assert hasattr(CharacterRelationship, "type")
        col = CharacterRelationship.type.property.columns[0]
        assert col.nullable is False

    def test_has_character_relationship(self):
        """Has character relationship."""
        assert hasattr(CharacterRelationship, "character")


# ============================================
# CharacterStoryline Model
# ============================================

class TestCharacterStorylineModel:
    """Tests for CharacterStoryline SQLAlchemy model."""

    def test_table_name(self):
        """Has correct table name."""
        assert CharacterStoryline.__tablename__ == "character_storylines"

    def test_has_character_id_foreign_key(self):
        """Has character_id foreign key."""
        assert hasattr(CharacterStoryline, "character_id")

    def test_has_title_column(self):
        """Has non-nullable title column."""
        assert hasattr(CharacterStoryline, "title")
        col = CharacterStoryline.title.property.columns[0]
        assert col.nullable is False

    def test_has_progress_with_default(self):
        """Has progress column with default 0."""
        assert hasattr(CharacterStoryline, "progress")
        col = CharacterStoryline.progress.property.columns[0]
        assert col.default.arg == 0

    def test_has_character_relationship(self):
        """Has character relationship."""
        assert hasattr(CharacterStoryline, "character")


# ============================================
# Item Model
# ============================================

class TestItemModel:
    """Tests for Item SQLAlchemy model."""

    def test_table_name(self):
        """Has correct table name."""
        assert Item.__tablename__ == "items"

    def test_has_name_column(self):
        """Has non-nullable name column."""
        assert hasattr(Item, "name")
        col = Item.name.property.columns[0]
        assert col.nullable is False

    def test_has_optional_columns(self):
        """Has optional description, owner, location columns."""
        for attr in ("description", "owner", "location"):
            assert hasattr(Item, attr)


# ============================================
# Location Model
# ============================================

class TestLocationModel:
    """Tests for Location SQLAlchemy model."""

    def test_table_name(self):
        """Has correct table name."""
        assert Location.__tablename__ == "locations"

    def test_has_name_column(self):
        """Has non-nullable name column."""
        assert hasattr(Location, "name")
        col = Location.name.property.columns[0]
        assert col.nullable is False

    def test_has_optional_columns(self):
        """Has optional description and importance columns."""
        for attr in ("description", "importance"):
            assert hasattr(Location, attr)


# ============================================
# Faction Model
# ============================================

class TestFactionModel:
    """Tests for Faction SQLAlchemy model."""

    def test_table_name(self):
        """Has correct table name."""
        assert Faction.__tablename__ == "factions"

    def test_has_name_column(self):
        """Has non-nullable name column."""
        assert hasattr(Faction, "name")
        col = Faction.name.property.columns[0]
        assert col.nullable is False

    def test_has_optional_columns(self):
        """Has optional description and type columns."""
        for attr in ("description", "type"):
            assert hasattr(Faction, attr)


# ============================================
# WorldSetting Model
# ============================================

class TestWorldSettingModel:
    """Tests for WorldSetting SQLAlchemy model."""

    def test_table_name(self):
        """Has correct table name."""
        assert WorldSetting.__tablename__ == "world_settings"

    def test_has_name_column(self):
        """Has non-nullable name column."""
        assert hasattr(WorldSetting, "name")
        col = WorldSetting.name.property.columns[0]
        assert col.nullable is False

    def test_has_description_column(self):
        """Has optional description column."""
        assert hasattr(WorldSetting, "description")

    def test_has_details_json_column(self):
        """Has optional details_json column."""
        assert hasattr(WorldSetting, "details_json")


# ============================================
# Rule Model
# ============================================

class TestRuleModel:
    """Tests for Rule SQLAlchemy model."""

    def test_table_name(self):
        """Has correct table name."""
        assert Rule.__tablename__ == "rules"

    def test_has_name_column(self):
        """Has non-nullable name column."""
        assert hasattr(Rule, "name")
        col = Rule.name.property.columns[0]
        assert col.nullable is False

    def test_has_optional_columns(self):
        """Has optional description and type columns."""
        for attr in ("description", "type"):
            assert hasattr(Rule, attr)


# ============================================
# Outline Model
# ============================================

class TestOutlineModel:
    """Tests for Outline SQLAlchemy model."""

    def test_table_name(self):
        """Has correct table name."""
        assert Outline.__tablename__ == "outlines"

    def test_has_name_column(self):
        """Has non-nullable title column."""
        assert hasattr(Outline, "title")
        col = Outline.title.property.columns[0]
        assert col.nullable is False

    def test_has_description_column(self):
        """Has optional description column."""
        assert hasattr(Outline, "description")

    def test_has_chapters_relationship(self):
        """Has chapters relationship."""
        assert hasattr(Outline, "chapters")


# ============================================
# Chapter Model
# ============================================

class TestChapterModel:
    """Tests for Chapter SQLAlchemy model."""

    def test_table_name(self):
        """Has correct table name."""
        assert Chapter.__tablename__ == "chapters"

    def test_has_outline_id_foreign_key(self):
        """Has outline_id foreign key with SET NULL."""
        assert hasattr(Chapter, "outline_id")
        col = Chapter.outline_id.property.columns[0]
        assert col.nullable is True

    def test_has_status_with_default(self):
        """Has status column with default 'pending'."""
        assert hasattr(Chapter, "status")
        col = Chapter.status.property.columns[0]
        assert col.default.arg == "pending"

    def test_has_word_count_with_default(self):
        """Has word_count column with default 0."""
        assert hasattr(Chapter, "word_count")
        col = Chapter.word_count.property.columns[0]
        assert col.default.arg == 0

    def test_has_chapter_order_with_default(self):
        """Has chapter_order column with default 0."""
        assert hasattr(Chapter, "chapter_order")
        col = Chapter.chapter_order.property.columns[0]
        assert col.default.arg == 0

    def test_has_timestamp_columns(self):
        """Has created_at and updated_at columns."""
        assert hasattr(Chapter, "created_at")
        assert hasattr(Chapter, "updated_at")

    def test_has_outline_relationship(self):
        """Has outline relationship."""
        assert hasattr(Chapter, "outline")

    def test_has_draft_versions_relationship(self):
        """Has draft_versions relationship with cascade delete."""
        assert hasattr(Chapter, "draft_versions")

    def test_has_ai_inspections_relationship(self):
        """Has ai_inspections relationship with cascade delete."""
        assert hasattr(Chapter, "ai_inspections")


# ============================================
# IFLine Model
# ============================================

class TestIFLineModel:
    """Tests for IFLine SQLAlchemy model."""

    def test_table_name(self):
        """Has correct table name."""
        assert IFLine.__tablename__ == "if_lines"

    def test_has_title_column(self):
        """Has non-nullable title column."""
        assert hasattr(IFLine, "title")
        col = IFLine.title.property.columns[0]
        assert col.nullable is False

    def test_has_linked_character_id(self):
        """Has optional linked_character_id foreign key."""
        assert hasattr(IFLine, "linked_character_id")
        col = IFLine.linked_character_id.property.columns[0]
        assert col.nullable is True

    def test_has_sync_mode_with_default(self):
        """Has sync_mode column with default 'auto'."""
        assert hasattr(IFLine, "sync_mode")
        col = IFLine.sync_mode.property.columns[0]
        assert col.default.arg == "auto"

    def test_has_timestamp_columns(self):
        """Has created_at and updated_at columns."""
        assert hasattr(IFLine, "created_at")
        assert hasattr(IFLine, "updated_at")


# ============================================
# ChatSession Model
# ============================================

class TestChatSessionModel:
    """Tests for ChatSession SQLAlchemy model."""

    def test_table_name(self):
        """Has correct table name."""
        assert ChatSession.__tablename__ == "chat_sessions"

    def test_has_timestamp_columns(self):
        """Has created_at and updated_at columns."""
        assert hasattr(ChatSession, "created_at")
        assert hasattr(ChatSession, "updated_at")

    def test_has_messages_relationship(self):
        """Has messages relationship with cascade delete."""
        assert hasattr(ChatSession, "messages")

    def test_has_extracted_entities_relationship(self):
        """Has extracted_entities relationship with cascade delete."""
        assert hasattr(ChatSession, "extracted_entities")


# ============================================
# ChatMessage Model
# ============================================

class TestChatMessageModel:
    """Tests for ChatMessage SQLAlchemy model."""

    def test_table_name(self):
        """Has correct table name."""
        assert ChatMessage.__tablename__ == "chat_messages"

    def test_has_session_id_foreign_key(self):
        """Has non-nullable session_id foreign key."""
        assert hasattr(ChatMessage, "session_id")
        col = ChatMessage.session_id.property.columns[0]
        assert col.nullable is False

    def test_has_role_column(self):
        """Has non-nullable role column."""
        assert hasattr(ChatMessage, "role")
        col = ChatMessage.role.property.columns[0]
        assert col.nullable is False

    def test_has_content_column(self):
        """Has non-nullable content column."""
        assert hasattr(ChatMessage, "content")
        col = ChatMessage.content.property.columns[0]
        assert col.nullable is False

    def test_has_session_relationship(self):
        """Has session relationship."""
        assert hasattr(ChatMessage, "session")


# ============================================
# ExtractedEntity Model
# ============================================

class TestExtractedEntityModel:
    """Tests for ExtractedEntity SQLAlchemy model."""

    def test_table_name(self):
        """Has correct table name."""
        assert ExtractedEntity.__tablename__ == "extracted_entities"

    def test_has_session_id_foreign_key(self):
        """Has non-nullable session_id foreign key."""
        assert hasattr(ExtractedEntity, "session_id")
        col = ExtractedEntity.session_id.property.columns[0]
        assert col.nullable is False

    def test_has_type_column(self):
        """Has non-nullable type column."""
        assert hasattr(ExtractedEntity, "type")
        col = ExtractedEntity.type.property.columns[0]
        assert col.nullable is False

    def test_has_name_column(self):
        """Has non-nullable name column."""
        assert hasattr(ExtractedEntity, "name")
        col = ExtractedEntity.name.property.columns[0]
        assert col.nullable is False

    def test_has_confirmed_with_default(self):
        """Has confirmed column with default 0."""
        assert hasattr(ExtractedEntity, "confirmed")
        col = ExtractedEntity.confirmed.property.columns[0]
        assert col.default.arg == 0

    def test_has_session_relationship(self):
        """Has session relationship."""
        assert hasattr(ExtractedEntity, "session")


# ============================================
# DraftVersion Model
# ============================================

class TestDraftVersionModel:
    """Tests for DraftVersion SQLAlchemy model."""

    def test_table_name(self):
        """Has correct table name."""
        assert DraftVersion.__tablename__ == "draft_versions"

    def test_has_chapter_id_foreign_key(self):
        """Has non-nullable chapter_id foreign key."""
        assert hasattr(DraftVersion, "chapter_id")
        col = DraftVersion.chapter_id.property.columns[0]
        assert col.nullable is False

    def test_has_content_column(self):
        """Has non-nullable content column."""
        assert hasattr(DraftVersion, "content")
        col = DraftVersion.content.property.columns[0]
        assert col.nullable is False

    def test_has_version_number_column(self):
        """Has non-nullable version_number column."""
        assert hasattr(DraftVersion, "version_number")
        col = DraftVersion.version_number.property.columns[0]
        assert col.nullable is False

    def test_has_chapter_relationship(self):
        """Has chapter relationship."""
        assert hasattr(DraftVersion, "chapter")


# ============================================
# PlotThread Model
# ============================================

class TestPlotThreadModel:
    """Tests for PlotThread SQLAlchemy model."""

    def test_table_name(self):
        """Has correct table name."""
        assert PlotThread.__tablename__ == "plot_threads"

    def test_has_title_column(self):
        """Has non-nullable title column."""
        assert hasattr(PlotThread, "title")
        col = PlotThread.title.property.columns[0]
        assert col.nullable is False

    def test_has_status_with_default(self):
        """Has status column with default 'active'."""
        assert hasattr(PlotThread, "status")
        col = PlotThread.status.property.columns[0]
        assert col.default.arg == "active"

    def test_has_optional_chapter_ids(self):
        """Has optional created_chapter_id and reveal_chapter_id."""
        for attr in ("created_chapter_id", "reveal_chapter_id"):
            assert hasattr(PlotThread, attr)
            col = getattr(PlotThread, attr).property.columns[0]
            assert col.nullable is True


# ============================================
# AIInspectionResult Model
# ============================================

class TestAIInspectionResultModel:
    """Tests for AIInspectionResult SQLAlchemy model."""

    def test_table_name(self):
        """Has correct table name."""
        assert AIInspectionResult.__tablename__ == "ai_inspection_results"

    def test_has_chapter_id_foreign_key(self):
        """Has non-nullable chapter_id foreign key."""
        assert hasattr(AIInspectionResult, "chapter_id")
        col = AIInspectionResult.chapter_id.property.columns[0]
        assert col.nullable is False

    def test_has_inspection_type_column(self):
        """Has non-nullable inspection_type column."""
        assert hasattr(AIInspectionResult, "inspection_type")
        col = AIInspectionResult.inspection_type.property.columns[0]
        assert col.nullable is False

    def test_has_auto_fixed_with_default(self):
        """Has auto_fixed column with default 0."""
        assert hasattr(AIInspectionResult, "auto_fixed")
        col = AIInspectionResult.auto_fixed.property.columns[0]
        assert col.default.arg == 0

    def test_has_chapter_relationship(self):
        """Has chapter relationship."""
        assert hasattr(AIInspectionResult, "chapter")


# ============================================
# WritingSettings Model
# ============================================

class TestWritingSettingsModel:
    """Tests for WritingSettings SQLAlchemy model."""

    def test_table_name(self):
        """Has correct table name."""
        assert WritingSettings.__tablename__ == "writing_settings"

    def test_has_human_ai_ratio_with_default(self):
        """Has human_ai_ratio column with default 0.5."""
        assert hasattr(WritingSettings, "human_ai_ratio")
        col = WritingSettings.human_ai_ratio.property.columns[0]
        assert col.default.arg == 0.5

    def test_has_writing_style_with_default(self):
        """Has writing_style column with default 'default'."""
        assert hasattr(WritingSettings, "writing_style")
        col = WritingSettings.writing_style.property.columns[0]
        assert col.default.arg == "default"

    def test_has_target_word_count_with_default(self):
        """Has target_word_count column with default 3000."""
        assert hasattr(WritingSettings, "target_word_count")
        col = WritingSettings.target_word_count.property.columns[0]
        assert col.default.arg == 3000

    def test_has_timestamp_columns(self):
        """Has created_at and updated_at columns."""
        assert hasattr(WritingSettings, "created_at")
        assert hasattr(WritingSettings, "updated_at")


# ============================================
# Model Registry
# ============================================

class TestModelRegistry:
    """Tests for overall model coverage."""

    def test_all_models_have_tablenames(self):
        """All models define a __tablename__."""
        models = [
            Character, CharacterRelationship, CharacterStoryline,
            Item, Location, Faction, WorldSetting, Rule,
            Outline, Chapter, IFLine,
            ChatSession, ChatMessage, ExtractedEntity,
            DraftVersion, PlotThread, AIInspectionResult,
            WritingSettings,
        ]
        for model in models:
            assert hasattr(model, "__tablename__")
            assert isinstance(model.__tablename__, str)
            assert len(model.__tablename__) > 0

    def test_all_models_have_id_primary_key(self):
        """All models have an id primary key column."""
        models = [
            Character, CharacterRelationship, CharacterStoryline,
            Item, Location, Faction, WorldSetting, Rule,
            Outline, Chapter, IFLine,
            ChatSession, ChatMessage, ExtractedEntity,
            DraftVersion, PlotThread, AIInspectionResult,
            WritingSettings,
        ]
        for model in models:
            assert hasattr(model, "id")
            col = model.id.property.columns[0]
            assert col.primary_key is True
            assert isinstance(col.type, Integer)
