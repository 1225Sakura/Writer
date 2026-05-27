"""Tests for Export/Import Service — async export/import, conflict resolution, progress callbacks."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch, call

import pytest

from backend.services.export_import import (
    ExportProgressCallback,
    ConflictResolution,
    ImportValidationError,
    export_project,
    import_project,
    export_to_json,
    export_to_yaml,
    export_to_zip,
    import_from_json,
    import_from_yaml,
    _model_to_dict,
    _validate_import_data,
    _detect_import_conflicts,
    _resolve_conflicts,
    _clear_all_data,
    _import_characters,
    _import_character_relationships,
    _import_character_storylines,
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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_mock_session():
    """Create a mock async database session."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    return session


def _make_model_obj(**kwargs):
    """Create a mock SQLAlchemy model instance."""
    obj = MagicMock()
    obj.__dict__ = {"_sa_instance_state": MagicMock(), **kwargs}
    return obj


def _valid_import_data(**overrides):
    """Return a minimal valid import payload (version 1.0)."""
    base = {
        "version": "1.0",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "data": {
            "characters": [],
            "character_relationships": [],
            "character_storylines": [],
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
        },
    }
    base.update(overrides)
    return base


# =============================================================================
# ExportProgressCallback
# =============================================================================

class TestExportProgressCallback:
    def test_initial_state(self):
        cb = ExportProgressCallback()
        assert cb.progress == 0.0
        assert cb.current_step == ""
        assert cb.callback is None

    def test_set_callback(self):
        cb = ExportProgressCallback()
        fn = MagicMock()
        cb.set_callback(fn)
        assert cb.callback is fn

    def test_update_without_callback(self):
        cb = ExportProgressCallback()
        cb.update(0.5, "step")
        assert cb.progress == 0.5
        assert cb.current_step == "step"

    def test_update_with_callback(self):
        cb = ExportProgressCallback()
        fn = MagicMock()
        cb.set_callback(fn)
        cb.update(0.75, "halfway")
        fn.assert_called_once_with(0.75, "halfway")
        assert cb.progress == 0.75
        assert cb.current_step == "halfway"


# =============================================================================
# ConflictResolution
# =============================================================================

class TestConflictResolution:
    def test_import_wins_strategy(self):
        existing = {"id": "1", "name": "old"}
        imported = {"id": "1", "name": "new"}
        result = ConflictResolution.resolve_conflict(existing, imported, "import_wins")
        assert result == imported

    def test_existing_wins_strategy(self):
        existing = {"id": "1", "name": "old"}
        imported = {"id": "1", "name": "new"}
        result = ConflictResolution.resolve_conflict(existing, imported, "existing_wins")
        assert result == existing

    def test_merge_strategy_prefers_imported_non_none(self):
        existing = {"id": "1", "name": "old", "age": 30}
        imported = {"id": "1", "name": "new", "age": None}
        result = ConflictResolution.resolve_conflict(existing, imported, "merge")
        assert result["name"] == "new"
        assert result["age"] == 30

    def test_merge_nested_dicts(self):
        existing = {"id": "1", "meta": {"a": 1, "b": 2}}
        imported = {"id": "1", "meta": {"b": 99, "c": 3}}
        result = ConflictResolution.resolve_conflict(existing, imported, "merge")
        assert result["meta"] == {"a": 1, "b": 99, "c": 3}

    def test_detect_conflicts_no_overlap(self):
        existing = [{"id": "1", "name": "a"}]
        imported = [{"id": "2", "name": "b"}]
        assert ConflictResolution.detect_conflicts(existing, imported) == []

    def test_detect_conflicts_with_differences(self):
        existing = [{"id": "1", "name": "old"}]
        imported = [{"id": "1", "name": "new"}]
        conflicts = ConflictResolution.detect_conflicts(existing, imported)
        assert len(conflicts) == 1
        assert conflicts[0]["id"] == "1"
        assert "name" in conflicts[0]["differences"]

    def test_detect_conflicts_same_data_no_diff(self):
        existing = [{"id": "1", "name": "same"}]
        imported = [{"id": "1", "name": "same"}]
        conflicts = ConflictResolution.detect_conflicts(existing, imported)
        assert len(conflicts) == 0

    def test_detect_conflicts_custom_id_field(self):
        existing = [{"uid": "1", "val": "a"}]
        imported = [{"uid": "1", "val": "b"}]
        conflicts = ConflictResolution.detect_conflicts(existing, imported, id_field="uid")
        assert len(conflicts) == 1

    def test_detect_conflicts_imported_none_not_a_diff(self):
        existing = [{"id": "1", "name": "a", "extra": "x"}]
        imported = [{"id": "1", "name": "a", "extra": None}]
        conflicts = ConflictResolution.detect_conflicts(existing, imported)
        # extra=None in imported is not a meaningful diff
        assert len(conflicts) == 0


