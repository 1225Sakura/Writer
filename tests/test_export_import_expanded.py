"""
Expanded tests for export/import integration scenarios.
"""

import pytest
import json
import zipfile
import io
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch, Mock

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))

from backend.services.export_import import (
    export_project,
    export_to_json,
    export_to_zip,
    import_project,
    import_from_json,
    import_from_zip,
    _model_to_dict,
    _clear_all_data,
    _import_characters,
    _import_items,
    _import_locations,
    _import_factions,
    _import_world_settings,
    _import_rules,
    _import_outlines,
    _import_if_lines,
    _import_chat_sessions,
    _import_plot_threads,
    _import_writing_settings,
)


class TestModelToDict:
    """Test _model_to_dict helper."""

    def test_basic_conversion(self):
        """Test basic model to dict conversion."""
        model = MagicMock()
        model.__dict__ = {
            "id": 1,
            "name": "Test",
            "_sa_instance_state": "should_be_excluded",
        }

        result = _model_to_dict(model)

        assert result["id"] == 1
        assert result["name"] == "Test"
        assert "_sa_instance_state" not in result

    def test_datetime_conversion(self):
        """Test datetime fields are converted to ISO format."""
        now = datetime.utcnow()
        model = MagicMock()
        model.__dict__ = {
            "id": 1,
            "created_at": now,
        }

        result = _model_to_dict(model)

        assert result["created_at"] == now.isoformat()

    def test_nested_model_exclusion(self):
        """Test nested models with __dict__ are excluded."""
        nested = MagicMock()
        nested.__dict__ = {"something": "value"}

        model = MagicMock()
        model.__dict__ = {
            "id": 1,
            "nested": nested,
        }

        result = _model_to_dict(model)

        assert "nested" not in result

    def test_none_model(self):
        """Test None model returns None."""
        assert _model_to_dict(None) is None


class TestExportToJson:
    """Test export_to_json function."""

    def test_basic_export(self):
        """Test basic JSON export."""
        data = {"version": "1.0", "data": {"test": "value"}}

        result = export_to_json(data)

        parsed = json.loads(result)
        assert parsed["version"] == "1.0"

    def test_unicode_preservation(self):
        """Test Unicode characters are preserved."""
        data = {"name": "测试中文"}

        result = export_to_json(data)

        assert "测试中文" in result

    def test_indent_formatting(self):
        """Test JSON is formatted with indentation."""
        data = {"a": 1}

        result = export_to_json(data)

        assert "\n" in result


class TestExportToZip:
    """Test export_to_zip function."""

    def test_creates_valid_zip(self):
        """Test valid ZIP archive is created."""
        data = {"version": "1.0", "data": {}}

        result = export_to_zip(data)

        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_contains_project_data_json(self):
        """Test ZIP contains project_data.json."""
        data = {"version": "1.0", "data": {"key": "value"}}

        zip_bytes = export_to_zip(data)

        with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as zf:
            assert "project_data.json" in zf.namelist()

    def test_zip_content_valid(self):
        """Test ZIP content is valid JSON."""
        data = {"version": "1.0", "test": True}

        zip_bytes = export_to_zip(data)

        with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as zf:
            content = zf.read("project_data.json").decode('utf-8')
            parsed = json.loads(content)
            assert parsed["version"] == "1.0"
            assert parsed["test"] is True

    def test_zip_compression(self):
        """Test ZIP uses DEFLATED compression."""
        data = {"version": "1.0", "data": "x" * 1000}

        zip_bytes = export_to_zip(data)

        with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as zf:
            info = zf.getinfo("project_data.json")
            assert info.compress_type == zipfile.ZIP_DEFLATED


