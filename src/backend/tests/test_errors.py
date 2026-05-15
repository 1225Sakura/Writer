"""Tests for error handling, request context, and logging."""

import pytest
import asyncio
import contextvars
from datetime import datetime
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.middleware.errors import (
    ErrorCode,
    AppException,
    NotFoundError,
    ValidationError,
    AuthenticationError,
    PermissionDeniedError,
    ConflictError,
    RateLimitError,
    ServiceUnavailableError,
    ExternalServiceError,
    DatabaseError,
    CharacterNotFoundError,
    CharacterNameEmptyError,
    CharacterNameTooLongError,
    ChapterNotFoundError,
    ChapterInvalidOrderError,
    ChapterOrderDuplicateError,
    ChapterStatusInvalidError,
    DraftVersionNotFoundError,
    DraftVersionMismatchError,
    OutlineNotFoundError,
    OutlineTitleEmptyError,
    IFLineNotFoundError,
    IFLineSyncModeInvalidError,
    ItemNotFoundError,
    LocationNotFoundError,
    FactionNotFoundError,
    WorldSettingNotFoundError,
    RuleNotFoundError,
    PlotThreadNotFoundError,
    PlotThreadStatusInvalidError,
    SessionNotFoundError,
    SessionExpiredError,
    StyleNotFoundError,
    StyleInvalidError,
    ImportVersionUnsupportedError,
    ImportDataInvalidError,
    AIServiceError,
    AIServiceTimeoutError,
    AIServiceRateLimitError,
    build_error_response,
    register_exception_handlers,
    get_current_request_id,
    set_request_context,
)
from backend.middleware.request_context import (
    get_request_id,
    set_request_id,
    get_correlation_id,
    set_correlation_id,
    get_user_id,
    get_request_context,
    set_request_context as rc_set_request_context,
    clear_request_context,
)


# =============================================================================
# Error Code Tests
# =============================================================================

class TestErrorCodes:
    def test_error_code_values(self):
        assert ErrorCode.INTERNAL_ERROR == "INTERNAL_ERROR"
        assert ErrorCode.NOT_FOUND == "NOT_FOUND"
        assert ErrorCode.CHARACTER_NOT_FOUND == "CHARACTER_NOT_FOUND"
        assert ErrorCode.CHAPTER_INVALID_ORDER == "CHAPTER_INVALID_ORDER"
        assert ErrorCode.AI_SERVICE_TIMEOUT == "AI_SERVICE_TIMEOUT"

    def test_error_code_uniqueness(self):
        """Ensure no duplicate error codes exist."""
        codes = [
            ErrorCode.INTERNAL_ERROR,
            ErrorCode.NOT_FOUND,
            ErrorCode.VALIDATION_ERROR,
            ErrorCode.AUTH_ERROR,
            ErrorCode.PERMISSION_DENIED,
            ErrorCode.CONFLICT,
            ErrorCode.RATE_LIMIT_EXCEEDED,
            ErrorCode.SERVICE_UNAVAILABLE,
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            ErrorCode.AI_SERVICE_ERROR,
            ErrorCode.AI_SERVICE_TIMEOUT,
            ErrorCode.AI_SERVICE_RATE_LIMIT,
            ErrorCode.DATABASE_ERROR,
            ErrorCode.DATABASE_CONNECTION_ERROR,
            ErrorCode.DATABASE_CONSTRAINT_ERROR,
            ErrorCode.CHARACTER_NOT_FOUND,
            ErrorCode.CHAPTER_NOT_FOUND,
            ErrorCode.CHAPTER_INVALID_ORDER,
            ErrorCode.OUTLINE_NOT_FOUND,
            ErrorCode.IFLINE_NOT_FOUND,
            ErrorCode.ITEM_NOT_FOUND,
            ErrorCode.LOCATION_NOT_FOUND,
            ErrorCode.FACTION_NOT_FOUND,
            ErrorCode.WORLD_SETTING_NOT_FOUND,
            ErrorCode.RULE_NOT_FOUND,
            ErrorCode.PLOT_THREAD_NOT_FOUND,
            ErrorCode.SESSION_NOT_FOUND,
            ErrorCode.STYLE_NOT_FOUND,
        ]
        assert len(codes) == len(set(codes)), "Duplicate error codes found"


