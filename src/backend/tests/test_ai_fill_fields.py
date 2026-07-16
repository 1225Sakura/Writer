"""AI fill-fields endpoint tests (US-010).

All cases mock the Anthropic SDK so the test suite stays offline and fast.
Production code calls real MiniMax via the same Anthropic client surface.

Real MiniMax integration is exercised by test_fill_live_minimax when
ANTHROPIC_API_KEY is present in the environment.
"""
from __future__ import annotations

import json
import os
import time
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError as PydanticValidationError

from app.core.exceptions import NotFoundException, ValidationException, WriterException
from app.dependencies import get_field_filler_service
from app.main import app
from app.services.ai_chat import AIChatTimeout
from app.services.ai_fill_fields import (
    FILLABLE_FIELDS,
    FieldFillerService,
    _parse_fill_payload,
)


ENTITY_TYPES = tuple(FILLABLE_FIELDS.keys())


# -- helpers ---------------------------------------------------------------


def _to_json(payload: dict | list) -> str:
    return json.dumps(payload, ensure_ascii=False)


def _make_ai_response(payload: dict | list | str) -> MagicMock:
    text = payload if isinstance(payload, str) else _to_json(payload)
    block = MagicMock()
    block.text = text
    response = MagicMock()
    response.content = [block]
    return response


def _make_entity(entity_type: str, **fields) -> MagicMock:
    """Build a mock entity ORM-like object."""
    ent = MagicMock()
    ent.id = fields.pop("id", 1)
    ent.name = fields.get("name", f"sample-{entity_type}")
    for k, v in fields.items():
        setattr(ent, k, v)
    return ent


def _make_repos(entities_by_id: dict[tuple[str, int], MagicMock] | None = None) -> dict[str, MagicMock]:
    """Build 6 mock repos whose .get(id) returns a pre-loaded entity if any."""
    repos: dict[str, MagicMock] = {}
    entities_by_id = entities_by_id or {}
    for entity_type in ENTITY_TYPES:
        repo = MagicMock()
        for (etype, eid), entity in entities_by_id.items():
            if etype != entity_type:
                continue
            repo.get.return_value = entity
            # Only support one entity per repo in mocks for simplicity.
        # Default for repos with no pre-loaded entity: return None
        if not any(k[0] == entity_type for k in entities_by_id):
            repo.get.return_value = None
        repos[entity_type] = repo
    return repos


def _make_service(payload, entities_by_id=None, *, ai_client=None):
    """Build service with mocked AI client + repos; return (svc, ai_client, repos)."""
    if ai_client is None:
        ai_client = MagicMock()
        ai_client.messages.create.return_value = _make_ai_response(payload)
    repos = _make_repos(entities_by_id)
    svc = FieldFillerService(ai_client, repos)
    return svc, ai_client, repos


# -- unit: payload parser --------------------------------------------------


def test_parse_fill_payload_handles_fenced_json():
    raw = "```json\n" + _to_json({"description": "abc"}) + "\n```"
    parsed = _parse_fill_payload(raw, ["description"])
    assert parsed == {"description": "abc"}


def test_parse_fill_payload_unwraps_filled_key():
    raw = _to_json({"filled": {"description": "abc"}})
    parsed = _parse_fill_payload(raw, ["description"])
    assert parsed == {"description": "abc"}


def test_parse_fill_payload_only_returns_requested_fields():
    raw = _to_json({"description": "abc", "tags": ["x"], "extras": "leak"})
    parsed = _parse_fill_payload(raw, ["description"])
    assert parsed == {"description": "abc"}


def test_parse_fill_payload_skips_empty_string():
    raw = _to_json({"description": "  ", "tier": "protagonist"})
    parsed = _parse_fill_payload(raw, ["description", "tier"])
    assert parsed == {"tier": "protagonist"}


def test_parse_fill_payload_skips_empty_list():
    raw = _to_json({"tags": [], "description": "ok"})
    parsed = _parse_fill_payload(raw, ["tags", "description"])
    assert parsed == {"description": "ok"}


def test_parse_fill_payload_extracts_object_from_prose():
    raw = 'noise before {"description": "ok"} noise after'
    parsed = _parse_fill_payload(raw, ["description"])
    assert parsed == {"description": "ok"}


def test_parse_fill_payload_returns_empty_on_garbage():
    assert _parse_fill_payload("not json at all", ["description"]) == {}


# -- service: happy paths (mocked MiniMax) --------------------------------


