"""AI generate-entity endpoint tests (US-008).

All cases mock the Anthropic SDK so the test suite stays offline and fast.
Production code calls real MiniMax via the same Anthropic client surface.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError as PydanticValidationError

from app.core.exceptions import ValidationException
from app.schemas.character import CharacterCreate
from app.schemas.settings_entities import (
    FactionCreate,
    ItemCreate,
    LocationCreate,
    RuleCreate,
    WorldSettingCreate,
)
from app.services.ai_generate_entity import (
    EntityGeneratorService,
    _parse_entity_payload,
)


# -- helpers ---------------------------------------------------------------


def _make_ai_response(payload: dict | str) -> MagicMock:
    """Build a mock Anthropic messages.create() response."""
    text = payload if isinstance(payload, str) else _to_json(payload)
    block = MagicMock()
    block.text = text
    response = MagicMock()
    response.content = [block]
    return response


def _to_json(payload: dict) -> str:
    import json
    return json.dumps(payload, ensure_ascii=False)


# -- unit: payload parser --------------------------------------------------


def test_parse_entity_payload_handles_fenced_json():
    raw = "```json\n" + _to_json({"name": "X"}) + "\n```"
    parsed = _parse_entity_payload(raw)
    assert parsed == {"name": "X"}


def test_parse_entity_payload_extracts_object_from_prose():
    raw = 'noise before {"name": "Y", "tier": "protagonist"} noise after'
    parsed = _parse_entity_payload(raw)
    assert parsed == {"name": "Y", "tier": "protagonist"}


def test_parse_entity_payload_unwraps_entity_key():
    raw = _to_json({"entity": {"name": "Z"}})
    parsed = _parse_entity_payload(raw)
    assert parsed == {"name": "Z"}


def test_parse_entity_payload_returns_empty_on_garbage():
    assert _parse_entity_payload("not json at all") == {}


# -- service: happy paths (mocked MiniMax) ---------------------------------


def test_generate_entity_character_with_full_hint():
    svc = EntityGeneratorService()
    payload = {
        "name": "林远图",
        "gender": "男",
        "personality": "沉稳内敛",
        "desires": "破解九州封印",
        "flaws": "不善言辞",
        "description": "身披青衫的青年剑客",
        "tier": "protagonist",
        "cultivation_realm": "金丹期",
    }
    response = _make_ai_response(payload)

    with patch("app.services.ai_generate_entity.Anthropic") as mock_anthropic:
        mock_anthropic.return_value.messages.create.return_value = response
        result = svc.generate("character", "主角是林远图，金丹期剑客", project_id=1)

    assert "entity" in result
    entity = result["entity"]
    # Response shape must validate as CharacterCreate when project_id is added.
    validated = CharacterCreate(project_id=1, **entity)
    assert validated.name == "林远图"
    assert validated.tier == "protagonist"
    assert validated.cultivation_realm == "金丹期"


def test_generate_entity_item_with_partial_hint():
    svc = EntityGeneratorService()
    payload = {
        "name": "封印灵根",
        "description": "九州大陆上古遗留的法宝",
        "owner": "林远图",
    }
    response = _make_ai_response(payload)

    with patch("app.services.ai_generate_entity.Anthropic") as mock_anthropic:
        mock_anthropic.return_value.messages.create.return_value = response
        result = svc.generate("item", "金手指是一个封印灵根", project_id=1)

    entity = result["entity"]
    validated = ItemCreate(project_id=1, **entity)
    assert validated.name == "封印灵根"
    assert validated.owner == "林远图"
    assert validated.location is None


def test_generate_entity_location_with_no_hint():
    svc = EntityGeneratorService()
    payload = {
        "name": "青云峰",
        "description": "云雾缭绕的剑修圣地",
        "importance": "core",
        "tags": ["圣地", "剑修"],
    }
    response = _make_ai_response(payload)

    with patch("app.services.ai_generate_entity.Anthropic") as mock_anthropic:
        mock_anthropic.return_value.messages.create.return_value = response
        result = svc.generate("location", "", project_id=7)

    entity = result["entity"]
    validated = LocationCreate(project_id=7, **entity)
    assert validated.name == "青云峰"
    assert validated.importance == "core"


def test_generate_entity_unsupported_type_raises_validation_error():
    svc = EntityGeneratorService()
    with pytest.raises(ValidationException):
        svc.generate("dragon", "a fire-breathing dragon", project_id=1)


def test_generate_entity_strips_server_only_fields():
    """AI may hallucinate id / project_id; service must drop them."""
    svc = EntityGeneratorService()
    payload = {
        "name": "九州大陆",
        "description": "辽阔的中式奇幻世界",
        "category": "geography",
        "id": 999,
        "project_id": 123,
    }
    response = _make_ai_response(payload)

    with patch("app.services.ai_generate_entity.Anthropic") as mock_anthropic:
        mock_anthropic.return_value.messages.create.return_value = response
        result = svc.generate("world_setting", "玄幻世界", project_id=1)

    entity = result["entity"]
    assert "id" not in entity
    assert "project_id" not in entity
    validated = WorldSettingCreate(project_id=1, **entity)
    assert validated.name == "九州大陆"
    assert validated.category == "geography"


def test_generate_entity_request_accepts_camel_case_project_id():
    """AC-P0-8.1 body uses {type, hint, projectId}."""
    from app.schemas.ai_generate_entity import GenerateEntityRequest

    body = GenerateEntityRequest.model_validate(
        {"type": "rule", "hint": "灵力守恒", "projectId": 42}
    )
    assert body.project_id == 42
    assert body.type == "rule"


def test_generate_entity_request_rejects_invalid_type():
    from app.schemas.ai_generate_entity import GenerateEntityRequest

    with pytest.raises(PydanticValidationError):
        GenerateEntityRequest.model_validate(
            {"type": "dragon", "hint": "x", "projectId": 1}
        )


# -- router: HTTP-level integration (mocked AI) ---------------------------


def test_generate_entity_router_happy_path(client):
    payload = {
        "name": "青云宗",
        "description": "正道第一剑宗",
        "type": "sect",
    }
    response_mock = _make_ai_response(payload)

    with patch("app.services.ai_generate_entity.Anthropic") as mock_anthropic:
        mock_anthropic.return_value.messages.create.return_value = response_mock
        resp = client.post(
            "/api/v1/ai/generate-entity",
            json={"type": "faction", "hint": "正派", "projectId": 1},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "entity" in body["data"]
    entity = body["data"]["entity"]
    validated = FactionCreate(project_id=1, **entity)
    assert validated.name == "青云宗"
    assert validated.type == "sect"


def test_generate_entity_router_validation_error_400(client):
    resp = client.post(
        "/api/v1/ai/generate-entity",
        json={"type": "dragon", "hint": "x", "projectId": 1},
    )
    # Pydantic literal validation surfaces as 422 (FastAPI default for body errors).
    assert resp.status_code in (400, 422)


def test_generate_entity_router_ai_bad_response_502(client):
    bad_response = _make_ai_response("not parseable json at all")

    with patch("app.services.ai_generate_entity.Anthropic") as mock_anthropic:
        mock_anthropic.return_value.messages.create.return_value = bad_response
        resp = client.post(
            "/api/v1/ai/generate-entity",
            json={"type": "rule", "hint": "灵力守恒", "projectId": 1},
        )

    # Empty parse → WriterException AI_BAD_RESPONSE → 502 via generic handler.
    assert resp.status_code == 502
    assert resp.json()["success"] is False


def test_generate_entity_router_supports_all_six_types(client):
    """Smoke-check that all 6 entity types are accepted by the router."""
    samples = [
        ("character", {"name": "A"}),
        ("item", {"name": "B"}),
        ("location", {"name": "C"}),
        ("faction", {"name": "D"}),
        ("world_setting", {"name": "E"}),
        ("rule", {"name": "F", "rule_type": "magic"}),
    ]
    for entity_type, payload in samples:
        response_mock = _make_ai_response(payload)
        with patch("app.services.ai_generate_entity.Anthropic") as mock_anthropic:
            mock_anthropic.return_value.messages.create.return_value = response_mock
            resp = client.post(
                "/api/v1/ai/generate-entity",
                json={"type": entity_type, "hint": "x", "projectId": 1},
            )
        assert resp.status_code == 200, f"{entity_type} failed: {resp.text}"
        assert resp.json()["data"]["entity"]["name"] == payload["name"]


# -- perf smoke (mocked; real MiniMax is exercised in manual e2e) ---------


def test_generate_entity_under_30s_mocked(client):
    import time

    payload = {"name": "快剑诀", "rule_type": "cultivation"}
    response_mock = _make_ai_response(payload)
    started = time.monotonic()
    with patch("app.services.ai_generate_entity.Anthropic") as mock_anthropic:
        mock_anthropic.return_value.messages.create.return_value = response_mock
        resp = client.post(
            "/api/v1/ai/generate-entity",
            json={"type": "rule", "hint": "一套剑法", "projectId": 1},
        )
    elapsed = time.monotonic() - started
    assert resp.status_code == 200
    assert elapsed < 30.0