# =============================================================================
# _model_to_dict
# =============================================================================

class TestModelToDict:
    def test_none_returns_none(self):
        assert _model_to_dict(None) is None

    def test_strips_sa_instance_state(self):
        obj = _make_model_obj(id=1, name="test")
        result = _model_to_dict(obj)
        assert "_sa_instance_state" not in result
        assert result["id"] == 1

    def test_converts_datetime_to_iso(self):
        dt = datetime(2025, 1, 1, tzinfo=timezone.utc)
        obj = _make_model_obj(id=1, created_at=dt)
        result = _model_to_dict(obj)
        assert isinstance(result["created_at"], str)
        assert "2025" in result["created_at"]

    def test_skips_relationship_attributes(self):
        obj = _make_model_obj(id=1)
        obj.__dict__["related"] = MagicMock()  # has __dict__, should skip
        result = _model_to_dict(obj)
        assert "related" not in result


# =============================================================================
# Serialization helpers
# =============================================================================

class TestSerializationHelpers:
    def test_export_to_json_roundtrip(self):
        data = {"version": "1.0", "data": {"characters": []}}
        j = export_to_json(data)
        assert json.loads(j) == data

    def test_export_to_json_unicode(self):
        data = {"name": "测试"}
        j = export_to_json(data)
        assert "测试" in j

    def test_export_to_yaml_contains_key(self):
        data = {"version": "1.0", "data": {}}
        y = export_to_yaml(data)
        assert "version" in y

    def test_export_to_zip_json(self):
        data = {"version": "1.0"}
        z = export_to_zip(data, format="json")
        assert len(z) > 0

    def test_export_to_zip_yaml(self):
        data = {"version": "1.0"}
        z = export_to_zip(data, format="yaml")
        assert len(z) > 0

    def test_import_from_json_valid(self):
        data = {"version": "1.0"}
        result = import_from_json(json.dumps(data))
        assert result == data

    def test_import_from_json_invalid(self):
        with pytest.raises(ValueError, match="Invalid JSON"):
            import_from_json("{bad json")

    def test_import_from_yaml_valid(self):
        result = import_from_yaml("version: '1.0'")
        assert result["version"] == "1.0"

    def test_import_from_yaml_invalid(self):
        with pytest.raises(ValueError, match="Invalid YAML"):
            import_from_yaml(":\n  :\n    bad: [unclosed")


# =============================================================================
# _validate_import_data
# =============================================================================

class TestValidateImportData:
    def test_non_dict_returns_error(self):
        errors = _validate_import_data("not a dict")
        assert len(errors) == 1
        assert "dictionary" in errors[0]["error"]

    def test_missing_version(self):
        errors = _validate_import_data({"data": {}})
        assert any("version" in e["error"].lower() for e in errors)

    def test_unsupported_version(self):
        errors = _validate_import_data({"version": "2.0", "data": {}})
        assert any("unsupported" in e["error"].lower() for e in errors)

    def test_missing_data_field(self):
        errors = _validate_import_data({"version": "1.0"})
        assert any("data" in e["error"].lower() for e in errors)

    def test_valid_minimal_data(self):
        errors = _validate_import_data(_valid_import_data())
        assert errors == []

    def test_character_missing_name(self):
        data = _valid_import_data()
        data["data"]["characters"] = [{"id": "1"}]
        errors = _validate_import_data(data)
        assert any("name" in e["error"].lower() for e in errors)

    def test_character_not_dict(self):
        data = _valid_import_data()
        data["data"]["characters"] = ["bad"]
        errors = _validate_import_data(data)
        assert any("object" in e["error"].lower() or "array" in e["error"].lower() for e in errors)

    def test_item_missing_id(self):
        data = _valid_import_data()
        data["data"]["items"] = [{"name": "Sword"}]
        errors = _validate_import_data(data)
        assert any("id" in e["error"].lower() for e in errors)

    def test_location_valid(self):
        data = _valid_import_data()
        data["data"]["locations"] = [{"id": "1", "name": "Castle"}]
        errors = _validate_import_data(data)
        assert not any("location" in e.get("field", "").lower() for e in errors)

    def test_outline_chapter_not_object(self):
        data = _valid_import_data()
        data["data"]["outlines"] = [{"id": "1", "title": "Arc1", "chapters": ["bad"]}]
        errors = _validate_import_data(data)
        assert any("chapter" in e["error"].lower() for e in errors)

    def test_if_line_missing_title(self):
        data = _valid_import_data()
        data["data"]["if_lines"] = [{"id": "1"}]
        errors = _validate_import_data(data)
        assert any("title" in e["error"].lower() for e in errors)

    def test_plot_thread_missing_title(self):
        data = _valid_import_data()
        data["data"]["plot_threads"] = [{"id": "1"}]
        errors = _validate_import_data(data)
        assert any("title" in e["error"].lower() for e in errors)

    def test_chat_session_not_list(self):
        data = _valid_import_data()
        data["data"]["chat_sessions"] = "bad"
        errors = _validate_import_data(data)
        assert any("array" in e["error"].lower() for e in errors)

    def test_faction_valid(self):
        data = _valid_import_data()
        data["data"]["factions"] = [{"id": "1", "name": "Empire"}]
        errors = _validate_import_data(data)
        assert not any("faction" in e.get("field", "").lower() for e in errors)

    def test_world_setting_not_dict(self):
        data = _valid_import_data()
        data["data"]["world_settings"] = [42]
        errors = _validate_import_data(data)
        assert any("object" in e["error"].lower() for e in errors)