def test_fill_character_partial_fields():
    """character has empty personality / description -> AI fills both."""
    entity = _make_entity(
        "character",
        id=1,
        name="林远图",
        gender="男",
        tier="protagonist",
        personality=None,
        desires=None,
        flaws=None,
        description=None,
        cultivation_realm=None,
    )
    payload = {
        "personality": "沉稳内敛",
        "description": "身披青衫的青年剑客",
    }
    svc, _ai, _repos = _make_service(
        payload, {("character", 1): entity}
    )

    result = svc.fill("character", entity_id=1, empty_fields=["personality", "description"])

    assert "filled" in result
    assert result["filled"]["personality"] == "沉稳内敛"
    assert result["filled"]["description"] == "身披青衫的青年剑客"


def test_fill_item_single_field():
    """item has empty description -> AI fills it."""
    entity = _make_entity(
        "item",
        id=2,
        name="封印灵根",
        description=None,
        owner="林远图",
        location=None,
        tags=None,
    )
    payload = {"description": "上古遗留的法宝，承载九州灵力"}
    svc, _ai, _repos = _make_service(payload, {("item", 2): entity})

    result = svc.fill("item", entity_id=2, empty_fields=["description"])

    assert result["filled"]["description"] == "上古遗留的法宝，承载九州灵力"


def test_fill_location_no_fields_needed():
    """emptyFields=[] -> short-circuit, no AI call."""
    entity = _make_entity("location", id=3, name="青云峰", description="x")
    svc, ai_client, _repos = _make_service({}, {("location", 3): entity})

    result = svc.fill("location", entity_id=3, empty_fields=[])

    assert result == {"filled": {}}
    ai_client.messages.create.assert_not_called()


def test_fill_faction_with_invalid_field():
    """emptyFields contains a field not valid for faction -> silently skipped."""
    entity = _make_entity(
        "faction",
        id=4,
        name="青云宗",
        description=None,
        type="sect",
        tags=None,
    )
    payload = {"description": "正道第一剑宗"}
    svc, ai_client, _repos = _make_service(payload, {("faction", 4): entity})

    # "cultivation_realm" is for characters, not factions — must be dropped.
    result = svc.fill(
        "faction",
        entity_id=4,
        empty_fields=["description", "cultivation_realm"],
    )

    assert result["filled"]["description"] == "正道第一剑宗"
    assert "cultivation_realm" not in result["filled"]


def test_fill_world_setting_multiple_fields():
    """One call fills multiple world_setting fields at once."""
    entity = _make_entity(
        "world_setting",
        id=5,
        name="九州大陆",
        description=None,
        category=None,
    )
    payload = {
        "description": "辽阔的中式奇幻世界",
        "category": "geography",
    }
    svc, _ai, _repos = _make_service(payload, {("world_setting", 5): entity})

    result = svc.fill(
        "world_setting",
        entity_id=5,
        empty_fields=["description", "category"],
    )

    assert result["filled"]["description"] == "辽阔的中式奇幻世界"
    assert result["filled"]["category"] == "geography"


def test_fill_rule_describe_only():
    """rule asked to fill only description."""
    entity = _make_entity(
        "rule",
        id=6,
        name="灵力守恒",
        description=None,
        rule_type="cultivation",
    )
    payload = {"description": "灵力总量守恒，不可凭空产生"}
    svc, _ai, _repos = _make_service(payload, {("rule", 6): entity})

    result = svc.fill("rule", entity_id=6, empty_fields=["description"])

    assert result["filled"]["description"] == "灵力总量守恒，不可凭空产生"
    # tier is for characters; should not appear
    assert "tier" not in result["filled"]


def test_fill_entity_not_found_raises_404():
    svc, _ai, _repos = _make_service({}, {})

    with pytest.raises(NotFoundException) as exc:
        svc.fill("character", entity_id=999, empty_fields=["description"])
    assert exc.value.status_code == 404


def test_fill_invalid_entity_type_raises_400():
    svc, _ai, _repos = _make_service({}, {})

    with pytest.raises(ValidationException) as exc:
        svc.fill("dragon", entity_id=1, empty_fields=["description"])
    assert exc.value.status_code == 400


def test_fill_handles_ai_timeout():
    entity = _make_entity("character", id=1, name="林远图")
    ai_client = MagicMock()
    ai_client.messages.create.side_effect = AIChatTimeout("elapsed 31.0s > 30s")
    repos = _make_repos({("character", 1): entity})
    svc = FieldFillerService(ai_client, repos)

    with pytest.raises(AIChatTimeout):
        svc.fill("character", entity_id=1, empty_fields=["description"])


