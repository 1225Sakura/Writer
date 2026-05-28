# Extended tests for serialization.py - Phase 5 Tier 3
# Covers CustomJSONEncoder, datetime helpers, pagination, safe helpers

import json
import pytest
from datetime import datetime, date, timezone, timedelta
from decimal import Decimal
from uuid import UUID
from unittest.mock import MagicMock

from backend.utils.serialization import (
    CustomJSONEncoder,
    serialize_to_json,
    deserialize_json,
    serialize_datetime,
    deserialize_datetime,
    serialize_date,
    deserialize_date,
    PaginationWrapper,
    create_pagination_wrapper,
    serialize_sqlalchemy_object,
    serialize_sqlalchemy_list,
    safe_json_loads,
    safe_json_dumps,
    DEFAULT_TIMEZONE,
)


# ── CustomJSONEncoder ─────────────────────────────────────────────────

class TestCustomJSONEncoder:
    def test_date_serialization(self):
        d = date(2024, 6, 15)
        result = json.dumps(d, cls=CustomJSONEncoder)
        assert "2024-06-15" in result

    def test_decimal_serialization(self):
        d = Decimal("3.14")
        result = json.dumps({"val": d}, cls=CustomJSONEncoder)
        assert 3.14 == json.loads(result)["val"]

    def test_uuid_serialization(self):
        u = UUID("550e8400-e29b-41d4-a716-446655440000")
        result = json.dumps({"id": u}, cls=CustomJSONEncoder)
        assert json.loads(result)["id"] == "550e8400-e29b-41d4-a716-446655440000"

    def test_bytes_serialization(self):
        b = b"hello"
        result = json.dumps({"data": b}, cls=CustomJSONEncoder)
        assert json.loads(result)["data"] == "hello"

    def test_bytes_with_errors(self):
        b = b"\xff\xfe"
        result = json.dumps({"data": b}, cls=CustomJSONEncoder)
        parsed = json.loads(result)
        assert isinstance(parsed["data"], str)

    def test_set_serialization(self):
        s = {1, 2, 3}
        result = json.dumps({"items": s}, cls=CustomJSONEncoder)
        parsed = json.loads(result)
        assert set(parsed["items"]) == {1, 2, 3}

    def test_pydantic_model_serialization(self):
        from pydantic import BaseModel

        class MyModel(BaseModel):
            name: str
            value: int

        m = MyModel(name="test", value=42)
        result = json.dumps(m, cls=CustomJSONEncoder)
        parsed = json.loads(result)
        assert parsed == {"name": "test", "value": 42}

    def test_object_with_dict(self):
        class SimpleObj:
            def __init__(self):
                self.x = 1
                self.y = 2
                self._private = 3

        result = json.dumps(SimpleObj(), cls=CustomJSONEncoder)
        parsed = json.loads(result)
        assert parsed == {"x": 1, "y": 2}
        assert "_private" not in parsed

    def test_nested_datetime(self):
        data = {"ts": datetime(2024, 1, 1, tzinfo=timezone.utc)}
        result = serialize_to_json(data)
        parsed = json.loads(result)
        assert "2024" in parsed["ts"]


# ── serialize_to_json extended ────────────────────────────────────────

class TestSerializeToJsonExtended:
    def test_indent(self):
        result = serialize_to_json({"a": 1}, indent=2)
        assert "\n" in result

    def test_ensure_ascii(self):
        result = serialize_to_json("你好", ensure_ascii=True)
        assert "\\u" in result

    def test_non_ascii_default(self):
        result = serialize_to_json("你好", ensure_ascii=False)
        assert "你好" in result


# ── deserialize_json ──────────────────────────────────────────────────

class TestDeserializeJson:
    def test_basic(self):
        assert deserialize_json('{"a": 1}') == {"a": 1}

    def test_list(self):
        assert deserialize_json('[1, 2, 3]') == [1, 2, 3]

    def test_invalid_raises(self):
        with pytest.raises(json.JSONDecodeError):
            deserialize_json("not json")


# ── serialize_datetime extended ───────────────────────────────────────