# =============================================================================
# Base Exception Tests
# =============================================================================

class TestAppException:
    def test_base_exception(self):
        exc = AppException("Something went wrong", status_code=500, error_code="TEST_ERROR")
        assert exc.message == "Something went wrong"
        assert exc.status_code == 500
        assert exc.error_code == "TEST_ERROR"
        assert exc.details == {}
        assert exc.timestamp is not None

    def test_exception_with_details(self):
        details = {"field": "name", "reason": "too_long"}
        exc = AppException("Validation failed", status_code=422, error_code="VALIDATION_ERROR", details=details)
        assert exc.details == details

    def test_exception_to_dict(self):
        exc = AppException("Not found", status_code=404, error_code="NOT_FOUND")
        d = exc.to_dict(request_id="req-123")
        assert d["error_code"] == "NOT_FOUND"
        assert d["message"] == "Not found"
        assert d["request_id"] == "req-123"
        assert "timestamp" in d

    def test_exception_to_dict_without_request_id(self):
        exc = AppException("Error", status_code=500, error_code="INTERNAL_ERROR")
        d = exc.to_dict()
        assert "request_id" not in d

    def test_exception_to_dict_with_details(self):
        exc = AppException("Error", status_code=400, error_code="BAD", details={"key": "value"})
        d = exc.to_dict()
        assert d["details"] == {"key": "value"}


# =============================================================================
# Generic Exception Tests
# =============================================================================

class TestGenericExceptions:
    def test_not_found_error(self):
        exc = NotFoundError("User not found")
        assert exc.status_code == 404
        assert exc.error_code == ErrorCode.NOT_FOUND

    def test_validation_error(self):
        exc = ValidationError("Invalid input", details={"field": "email"})
        assert exc.status_code == 422
        assert exc.error_code == ErrorCode.VALIDATION_ERROR
        assert exc.details == {"field": "email"}

    def test_authentication_error(self):
        exc = AuthenticationError("Token expired")
        assert exc.status_code == 401
        assert exc.error_code == ErrorCode.AUTH_ERROR

    def test_permission_denied_error(self):
        exc = PermissionDeniedError("Admin only")
        assert exc.status_code == 403
        assert exc.error_code == ErrorCode.PERMISSION_DENIED

    def test_conflict_error(self):
        exc = ConflictError("Duplicate entry")
        assert exc.status_code == 409
        assert exc.error_code == ErrorCode.CONFLICT

    def test_rate_limit_error(self):
        exc = RateLimitError("Too many requests")
        assert exc.status_code == 429
        assert exc.error_code == ErrorCode.RATE_LIMIT_EXCEEDED

    def test_service_unavailable_error(self):
        exc = ServiceUnavailableError("Maintenance mode")
        assert exc.status_code == 503
        assert exc.error_code == ErrorCode.SERVICE_UNAVAILABLE

    def test_external_service_error(self):
        exc = ExternalServiceError("AI API down")
        assert exc.status_code == 502
        assert exc.error_code == ErrorCode.EXTERNAL_SERVICE_ERROR

    def test_database_error(self):
        exc = DatabaseError("Connection failed")
        assert exc.status_code == 500
        assert exc.error_code == ErrorCode.DATABASE_ERROR


# =============================================================================
# Domain-Specific Exception Tests
# =============================================================================

class TestCharacterExceptions:
    def test_character_not_found(self):
        exc = CharacterNotFoundError(character_id=42)
        assert exc.status_code == 404
        assert exc.error_code == ErrorCode.CHARACTER_NOT_FOUND
        assert exc.details["character_id"] == 42
        assert "42" in exc.message

    def test_character_not_found_without_id(self):
        exc = CharacterNotFoundError()
        assert exc.details == {} or exc.details is None

    def test_character_name_empty(self):
        exc = CharacterNameEmptyError()
        assert exc.status_code == 422
        assert exc.error_code == ErrorCode.CHARACTER_NAME_EMPTY

    def test_character_name_too_long(self):
        exc = CharacterNameTooLongError(max_length=200)
        assert exc.status_code == 422
        assert exc.error_code == ErrorCode.CHARACTER_NAME_TOO_LONG
        assert exc.details["max_length"] == 200


