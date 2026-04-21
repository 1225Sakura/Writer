"""Unit tests for Pydantic request schema validation.

Covers field validation, default values, and error handling for core models.
No database required — pure schema validation tests.
"""

import pytest
from pydantic import ValidationError

from schemas.request_schemas import (
    CharacterCreateRequest,
    CharacterUpdateRequest,
    CharacterRelationshipCreateRequest,
    CharacterStorylineCreateRequest,
    ChapterCreateRequest,
    ChapterUpdateRequest,
    OutlineCreateRequest,
    OutlineUpdateRequest,
    IFLineCreateRequest,
    IFLineUpdateRequest,
    ItemCreateRequest,
    LocationCreateRequest,
    FactionCreateRequest,
    WorldSettingCreateRequest,
    RuleCreateRequest,
    DraftVersionCreateRequest,
    PlotThreadCreateRequest,
    ChatMessageCreateRequest,
    GenerateRequest,
    ReviewRequest,
    WritingSettingsUpdateRequest,
    ImportRequest,
)


# ============================================
# CharacterCreateRequest
# ============================================

class TestCharacterCreateRequest:
    """Tests for CharacterCreateRequest schema validation."""

    def test_valid_input_with_all_fields(self):
        """Accepts valid input with all fields populated."""
        char = CharacterCreateRequest(
            name="萧炎",
            gender="male",
            personality="坚韧、执着",
            desires="成为最强斗者",
            flaws="冲动",
            description="主角",
            tier=" protagonist",
            cultivation_realm="斗帝",
        )
        assert char.name == "萧炎"
        assert char.gender == "male"
        assert char.personality == "坚韧、执着"

    def test_valid_input_with_minimal_fields(self):
        """Accepts valid input with only required fields."""
        char = CharacterCreateRequest(name="萧炎")
        assert char.name == "萧炎"
        assert char.gender is None
        assert char.personality is None

    def test_rejects_empty_name(self):
        """Rejects empty name string."""
        with pytest.raises(ValidationError):
            CharacterCreateRequest(name="")

    def test_rejects_whitespace_only_name(self):
        """Rejects name that is only whitespace."""
        with pytest.raises(ValidationError):
            CharacterCreateRequest(name="   ")

    def test_rejects_name_too_long(self):
        """Rejects name exceeding maximum length."""
        with pytest.raises(ValidationError):
            CharacterCreateRequest(name="a" * 201)

    def test_strips_whitespace_from_name(self):
        """Strips leading/trailing whitespace from name."""
        char = CharacterCreateRequest(name="  萧炎  ")
        assert char.name == "萧炎"

    def test_sanitizes_html_in_text_fields(self):
        """Sanitizes HTML tags in text fields."""
        char = CharacterCreateRequest(
            name="Test",
            personality="<script>alert(1)</script>Kind"
        )
        assert "<script>" not in char.personality

    def test_valid_gender_values(self):
        """Accepts valid gender values."""
        for g in ("male", "female", "other", "unknown", "男", "女", "其他"):
            char = CharacterCreateRequest(name="Test", gender=g)
            assert char.gender == g


# ============================================
# CharacterUpdateRequest
# ============================================

class TestCharacterUpdateRequest:
    """Tests for CharacterUpdateRequest schema validation."""

    def test_valid_update(self):
        """Accepts valid update with partial fields."""
        char = CharacterUpdateRequest(name="Updated")
        assert char.name == "Updated"
        assert char.gender is None

    def test_all_optional_fields(self):
        """Accepts empty update (all fields optional)."""
        char = CharacterUpdateRequest()
        assert char.name is None

    def test_rejects_empty_name_when_provided(self):
        """Rejects empty name when explicitly provided."""
        with pytest.raises(ValidationError):
            CharacterUpdateRequest(name="")


# ============================================
# CharacterRelationshipCreateRequest
# ============================================

class TestCharacterRelationshipCreateRequest:
    """Tests for CharacterRelationshipCreateRequest schema validation."""

    def test_valid_relationship(self):
        """Accepts valid relationship between two characters."""
        rel = CharacterRelationshipCreateRequest(
            character_id=1, target_id=2, type="friend"
        )
        assert rel.character_id == 1
        assert rel.target_id == 2
        assert rel.type == "friend"

    def test_rejects_self_relationship(self):
        """Rejects relationship where character targets itself."""
        with pytest.raises(ValidationError, match="itself"):
            CharacterRelationshipCreateRequest(
                character_id=1, target_id=1, type="self"
            )

    def test_rejects_zero_character_id(self):
        """Rejects zero character_id."""
        with pytest.raises(ValidationError):
            CharacterRelationshipCreateRequest(
                character_id=0, target_id=1, type="friend"
            )

    def test_rejects_negative_target_id(self):
        """Rejects negative target_id."""
        with pytest.raises(ValidationError):
            CharacterRelationshipCreateRequest(
                character_id=1, target_id=-1, type="friend"
            )

    def test_rejects_empty_type(self):
        """Rejects empty relationship type."""
        with pytest.raises(ValidationError):
            CharacterRelationshipCreateRequest(
                character_id=1, target_id=2, type=""
            )


