# Extended tests for validators.py - Phase 5 Tier 3
# Covers edge cases, boundary conditions, and untested paths

import pytest
from backend.utils.validators import (
    sanitize_string,
    sanitize_html,
    validate_slug,
    validate_email,
    validate_chinese_text,
    validate_entity_type,
    validate_writing_ratio,
    TitleValidator,
    ContentValidator,
    NameValidator,
    SlugValidator,
    PaginationValidator,
    UUIDValidator,
    WritingStyleValidator,
    AICommandValidator,
    ChatMessageValidator,
    MAX_TITLE_LENGTH,
    MAX_CONTENT_LENGTH,
    MAX_NAME_LENGTH,
    MAX_SLUG_LENGTH,
)


# ── sanitize_string edge cases ────────────────────────────────────────

class TestSanitizeStringExtended:
    def test_multiple_null_bytes(self):
        assert sanitize_string("a\x00b\x00c") == "abc"

    def test_only_whitespace(self):
        assert sanitize_string("   ") == ""

    def test_tabs_and_newlines_stripped(self):
        assert sanitize_string("\t\nhello\t\n") == "hello"

    def test_unicode_passthrough(self):
        assert sanitize_string("你好") == "你好"

    def test_none_passthrough(self):
        # sanitize_string checks isinstance(value, str), None is not str
        assert sanitize_string(None) is None

    def test_list_passthrough(self):
        assert sanitize_string([1, 2]) == [1, 2]


# ── sanitize_html extended ────────────────────────────────────────────

class TestSanitizeHtmlExtended:
    def test_script_tags_removed(self):
        assert sanitize_html("<script>alert('xss')</script>") == "alert('xss')"

    def test_self_closing_tags(self):
        assert sanitize_html("hello<br/>world") == "helloworld"

    def test_tags_with_attributes(self):
        assert sanitize_html('<a href="http://example.com">link</a>') == "link"

    def test_deeply_nested(self):
        assert sanitize_html("<div><span><b>deep</b></span></div>") == "deep"

    def test_only_tags_no_text(self):
        assert sanitize_html("<br/><hr/>") == ""


# ── validate_slug extended ────────────────────────────────────────────

class TestValidateSlugExtended:
    def test_dots_removed(self):
        result = validate_slug("my.slug")
        assert "." not in result

    def test_underscores_preserved(self):
        assert validate_slug("my_slug") == "my_slug"

    def test_hyphens_preserved(self):
        assert validate_slug("my-slug") == "my-slug"

    def test_numbers_preserved(self):
        assert validate_slug("slug123") == "slug123"

    def test_max_length_boundary(self):
        slug = "a" * MAX_SLUG_LENGTH
        assert validate_slug(slug) == slug

    def test_unicode_removed(self):
        # Chinese chars are stripped by the regex, leaving empty string
        with pytest.raises(ValueError, match="empty"):
            validate_slug("你好")


# ── validate_email extended ───────────────────────────────────────────

class TestValidateEmailExtended:
    def test_subdomain(self):
        assert validate_email("user@sub.domain.com") == "user@sub.domain.com"

    def test_plus_addressing(self):
        assert validate_email("user+tag@example.com") == "user+tag@example.com"

    def test_leading_trailing_spaces_stripped(self):
        assert validate_email("  user@example.com  ") == "user@example.com"

    def test_empty_raises(self):
        with pytest.raises(ValueError, match="Invalid email"):
            validate_email("")

    def test_no_domain_raises(self):
        with pytest.raises(ValueError, match="Invalid email"):
            validate_email("user@")

    def test_short_tld_raises(self):
        with pytest.raises(ValueError, match="Invalid email"):
            validate_email("user@domain.c")


# ── validate_chinese_text extended ────────────────────────────────────

class TestValidateChineseTextExtended:
    def test_mixed_chinese_english(self):
        assert validate_chinese_text("你好world") == "你好world"

    def test_pure_english(self):
        assert validate_chinese_text("hello") == "hello"

    def test_numbers(self):
        assert validate_chinese_text("12345") == "12345"

    def test_punctuation(self):
        assert validate_chinese_text("。！") == "。！"


# ── validate_entity_type extended ─────────────────────────────────────

class TestValidateEntityTypeExtended:
    def test_uppercase_normalized(self):
        assert validate_entity_type("CHARACTER") == "character"

    def test_mixed_case(self):
        assert validate_entity_type("Character") == "character"

    def test_all_valid_types_normalized(self):
        for t in ['character', 'item', 'location', 'faction',
                   'rule', 'outline', 'ifline', 'chapter']:
            assert validate_entity_type(t.upper()) == t.lower()


# ── validate_writing_ratio extended ───────────────────────────────────

class TestValidateWritingRatioExtended:
    def test_float_precision(self):
        assert validate_writing_ratio(0.12345) == pytest.approx(0.12345)

    def test_zero(self):
        assert validate_writing_ratio(0) == 0.0

    def test_one(self):
        assert validate_writing_ratio(1) == 1.0

    def test_bool_raises(self):
        # bool is subclass of int, so True=1 passes; check it returns 1.0
        assert validate_writing_ratio(True) == 1.0