class TestChapterExceptions:
    def test_chapter_not_found(self):
        exc = ChapterNotFoundError(chapter_id=5)
        assert exc.status_code == 404
        assert exc.error_code == ErrorCode.CHAPTER_NOT_FOUND
        assert exc.details["chapter_id"] == 5

    def test_chapter_invalid_order(self):
        exc = ChapterInvalidOrderError(order=-1)
        assert exc.status_code == 422
        assert exc.error_code == ErrorCode.CHAPTER_INVALID_ORDER
        assert exc.details["provided_order"] == -1

    def test_chapter_order_duplicate(self):
        exc = ChapterOrderDuplicateError(order=3, outline_id=1)
        assert exc.status_code == 409
        assert exc.error_code == ErrorCode.CHAPTER_ORDER_DUPLICATE
        assert exc.details["order"] == 3
        assert exc.details["outline_id"] == 1

    def test_chapter_status_invalid(self):
        exc = ChapterStatusInvalidError("invalid", valid_statuses=["pending", "published"])
        assert exc.status_code == 422
        assert exc.error_code == ErrorCode.CHAPTER_STATUS_INVALID
        assert exc.details["provided_status"] == "invalid"
        assert exc.details["valid_statuses"] == ["pending", "published"]

    def test_draft_version_not_found(self):
        exc = DraftVersionNotFoundError(chapter_id=1, version_number=3)
        assert exc.status_code == 404
        assert exc.error_code == ErrorCode.DRAFT_VERSION_NOT_FOUND
        assert exc.details["chapter_id"] == 1
        assert exc.details["version_number"] == 3

    def test_draft_version_mismatch(self):
        exc = DraftVersionMismatchError(expected_chapter_id=1, actual_chapter_id=2)
        assert exc.status_code == 422
        assert exc.error_code == ErrorCode.DRAFT_VERSION_MISMATCH
        assert exc.details["expected_chapter_id"] == 1
        assert exc.details["actual_chapter_id"] == 2


class TestOutlineExceptions:
    def test_outline_not_found(self):
        exc = OutlineNotFoundError(outline_id=10)
        assert exc.status_code == 404
        assert exc.error_code == ErrorCode.OUTLINE_NOT_FOUND

    def test_outline_title_empty(self):
        exc = OutlineTitleEmptyError()
        assert exc.status_code == 422
        assert exc.error_code == ErrorCode.OUTLINE_TITLE_EMPTY


class TestIFLineExceptions:
    def test_ifline_not_found(self):
        exc = IFLineNotFoundError(if_line_id=7)
        assert exc.status_code == 404
        assert exc.error_code == ErrorCode.IFLINE_NOT_FOUND

    def test_ifline_sync_mode_invalid(self):
        exc = IFLineSyncModeInvalidError("bad_mode", valid_modes=["auto", "manual"])
        assert exc.status_code == 422
        assert exc.error_code == ErrorCode.IFLINE_SYNC_MODE_INVALID
        assert exc.details["valid_modes"] == ["auto", "manual"]


class TestEntityExceptions:
    def test_item_not_found(self):
        exc = ItemNotFoundError(item_id=3)
        assert exc.status_code == 404
        assert exc.error_code == ErrorCode.ITEM_NOT_FOUND

    def test_location_not_found(self):
        exc = LocationNotFoundError(location_id=8)
        assert exc.status_code == 404
        assert exc.error_code == ErrorCode.LOCATION_NOT_FOUND

    def test_faction_not_found(self):
        exc = FactionNotFoundError(faction_id=12)
        assert exc.status_code == 404
        assert exc.error_code == ErrorCode.FACTION_NOT_FOUND

    def test_world_setting_not_found(self):
        exc = WorldSettingNotFoundError(setting_id=99)
        assert exc.status_code == 404
        assert exc.error_code == ErrorCode.WORLD_SETTING_NOT_FOUND

    def test_rule_not_found(self):
        exc = RuleNotFoundError(rule_id=44)
        assert exc.status_code == 404
        assert exc.error_code == ErrorCode.RULE_NOT_FOUND

    def test_plot_thread_not_found(self):
        exc = PlotThreadNotFoundError(plot_thread_id=21)
        assert exc.status_code == 404
        assert exc.error_code == ErrorCode.PLOT_THREAD_NOT_FOUND

    def test_plot_thread_status_invalid(self):
        exc = PlotThreadStatusInvalidError("done", valid_statuses=["active", "resolved"])
        assert exc.status_code == 422
        assert exc.error_code == ErrorCode.PLOT_THREAD_STATUS_INVALID