# ============================================
# CharacterStorylineCreateRequest
# ============================================

class TestCharacterStorylineCreateRequest:
    """Tests for CharacterStorylineCreateRequest schema validation."""

    def test_valid_storyline(self):
        """Accepts valid storyline with default progress."""
        story = CharacterStorylineCreateRequest(
            character_id=1, title="The Journey"
        )
        assert story.progress == 0
        assert story.title == "The Journey"

    def test_valid_progress(self):
        """Accepts progress within valid range."""
        story = CharacterStorylineCreateRequest(
            character_id=1, title="Test", progress=50
        )
        assert story.progress == 50

    def test_rejects_progress_over_100(self):
        """Rejects progress greater than 100."""
        with pytest.raises(ValidationError):
            CharacterStorylineCreateRequest(
                character_id=1, title="Test", progress=101
            )

    def test_rejects_negative_progress(self):
        """Rejects negative progress."""
        with pytest.raises(ValidationError):
            CharacterStorylineCreateRequest(
                character_id=1, title="Test", progress=-1
            )

    def test_rejects_zero_character_id(self):
        """Rejects zero character_id."""
        with pytest.raises(ValidationError):
            CharacterStorylineCreateRequest(
                character_id=0, title="Test"
            )


# ============================================
# OutlineCreateRequest
# ============================================

class TestOutlineCreateRequest:
    """Tests for OutlineCreateRequest schema validation."""

    def test_valid_outline(self):
        """Accepts valid outline with required title."""
        outline = OutlineCreateRequest(title="Main Story")
        assert outline.title == "Main Story"
        assert outline.description is None

    def test_valid_outline_with_description(self):
        """Accepts outline with description."""
        outline = OutlineCreateRequest(
            title="Main Story", description="A grand tale"
        )
        assert outline.description == "A grand tale"

    def test_rejects_empty_title(self):
        """Rejects empty title."""
        with pytest.raises(ValidationError):
            OutlineCreateRequest(title="")

    def test_rejects_whitespace_only_title(self):
        """Rejects whitespace-only title."""
        with pytest.raises(ValidationError):
            OutlineCreateRequest(title="   ")

    def test_strips_whitespace_from_title(self):
        """Strips whitespace from title."""
        outline = OutlineCreateRequest(title="  Story  ")
        assert outline.title == "Story"


# ============================================
# OutlineUpdateRequest
# ============================================

class TestOutlineUpdateRequest:
    """Tests for OutlineUpdateRequest schema validation."""

    def test_valid_partial_update(self):
        """Accepts partial update with only title."""
        outline = OutlineUpdateRequest(title="New Title")
        assert outline.title == "New Title"

    def test_empty_update_allowed(self):
        """Allows empty update (all fields optional)."""
        outline = OutlineUpdateRequest()
        assert outline.title is None
        assert outline.description is None


# ============================================
# ChapterCreateRequest
# ============================================

class TestChapterCreateRequest:
    """Tests for ChapterCreateRequest schema validation."""

    def test_valid_chapter_with_defaults(self):
        """Accepts chapter with default values."""
        ch = ChapterCreateRequest()
        assert ch.status == "pending"
        assert ch.word_count == 0
        assert ch.chapter_order == 0
        assert ch.outline_id is None

    def test_valid_chapter_with_custom_status(self):
        """Accepts chapter with valid status."""
        for status in ("pending", "writing", "review", "completed", "archived"):
            ch = ChapterCreateRequest(status=status)
            assert ch.status == status

    def test_rejects_invalid_status(self):
        """Rejects invalid status value."""
        with pytest.raises(ValidationError, match="Status must be one of"):
            ChapterCreateRequest(status="invalid_status")

    def test_rejects_negative_word_count(self):
        """Rejects negative word_count."""
        with pytest.raises(ValidationError):
            ChapterCreateRequest(word_count=-1)

    def test_rejects_zero_outline_id(self):
        """Rejects zero outline_id."""
        with pytest.raises(ValidationError):
            ChapterCreateRequest(outline_id=0)

    def test_sanitizes_title(self):
        """Sanitizes title input."""
        ch = ChapterCreateRequest(title="  Chapter 1  ")
        assert ch.title == "Chapter 1"