def test_fill_handles_missing_api_key():
    """ai_client=None -> WriterException AI_NOT_CONFIGURED (503)."""
    repos = _make_repos()
    svc = FieldFillerService(None, repos)

    with pytest.raises(WriterException) as exc:
        svc.fill("character", entity_id=1, empty_fields=["description"])
    assert exc.value.code == "AI_NOT_CONFIGURED"
    assert exc.value.status_code == 503


def test_fill_handles_bad_ai_json():
    """AI returns unparseable text -> 502 AI_BAD_RESPONSE."""
    entity = _make_entity("character", id=1, name="林远图")
    ai_client = MagicMock()
    ai_client.messages.create.return_value = _make_ai_response(
        "definitely not json at all"
    )
    repos = _make_repos({("character", 1): entity})
    svc = FieldFillerService(ai_client, repos)

    with pytest.raises(WriterException) as exc:
        svc.fill("character", entity_id=1, empty_fields=["description"])
    assert exc.value.code == "AI_BAD_RESPONSE"
    assert exc.value.status_code == 502


def test_fill_response_shape():
    """filled is a dict keyed by requested field names with string/list values."""
    entity = _make_entity("item", id=2, name="封印灵根", tags=None)
    payload = {"tags": ["上古", "法宝"]}
    svc, _ai, _repos = _make_service(payload, {("item", 2): entity})

    result = svc.fill("item", entity_id=2, empty_fields=["tags"])

    assert isinstance(result, dict)
    assert "filled" in result
    assert isinstance(result["filled"], dict)
    assert "tags" in result["filled"]
    assert isinstance(result["filled"]["tags"], list)
    assert set(result["filled"]["tags"]) == {"上古", "法宝"}


def test_fill_supports_all_six_entity_types():
    """Smoke-check that all 6 entity types reach the AI."""
    payload_map = {
        "character": {"description": "c"},
        "item": {"description": "i"},
        "location": {"description": "l"},
        "faction": {"description": "f"},
        "world_setting": {"description": "w"},
        "rule": {"description": "r"},
    }
    for entity_type in ENTITY_TYPES:
        eid = 100 + hash(entity_type) % 1000
        entity = _make_entity(entity_type, id=eid, name=f"sample-{entity_type}")
        payload = payload_map[entity_type]
        svc, ai_client, repos = _make_service(
            payload, {(entity_type, eid): entity}
        )
        result = svc.fill(
            entity_type,
            entity_id=eid,
            empty_fields=["description"],
        )
        assert result["filled"]["description"] == payload["description"], entity_type


def test_fill_empty_fields_after_filtering_returns_empty():
    """emptyFields contains only non-fillable fields -> short-circuit."""
    entity = _make_entity("item", id=2, name="封印灵根")
    svc, ai_client, _repos = _make_service({}, {("item", 2): entity})

    # "tier" is a character-only field; not valid for items
    result = svc.fill("item", entity_id=2, empty_fields=["tier"])

    assert result == {"filled": {}}
    ai_client.messages.create.assert_not_called()


# -- router: HTTP-level integration (mocked AI) ---------------------------


def test_fill_router_happy_path(client):
    entity = _make_entity(
        "character", id=1, name="林远图", gender="男", description=None
    )
    payload = {"description": "身披青衫的青年剑客"}
    svc, _ai, _repos = _make_service(payload, {("character", 1): entity})
    app.dependency_overrides[get_field_filler_service] = lambda: svc
    try:
        resp = client.post(
            "/api/v1/ai/fill-fields",
            json={
                "entityType": "character",
                "entityId": 1,
                "emptyFields": ["description"],
            },
        )
    finally:
        app.dependency_overrides.pop(get_field_filler_service, None)

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["filled"]["description"] == "身披青衫的青年剑客"


def test_fill_router_validation_error_400(client):
    """Pydantic literal validation on entityType -> 400 (or 422)."""
    resp = client.post(
        "/api/v1/ai/fill-fields",
        json={"entityType": "dragon", "entityId": 1, "emptyFields": ["description"]},
    )
    assert resp.status_code in (400, 422)


def test_fill_router_entity_not_found_404(client):
    svc, _ai, _repos = _make_service({}, {})
    app.dependency_overrides[get_field_filler_service] = lambda: svc
    try:
        resp = client.post(
            "/api/v1/ai/fill-fields",
            json={
                "entityType": "character",
                "entityId": 999,
                "emptyFields": ["description"],
            },
        )
    finally:
        app.dependency_overrides.pop(get_field_filler_service, None)

    assert resp.status_code == 404
    assert resp.json()["success"] is False


