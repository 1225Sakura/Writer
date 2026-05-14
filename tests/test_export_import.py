"""
Tests for export/import functionality.
"""

import pytest
import json
import yaml
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime


class TestExportImportService:
    """Test export/import service."""

    @pytest.fixture
    def mock_db_service(self):
        """Create a mock database service."""
        return MagicMock()

    @pytest.mark.asyncio
    async def test_export_project_structure(self, mock_db_service):
        """Test export_project returns expected structure."""
        mock_db_service.get_all_characters = AsyncMock(return_value=[])
        mock_db_service.get_all_items = AsyncMock(return_value=[])
        mock_db_service.get_all_locations = AsyncMock(return_value=[])
        mock_db_service.get_all_factions = AsyncMock(return_value=[])
        mock_db_service.get_all_world_settings = AsyncMock(return_value=[])
        mock_db_service.get_all_rules = AsyncMock(return_value=[])
        mock_db_service.get_all_outlines = AsyncMock(return_value=[])
        mock_db_service.get_all_chapters = AsyncMock(return_value=[])
        mock_db_service.get_all_if_lines = AsyncMock(return_value=[])
        mock_db_service.get_all_chat_sessions = AsyncMock(return_value=[])

        from backend.services.export_import import export_project

        with patch('backend.services.export_import.async_session_maker'):
            pass

    def test_export_to_json(self):
        """Test export_to_json serializes data correctly."""
        from backend.services.export_import import export_to_json

        data = {
            "version": "1.0",
            "exported_at": "2024-01-01T00:00:00",
            "data": {
                "characters": [{"id": 1, "name": "Test"}],
            }
        }

        result = export_to_json(data)

        assert isinstance(result, str)
        parsed = json.loads(result)
        assert parsed["version"] == "1.0"
        assert len(parsed["data"]["characters"]) == 1

    def test_export_to_yaml(self):
        """Test export_to_yaml serializes data correctly."""
        from backend.services.export_import import export_to_yaml

        data = {
            "version": "1.0",
            "exported_at": "2024-01-01T00:00:00",
            "data": {
                "characters": [{"id": 1, "name": "Test"}],
            }
        }

        result = export_to_yaml(data)

        assert isinstance(result, str)
        parsed = yaml.safe_load(result)
        assert parsed["version"] == "1.0"
        assert len(parsed["data"]["characters"]) == 1

    def test_export_to_zip(self):
        """Test export_to_zip creates valid ZIP archive."""
        from backend.services.export_import import export_to_zip
        import zipfile
        import io

        data = {
            "version": "1.0",
            "exported_at": "2024-01-01T00:00:00",
            "data": {}
        }

        zip_bytes = export_to_zip(data)

        assert isinstance(zip_bytes, bytes)
        assert len(zip_bytes) > 0

        # Verify ZIP structure
        with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as zf:
            assert "project_data.json" in zf.namelist()

            content = zf.read("project_data.json").decode('utf-8')
            parsed = json.loads(content)
            assert parsed["version"] == "1.0"

    def test_export_to_zip_yaml_format(self):
        """Test export_to_zip creates valid ZIP archive with YAML."""
        from backend.services.export_import import export_to_zip
        import zipfile
        import io

        data = {
            "version": "1.0",
            "exported_at": "2024-01-01T00:00:00",
            "data": {}
        }

        zip_bytes = export_to_zip(data, format="yaml")

        assert isinstance(zip_bytes, bytes)
        assert len(zip_bytes) > 0

        with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as zf:
            assert "project_data.yaml" in zf.namelist()

            content = zf.read("project_data.yaml").decode('utf-8')
            parsed = yaml.safe_load(content)
            assert parsed["version"] == "1.0"

    def test_import_from_json(self):
        """Test import_from_json parses JSON correctly."""
        from backend.services.export_import import import_from_json

        json_str = '{"version": "1.0", "data": {}}'

        result = import_from_json(json_str)

        assert result["version"] == "1.0"
        assert "data" in result

    def test_import_from_json_invalid(self):
        """Test import_from_json raises error for invalid JSON."""
        from backend.services.export_import import import_from_json

        with pytest.raises(ValueError, match="Invalid JSON"):
            import_from_json("not valid json {")

    def test_import_from_yaml(self):
        """Test import_from_yaml parses YAML correctly."""
        from backend.services.export_import import import_from_yaml

        yaml_str = 'version: "1.0"\ndata: {}'

        result = import_from_yaml(yaml_str)

        assert result["version"] == "1.0"
        assert "data" in result

    def test_import_from_yaml_invalid(self):
        """Test import_from_yaml raises error for invalid YAML."""
        from backend.services.export_import import import_from_yaml

        with pytest.raises(ValueError, match="Invalid YAML"):
            import_from_yaml("invalid: yaml: :")

    def test_import_from_zip(self):
        """Test import_from_zip extracts data correctly."""
        from backend.services.export_import import export_to_zip, import_from_zip
        import zipfile
        import io

        data = {
            "version": "1.0",
            "exported_at": "2024-01-01T00:00:00",
            "data": {
                "characters": [{"id": 1, "name": "Test Character"}],
            }
        }

        zip_bytes = export_to_zip(data)
        result = import_from_zip(zip_bytes)

        assert result["version"] == "1.0"
        assert len(result["data"]["characters"]) == 1
        assert result["data"]["characters"][0]["name"] == "Test Character"

    def test_import_from_zip_auto_detect_format(self):
        """Test import_from_zip auto-detects JSON vs YAML in ZIP."""
        from backend.services.export_import import export_to_zip, import_from_zip
        import zipfile
        import io

        data = {
            "version": "1.0",
            "exported_at": "2024-01-01T00:00:00",
            "data": {"characters": []}
        }

        # Test with YAML format
        zip_bytes = export_to_zip(data, format="yaml")
        result = import_from_zip(zip_bytes)

        assert result["version"] == "1.0"

    @pytest.mark.asyncio
    async def test_import_version_check(self):
        """Test import rejects unsupported versions."""
        from backend.services.export_import import import_project

        data = {
            "version": "99.0",
            "data": {}
        }

        with pytest.raises(ValueError, match="Unsupported export version"):
            await import_project(data, mode="merge")