# =============================================================================
# ImportValidationError
# =============================================================================

class TestImportValidationError:
    def test_message_truncates_after_5(self):
        errors = [{"field": f"f{i}", "error": f"e{i}"} for i in range(8)]
        exc = ImportValidationError(errors)
        assert "and 3 more" in str(exc)
        assert exc.errors == errors


# =============================================================================
# export_project (async)
# =============================================================================

@pytest.mark.asyncio
class TestExportProject:
    @patch("backend.services.export_import.async_session_maker")
    async def test_returns_version_and_data_keys(self, mock_session_maker):
        session = _make_mock_session()
        # All queries return empty lists
        empty_result = MagicMock()
        empty_result.scalars.return_value.all.return_value = []
        empty_result.scalar_one_or_none.return_value = None
        session.execute.return_value = empty_result

        mock_session_maker.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_session_maker.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await export_project()
        assert result["version"] == "1.0"
        assert "data" in result
        assert "exported_at" in result

    @patch("backend.services.export_import.async_session_maker")
    async def test_export_includes_all_entity_keys(self, mock_session_maker):
        session = _make_mock_session()
        empty_result = MagicMock()
        empty_result.scalars.return_value.all.return_value = []
        empty_result.scalar_one_or_none.return_value = None
        session.execute.return_value = empty_result

        mock_session_maker.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_session_maker.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await export_project()
        expected_keys = {
            "characters", "character_relationships", "character_storylines",
            "items", "locations", "factions", "world_settings", "rules",
            "outlines", "if_lines", "chat_sessions", "plot_threads",
            "writing_settings",
        }
        assert expected_keys == set(result["data"].keys())

    @patch("backend.services.export_import.async_session_maker")
    async def test_export_incremental_flag(self, mock_session_maker):
        session = _make_mock_session()
        empty_result = MagicMock()
        empty_result.scalars.return_value.all.return_value = []
        empty_result.scalar_one_or_none.return_value = None
        session.execute.return_value = empty_result

        mock_session_maker.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_session_maker.return_value.__aexit__ = AsyncMock(return_value=False)

        since = datetime(2025, 1, 1, tzinfo=timezone.utc)
        result = await export_project(incremental=True, since=since)
        assert result["incremental"] is True
        assert result["since"] is not None

    @patch("backend.services.export_import.async_session_maker")
    async def test_export_with_progress_callback(self, mock_session_maker):
        session = _make_mock_session()
        empty_result = MagicMock()
        empty_result.scalars.return_value.all.return_value = []
        empty_result.scalar_one_or_none.return_value = None
        session.execute.return_value = empty_result

        mock_session_maker.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_session_maker.return_value.__aexit__ = AsyncMock(return_value=False)

        cb = ExportProgressCallback()
        cb.set_callback(MagicMock())
        await export_project(progress_callback=cb)
        assert cb.progress == 1.0
        assert cb.callback.call_count >= 10

    @patch("backend.services.export_import.async_session_maker")
    async def test_export_converts_models_to_dicts(self, mock_session_maker):
        session = _make_mock_session()
        char_obj = _make_model_obj(id="c1", name="Alice")
        char_result = MagicMock()
        char_result.scalars.return_value.all.return_value = [char_obj]

        empty_result = MagicMock()
        empty_result.scalars.return_value.all.return_value = []
        empty_result.scalar_one_or_none.return_value = None

        # First call returns chars, rest return empty
        session.execute = AsyncMock(side_effect=[
            char_result,  # characters
            empty_result,  # relationships
            empty_result,  # storylines
            empty_result,  # items
            empty_result,  # locations
            empty_result,  # factions
            empty_result,  # world_settings
            empty_result,  # rules
            empty_result,  # outlines
            empty_result,  # if_lines
            empty_result,  # chat_sessions
            empty_result,  # plot_threads
            empty_result,  # writing_settings
        ])

        mock_session_maker.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_session_maker.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await export_project()
        assert len(result["data"]["characters"]) == 1
        assert result["data"]["characters"][0]["name"] == "Alice"


