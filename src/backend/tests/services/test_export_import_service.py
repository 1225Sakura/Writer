"""Tests for Export/Import Service - ZIP security, validation, conflict resolution, serialization."""

import io
import json
import zipfile

import pytest
import yaml

from backend.services.export_import import (
    ZipSecurityError,
    _is_safe_path,
    _check_zip_security,
    _validate_import_data,
    _validate_character,
    _validate_item,
    _validate_location,
    _validate_faction,
    _validate_world_setting,
    _validate_rule,
    _validate_outline,
    _validate_if_line,
    _validate_chat_session,
    _validate_plot_thread,
    ConflictResolution,
    ExportProgressCallback,
    ImportValidationError,
    export_to_json,
    export_to_yaml,
    export_to_zip,
    import_from_json,
    import_from_yaml,
    import_from_zip,
    _model_to_dict,
    MAX_UNCOMPRESSED_SIZE,
    MAX_COMPRESSION_RATIO,
    MAX_TOTAL_UNCOMPRESSED_SIZE,
)


# =============================================================================
# _is_safe_path
# =============================================================================


class TestIsSafePath:
    """Test path traversal prevention."""

    def test_normal_path_is_safe(self):
        assert _is_safe_path("/tmp", "project_data.json") is True

    def test_subdirectory_path_is_safe(self):
        assert _is_safe_path("/tmp", "subdir/project_data.json") is True

    def test_dotdot_traversal_is_unsafe(self):
        assert _is_safe_path("/tmp", "../etc/passwd") is False

    def test_dotdot_middle_is_unsafe(self):
        assert _is_safe_path("/tmp", "subdir/../../etc/passwd") is False


# =============================================================================
# ZIP Security
# =============================================================================


class TestZipSecurity:
    """Test ZIP archive security checks."""

    def _make_zip(self, entries: list[tuple[str, str | bytes]]) -> bytes:
        """Helper to create a ZIP in memory."""
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            for name, content in entries:
                zf.writestr(name, content)
        return buf.getvalue()

    def test_safe_zip_passes(self):
        data = self._make_zip([("project_data.json", '{"version":"1.0","data":{}}')])
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            _check_zip_security(zf)  # Should not raise

    def test_path_traversal_raises(self):
        data = self._make_zip([("../evil.txt", "bad")])
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            with pytest.raises(ZipSecurityError, match="Path traversal"):
                _check_zip_security(zf)


# =============================================================================
# Import Validation
# =============================================================================


class TestValidateImportData:
    """Test top-level import data validation."""

    def test_valid_data_no_errors(self):
        data = {"version": "1.0", "data": {}}
        errors = _validate_import_data(data)
        assert errors == []

    def test_missing_version(self):
        data = {"data": {}}
        errors = _validate_import_data(data)
        assert any(e["field"] == "version" for e in errors)

    def test_unsupported_version(self):
        data = {"version": "2.0", "data": {}}
        errors = _validate_import_data(data)
        assert any("Unsupported version" in e["error"] for e in errors)

    def test_missing_data_field(self):
        data = {"version": "1.0"}
        errors = _validate_import_data(data)
        assert any(e["field"] == "data" for e in errors)

    def test_non_dict_root(self):
        errors = _validate_import_data("not a dict")
        assert len(errors) == 1
        assert errors[0]["field"] == "root"

    def test_characters_not_array(self):
        data = {"version": "1.0", "data": {"characters": "not a list"}}
        errors = _validate_import_data(data)
        assert any("characters" in e["field"] for e in errors)


# =============================================================================
# Entity Validators
# =============================================================================