class TestImportFromJson:
    """Test import_from_json function."""

    def test_basic_import(self):
        """Test basic JSON import."""
        json_str = '{"version": "1.0", "data": {}}'

        result = import_from_json(json_str)

        assert result["version"] == "1.0"

    def test_complex_data(self):
        """Test import with nested data."""
        data = {
            "version": "1.0",
            "data": {
                "characters": [{"id": 1, "name": "Hero"}],
                "nested": {"deep": {"value": 42}},
            }
        }

        result = import_from_json(json.dumps(data))

        assert result["data"]["characters"][0]["name"] == "Hero"
        assert result["data"]["nested"]["deep"]["value"] == 42


class TestImportFromZip:
    """Test import_from_zip function."""

    def test_basic_zip_import(self):
        """Test basic ZIP import."""
        data = {"version": "1.0", "data": {"test": "value"}}
        zip_bytes = export_to_zip(data)

        result = import_from_zip(zip_bytes)

        assert result["version"] == "1.0"
        assert result["data"]["test"] == "value"

    def test_large_data_zip_import(self):
        """Test ZIP import with large data."""
        data = {
            "version": "1.0",
            "data": {
                "characters": [{"id": i, "name": f"Character{i}"} for i in range(100)],
            }
        }
        zip_bytes = export_to_zip(data)

        result = import_from_zip(zip_bytes)

        assert len(result["data"]["characters"]) == 100


class TestImportProject:
    """Test import_project function."""

    @pytest.mark.asyncio
    async def test_unsupported_version(self):
        """Test import rejects unsupported version."""
        data = {"version": "99.0", "data": {}}

        with pytest.raises(ValueError, match="Unsupported export version"):
            await import_project(data, mode="merge")

    @pytest.mark.asyncio
    async def test_missing_version(self):
        """Test import rejects missing version."""
        data = {"data": {}}

        with pytest.raises(ValueError, match="Unsupported export version"):
            await import_project(data, mode="merge")

    @pytest.mark.asyncio
    async def test_merge_mode(self):
        """Test merge mode imports without clearing."""
        data = {
            "version": "1.0",
            "data": {
                "characters": [{"id": 1, "name": "Hero"}],
                "items": [],
                "locations": [],
                "factions": [],
                "world_settings": [],
                "rules": [],
                "outlines": [],
                "if_lines": [],
                "chat_sessions": [],
                "plot_threads": [],
                "writing_settings": None,
            }
        }

        mock_session = AsyncMock()
        # Mock execute to return result with scalars().all() chain
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute = AsyncMock(return_value=mock_result)

        with patch('backend.services.export_import.async_session_maker') as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await import_project(data, mode="merge")

        assert "imported" in result
        assert result["imported"]["characters"] == 1

    @pytest.mark.asyncio
    async def test_replace_mode(self):
        """Test replace mode clears data first."""
        data = {
            "version": "1.0",
            "data": {
                "characters": [],
                "items": [],
                "locations": [],
                "factions": [],
                "world_settings": [],
                "rules": [],
                "outlines": [],
                "if_lines": [],
                "chat_sessions": [],
                "plot_threads": [],
                "writing_settings": None,
            }
        }

        mock_session = AsyncMock()

        with patch('backend.services.export_import.async_session_maker') as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await import_project(data, mode="replace")

        # Should have called delete operations
        assert mock_session.execute.called


class TestClearAllData:
    """Test _clear_all_data function."""

    @pytest.mark.asyncio
    async def test_deletes_all_tables(self):
        """Test all tables are deleted in correct order."""
        mock_session = AsyncMock()

        await _clear_all_data(mock_session)

        # Should execute delete for all entity types
        assert mock_session.execute.call_count >= 15