# =============================================================================
# import_project (async)
# =============================================================================

@pytest.mark.asyncio
class TestImportProject:
    @patch("backend.services.export_import.async_session_maker")
    async def test_import_unsupported_version_raises(self, mock_session_maker):
        with pytest.raises(ValueError, match="Unsupported"):
            await import_project({"version": "99.0", "data": {}})

    @patch("backend.services.export_import.async_session_maker")
    async def test_import_validation_failure(self, mock_session_maker):
        data = _valid_import_data()
        data["data"]["characters"] = [{"id": 1}]  # missing name
        with pytest.raises(ImportValidationError):
            await import_project(data, validate=True)

    @patch("backend.services.export_import.async_session_maker")
    async def test_import_skip_validation(self, mock_session_maker):
        session = _make_mock_session()
        empty_result = MagicMock()
        empty_result.scalars.return_value.all.return_value = []
        session.execute.return_value = empty_result

        mock_session_maker.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_session_maker.return_value.__aexit__ = AsyncMock(return_value=False)

        data = _valid_import_data()
        data["data"]["characters"] = [{"id": 1}]  # would fail validation
        result = await import_project(data, validate=False)
        assert result["validation_passed"] is True

    @patch("backend.services.export_import.async_session_maker")
    async def test_import_merge_mode_no_conflicts(self, mock_session_maker):
        session = _make_mock_session()
        empty_result = MagicMock()
        empty_result.scalars.return_value.all.return_value = []
        session.execute.return_value = empty_result

        mock_session_maker.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_session_maker.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await import_project(_valid_import_data(), mode="merge")
        assert result["conflicts"] == []

    @patch("backend.services.export_import.async_session_maker")
    async def test_import_replace_mode_clears_data(self, mock_session_maker):
        session = _make_mock_session()
        empty_result = MagicMock()
        empty_result.scalars.return_value.all.return_value = []
        session.execute.return_value = empty_result

        mock_session_maker.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_session_maker.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await import_project(_valid_import_data(), mode="replace")
        assert "imported" in result

    @patch("backend.services.export_import.async_session_maker")
    async def test_import_with_progress_callback(self, mock_session_maker):
        session = _make_mock_session()
        empty_result = MagicMock()
        empty_result.scalars.return_value.all.return_value = []
        session.execute.return_value = empty_result

        mock_session_maker.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_session_maker.return_value.__aexit__ = AsyncMock(return_value=False)

        cb = ExportProgressCallback()
        cb.set_callback(MagicMock())
        await import_project(_valid_import_data(), progress_callback=cb)
        assert cb.progress == 1.0

    @patch("backend.services.export_import.async_session_maker")
    async def test_import_characters_count(self, mock_session_maker):
        session = _make_mock_session()
        empty_result = MagicMock()
        empty_result.scalars.return_value.all.return_value = []
        session.execute.return_value = empty_result

        mock_session_maker.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_session_maker.return_value.__aexit__ = AsyncMock(return_value=False)

        data = _valid_import_data()
        data["data"]["characters"] = [
            {"id": "1", "name": "Alice"},
            {"id": "2", "name": "Bob"},
        ]
        result = await import_project(data, validate=False)
        assert result["imported"]["characters"] == 2

    @patch("backend.services.export_import.async_session_maker")
    async def test_import_writing_settings(self, mock_session_maker):
        session = _make_mock_session()
        empty_result = MagicMock()
        empty_result.scalars.return_value.all.return_value = []
        session.execute.return_value = empty_result

        mock_session_maker.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_session_maker.return_value.__aexit__ = AsyncMock(return_value=False)

        data = _valid_import_data()
        data["data"]["writing_settings"] = {
            "human_ai_ratio": 0.6,
            "writing_style": "default",
            "target_word_count": 5000,
        }
        result = await import_project(data, validate=False)
        assert result["imported"]["writing_settings"] == 1

    @patch("backend.services.export_import.async_session_maker")
    async def test_import_empty_data(self, mock_session_maker):
        session = _make_mock_session()
        empty_result = MagicMock()
        empty_result.scalars.return_value.all.return_value = []
        session.execute.return_value = empty_result

        mock_session_maker.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_session_maker.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await import_project(_valid_import_data())
        for count in result["imported"].values():
            assert count == 0


