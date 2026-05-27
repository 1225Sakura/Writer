"""Tests for utility modules: validators, logging, exceptions, event_bus, serialization."""

import pytest
import logging
import json
from unittest.mock import patch, MagicMock


# ── validators.py ────────────────────────────────────────────────────

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


class TestSanitizeString:
    def test_removes_null_bytes(self):
        assert sanitize_string("hello\x00world") == "helloworld"

    def test_strips_whitespace(self):
        assert sanitize_string("  hello  ") == "hello"

    def test_non_string_passthrough(self):
        assert sanitize_string(123) == 123

    def test_empty_string(self):
        assert sanitize_string("") == ""


class TestSanitizeHtml:
    def test_removes_tags(self):
        assert sanitize_html("<b>hello</b>") == "hello"

    def test_removes_nested_tags(self):
        assert sanitize_html("<div><p>text</p></div>") == "text"

    def test_non_string_passthrough(self):
        assert sanitize_html(42) == 42

    def test_strips_after_removal(self):
        assert sanitize_html("  <br/>  ") == ""


class TestValidateSlug:
    def test_valid_slug(self):
        assert validate_slug("my-slug") == "my-slug"

    def test_uppercase_normalized(self):
        assert validate_slug("My-Slug") == "my-slug"

    def test_special_chars_removed(self):
        assert validate_slug("hello world!") == "helloworld"

    def test_empty_raises(self):
        with pytest.raises(ValueError, match="empty"):
            validate_slug("!!!")

    def test_too_long_raises(self):
        with pytest.raises(ValueError, match="maximum length"):
            validate_slug("a" * (MAX_SLUG_LENGTH + 1))


class TestValidateEmail:
    def test_valid_email(self):
        assert validate_email("test@example.com") == "test@example.com"

    def test_uppercase_normalized(self):
        assert validate_email("Test@EXAMPLE.COM") == "test@example.com"

    def test_invalid_raises(self):
        with pytest.raises(ValueError, match="Invalid email"):
            validate_email("not-an-email")

    def test_no_at_raises(self):
        with pytest.raises(ValueError, match="Invalid email"):
            validate_email("testexample.com")


class TestValidateChineseText:
    def test_valid_text(self):
        assert validate_chinese_text("你好世界") == "你好世界"

    def test_empty_raises(self):
        with pytest.raises(ValueError, match="empty"):
            validate_chinese_text("")

    def test_whitespace_only_raises(self):
        with pytest.raises(ValueError, match="empty"):
            validate_chinese_text("   ")


class TestValidateEntityType:
    def test_valid_types(self):
        for t in ['character', 'item', 'location', 'faction', 'rule', 'outline', 'ifline', 'chapter']:
            assert validate_entity_type(t) == t

    def test_invalid_raises(self):
        with pytest.raises(ValueError, match="Invalid entity type"):
            validate_entity_type("unknown")

    def test_case_insensitive(self):
        assert validate_entity_type("Character") == "character"


class TestValidateWritingRatio:
    def test_valid_ratio(self):
        assert validate_writing_ratio(0.5) == 0.5

    def test_boundaries(self):
        assert validate_writing_ratio(0.0) == 0.0
        assert validate_writing_ratio(1.0) == 1.0

    def test_int_coerced(self):
        assert validate_writing_ratio(1) == 1.0

    def test_below_zero_raises(self):
        with pytest.raises(ValueError, match="between"):
            validate_writing_ratio(-0.1)

    def test_above_one_raises(self):
        with pytest.raises(ValueError, match="between"):
            validate_writing_ratio(1.1)

    def test_non_number_raises(self):
        with pytest.raises(ValueError, match="number"):
            validate_writing_ratio("abc")


class TestTitleValidator:
    def test_valid(self):
        v = TitleValidator(value="My Title")
        assert v.value == "My Title"

    def test_empty_raises(self):
        with pytest.raises(Exception):
            TitleValidator(value="")

    def test_too_long_raises(self):
        with pytest.raises(Exception):
            TitleValidator(value="x" * (MAX_TITLE_LENGTH + 1))


class TestContentValidator:
    def test_valid(self):
        v = ContentValidator(value="Some content")
        assert v.value == "Some content"

    def test_empty_raises(self):
        with pytest.raises(Exception):
            ContentValidator(value="")


class TestNameValidator:
    def test_valid(self):
        v = NameValidator(value="Alice")
        assert v.value == "Alice"

    def test_empty_raises(self):
        with pytest.raises(Exception):
            NameValidator(value="")

    def test_too_long_raises(self):
        with pytest.raises(Exception):
            NameValidator(value="x" * (MAX_NAME_LENGTH + 1))