class TestEntityValidators:
    """Test individual entity validators."""

    def test_validate_character_valid(self):
        errors = _validate_character({"id": 1, "name": "Hero"}, 0)
        assert errors == []

    def test_validate_character_missing_id(self):
        errors = _validate_character({"name": "Hero"}, 0)
        assert any("id" in e["error"] for e in errors)

    def test_validate_character_missing_name(self):
        errors = _validate_character({"id": 1}, 0)
        assert any("name" in e["error"] for e in errors)

    def test_validate_character_empty_name(self):
        errors = _validate_character({"id": 1, "name": ""}, 0)
        assert any("name" in e["error"] for e in errors)

    def test_validate_character_not_dict(self):
        errors = _validate_character("invalid", 0)
        assert any("object" in e["error"] for e in errors)

    def test_validate_character_long_name(self):
        errors = _validate_character({"id": 1, "name": "x" * 201}, 0)
        assert any("maximum length" in e["error"] for e in errors)

    def test_validate_item_valid(self):
        errors = _validate_item({"id": 1, "name": "Sword"}, 0)
        assert errors == []

    def test_validate_item_missing_name(self):
        errors = _validate_item({"id": 1}, 0)
        assert any("name" in e["error"] for e in errors)

    def test_validate_location_valid(self):
        errors = _validate_location({"id": 1, "name": "Castle"}, 0)
        assert errors == []

    def test_validate_location_missing_id(self):
        errors = _validate_location({"name": "Castle"}, 0)
        assert any("id" in e["error"] for e in errors)

    def test_validate_faction_valid(self):
        errors = _validate_faction({"id": 1, "name": "Guild"}, 0)
        assert errors == []

    def test_validate_faction_not_dict(self):
        errors = _validate_faction(123, 0)
        assert any("object" in e["error"] for e in errors)

    def test_validate_world_setting_valid(self):
        errors = _validate_world_setting({"id": 1, "name": "Realm"}, 0)
        assert errors == []

    def test_validate_rule_valid(self):
        errors = _validate_rule({"id": 1, "name": "Power Rule"}, 0)
        assert errors == []

    def test_validate_outline_valid(self):
        errors = _validate_outline({"id": 1, "title": "Main Arc"}, 0)
        assert errors == []

    def test_validate_outline_missing_title(self):
        errors = _validate_outline({"id": 1}, 0)
        assert any("title" in e["error"] for e in errors)

    def test_validate_outline_bad_chapters(self):
        data = {"id": 1, "title": "Arc", "chapters": "not a list"}
        errors = _validate_outline(data, 0)
        assert any("chapters" in e["field"] for e in errors)

    def test_validate_if_line_valid(self):
        errors = _validate_if_line({"id": 1, "title": "IF Arc"}, 0)
        assert errors == []

    def test_validate_if_line_missing_title(self):
        errors = _validate_if_line({"id": 1}, 0)
        assert any("title" in e["error"] for e in errors)

    def test_validate_chat_session_valid(self):
        errors = _validate_chat_session({"id": 1}, 0)
        assert errors == []

    def test_validate_plot_thread_valid(self):
        errors = _validate_plot_thread({"id": 1, "title": "Thread"}, 0)
        assert errors == []

    def test_validate_plot_thread_missing_title(self):
        errors = _validate_plot_thread({"id": 1}, 0)
        assert any("title" in e["error"] for e in errors)


# =============================================================================
# ConflictResolution
# =============================================================================


class TestConflictResolution:
    """Test conflict resolution strategies."""

    def test_import_wins_returns_imported(self):
        existing = {"id": 1, "name": "Old"}
        imported = {"id": 1, "name": "New"}
        result = ConflictResolution.resolve_conflict(existing, imported, "import_wins")
        assert result == imported

    def test_existing_wins_returns_existing(self):
        existing = {"id": 1, "name": "Old"}
        imported = {"id": 1, "name": "New"}
        result = ConflictResolution.resolve_conflict(existing, imported, "existing_wins")
        assert result == existing

    def test_merge_prefers_imported_non_none(self):
        existing = {"id": 1, "name": "Old", "desc": "keep"}
        imported = {"id": 1, "name": "New", "desc": None}
        result = ConflictResolution.resolve_conflict(existing, imported, "merge")
        assert result["name"] == "New"
        assert result["desc"] == "keep"

    def test_merge_deep_nested(self):
        existing = {"id": 1, "meta": {"a": 1, "b": 2}}
        imported = {"id": 1, "meta": {"b": 99, "c": 3}}
        result = ConflictResolution.resolve_conflict(existing, imported, "merge")
        assert result["meta"]["a"] == 1
        assert result["meta"]["b"] == 99
        assert result["meta"]["c"] == 3

    def test_detect_conflicts_finds_differences(self):
        existing = [{"id": 1, "name": "Old"}]
        imported = [{"id": 1, "name": "New"}]
        conflicts = ConflictResolution.detect_conflicts(existing, imported)
        assert len(conflicts) == 1
        assert conflicts[0]["id"] == "1"

    def test_detect_conflicts_no_overlap(self):
        existing = [{"id": 1, "name": "A"}]
        imported = [{"id": 2, "name": "B"}]
        conflicts = ConflictResolution.detect_conflicts(existing, imported)
        assert len(conflicts) == 0

    def test_detect_conflicts_same_data_no_conflict(self):
        existing = [{"id": 1, "name": "A"}]
        imported = [{"id": 1, "name": "A"}]
        conflicts = ConflictResolution.detect_conflicts(existing, imported)
        assert len(conflicts) == 0


# =============================================================================
# ExportProgressCallback
# =============================================================================


class TestExportProgressCallback:
    """Test progress callback."""

    def test_initial_state(self):
        cb = ExportProgressCallback()
        assert cb.progress == 0.0
        assert cb.current_step == ""
        assert cb.callback is None

    def test_update_without_callback(self):
        cb = ExportProgressCallback()
        cb.update(0.5, "halfway")
        assert cb.progress == 0.5
        assert cb.current_step == "halfway"

    def test_update_with_callback(self):
        cb = ExportProgressCallback()
        calls = []
        cb.set_callback(lambda p, s: calls.append((p, s)))
        cb.update(0.7, "step")
        assert calls == [(0.7, "step")]