def test_fill_router_bad_ai_response_502(client):
    entity = _make_entity("character", id=1, name="X", description=None)
    ai_client = MagicMock()
    ai_client.messages.create.return_value = _make_ai_response("not json")
    repos = _make_repos({("character", 1): entity})
    svc = FieldFillerService(ai_client, repos)
    app.dependency_overrides[get_field_filler_service] = lambda: svc
    try:
        resp = client.post(
            "/api/v1/ai/fill-fields",
            json={
                "entityType": "character",
                "entityId": 1,
                "emptyFields": ["description"],
            },
        )
    finally:
        app.dependency_overrides.pop(get_field_filler_service, None)

    assert resp.status_code == 502
    assert resp.json()["success"] is False


def test_fill_router_missing_api_key_503(client):
    repos = _make_repos()
    svc = FieldFillerService(None, repos)
    app.dependency_overrides[get_field_filler_service] = lambda: svc
    try:
        resp = client.post(
            "/api/v1/ai/fill-fields",
            json={
                "entityType": "character",
                "entityId": 1,
                "emptyFields": ["description"],
            },
        )
    finally:
        app.dependency_overrides.pop(get_field_filler_service, None)

    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "AI_NOT_CONFIGURED"


def test_fill_router_empty_fields_short_circuit(client):
    """emptyFields=[] -> 200 with filled={} immediately, no AI call."""
    entity = _make_entity("character", id=1, name="林远图")
    svc, ai_client, _repos = _make_service({}, {("character", 1): entity})
    app.dependency_overrides[get_field_filler_service] = lambda: svc
    try:
        resp = client.post(
            "/api/v1/ai/fill-fields",
            json={"entityType": "character", "entityId": 1, "emptyFields": []},
        )
    finally:
        app.dependency_overrides.pop(get_field_filler_service, None)

    assert resp.status_code == 200
    assert resp.json()["data"]["filled"] == {}
    ai_client.messages.create.assert_not_called()


# -- request schema validation --------------------------------------------


def test_fill_request_accepts_camel_case():
    from app.schemas.ai_fill_fields import FillFieldsRequest

    body = FillFieldsRequest.model_validate(
        {"entityType": "character", "entityId": 1, "emptyFields": ["description"]}
    )
    assert body.entity_type == "character"
    assert body.entity_id == 1
    assert body.empty_fields == ["description"]


def test_fill_request_accepts_empty_fields_default():
    from app.schemas.ai_fill_fields import FillFieldsRequest

    body = FillFieldsRequest.model_validate({"entityType": "item", "entityId": 1})
    assert body.empty_fields == []


def test_fill_request_rejects_invalid_entity_type():
    from app.schemas.ai_fill_fields import FillFieldsRequest

    with pytest.raises(PydanticValidationError):
        FillFieldsRequest.model_validate(
            {"entityType": "dragon", "entityId": 1, "emptyFields": []}
        )


# -- perf smoke (mocked; real MiniMax is exercised in live test below) -----


def test_fill_under_30s_mocked(client):
    """Full HTTP path with mocked AI must finish well under 30s."""
    entity = _make_entity("character", id=1, name="林远图", description=None)
    payload = {"description": "身披青衫的青年剑客"}
    svc, _ai, _repos = _make_service(payload, {("character", 1): entity})
    app.dependency_overrides[get_field_filler_service] = lambda: svc
    try:
        started = time.monotonic()
        resp = client.post(
            "/api/v1/ai/fill-fields",
            json={
                "entityType": "character",
                "entityId": 1,
                "emptyFields": ["description"],
            },
        )
        elapsed = time.monotonic() - started
    finally:
        app.dependency_overrides.pop(get_field_filler_service, None)

    assert resp.status_code == 200
    assert elapsed < 30.0


# -- optional real MiniMax integration (skipped without ANTHROPIC_API_KEY) -


@pytest.mark.skipif(
    not os.environ.get("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set; skipping live MiniMax integration test",
)
def test_fill_live_minimax():
    """Real MiniMax call through the real service + real Anthropic client.

    Requires a Character (or any entity) row whose id is known, OR we let the
    service raise NotFound — both paths exercise the live SDK surface.
    """
    from app.config import get_settings

    settings = get_settings()
    assert settings.anthropic_api_key, "API key must be set to run live test"

    from anthropic import Anthropic

    real_client = Anthropic(
        api_key=settings.anthropic_api_key,
        base_url=settings.anthropic_base_url,
    )

    # Mock repos (real DB might not have a character with id=1).
    entity = _make_entity(
        "character", id=1, name="林远图", gender="男", description=None
    )
    repos = _make_repos({("character", 1): entity})
    svc = FieldFillerService(real_client, repos)

    result = svc.fill("character", entity_id=1, empty_fields=["description"])

    assert "filled" in result
    assert isinstance(result["filled"], dict)