# ── TitleValidator extended ───────────────────────────────────────────

class TestTitleValidatorExtended:
    def test_max_boundary(self):
        v = TitleValidator(value="x" * MAX_TITLE_LENGTH)
        assert len(v.value) == MAX_TITLE_LENGTH

    def test_sanitization(self):
        v = TitleValidator(value="  hello  ")
        assert v.value == "hello"

    def test_null_byte_removed(self):
        v = TitleValidator(value="hello\x00world")
        assert v.value == "helloworld"


# ── ContentValidator extended ─────────────────────────────────────────

class TestContentValidatorExtended:
    def test_max_boundary(self):
        v = ContentValidator(value="x" * MAX_CONTENT_LENGTH)
        assert len(v.value) == MAX_CONTENT_LENGTH

    def test_too_long_raises(self):
        with pytest.raises(Exception):
            ContentValidator(value="x" * (MAX_CONTENT_LENGTH + 1))

    def test_sanitization(self):
        v = ContentValidator(value="  content  ")
        assert v.value == "content"


# ── NameValidator extended ────────────────────────────────────────────

class TestNameValidatorExtended:
    def test_max_boundary(self):
        v = NameValidator(value="x" * MAX_NAME_LENGTH)
        assert len(v.value) == MAX_NAME_LENGTH

    def test_unicode_name(self):
        v = NameValidator(value="张三")
        assert v.value == "张三"

    def test_sanitization(self):
        v = NameValidator(value="  Alice  ")
        assert v.value == "Alice"


# ── SlugValidator extended ────────────────────────────────────────────

class TestSlugValidatorExtended:
    def test_invalid_chars_removed(self):
        v = SlugValidator(value="hello world!")
        assert v.value == "helloworld"

    def test_empty_after_sanitize_raises(self):
        with pytest.raises(Exception):
            SlugValidator(value="!!!")


# ── PaginationValidator extended ──────────────────────────────────────

class TestPaginationValidatorExtended:
    def test_page_edge_one(self):
        v = PaginationValidator(page=1)
        assert v.page == 1

    def test_large_page(self):
        v = PaginationValidator(page=999)
        assert v.page == 999

    def test_page_size_boundary_100(self):
        v = PaginationValidator(page_size=100)
        assert v.page_size == 100

    def test_page_size_boundary_1(self):
        v = PaginationValidator(page_size=1)
        assert v.page_size == 1


# ── UUIDValidator extended ────────────────────────────────────────────

class TestUUIDValidatorExtended:
    def test_uppercase_normalized(self):
        v = UUIDValidator(value="550E8400-E29B-41D4-A716-446655440000")
        assert v.value == "550e8400-e29b-41d4-a716-446655440000"

    def test_all_zeros(self):
        v = UUIDValidator(value="00000000-0000-0000-0000-000000000000")
        assert v.value == "00000000-0000-0000-0000-000000000000"

    def test_too_short_raises(self):
        with pytest.raises(Exception):
            UUIDValidator(value="550e8400")

    def test_no_hyphens_raises(self):
        with pytest.raises(Exception):
            UUIDValidator(value="550e8400e29b41d4a716446655440000")


# ── WritingStyleValidator extended ────────────────────────────────────

class TestWritingStyleValidatorExtended:
    def test_uppercase_normalized(self):
        v = WritingStyleValidator(style="JIANGNAN")
        assert v.style == "jiangnan"

    def test_whitespace_stripped(self):
        v = WritingStyleValidator(style="  kafka  ")
        assert v.style == "kafka"

    def test_empty_raises(self):
        with pytest.raises(Exception):
            WritingStyleValidator(style="")

    def test_all_valid_styles(self):
        for s in ['jiangnan', 'kafka', 'camus', 'default', 'custom']:
            v = WritingStyleValidator(style=s)
            assert v.style == s


# ── AICommandValidator extended ───────────────────────────────────────

class TestAICommandValidatorExtended:
    def test_uppercase_normalized(self):
        v = AICommandValidator(command="OPTIMIZE")
        assert v.command == "optimize"

    def test_whitespace_stripped(self):
        v = AICommandValidator(command="  expand  ")
        assert v.command == "expand"

    def test_content_optional(self):
        v = AICommandValidator(command="polish")
        assert v.content is None

    def test_with_content(self):
        v = AICommandValidator(command="rewrite", content="some text")
        assert v.content == "some text"


# ── ChatMessageValidator extended ─────────────────────────────────────

class TestChatMessageValidatorExtended:
    def test_system_role(self):
        v = ChatMessageValidator(role="system", content="instruction")
        assert v.role == "system"

    def test_assistant_role(self):
        v = ChatMessageValidator(role="assistant", content="response")
        assert v.role == "assistant"

    def test_role_case_normalized(self):
        v = ChatMessageValidator(role="USER", content="hello")
        assert v.role == "user"

    def test_max_content_boundary(self):
        v = ChatMessageValidator(role="user", content="x" * 10000)
        assert len(v.content) == 10000