class TestSerializeDatetimeExtended:
    def test_aware_datetime(self):
        dt = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        result = serialize_datetime(dt)
        assert "2024" in result
        assert "+00:00" in result

    def test_naive_datetime_gets_utc(self):
        dt = datetime(2024, 6, 15, 10, 30, 0)
        result = serialize_datetime(dt)
        assert "2024" in result

    def test_custom_format(self):
        dt = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        result = serialize_datetime(dt, format_str="%Y/%m/%d")
        assert result == "2024/01/01"

    def test_no_timezone(self):
        dt = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        result = serialize_datetime(dt, include_timezone=False)
        assert "+00:00" not in result

    def test_none_returns_none(self):
        assert serialize_datetime(None) is None


# ── deserialize_datetime extended ─────────────────────────────────────

class TestDeserializeDatetimeExtended:
    def test_iso_with_z(self):
        dt = deserialize_datetime("2024-01-01T12:00:00Z")
        assert dt.year == 2024
        assert dt.tzinfo is not None

    def test_iso_with_offset(self):
        dt = deserialize_datetime("2024-01-01T12:00:00+05:00")
        assert dt.utcoffset() == timedelta(hours=5)

    def test_naive_gets_default_tz(self):
        dt = deserialize_datetime("2024-01-01T12:00:00")
        assert dt.tzinfo == DEFAULT_TIMEZONE

    def test_none_returns_none(self):
        assert deserialize_datetime(None) is None

    def test_invalid_raises(self):
        with pytest.raises(ValueError):
            deserialize_datetime("not a datetime")

    def test_custom_default_tz(self):
        custom_tz = timezone(timedelta(hours=8))
        dt = deserialize_datetime("2024-01-01T12:00:00", default_tz=custom_tz)
        assert dt.tzinfo == custom_tz


# ── serialize_date / deserialize_date ─────────────────────────────────

class TestDateSerialization:
    def test_roundtrip(self):
        d = date(2024, 6, 15)
        serialized = serialize_date(d)
        assert serialized == "2024-06-15"
        deserialized = deserialize_date(serialized)
        assert deserialized == d

    def test_serialize_none(self):
        assert serialize_date(None) is None

    def test_deserialize_none(self):
        assert deserialize_date(None) is None


# ── PaginationWrapper ─────────────────────────────────────────────────

class TestPaginationWrapper:
    def test_has_more_true(self):
        pw = PaginationWrapper(items=[1, 2, 3], total=10, skip=0, limit=5)
        assert pw.has_more is True

    def test_has_more_false(self):
        pw = PaginationWrapper(items=[1, 2, 3], total=3, skip=0, limit=5)
        assert pw.has_more is False

    def test_has_more_exact_fit(self):
        pw = PaginationWrapper(items=[1, 2, 3], total=3, skip=0, limit=3)
        assert pw.has_more is False

    def test_page_calculation(self):
        pw = PaginationWrapper(items=[1], total=10, skip=0, limit=5)
        assert pw.page == 1

    def test_page_second(self):
        pw = PaginationWrapper(items=[1], total=10, skip=5, limit=5)
        assert pw.page == 2

    def test_page_zero_limit(self):
        pw = PaginationWrapper(items=[1], total=10, skip=0, limit=0)
        assert pw.page == 1

    def test_total_pages(self):
        pw = PaginationWrapper(items=[], total=10, skip=0, limit=3)
        assert pw.total_pages == 4  # ceil(10/3)

    def test_total_pages_exact(self):
        pw = PaginationWrapper(items=[], total=10, skip=0, limit=5)
        assert pw.total_pages == 2

    def test_total_pages_zero_limit(self):
        pw = PaginationWrapper(items=[], total=10, skip=0, limit=0)
        assert pw.total_pages == 1

    def test_to_dict(self):
        pw = PaginationWrapper(items=[1, 2], total=5, skip=0, limit=10)
        d = pw.to_dict()
        assert d["items"] == [1, 2]
        assert d["total"] == 5
        assert d["has_more"] is True
        assert d["page"] == 1

    def test_to_json(self):
        pw = PaginationWrapper(items=["a"], total=1, skip=0, limit=10)
        j = pw.to_json()
        parsed = json.loads(j)
        assert parsed["items"] == ["a"]


# ── create_pagination_wrapper ─────────────────────────────────────────

class TestCreatePaginationWrapper:
    def test_creates_wrapper(self):
        pw = create_pagination_wrapper(items=[1, 2], total=10, skip=0, limit=5)
        assert isinstance(pw, PaginationWrapper)
        assert pw.items == [1, 2]
        assert pw.total == 10


# ── serialize_sqlalchemy_object ───────────────────────────────────────