class TestSessionExceptions:
    def test_session_not_found(self):
        exc = SessionNotFoundError(session_id=100)
        assert exc.status_code == 404
        assert exc.error_code == ErrorCode.SESSION_NOT_FOUND

    def test_session_expired(self):
        exc = SessionExpiredError(session_id=100)
        assert exc.status_code == 410
        assert exc.error_code == ErrorCode.SESSION_EXPIRED


class TestStyleExceptions:
    def test_style_not_found_by_id(self):
        exc = StyleNotFoundError(style_id=1)
        assert exc.status_code == 404
        assert exc.error_code == ErrorCode.STYLE_NOT_FOUND
        assert exc.details["style_id"] == 1

    def test_style_not_found_by_name(self):
        exc = StyleNotFoundError(style_name="cyberpunk")
        assert exc.details["style_name"] == "cyberpunk"

    def test_style_invalid(self):
        exc = StyleInvalidError()
        assert exc.status_code == 422
        assert exc.error_code == ErrorCode.STYLE_INVALID


class TestImportExportExceptions:
    def test_import_version_unsupported(self):
        exc = ImportVersionUnsupportedError("0.5", supported_versions=["1.0", "2.0"])
        assert exc.status_code == 422
        assert exc.error_code == ErrorCode.IMPORT_VERSION_UNSUPPORTED
        assert exc.details["supported_versions"] == ["1.0", "2.0"]

    def test_import_data_invalid(self):
        exc = ImportDataInvalidError("Missing required field 'characters'")
        assert exc.status_code == 422
        assert exc.error_code == ErrorCode.IMPORT_DATA_INVALID
        assert exc.details["reason"] == "Missing required field 'characters'"


class TestAIServiceExceptions:
    def test_ai_service_error(self):
        exc = AIServiceError("Model unavailable")
        assert exc.status_code == 502
        assert exc.error_code == ErrorCode.AI_SERVICE_ERROR

    def test_ai_service_timeout(self):
        exc = AIServiceTimeoutError(timeout_seconds=30.0)
        assert exc.status_code == 502
        assert exc.error_code == ErrorCode.AI_SERVICE_TIMEOUT
        assert exc.details["timeout_seconds"] == 30.0

    def test_ai_service_rate_limit(self):
        exc = AIServiceRateLimitError(retry_after=60)
        assert exc.status_code == 502
        assert exc.error_code == ErrorCode.AI_SERVICE_RATE_LIMIT
        assert exc.details["retry_after_seconds"] == 60


# =============================================================================
# Error Response Builder Tests
# =============================================================================

class TestBuildErrorResponse:
    def test_basic_response(self):
        resp = build_error_response("Not found", "NOT_FOUND")
        assert resp["error_code"] == "NOT_FOUND"
        assert resp["message"] == "Not found"
        assert "timestamp" in resp

    def test_response_with_details(self):
        resp = build_error_response("Invalid", "VALIDATION_ERROR", details={"field": "name"})
        assert resp["details"] == {"field": "name"}

    def test_response_with_request_id(self):
        resp = build_error_response("Error", "INTERNAL_ERROR", request_id="abc-123")
        assert resp["request_id"] == "abc-123"

    def test_response_with_timestamp(self):
        ts = "2024-01-01T00:00:00+00:00"
        resp = build_error_response("Error", "INTERNAL_ERROR", timestamp=ts)
        assert resp["timestamp"] == ts

    def test_response_without_optional_fields(self):
        resp = build_error_response("Simple error", "SIMPLE_ERROR")
        assert "details" not in resp
        assert "request_id" not in resp


# =============================================================================
# Request Context Tests
# =============================================================================