class TestImportValidation:
    """Test import validation functionality."""

    def test_validate_missing_version(self):
        """Test validation detects missing version."""
        from backend.services.export_import import _validate_import_data

        data = {"data": {"characters": []}}
        errors = _validate_import_data(data)

        assert any(e["field"] == "version" for e in errors)

    def test_validate_unsupported_version(self):
        """Test validation detects unsupported version."""
        from backend.services.export_import import _validate_import_data

        data = {"version": "2.0", "data": {"characters": []}}
        errors = _validate_import_data(data)

        assert any("Unsupported version" in e["error"] for e in errors)

    def test_validate_missing_data_field(self):
        """Test validation detects missing data field."""
        from backend.services.export_import import _validate_import_data

        data = {"version": "1.0"}
        errors = _validate_import_data(data)

        assert any(e["field"] == "data" for e in errors)

    def test_validate_character_missing_name(self):
        """Test validation detects character without name."""
        from backend.services.export_import import _validate_import_data

        data = {
            "version": "1.0",
            "data": {
                "characters": [{"id": 1}]  # Missing name
            }
        }
        errors = _validate_import_data(data)

        assert any("name" in e["field"].lower() for e in errors)

    def test_validate_character_invalid_id(self):
        """Test validation detects character with invalid ID type."""
        from backend.services.export_import import _validate_import_data

        data = {
            "version": "1.0",
            "data": {
                "characters": [{"id": [1, 2, 3], "name": "Test"}]  # ID as array
            }
        }
        errors = _validate_import_data(data)

        assert any("id" in e["field"].lower() and "integer" in e["error"].lower() for e in errors)

    def test_validate_item_missing_fields(self):
        """Test validation detects item without required fields."""
        from backend.services.export_import import _validate_import_data

        data = {
            "version": "1.0",
            "data": {
                "items": [{"description": "Only description"}]  # Missing id and name
            }
        }
        errors = _validate_import_data(data)

        error_fields = [e["field"] for e in errors]
        assert any("items" in f and "id" in f for f in error_fields)
        assert any("items" in f and "name" in f for f in error_fields)

    def test_validate_outline_with_invalid_chapters(self):
        """Test validation detects outline with non-array chapters."""
        from backend.services.export_import import _validate_import_data

        data = {
            "version": "1.0",
            "data": {
                "outlines": [{
                    "id": 1,
                    "title": "Test",
                    "chapters": "not an array"  # Should be array
                }]
            }
        }
        errors = _validate_import_data(data)

        assert any("chapters" in e["field"] and "array" in e["error"].lower() for e in errors)

    def test_validate_valid_data(self):
        """Test validation passes for valid data."""
        from backend.services.export_import import _validate_import_data

        data = {
            "version": "1.0",
            "data": {
                "characters": [{"id": 1, "name": "Test Character"}],
                "items": [{"id": 1, "name": "Test Item"}],
                "locations": [{"id": 1, "name": "Test Location"}],
                "factions": [{"id": 1, "name": "Test Faction"}],
                "world_settings": [{"id": 1, "name": "Test Setting"}],
                "rules": [{"id": 1, "name": "Test Rule"}],
                "outlines": [{"id": 1, "title": "Test Outline", "chapters": []}],
                "if_lines": [{"id": 1, "title": "Test IF"}],
                "chat_sessions": [{"id": 1}],
                "plot_threads": [{"id": 1, "title": "Test Thread"}],
            }
        }
        errors = _validate_import_data(data)

        # Should have no errors for valid data
        assert len(errors) == 0