# ============================================
# ChapterUpdateRequest
# ============================================

class TestChapterUpdateRequest:
    """Tests for ChapterUpdateRequest schema validation."""

    def test_valid_partial_update(self):
        """Accepts partial update."""
        ch = ChapterUpdateRequest(title="Updated")
        assert ch.title == "Updated"

    def test_empty_update_allowed(self):
        """Allows empty update."""
        ch = ChapterUpdateRequest()
        assert ch.title is None

    def test_rejects_invalid_status_in_update(self):
        """Rejects invalid status in update."""
        with pytest.raises(ValidationError, match="Status must be one of"):
            ChapterUpdateRequest(status="bad")


# ============================================
# IFLineCreateRequest
# ============================================

class TestIFLineCreateRequest:
    """Tests for IFLineCreateRequest schema validation."""

    def test_valid_ifline_with_defaults(self):
        """Accepts IF line with default values."""
        ifl = IFLineCreateRequest(title="Alternate Path")
        assert ifl.sync_mode == "auto"
        assert ifl.linked_character_id is None

    def test_valid_sync_modes(self):
        """Accepts all valid sync modes."""
        for mode in ("auto", "manual", "disabled"):
            ifl = IFLineCreateRequest(title="Test", sync_mode=mode)
            assert ifl.sync_mode == mode

    def test_rejects_invalid_sync_mode(self):
        """Rejects invalid sync mode."""
        with pytest.raises(ValidationError, match="Sync mode must be one of"):
            IFLineCreateRequest(title="Test", sync_mode="invalid")

    def test_rejects_empty_title(self):
        """Rejects empty title."""
        with pytest.raises(ValidationError):
            IFLineCreateRequest(title="")

    def test_rejects_zero_linked_character_id(self):
        """Rejects zero linked_character_id."""
        with pytest.raises(ValidationError):
            IFLineCreateRequest(title="Test", linked_character_id=0)


# ============================================
# IFLineUpdateRequest
# ============================================

class TestIFLineUpdateRequest:
    """Tests for IFLineUpdateRequest schema validation."""

    def test_valid_partial_update(self):
        """Accepts partial update."""
        ifl = IFLineUpdateRequest(title="New Title")
        assert ifl.title == "New Title"

    def test_empty_update_allowed(self):
        """Allows empty update."""
        ifl = IFLineUpdateRequest()
        assert ifl.title is None

    def test_rejects_invalid_sync_mode(self):
        """Rejects invalid sync mode in update."""
        with pytest.raises(ValidationError, match="Sync mode must be one of"):
            IFLineUpdateRequest(sync_mode="bad")


# ============================================
# ItemCreateRequest
# ============================================

class TestItemCreateRequest:
    """Tests for ItemCreateRequest schema validation."""

    def test_valid_item(self):
        """Accepts valid item with required name."""
        item = ItemCreateRequest(name="玄重尺")
        assert item.name == "玄重尺"
        assert item.description is None

    def test_valid_item_with_all_fields(self):
        """Accepts item with all fields."""
        item = ItemCreateRequest(
            name="玄重尺", description="Heavy ruler", owner="萧炎", location="纳戒"
        )
        assert item.owner == "萧炎"
        assert item.location == "纳戒"

    def test_rejects_empty_name(self):
        """Rejects empty name."""
        with pytest.raises(ValidationError):
            ItemCreateRequest(name="")


# ============================================
# LocationCreateRequest
# ============================================

class TestLocationCreateRequest:
    """Tests for LocationCreateRequest schema validation."""

    def test_valid_location(self):
        """Accepts valid location."""
        loc = LocationCreateRequest(name="乌坦城")
        assert loc.name == "乌坦城"

    def test_rejects_empty_name(self):
        """Rejects empty name."""
        with pytest.raises(ValidationError):
            LocationCreateRequest(name="")


# ============================================
# FactionCreateRequest
# ============================================

class TestFactionCreateRequest:
    """Tests for FactionCreateRequest schema validation."""

    def test_valid_faction(self):
        """Accepts valid faction."""
        fac = FactionCreateRequest(name="云岚宗")
        assert fac.name == "云岚宗"

    def test_rejects_empty_name(self):
        """Rejects empty name."""
        with pytest.raises(ValidationError):
            FactionCreateRequest(name="")