class TestSlugValidator:
    def test_valid(self):
        v = SlugValidator(value="my-slug")
        assert v.value == "my-slug"


class TestPaginationValidator:
    def test_defaults(self):
        v = PaginationValidator()
        assert v.page == 1
        assert v.page_size == 20

    def test_custom(self):
        v = PaginationValidator(page=3, page_size=50)
        assert v.page == 3
        assert v.page_size == 50

    def test_page_below_one_raises(self):
        with pytest.raises(Exception):
            PaginationValidator(page=0)

    def test_page_size_over_max_raises(self):
        with pytest.raises(Exception):
            PaginationValidator(page_size=200)

    def test_page_size_below_min_raises(self):
        with pytest.raises(Exception):
            PaginationValidator(page_size=0)


class TestUUIDValidator:
    def test_valid_uuid(self):
        v = UUIDValidator(value="550e8400-e29b-41d4-a716-446655440000")
        assert v.value == "550e8400-e29b-41d4-a716-446655440000"

    def test_invalid_raises(self):
        with pytest.raises(Exception):
            UUIDValidator(value="not-a-uuid")


class TestWritingStyleValidator:
    def test_valid_styles(self):
        for style in ['jiangnan', 'kafka', 'camus', 'default', 'custom']:
            v = WritingStyleValidator(style=style)
            assert v.style == style

    def test_invalid_raises(self):
        with pytest.raises(Exception):
            WritingStyleValidator(style="romantic")


class TestAICommandValidator:
    def test_valid_commands(self):
        for cmd in ['optimize', 'expand', 'summarize', 'rewrite', 'continue', 'polish']:
            v = AICommandValidator(command=cmd)
            assert v.command == cmd

    def test_invalid_raises(self):
        with pytest.raises(Exception):
            AICommandValidator(command="delete")


class TestChatMessageValidator:
    def test_valid(self):
        v = ChatMessageValidator(role="user", content="Hello")
        assert v.role == "user"
        assert v.content == "Hello"

    def test_invalid_role_raises(self):
        with pytest.raises(Exception):
            ChatMessageValidator(role="admin", content="Hello")

    def test_empty_content_raises(self):
        with pytest.raises(Exception):
            ChatMessageValidator(role="user", content="")

    def test_too_long_content_raises(self):
        with pytest.raises(Exception):
            ChatMessageValidator(role="user", content="x" * 10001)


# ── exceptions.py ────────────────────────────────────────────────────

from backend.utils.exceptions import (
    AppException,
    AgentError,
    AgentTimeoutError,
    AgentContextError,
    CheckerError,
    CheckerAnalysisError,
    CacheError,
    EncryptionError,
    EmbeddingError,
    RAGError,
    TaskQueueError,
    ExportImportError,
    SnapshotError,
    ConstraintError,
    GraphServiceError,
    AIServiceError,
    DatabaseError,
    NotFoundError,
    ValidationError,
)


class TestExceptionHierarchy:
    def test_agent_error_is_app_exception(self):
        assert issubclass(AgentError, AppException)

    def test_agent_timeout_is_agent_error(self):
        assert issubclass(AgentTimeoutError, AgentError)

    def test_agent_context_is_agent_error(self):
        assert issubclass(AgentContextError, AgentError)

    def test_checker_error_is_app_exception(self):
        assert issubclass(CheckerError, AppException)

    def test_checker_analysis_is_checker_error(self):
        assert issubclass(CheckerAnalysisError, CheckerError)

    def test_infrastructure_errors_are_app_exception(self):
        for exc_cls in [CacheError, EncryptionError, EmbeddingError, RAGError,
                        TaskQueueError, ExportImportError, SnapshotError,
                        ConstraintError, GraphServiceError]:
            assert issubclass(exc_cls, AppException), f"{exc_cls.__name__} should be AppException"