class TestConflictResolution:
    """Test conflict resolution functionality."""

    def test_detect_conflicts_no_conflicts(self):
        """Test conflict detection with no conflicts."""
        from backend.services.export_import import ConflictResolution

        existing = [{"id": 1, "name": "Existing"}]
        imported = [{"id": 2, "name": "New"}]

        conflicts = ConflictResolution.detect_conflicts(existing, imported)

        assert len(conflicts) == 0

    def test_detect_conflicts_with_conflicts(self):
        """Test conflict detection with conflicts."""
        from backend.services.export_import import ConflictResolution

        existing = [{"id": 1, "name": "Existing", "description": "Old desc"}]
        imported = [{"id": 1, "name": "Existing", "description": "New desc"}]

        conflicts = ConflictResolution.detect_conflicts(existing, imported)

        assert len(conflicts) == 1
        assert conflicts[0]["id"] == "1"
        assert "description" in conflicts[0]["differences"]

    def test_resolve_conflict_import_wins(self):
        """Test import_wins conflict resolution."""
        from backend.services.export_import import ConflictResolution

        existing = {"name": "Existing", "description": "Old"}
        imported = {"name": "Imported", "description": "New"}

        result = ConflictResolution.resolve_conflict(existing, imported, "import_wins")

        assert result["name"] == "Imported"
        assert result["description"] == "New"

    def test_resolve_conflict_existing_wins(self):
        """Test existing_wins conflict resolution."""
        from backend.services.export_import import ConflictResolution

        existing = {"name": "Existing", "description": "Old"}
        imported = {"name": "Imported", "description": "New"}

        result = ConflictResolution.resolve_conflict(existing, imported, "existing_wins")

        assert result["name"] == "Existing"
        assert result["description"] == "Old"

    def test_resolve_conflict_merge(self):
        """Test merge conflict resolution."""
        from backend.services.export_import import ConflictResolution

        existing = {"name": "Existing", "description": "Old", "status": "active"}
        imported = {"name": "Imported", "description": "New"}

        result = ConflictResolution.resolve_conflict(existing, imported, "merge")

        assert result["name"] == "Imported"  # Imported wins for name
        assert result["description"] == "New"  # Imported wins for description
        assert result["status"] == "active"  # Existing preserved

    def test_merge_deep(self):
        """Test deep merge of nested dictionaries."""
        from backend.services.export_import import ConflictResolution

        existing = {"outer": {"inner": "existing", "extra": "kept"}}
        imported = {"outer": {"inner": "imported"}}

        result = ConflictResolution.resolve_conflict(existing, imported, "merge")

        assert result["outer"]["inner"] == "imported"
        assert result["outer"]["extra"] == "kept"


class TestImportValidationError:
    """Test ImportValidationError exception."""

    def test_import_validation_error_message(self):
        """Test ImportValidationError formats message correctly."""
        from backend.services.export_import import ImportValidationError

        errors = [
            {"field": "data.characters[0].name", "error": "Missing required field"},
            {"field": "data.items[1].id", "error": "Invalid type"},
        ]

        error = ImportValidationError(errors)

        assert "Import validation failed" in str(error)
        assert "data.characters[0].name" in str(error)
        assert len(error.errors) == 2

    def test_import_validation_error_truncates_message(self):
        """Test ImportValidationError truncates long error lists."""
        from backend.services.export_import import ImportValidationError

        errors = [
            {"field": f"field{i}", "error": f"error{i}"}
            for i in range(10)
        ]

        error = ImportValidationError(errors)

        message = str(error)
        assert "and 5 more errors" in message


class TestExportProgressCallback:
    """Test ExportProgressCallback functionality."""

    def test_progress_callback_initial_state(self):
        """Test progress callback initial state."""
        from backend.services.export_import import ExportProgressCallback

        callback = ExportProgressCallback()

        assert callback.progress == 0.0
        assert callback.current_step == ""

    def test_progress_callback_update(self):
        """Test progress callback update."""
        from backend.services.export_import import ExportProgressCallback

        callback = ExportProgressCallback()
        progress_updates = []

        callback.set_callback(lambda p, s: progress_updates.append((p, s)))
        callback.update(0.5, "Halfway done")

        assert callback.progress == 0.5
        assert callback.current_step == "Halfway done"
        assert progress_updates == [(0.5, "Halfway done")]