# ============================================
# WorldSettingCreateRequest
# ============================================

class TestWorldSettingCreateRequest:
    """Tests for WorldSettingCreateRequest schema validation."""

    def test_valid_world_setting(self):
        """Accepts valid world setting."""
        ws = WorldSettingCreateRequest(name="斗气大陆")
        assert ws.name == "斗气大陆"

    def test_valid_json_details(self):
        """Accepts valid JSON in details_json field."""
        ws = WorldSettingCreateRequest(
            name="Magic System",
            details_json='{"type": "elemental"}'
        )
        assert ws.details_json == '{"type": "elemental"}'

    def test_rejects_invalid_json(self):
        """Rejects invalid JSON in details_json field."""
        with pytest.raises(ValidationError, match="valid JSON"):
            WorldSettingCreateRequest(name="Test", details_json="not json")

    def test_none_details_json_allowed(self):
        """Allows None for details_json."""
        ws = WorldSettingCreateRequest(name="Test", details_json=None)
        assert ws.details_json is None


# ============================================
# RuleCreateRequest
# ============================================

class TestRuleCreateRequest:
    """Tests for RuleCreateRequest schema validation."""

    def test_valid_rule(self):
        """Accepts valid rule."""
        rule = RuleCreateRequest(name="No killing")
        assert rule.name == "No killing"

    def test_rejects_empty_name(self):
        """Rejects empty name."""
        with pytest.raises(ValidationError):
            RuleCreateRequest(name="")


# ============================================
# DraftVersionCreateRequest
# ============================================

class TestDraftVersionCreateRequest:
    """Tests for DraftVersionCreateRequest schema validation."""

    def test_valid_draft(self):
        """Accepts valid draft version."""
        draft = DraftVersionCreateRequest(
            chapter_id=1, content="Chapter content", version_number=1
        )
        assert draft.chapter_id == 1
        assert draft.version_number == 1

    def test_rejects_empty_content(self):
        """Rejects empty content."""
        with pytest.raises(ValidationError):
            DraftVersionCreateRequest(chapter_id=1, content="", version_number=1)

    def test_rejects_zero_version(self):
        """Rejects version_number of zero."""
        with pytest.raises(ValidationError):
            DraftVersionCreateRequest(chapter_id=1, content="test", version_number=0)

    def test_rejects_zero_chapter_id(self):
        """Rejects zero chapter_id."""
        with pytest.raises(ValidationError):
            DraftVersionCreateRequest(chapter_id=0, content="test", version_number=1)


# ============================================
# PlotThreadCreateRequest
# ============================================

class TestPlotThreadCreateRequest:
    """Tests for PlotThreadCreateRequest schema validation."""

    def test_valid_plot_thread(self):
        """Accepts valid plot thread with default status."""
        pt = PlotThreadCreateRequest(title="The Mystery")
        assert pt.status == "active"

    def test_valid_status_values(self):
        """Accepts all valid status values."""
        for status in ("active", "resolved", "abandoned", "hidden"):
            pt = PlotThreadCreateRequest(title="Test", status=status)
            assert pt.status == status

    def test_rejects_invalid_status(self):
        """Rejects invalid status."""
        with pytest.raises(ValidationError, match="Status must be one of"):
            PlotThreadCreateRequest(title="Test", status="unknown")


# ============================================
# ChatMessageCreateRequest
# ============================================

class TestChatMessageCreateRequest:
    """Tests for ChatMessageCreateRequest schema validation."""

    def test_valid_message(self):
        """Accepts valid chat message."""
        msg = ChatMessageCreateRequest(role="user", content="Hello")
        assert msg.role == "user"
        assert msg.content == "Hello"

    def test_valid_roles(self):
        """Accepts all valid roles."""
        for role in ("user", "assistant", "system"):
            msg = ChatMessageCreateRequest(role=role, content="Test")
            assert msg.role == role

    def test_rejects_invalid_role(self):
        """Rejects invalid role."""
        with pytest.raises(ValidationError, match="Role must be one of"):
            ChatMessageCreateRequest(role="hacker", content="Hello")

    def test_rejects_empty_content(self):
        """Rejects empty content."""
        with pytest.raises(ValidationError):
            ChatMessageCreateRequest(role="user", content="")


# ============================================
# GenerateRequest
# ============================================