class TestRequestContext:
    def test_get_request_id_generates_one(self):
        clear_request_context()
        req_id = get_request_id()
        assert req_id
        assert isinstance(req_id, str)
        assert len(req_id) == 36  # UUID length

    def test_set_and_get_request_id(self):
        set_request_id("test-req-123")
        assert get_request_id() == "test-req-123"
        clear_request_context()

    def test_set_and_get_correlation_id(self):
        set_correlation_id("corr-456")
        assert get_correlation_id() == "corr-456"
        clear_request_context()

    def test_get_request_context(self):
        rc_set_request_context(request_id="req-1", correlation_id="corr-1", user_id="user-1")
        ctx = get_request_context()
        assert ctx["request_id"] == "req-1"
        assert ctx["correlation_id"] == "corr-1"
        assert ctx["user_id"] == "user-1"
        clear_request_context()

    def test_clear_request_context(self):
        rc_set_request_context(request_id="req-1", correlation_id="corr-1", user_id="user-1")
        clear_request_context()
        assert get_request_id() != "req-1"  # Should generate new one
        assert get_correlation_id() is None
        assert get_user_id() is None

    def test_set_request_context_returns_request_id(self):
        req_id = rc_set_request_context()
        assert req_id
        assert isinstance(req_id, str)
        clear_request_context()

    def test_set_request_context_with_existing_id(self):
        req_id = rc_set_request_context(request_id="my-id")
        assert req_id == "my-id"
        clear_request_context()

    @pytest.mark.asyncio
    async def test_context_isolation_across_tasks(self):
        """Ensure context vars are isolated between async tasks."""
        async def task1():
            rc_set_request_context(request_id="task1-id")
            return get_request_id()

        async def task2():
            rc_set_request_context(request_id="task2-id")
            return get_request_id()

        id1, id2 = await asyncio.gather(task1(), task2())
        assert id1 == "task1-id"
        assert id2 == "task2-id"
        clear_request_context()


# =============================================================================
# Exception Handler Integration Tests
# =============================================================================

class TestExceptionHandlers:
    @pytest.fixture
    def test_app(self):
        app = FastAPI()
        register_exception_handlers(app)

        @app.get("/not-found")
        async def raise_not_found():
            raise NotFoundError("Resource missing")

        @app.get("/validation")
        async def raise_validation():
            raise ValidationError("Bad input", details={"field": "email"})

        @app.get("/generic")
        async def raise_generic():
            raise ValueError("Unexpected error")

        @app.get("/character/{char_id}")
        async def raise_character_not_found(char_id: int):
            raise CharacterNotFoundError(character_id=char_id)

        return app

    @pytest.fixture
    def client(self, test_app):
        return TestClient(test_app, raise_server_exceptions=False)

    def test_not_found_handler(self, client):
        response = client.get("/not-found")
        assert response.status_code == 404
        data = response.json()
        assert data["error_code"] == "NOT_FOUND"
        assert data["message"] == "Resource missing"
        assert "timestamp" in data

    def test_validation_handler(self, client):
        response = client.get("/validation")
        assert response.status_code == 422
        data = response.json()
        assert data["error_code"] == "VALIDATION_ERROR"
        assert data["details"] == {"field": "email"}

    def test_generic_handler(self, client):
        response = client.get("/generic")
        assert response.status_code == 500
        data = response.json()
        assert data["error_code"] == "INTERNAL_ERROR"
        assert data["message"] == "Internal server error"

    def test_character_not_found_handler(self, client):
        response = client.get("/character/42")
        assert response.status_code == 404
        data = response.json()
        assert data["error_code"] == "CHARACTER_NOT_FOUND"
        assert data["details"]["character_id"] == 42

    def test_response_has_request_id_header(self, client):
        response = client.get("/not-found")
        assert "X-Request-ID" in response.headers
        assert response.headers["X-Request-ID"]

    def test_error_response_structure(self, client):
        response = client.get("/validation")
        data = response.json()
        assert "error_code" in data
        assert "message" in data
        assert "timestamp" in data
        assert "details" in data


# =============================================================================
# Request Context Module Tests (middleware/request_context.py)
# =============================================================================

class TestRequestContextModule:
    def test_request_id_var_exists(self):
        from backend.middleware.request_context import request_id_var
        assert isinstance(request_id_var, contextvars.ContextVar)

    def test_correlation_id_var_exists(self):
        from backend.middleware.request_context import correlation_id_var
        assert isinstance(correlation_id_var, contextvars.ContextVar)

    def test_user_id_var_exists(self):
        from backend.middleware.request_context import user_id_var
        assert isinstance(user_id_var, contextvars.ContextVar)