# =============================================================================
# _import_* entity functions (unit)
# =============================================================================

@pytest.mark.asyncio
class TestImportEntityFunctions:
    async def test_import_characters(self):
        session = _make_mock_session()
        data = {"characters": [{"id": "1", "name": "A", "gender": "M"}]}
        count = await _import_characters(session, data)
        assert count == 1
        session.add.assert_called_once()

    async def test_import_characters_empty(self):
        session = _make_mock_session()
        count = await _import_characters(session, {"characters": []})
        assert count == 0

    async def test_import_character_relationships(self):
        session = _make_mock_session()
        data = {"character_relationships": [{"id": "1", "character_id": "a", "target_id": "b", "type": "friend"}]}
        count = await _import_character_relationships(session, data)
        assert count == 1

    async def test_import_character_storylines(self):
        session = _make_mock_session()
        data = {"character_storylines": [{"id": "1", "character_id": "a", "title": "arc"}]}
        count = await _import_character_storylines(session, data)
        assert count == 1

    async def test_import_items(self):
        session = _make_mock_session()
        data = {"items": [{"id": "1", "name": "Sword"}]}
        count = await _import_items(session, data)
        assert count == 1

    async def test_import_locations(self):
        session = _make_mock_session()
        data = {"locations": [{"id": "1", "name": "Castle"}]}
        count = await _import_locations(session, data)
        assert count == 1

    async def test_import_factions(self):
        session = _make_mock_session()
        data = {"factions": [{"id": "1", "name": "Empire"}]}
        count = await _import_factions(session, data)
        assert count == 1

    async def test_import_world_settings(self):
        session = _make_mock_session()
        data = {"world_settings": [{"id": "1", "name": "Magic System"}]}
        count = await _import_world_settings(session, data)
        assert count == 1

    async def test_import_rules(self):
        session = _make_mock_session()
        data = {"rules": [{"id": "1", "name": "No time travel"}]}
        count = await _import_rules(session, data)
        assert count == 1

    async def test_import_outlines_with_chapters(self):
        session = _make_mock_session()
        data = {"outlines": [{"id": "1", "title": "Arc1", "chapters": [{"id": "c1", "title": "Ch1"}]}]}
        count = await _import_outlines(session, data)
        assert count == 1
        assert session.add.call_count == 2  # outline + chapter

    async def test_import_if_lines(self):
        session = _make_mock_session()
        data = {"if_lines": [{"id": "1", "title": "What if"}]}
        count = await _import_if_lines(session, data)
        assert count == 1

    async def test_import_chat_sessions_with_messages(self):
        session = _make_mock_session()
        data = {"chat_sessions": [
            {"id": "1", "messages": [{"id": "m1", "role": "user", "content": "hi"}]}
        ]}
        count = await _import_chat_sessions(session, data)
        assert count == 1
        assert session.add.call_count == 2  # session + message

    async def test_import_chat_sessions_with_entities(self):
        session = _make_mock_session()
        data = {"chat_sessions": [
            {"id": "1", "messages": [], "extracted_entities": [
                {"id": "e1", "type": "character", "name": "Alice"}
            ]}
        ]}
        count = await _import_chat_sessions(session, data)
        assert count == 1
        assert session.add.call_count == 2  # session + entity

    async def test_import_plot_threads(self):
        session = _make_mock_session()
        data = {"plot_threads": [{"id": "1", "title": "Main plot"}]}
        count = await _import_plot_threads(session, data)
        assert count == 1

    async def test_import_writing_settings_present(self):
        session = _make_mock_session()
        data = {"writing_settings": {"human_ai_ratio": 0.5, "writing_style": "default", "target_word_count": 3000}}
        count = await _import_writing_settings(session, data)
        assert count == 1

    async def test_import_writing_settings_none(self):
        session = _make_mock_session()
        count = await _import_writing_settings(session, {"writing_settings": None})
        assert count == 0

    async def test_import_items_multiple(self):
        session = _make_mock_session()
        data = {"items": [
            {"id": "1", "name": "Sword"},
            {"id": "2", "name": "Shield"},
            {"id": "3", "name": "Potion"},
        ]}
        count = await _import_items(session, data)
        assert count == 3
        assert session.add.call_count == 3
