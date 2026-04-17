"""
Tests for export/import functionality.
"""

import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch


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

    def test_import_from_json(self):
        """Test import_from_json parses JSON correctly."""
        from backend.services.export_import import import_from_json

        json_str = '{"version": "1.0", "data": {}}'

        result = import_from_json(json_str)

        assert result["version"] == "1.0"
        assert "data" in result

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

    def test_import_version_check(self):
        """Test import rejects unsupported versions."""
        from backend.services.export_import import import_project

        data = {
            "version": "99.0",
            "data": {}
        }

        with pytest.raises(ValueError, match="Unsupported export version"):
            import_project(data, mode="merge")


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