# =============================================================================
# Serialization (export_to_json, export_to_yaml, export_to_zip)
# =============================================================================


class TestSerialization:
    """Test export serialization functions."""

    def test_export_to_json(self):
        data = {"version": "1.0", "data": {"characters": []}}
        result = export_to_json(data)
        parsed = json.loads(result)
        assert parsed["version"] == "1.0"

    def test_export_to_json_indent(self):
        data = {"key": "value"}
        result = export_to_json(data, indent=4)
        assert "\n    " in result

    def test_export_to_yaml(self):
        data = {"version": "1.0", "data": {"characters": []}}
        result = export_to_yaml(data)
        parsed = yaml.safe_load(result)
        assert parsed["version"] == "1.0"

    def test_export_to_zip_json(self):
        data = {"version": "1.0", "data": {}}
        zip_bytes = export_to_zip(data, format="json")
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            assert "project_data.json" in zf.namelist()
            assert "export_info.json" in zf.namelist()
            content = json.loads(zf.read("project_data.json"))
            assert content["version"] == "1.0"

    def test_export_to_zip_yaml(self):
        data = {"version": "1.0", "data": {}}
        zip_bytes = export_to_zip(data, format="yaml")
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            assert "project_data.yaml" in zf.namelist()


# =============================================================================
# Deserialization (import_from_json, import_from_yaml, import_from_zip)
# =============================================================================


class TestDeserialization:
    """Test import deserialization functions."""

    def test_import_from_json_valid(self):
        data = import_from_json('{"version": "1.0", "data": {}}')
        assert data["version"] == "1.0"

    def test_import_from_json_invalid(self):
        with pytest.raises(ValueError, match="Invalid JSON"):
            import_from_json("{bad json}")

    def test_import_from_yaml_valid(self):
        data = import_from_yaml("version: '1.0'\ndata: {}")
        assert data["version"] == "1.0"

    def test_import_from_yaml_invalid(self):
        # yaml.safe_load is very permissive, but totally broken YAML still raises
        with pytest.raises(ValueError, match="Invalid YAML"):
            import_from_yaml(":\n:\n:")

    def test_import_from_zip_json(self):
        data = {"version": "1.0", "data": {}}
        zip_bytes = export_to_zip(data, format="json")
        result = import_from_zip(zip_bytes)
        assert result["version"] == "1.0"

    def test_import_from_zip_yaml(self):
        data = {"version": "1.0", "data": {}}
        zip_bytes = export_to_zip(data, format="yaml")
        result = import_from_zip(zip_bytes)
        assert result["version"] == "1.0"

    def test_import_from_zip_invalid(self):
        with pytest.raises(ValueError, match="Invalid ZIP"):
            import_from_zip(b"not a zip")

    def test_import_from_zip_missing_project_data(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("random.txt", "data")
        with pytest.raises(ValueError, match="No project_data"):
            import_from_zip(buf.getvalue())


# =============================================================================
# ImportValidationError
# =============================================================================


class TestImportValidationError:
    """Test custom validation error."""

    def test_error_message_truncates(self):
        errors = [{"field": f"f{i}", "error": f"e{i}"} for i in range(10)]
        exc = ImportValidationError(errors)
        assert "and 5 more" in str(exc)

    def test_error_stores_errors(self):
        errors = [{"field": "f1", "error": "e1"}]
        exc = ImportValidationError(errors)
        assert exc.errors == errors


# =============================================================================
# _model_to_dict
# =============================================================================


class TestModelToDict:
    """Test SQLAlchemy model to dict conversion."""

    def test_none_returns_none(self):
        assert _model_to_dict(None) is None

    def test_skips_private_attrs(self):
        class FakeModel:
            __dict__ = {"_sa_instance_state": "x", "name": "test", "id": 1}

        result = _model_to_dict(FakeModel())
        assert result == {"name": "test", "id": 1}

    def test_converts_datetime_to_iso(self):
        from datetime import datetime, timezone

        dt = datetime(2024, 1, 1, tzinfo=timezone.utc)

        class FakeModel:
            __dict__ = {"created_at": dt}

        result = _model_to_dict(FakeModel())
        assert "2024-01-01" in result["created_at"]

    def test_converts_uuid_to_str(self):
        from uuid import UUID

        uid = UUID("12345678-1234-5678-1234-567812345678")

        class FakeModel:
            __dict__ = {"id": uid}

        result = _model_to_dict(FakeModel())
        assert isinstance(result["id"], str)

    def test_skips_model_attrs(self):
        class Child:
            __dict__ = {"val": 1}

        class FakeModel:
            __dict__ = {"name": "test", "child": Child()}

        result = _model_to_dict(FakeModel())
        assert "child" not in result
        assert result["name"] == "test"