class TestSerializeSqlalchemyObject:
    def test_none_returns_empty(self):
        assert serialize_sqlalchemy_object(None) == {}

    def test_with_table_attribute(self):
        mock_obj = MagicMock()
        col1 = MagicMock()
        col1.name = "id"
        col2 = MagicMock()
        col2.name = "name"
        col3 = MagicMock()
        col3.name = "_private"
        mock_obj.__table__ = MagicMock()
        mock_obj.__table__.columns = [col1, col2, col3]
        mock_obj.id = 1
        mock_obj.name = "test"
        mock_obj._private = "hidden"

        result = serialize_sqlalchemy_object(mock_obj)
        assert result["id"] == 1
        assert result["name"] == "test"
        assert "_private" not in result

    def test_exclude_set(self):
        mock_obj = MagicMock()
        col1 = MagicMock()
        col1.name = "id"
        col2 = MagicMock()
        col2.name = "secret"
        mock_obj.__table__ = MagicMock()
        mock_obj.__table__.columns = [col1, col2]
        mock_obj.id = 1
        mock_obj.secret = "hidden"

        result = serialize_sqlalchemy_object(mock_obj, exclude={"secret"})
        assert "id" in result
        assert "secret" not in result

    def test_include_set(self):
        mock_obj = MagicMock()
        col1 = MagicMock()
        col1.name = "id"
        col2 = MagicMock()
        col2.name = "name"
        mock_obj.__table__ = MagicMock()
        mock_obj.__table__.columns = [col1, col2]
        mock_obj.id = 1
        mock_obj.name = "test"

        result = serialize_sqlalchemy_object(mock_obj, include={"id"})
        assert "id" in result
        assert "name" not in result

    def test_datetime_field_serialized(self):
        mock_obj = MagicMock()
        col1 = MagicMock()
        col1.name = "created_at"
        mock_obj.__table__ = MagicMock()
        mock_obj.__table__.columns = [col1]
        mock_obj.created_at = datetime(2024, 1, 1, tzinfo=timezone.utc)

        result = serialize_sqlalchemy_object(mock_obj)
        assert isinstance(result["created_at"], str)

    def test_object_without_table(self):
        class SimpleObj:
            def __init__(self):
                self.id = 1
                self.name = "test"
                self._hidden = "secret"

        result = serialize_sqlalchemy_object(SimpleObj())
        assert result["id"] == 1
        assert result["name"] == "test"
        assert "_hidden" not in result


# ── serialize_sqlalchemy_list ─────────────────────────────────────────

class TestSerializeSqlalchemyList:
    def test_empty_list(self):
        assert serialize_sqlalchemy_list([]) == []

    def test_multiple_objects(self):
        mock1 = MagicMock()
        col = MagicMock()
        col.name = "id"
        mock1.__table__ = MagicMock()
        mock1.__table__.columns = [col]
        mock1.id = 1

        mock2 = MagicMock()
        mock2.__table__ = MagicMock()
        mock2.__table__.columns = [col]
        mock2.id = 2

        result = serialize_sqlalchemy_list([mock1, mock2])
        assert len(result) == 2
        assert result[0]["id"] == 1
        assert result[1]["id"] == 2


# ── safe_json_loads ───────────────────────────────────────────────────

class TestSafeJsonLoads:
    def test_valid_json(self):
        assert safe_json_loads('{"a": 1}') == {"a": 1}

    def test_none_returns_default(self):
        assert safe_json_loads(None) is None

    def test_none_with_custom_default(self):
        assert safe_json_loads(None, default=[]) == []

    def test_invalid_returns_default(self):
        assert safe_json_loads("not json") is None

    def test_invalid_with_custom_default(self):
        assert safe_json_loads("not json", default={}) == {}

    def test_empty_string_returns_default(self):
        # empty string is not valid JSON
        assert safe_json_loads("", default=None) is None


# ── safe_json_dumps ───────────────────────────────────────────────────

class TestSafeJsonDumps:
    def test_valid_object(self):
        result = safe_json_dumps({"a": 1})
        assert json.loads(result) == {"a": 1}

    def test_with_indent(self):
        result = safe_json_dumps({"a": 1}, indent=2)
        assert "\n" in result

    def test_non_serializable_returns_default(self):
        result = safe_json_dumps(object())
        assert result == "{}"

    def test_custom_default(self):
        result = safe_json_dumps(object(), default="[]")
        assert result == "[]"