class TestGenerateRequest:
    """Tests for GenerateRequest schema validation."""

    def test_valid_generate(self):
        """Accepts valid generation request."""
        req = GenerateRequest(prompt="Write a story", operation="continue")
        assert req.operation == "continue"
        assert req.style is None
        assert req.human_ai_ratio is None

    def test_valid_operations(self):
        """Accepts all valid operations."""
        for op in ("continue", "expand", "condense", "rewrite", "polish", "optimize"):
            req = GenerateRequest(prompt="test", operation=op)
            assert req.operation == op

    def test_rejects_invalid_operation(self):
        """Rejects invalid operation."""
        with pytest.raises(ValidationError, match="Operation must be one of"):
            GenerateRequest(prompt="test", operation="hack")

    def test_rejects_empty_prompt(self):
        """Rejects empty prompt."""
        with pytest.raises(ValidationError):
            GenerateRequest(prompt="", operation="continue")

    def test_rejects_human_ai_ratio_over_100(self):
        """Rejects human_ai_ratio greater than 100."""
        with pytest.raises(ValidationError):
            GenerateRequest(prompt="test", operation="continue", human_ai_ratio=101)

    def test_rejects_negative_ratio(self):
        """Rejects negative human_ai_ratio."""
        with pytest.raises(ValidationError):
            GenerateRequest(prompt="test", operation="continue", human_ai_ratio=-1)


# ============================================
# ReviewRequest
# ============================================

class TestReviewRequest:
    """Tests for ReviewRequest schema validation."""

    def test_valid_review(self):
        """Accepts valid review request."""
        req = ReviewRequest(settings_data={"key": "value"})
        assert req.settings_data == {"key": "value"}

    def test_rejects_empty_settings(self):
        """Rejects empty settings_data."""
        with pytest.raises(ValidationError, match="cannot be empty"):
            ReviewRequest(settings_data={})

    def test_rejects_non_dict_settings(self):
        """Rejects non-dict settings_data."""
        with pytest.raises(ValidationError):
            ReviewRequest(settings_data="not a dict")


# ============================================
# WritingSettingsUpdateRequest
# ============================================

class TestWritingSettingsUpdateRequest:
    """Tests for WritingSettingsUpdateRequest schema validation."""

    def test_valid_ratio(self):
        """Accepts valid human_ai_ratio."""
        req = WritingSettingsUpdateRequest(human_ai_ratio=0.5)
        assert req.human_ai_ratio == 0.5

    def test_boundary_ratios(self):
        """Accepts boundary ratio values."""
        req = WritingSettingsUpdateRequest(human_ai_ratio=0.0)
        assert req.human_ai_ratio == 0.0
        req = WritingSettingsUpdateRequest(human_ai_ratio=1.0)
        assert req.human_ai_ratio == 1.0

    def test_rejects_ratio_too_high(self):
        """Rejects ratio greater than 1.0."""
        with pytest.raises(ValidationError):
            WritingSettingsUpdateRequest(human_ai_ratio=1.5)

    def test_rejects_negative_ratio(self):
        """Rejects negative ratio."""
        with pytest.raises(ValidationError):
            WritingSettingsUpdateRequest(human_ai_ratio=-0.1)

    def test_rejects_zero_word_count(self):
        """Rejects zero target_word_count."""
        with pytest.raises(ValidationError):
            WritingSettingsUpdateRequest(target_word_count=0)

    def test_empty_update_allowed(self):
        """Allows empty update."""
        req = WritingSettingsUpdateRequest()
        assert req.human_ai_ratio is None


# ============================================
# ImportRequest
# ============================================

class TestImportRequest:
    """Tests for ImportRequest schema validation."""

    def test_valid_merge_mode(self):
        """Accepts merge mode."""
        req = ImportRequest(data={"key": "value"}, mode="merge")
        assert req.mode == "merge"

    def test_valid_replace_mode(self):
        """Accepts replace mode."""
        req = ImportRequest(data={"key": "value"}, mode="replace")
        assert req.mode == "replace"

    def test_default_mode_is_merge(self):
        """Default mode is merge."""
        req = ImportRequest(data={"key": "value"})
        assert req.mode == "merge"

    def test_rejects_invalid_mode(self):
        """Rejects invalid mode."""
        with pytest.raises(ValidationError, match="Mode must be one of"):
            ImportRequest(data={"key": "value"}, mode="invalid")

    def test_strips_whitespace_from_mode(self):
        """Strips whitespace from mode."""
        req = ImportRequest(data={"key": "value"}, mode="  merge  ")
        assert req.mode == "merge"