class TestExceptionInstantiation:
    def test_agent_error_default_message(self):
        e = AgentError()
        assert "Agent error" in str(e)

    def test_agent_error_custom_message(self):
        e = AgentError(message="custom", agent_name="test_agent")
        assert e.agent_name == "test_agent"

    def test_agent_timeout_default(self):
        e = AgentTimeoutError()
        assert e.error_code == "AGENT_TIMEOUT"

    def test_checker_error_with_name(self):
        e = CheckerError(message="fail", checker_name="consistency")
        assert e.checker_name == "consistency"

    def test_checker_analysis_error(self):
        e = CheckerAnalysisError()
        assert e.error_code == "CHECKER_ANALYSIS_ERROR"

    def test_cache_error(self):
        e = CacheError(message="cache miss")
        assert e.error_code == "CACHE_ERROR"

    def test_encryption_error(self):
        e = EncryptionError()
        assert e.error_code == "ENCRYPTION_ERROR"

    def test_embedding_error(self):
        e = EmbeddingError()
        assert e.error_code == "EMBEDDING_ERROR"

    def test_rag_error(self):
        e = RAGError()
        assert e.error_code == "RAG_ERROR"

    def test_task_queue_error(self):
        e = TaskQueueError()
        assert e.error_code == "TASK_QUEUE_ERROR"

    def test_export_import_error(self):
        e = ExportImportError()
        assert e.error_code == "EXPORT_IMPORT_ERROR"

    def test_snapshot_error(self):
        e = SnapshotError()
        assert e.error_code == "SNAPSHOT_ERROR"

    def test_constraint_error(self):
        e = ConstraintError()
        assert e.error_code == "CONSTRAINT_ERROR"

    def test_graph_service_error(self):
        e = GraphServiceError()
        assert e.error_code == "GRAPH_SERVICE_ERROR"


# ── event_bus.py ─────────────────────────────────────────────────────

from backend.utils.event_bus import AsyncEventBus


class TestEventBus:
    def test_subscribe_and_get(self):
        bus = AsyncEventBus()
        handler = lambda d: None
        bus.subscribe("test_event", handler)
        assert handler in bus.get_subscribers("test_event")

    def test_multiple_listeners(self):
        bus = AsyncEventBus()
        h1 = lambda d: None
        h2 = lambda d: None
        bus.subscribe("ev", h1)
        bus.subscribe("ev", h2)
        assert len(bus.get_subscribers("ev")) == 2

    def test_unsubscribe(self):
        bus = AsyncEventBus()
        handler = lambda d: None
        bus.subscribe("ev", handler)
        assert bus.unsubscribe("ev", handler) is True
        assert handler not in bus.get_subscribers("ev")

    def test_unsubscribe_nonexistent(self):
        bus = AsyncEventBus()
        assert bus.unsubscribe("ev", lambda d: None) is False

    @pytest.mark.asyncio
    async def test_publish_no_listeners(self):
        bus = AsyncEventBus()
        await bus.publish("nonexistent", {})  # Should not raise

    @pytest.mark.asyncio
    async def test_publish_calls_handler(self):
        bus = AsyncEventBus()
        results = []
        async def handler(data):
            results.append(data)
        bus.subscribe("ev", handler)
        await bus.publish("ev", {"key": "value"})
        assert results == [{"key": "value"}]

    @pytest.mark.asyncio
    async def test_publish_sync_handler(self):
        bus = AsyncEventBus()
        results = []
        bus.subscribe("ev", lambda d: results.append(d))
        await bus.publish("ev", 42)
        assert results == [42]

    @pytest.mark.asyncio
    async def test_handler_exception_does_not_break_others(self):
        bus = AsyncEventBus()
        results = []
        bus.subscribe("ev", lambda d: 1 / 0)
        bus.subscribe("ev", lambda d: results.append(d))
        await bus.publish("ev", {})
        assert results == [{}]

    def test_list_event_types(self):
        bus = AsyncEventBus()
        bus.subscribe("ev1", lambda d: None)
        bus.subscribe("ev2", lambda d: None)
        assert set(bus.list_event_types()) == {"ev1", "ev2"}


# ── serialization.py ────────────────────────────────────────────────

from backend.utils.serialization import serialize_to_json, serialize_datetime


class TestSerializeToJson:
    def test_basic_types(self):
        assert serialize_to_json("hello") == '"hello"'
        assert serialize_to_json(42) == "42"
        assert serialize_to_json(3.14) == "3.14"
        assert serialize_to_json(True) == "true"
        assert serialize_to_json(None) == "null"

    def test_dict(self):
        result = serialize_to_json({"a": 1})
        assert json.loads(result) == {"a": 1}

    def test_list(self):
        result = serialize_to_json([1, 2, 3])
        assert json.loads(result) == [1, 2, 3]

    def test_nested(self):
        data = {"a": [1, {"b": 2}]}
        result = serialize_to_json(data)
        assert json.loads(result) == data

    def test_datetime_serialization(self):
        from datetime import datetime
        result = serialize_to_json(datetime(2024, 1, 1, 0, 0, 0))
        assert isinstance(result, str)
        assert "2024" in result


class TestSerializeDatetime:
    def test_naive_datetime(self):
        from datetime import datetime
        dt = datetime(2024, 1, 1, 12, 0, 0)
        result = serialize_datetime(dt)
        assert isinstance(result, str)
        assert "2024" in result

    def test_none(self):
        assert serialize_datetime(None) is None