class TestImportCharacters:
    """Test _import_characters function."""

    @pytest.mark.asyncio
    async def test_import_single_character(self):
        """Test importing a single character."""
        mock_session = MagicMock()
        data = {
            "characters": [
                {"id": 1, "name": "Hero", "gender": "male", "personality": "Brave"}
            ]
        }

        count = await _import_characters(mock_session, data)

        assert count == 1
        mock_session.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_import_multiple_characters(self):
        """Test importing multiple characters."""
        mock_session = MagicMock()
        data = {
            "characters": [
                {"id": 1, "name": "Hero"},
                {"id": 2, "name": "Villain"},
                {"id": 3, "name": "Sidekick"},
            ]
        }

        count = await _import_characters(mock_session, data)

        assert count == 3
        assert mock_session.add.call_count == 3

    @pytest.mark.asyncio
    async def test_import_empty(self):
        """Test importing empty character list."""
        mock_session = MagicMock()
        data = {"characters": []}

        count = await _import_characters(mock_session, data)

        assert count == 0
        mock_session.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_import_missing_characters_key(self):
        """Test importing with missing characters key."""
        mock_session = MagicMock()
        data = {}

        count = await _import_characters(mock_session, data)

        assert count == 0


class TestImportItems:
    """Test _import_items function."""

    @pytest.mark.asyncio
    async def test_import_item(self):
        """Test importing an item."""
        mock_session = MagicMock()
        data = {
            "items": [{"id": 1, "name": "Sword", "description": "Sharp", "owner": "Hero"}]
        }

        count = await _import_items(mock_session, data)

        assert count == 1


class TestImportLocations:
    """Test _import_locations function."""

    @pytest.mark.asyncio
    async def test_import_location(self):
        """Test importing a location."""
        mock_session = MagicMock()
        data = {
            "locations": [{"id": 1, "name": "Mountain", "importance": "high"}]
        }

        count = await _import_locations(mock_session, data)

        assert count == 1


class TestImportFactions:
    """Test _import_factions function."""

    @pytest.mark.asyncio
    async def test_import_faction(self):
        """Test importing a faction."""
        mock_session = MagicMock()
        data = {
            "factions": [{"id": 1, "name": "Guild", "type": "good"}]
        }

        count = await _import_factions(mock_session, data)

        assert count == 1


class TestImportWorldSettings:
    """Test _import_world_settings function."""

    @pytest.mark.asyncio
    async def test_import_world_setting(self):
        """Test importing world settings."""
        mock_session = MagicMock()
        data = {
            "world_settings": [{"id": 1, "name": "Magic System", "details_json": "{}"}]
        }

        count = await _import_world_settings(mock_session, data)

        assert count == 1


class TestImportRules:
    """Test _import_rules function."""

    @pytest.mark.asyncio
    async def test_import_rule(self):
        """Test importing a rule."""
        mock_session = MagicMock()
        data = {
            "rules": [{"id": 1, "name": "No killing", "type": "restriction"}]
        }

        count = await _import_rules(mock_session, data)

        assert count == 1


class TestImportOutlines:
    """Test _import_outlines function."""

    @pytest.mark.asyncio
    async def test_import_outline_with_chapters(self):
        """Test importing outline with chapters."""
        mock_session = MagicMock()
        data = {
            "outlines": [
                {
                    "id": 1,
                    "title": "Main Story",
                    "chapters": [
                        {"id": 1, "title": "Ch1", "chapter_order": 1},
                        {"id": 2, "title": "Ch2", "chapter_order": 2},
                    ]
                }
            ]
        }

        count = await _import_outlines(mock_session, data)

        assert count == 1
        # Should add outline + 2 chapters
        assert mock_session.add.call_count == 3


class TestImportIFLines:
    """Test _import_if_lines function."""

    @pytest.mark.asyncio
    async def test_import_if_line(self):
        """Test importing an IF line."""
        mock_session = MagicMock()
        data = {
            "if_lines": [{"id": 1, "title": "Side Story", "sync_mode": "auto"}]
        }

        count = await _import_if_lines(mock_session, data)

        assert count == 1


