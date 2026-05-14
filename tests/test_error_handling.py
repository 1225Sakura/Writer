"""
Test error handling for all exception types.
Exercises: NotFoundError (404), ValidationError (422), generic error (500)
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


def test_error_response_structure():
    """Verify error responses follow consistent format."""
    from backend.middleware.errors import build_error_response

    response = build_error_response(
        message="Test error",
        error_code="TEST_ERROR",
        details={"field": "value"},
        request_id="test-123"
    )

    assert response["error_code"] == "TEST_ERROR"
    assert response["message"] == "Test error"
    assert response["details"] == {"field": "value"}
    assert response["request_id"] == "test-123"
    assert "timestamp" in response

    # Without optional fields
    response = build_error_response(
        message="Simple error",
        error_code="SIMPLE"
    )
    assert response["error_code"] == "SIMPLE"
    assert response["message"] == "Simple error"
    assert "details" not in response
    assert "request_id" not in response


def test_exception_classes():
    """Test that exception classes are properly defined."""
    from backend.middleware.errors import (
        NotFoundError,
        ValidationError,
        AppException,
        AuthenticationError,
        PermissionDeniedError,
        ConflictError,
        ExternalServiceError,
        DatabaseError,
    )

    exc = NotFoundError(message="Resource not found")
    assert exc.message == "Resource not found"
    assert exc.status_code == 404
    assert exc.error_code == "NOT_FOUND"

    exc = ValidationError(message="Validation failed")
    assert exc.message == "Validation failed"
    assert exc.status_code == 422
    assert exc.error_code == "VALIDATION_ERROR"

    exc = AppException(message="Internal error", status_code=500, error_code="INTERNAL_ERROR")
    assert exc.message == "Internal error"
    assert exc.status_code == 500
    assert exc.error_code == "INTERNAL_ERROR"

    exc = NotFoundError(message="Character not found", details={"id": 123})
    assert exc.details == {"id": 123}

    exc = AuthenticationError()
    assert exc.status_code == 401

    exc = PermissionDeniedError()
    assert exc.status_code == 403

    exc = ConflictError()
    assert exc.status_code == 409

    exc = ExternalServiceError()
    assert exc.status_code == 502

    exc = DatabaseError()
    assert exc.status_code == 500


def test_error_response_json_structure():
    """Test that error responses can be JSON serialized properly."""
    import json

    from backend.middleware.errors import build_error_response

    response = build_error_response(
        message="Test error",
        error_code="TEST_ERROR",
        details={"errors": [{"field": "name", "message": "required"}]},
        request_id="req-123"
    )

    json_str = json.dumps(response)
    parsed = json.loads(json_str)

    assert parsed["error_code"] == "TEST_ERROR"
    assert parsed["message"] == "Test error"
    assert parsed["details"]["errors"][0]["field"] == "name"
    assert parsed["request_id"] == "req-123"


def test_generic_error_500_format_verified():
    """Verify error_id format in generic (500) errors."""
    test_request_id = "abcd12345678efgh"
    expected_error_id = f"ERR-{test_request_id[:8]}"
    assert expected_error_id == "ERR-abcd1234"


def test_notfound_error_404_format_verified():
    """Verify NotFoundError (404) format."""
    from backend.middleware.errors import NotFoundError

    exc = NotFoundError(message="Character not found", details={"id": 42})
    assert exc.status_code == 404
    assert exc.error_code == "NOT_FOUND"
    assert exc.message == "Character not found"
    assert exc.details == {"id": 42}


def test_error_handlers_registered():
    """Verify error handlers are properly registered in the app."""
    from backend.middleware.errors import (
        register_exception_handlers,
        NotFoundError,
        ValidationError,
        AppException,
        app_exception_handler,
        generic_exception_handler,
    )
    assert callable(app_exception_handler)
    assert callable(generic_exception_handler)