class TestExportImportIntegration:
    """Integration tests for export/import round-trip."""

    def test_roundtrip_preserves_data(self):
        """Test that export and re-import preserves all data."""
        from backend.services.export_import import export_to_json, import_from_json

        original_data = {
            "version": "1.0",
            "exported_at": "2024-01-01T00:00:00",
            "data": {
                "characters": [
                    {"id": 1, "name": "主角", "gender": "male", "tier": "核心"},
                    {"id": 2, "name": "配角", "gender": "female", "tier": "支线"},
                ],
                "items": [
                    {"id": 1, "name": "宝剑", "description": "一把神兵"},
                ],
                "locations": [
                    {"id": 1, "name": "青云山", "importance": "重要"},
                ],
                "chapters": [
                    {"id": 1, "title": "第一章 起点", "status": "completed"},
                ],
            }
        }

        json_str = export_to_json(original_data)
        parsed = import_from_json(json_str)

        assert parsed["version"] == original_data["version"]
        assert len(parsed["data"]["characters"]) == 2
        assert len(parsed["data"]["items"]) == 1
        assert len(parsed["data"]["locations"]) == 1
        assert len(parsed["data"]["chapters"]) == 1

    def test_roundtrip_yaml_preserves_data(self):
        """Test that YAML export and re-import preserves all data."""
        from backend.services.export_import import export_to_yaml, import_from_yaml

        original_data = {
            "version": "1.0",
            "exported_at": "2024-01-01T00:00:00",
            "data": {
                "characters": [
                    {"id": 1, "name": "主角", "gender": "male"},
                ],
            }
        }

        yaml_str = export_to_yaml(original_data)
        parsed = import_from_yaml(yaml_str)

        assert parsed["version"] == original_data["version"]
        assert len(parsed["data"]["characters"]) == 1

    def test_roundtrip_unicode_preserved(self):
        """Test that Unicode characters are preserved in round-trip."""
        from backend.services.export_import import export_to_json, import_from_json, export_to_yaml, import_from_yaml

        original_data = {
            "version": "1.0",
            "data": {
                "characters": [
                    {"id": 1, "name": "张三", "description": "主角光环"},
                    {"id": 2, "name": "李四", "description": "反派"},
                ],
                "items": [
                    {"id": 1, "name": "倚天剑", "description": "屠龙刀"},
                ],
            }
        }

        # Test JSON
        json_str = export_to_json(original_data)
        parsed_json = import_from_json(json_str)
        assert parsed_json["data"]["characters"][0]["name"] == "张三"

        # Test YAML
        yaml_str = export_to_yaml(original_data)
        parsed_yaml = import_from_yaml(yaml_str)
        assert parsed_yaml["data"]["characters"][0]["name"] == "张三"


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_empty_data_export(self):
        """Test exporting empty data."""
        from backend.services.export_import import export_to_json

        data = {
            "version": "1.0",
            "exported_at": "2024-01-01T00:00:00",
            "data": {
                "characters": [],
                "items": [],
                "locations": [],
            }
        }

        result = export_to_json(data)
        parsed = json.loads(result)

        assert parsed["version"] == "1.0"
        assert len(parsed["data"]["characters"]) == 0

    def test_large_id_values(self):
        """Test handling of large ID values."""
        from backend.services.export_import import export_to_json, import_from_json

        data = {
            "version": "1.0",
            "data": {
                "characters": [
                    {"id": 999999999999, "name": "Large ID Character"},
                ],
            }
        }

        json_str = export_to_json(data)
        parsed = import_from_json(json_str)

        assert parsed["data"]["characters"][0]["id"] == 999999999999

    def test_special_characters_in_names(self):
        """Test handling of special characters in names."""
        from backend.services.export_import import export_to_json, import_from_json

        data = {
            "version": "1.0",
            "data": {
                "characters": [
                    {"id": 1, "name": "Name with 'quotes' and \"double quotes\""},
                    {"id": 2, "name": "Name with\nnewline"},
                    {"id": 3, "name": "Name with\ttab"},
                ],
            }
        }

        json_str = export_to_json(data)
        parsed = import_from_json(json_str)

        assert "'" in parsed["data"]["characters"][0]["name"]
        assert "\n" in parsed["data"]["characters"][1]["name"]

    def test_none_values_in_optional_fields(self):
        """Test handling of None values in optional fields."""
        from backend.services.export_import import export_to_json, import_from_json

        data = {
            "version": "1.0",
            "data": {
                "characters": [
                    {"id": 1, "name": "Test", "gender": None, "description": None},
                ],
            }
        }

        json_str = export_to_json(data)
        parsed = import_from_json(json_str)

        assert parsed["data"]["characters"][0]["gender"] is None
        assert parsed["data"]["characters"][0]["description"] is None