class TestImportChatSessions:
    """Test _import_chat_sessions function."""

    @pytest.mark.asyncio
    async def test_import_chat_session_with_messages(self):
        """Test importing chat session with messages and entities."""
        mock_session = MagicMock()
        data = {
            "chat_sessions": [
                {
                    "id": 1,
                    "messages": [
                        {"id": 1, "role": "user", "content": "Hello"},
                        {"id": 2, "role": "assistant", "content": "Hi"},
                    ],
                    "extracted_entities": [
                        {"id": 1, "type": "character", "name": "Hero", "confirmed": 1},
                    ]
                }
            ]
        }

        count = await _import_chat_sessions(mock_session, data)

        assert count == 1
        # Should add session + 2 messages + 1 entity
        assert mock_session.add.call_count == 4


class TestImportPlotThreads:
    """Test _import_plot_threads function."""

    @pytest.mark.asyncio
    async def test_import_plot_thread(self):
        """Test importing a plot thread."""
        mock_session = MagicMock()
        data = {
            "plot_threads": [
                {"id": 1, "title": "Mystery", "status": "active"}
            ]
        }

        count = await _import_plot_threads(mock_session, data)

        assert count == 1


class TestImportWritingSettings:
    """Test _import_writing_settings function."""

    @pytest.mark.asyncio
    async def test_import_writing_settings(self):
        """Test importing writing settings."""
        mock_session = MagicMock()
        data = {
            "writing_settings": {
                "human_ai_ratio": 0.7,
                "writing_style": "江南",
                "target_word_count": 5000,
            }
        }

        count = await _import_writing_settings(mock_session, data)

        assert count == 1
        mock_session.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_import_no_writing_settings(self):
        """Test importing when no writing settings exist."""
        mock_session = MagicMock()
        data = {}

        count = await _import_writing_settings(mock_session, data)

        assert count == 0
        mock_session.add.assert_not_called()


class TestRoundTrip:
    """Test full export/import round-trip scenarios."""

    def test_json_roundtrip(self):
        """Test JSON export/import preserves data."""
        original = {
            "version": "1.0",
            "exported_at": datetime.utcnow().isoformat(),
            "data": {
                "characters": [
                    {"id": 1, "name": "主角", "gender": "male", "tier": "核心"},
                    {"id": 2, "name": "反派", "gender": "female", "tier": "核心"},
                ],
                "items": [
                    {"id": 1, "name": "神剑", "owner": "主角"},
                ],
                "locations": [
                    {"id": 1, "name": "青云山", "importance": "极高"},
                ],
            }
        }

        json_str = export_to_json(original)
        restored = import_from_json(json_str)

        assert restored["version"] == original["version"]
        assert len(restored["data"]["characters"]) == 2
        assert restored["data"]["characters"][0]["name"] == "主角"
        assert restored["data"]["items"][0]["owner"] == "主角"

    def test_zip_roundtrip(self):
        """Test ZIP export/import preserves data."""
        original = {
            "version": "1.0",
            "data": {
                "characters": [{"id": 1, "name": "Test"}],
                "outlines": [
                    {
                        "id": 1,
                        "title": "Outline",
                        "chapters": [{"id": 1, "title": "Ch1"}]
                    }
                ],
            }
        }

        zip_bytes = export_to_zip(original)
        restored = import_from_zip(zip_bytes)

        assert restored["version"] == "1.0"
        assert restored["data"]["characters"][0]["name"] == "Test"

    def test_empty_data_roundtrip(self):
        """Test empty data round-trip."""
        original = {
            "version": "1.0",
            "data": {}
        }

        json_str = export_to_json(original)
        restored = import_from_json(json_str)

        assert restored["data"] == {}

    def test_unicode_roundtrip(self):
        """Test Unicode data round-trip."""
        original = {
            "version": "1.0",
            "data": {
                "characters": [
                    {"id": 1, "name": "龙傲天", "description": "身怀绝技，纵横天下"},
                ]
            }
        }

        zip_bytes = export_to_zip(original)
        restored = import_from_zip(zip_bytes)

        assert restored["data"]["characters"][0]["name"] == "龙傲天"
        assert "纵横天下" in restored["data"]["characters"][0]["description"]
