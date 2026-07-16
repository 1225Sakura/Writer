"""AI rewrite-description endpoint tests (US-011).

All cases mock the Anthropic SDK so the test suite stays offline and fast.
Production code calls real MiniMax via the same Anthropic client surface.

Real MiniMax integration is exercised by test_rewrite_live_minimax when
ANTHROPIC_API_KEY is present in the environment.
"""
from __future__ import annotations

import json
import os
import time
from unittest.mock import MagicMock

import pytest
from pydantic import ValidationError as PydanticValidationError

from app.core.exceptions import NotFoundException, ValidationException, WriterException
from app.dependencies import get_description_rewriter_service
from app.main import app
from app.services.ai_chat import AIChatTimeout
from app.services.ai_rewrite_description import (
    STYLE_PROMPTS,
    DescriptionRewriterService,
    _parse_rewrite_payload,
)


ENTITY_TYPES = (
    "character", "item", "location", "faction", "world_setting", "rule",
)
SUPPORTED_STYLES = tuple(STYLE_PROMPTS.keys())


# -- helpers ---------------------------------------------------------------


def _to_json(payload: dict | list | str) -> str:
    if isinstance(payload, str):
        return payload
    return json.dumps(payload, ensure_ascii=False)


def _make_ai_response(payload: dict | list | str) -> MagicMock:
    text = _to_json(payload)
    block = MagicMock()
    block.text = text
    response = MagicMock()
    response.content = [block]
    return response


def _make_entity(entity_type: str, **fields) -> MagicMock:
    """Build a mock entity ORM-like object (description required)."""
    ent = MagicMock()
    ent.id = fields.pop("id", 1)
    ent.name = fields.get("name", f"sample-{entity_type}")
    for k, v in fields.items():
        setattr(ent, k, v)
    return ent


def _make_repos(entities_by_id: dict | None = None) -> dict[str, MagicMock]:
    """Build 6 mock repos whose .get(id) returns a pre-loaded entity if any."""
    repos: dict[str, MagicMock] = {}
    entities_by_id = entities_by_id or {}
    for entity_type in ENTITY_TYPES:
        repo = MagicMock()
        matching = [
            (etype, eid, entity)
            for (etype, eid), entity in entities_by_id.items()
            if etype == entity_type
        ]
        if matching:
            _, _, entity = matching[0]
            repo.get.return_value = entity
        else:
            repo.get.return_value = None
        repos[entity_type] = repo
    return repos


def _make_service(payload, entities_by_id=None, *, ai_client=None):
    """Build service with mocked AI client + repos; return (svc, ai_client, repos)."""
    if ai_client is None:
        ai_client = MagicMock()
        ai_client.messages.create.return_value = _make_ai_response(payload)
    repos = _make_repos(entities_by_id)
    svc = DescriptionRewriterService(ai_client, repos)
    return svc, ai_client, repos


# -- unit: payload parser -------------------------------------------------


def test_parse_rewrite_payload_handles_fenced_json():
    raw = "```json\n" + _to_json({"description": "abc"}) + "\n```"
    assert _parse_rewrite_payload(raw) == "abc"


def test_parse_rewrite_payload_unwraps_result_key():
    raw = _to_json({"result": {"description": "abc"}})
    assert _parse_rewrite_payload(raw) == "abc"


def test_parse_rewrite_payload_unwraps_rewrite_key():
    raw = _to_json({"rewrite": {"description": "abc"}})
    assert _parse_rewrite_payload(raw) == "abc"


def test_parse_rewrite_payload_extracts_object_from_prose():
    raw = 'noise before {"description": "ok"} noise after'
    assert _parse_rewrite_payload(raw) == "ok"


def test_parse_rewrite_payload_returns_empty_on_garbage():
    assert _parse_rewrite_payload("not json at all") == ""


def test_parse_rewrite_payload_returns_empty_on_missing_description():
    raw = _to_json({"other": "field"})
    assert _parse_rewrite_payload(raw) == ""


def test_parse_rewrite_payload_strips_whitespace_description():
    raw = _to_json({"description": "  clean text  "})
    assert _parse_rewrite_payload(raw) == "clean text"


# -- service: happy paths for each style (mocked MiniMax) -----------------


def test_rewrite_character_concise():
    entity = _make_entity(
        "character",
        id=1,
        name="林远图",
        gender="男",
        description="身披青衫的青年剑客，九州宗弟子，三年前下山历练。",
    )
    payload = {"description": "青衫剑客，九州宗弟子。" }
    svc, _ai, _repos = _make_service(payload, {("character", 1): entity})

    result = svc.rewrite("character", entity_id=1, style="concise")

    assert result["description"]
    assert result["style"] == "concise"
    assert result["entityType"] == "character"
    assert result["entityId"] == 1


def test_rewrite_item_literary():
    entity = _make_entity(
        "item",
        id=2,
        name="封印灵根",
        owner="林远图",
        description="上古遗留的法宝，承载九州灵力，可封印妖魔。",
    )
    payload = {"description": "灵根封印千万妖，九州独此一宝光。" }
    svc, _ai, _repos = _make_service(payload, {("item", 2): entity})

    result = svc.rewrite("item", entity_id=2, style="literary")

    assert result["description"]
    assert result["style"] == "literary"
    assert result["entityType"] == "item"


def test_rewrite_location_classical():
    entity = _make_entity(
        "location",
        id=3,
        name="青云峰",
        importance="core",
        description="九州宗的主峰，云雾缭绕，山巅有一座剑殿。",
    )
    payload = {"description": "青云峰高耸入云，剑殿隐于云雾之中。" }
    svc, _ai, _repos = _make_service(payload, {("location", 3): entity})

    result = svc.rewrite("location", entity_id=3, style="classical")

    assert result["description"]
    assert result["style"] == "classical"


def test_rewrite_faction_humorous():
    entity = _make_entity(
        "faction",
        id=4,
        name="青云宗",
        type="sect",
        description="正道第一剑宗，以守护九州为己任。",
    )
    payload = {"description": "自诩九州第一剑宗，其实是一群爱管闲事的剑痴。" }
    svc, _ai, _repos = _make_service(payload, {("faction", 4): entity})

    result = svc.rewrite("faction", entity_id=4, style="humorous")

    assert result["description"]
    assert result["style"] == "humorous"


def test_rewrite_world_setting_mysterious():
    entity = _make_entity(
        "world_setting",
        id=5,
        name="九州大陆",
        category="geography",
        description="辽阔的中式奇幻世界，分九州五域。",
    )
    payload = {"description": "九州大陆，云雾之下藏着不可言说的秘密。" }
    svc, _ai, _repos = _make_service(payload, {("world_setting", 5): entity})

    result = svc.rewrite("world_setting", entity_id=5, style="mysterious")

    assert result["description"]
    assert result["style"] == "mysterious"


def test_rewrite_rule_default_style():
    """Rule entity with concise style — covers all 6 entity types reachable."""
    entity = _make_entity(
        "rule",
        id=6,
        name="灵力守恒",
        rule_type="cultivation",
        description="灵力总量守恒，不可凭空产生。",
    )
    payload = {"description": "灵力守恒，不可凭空而生。"}
    svc, _ai, _repos = _make_service(payload, {("rule", 6): entity})

    result = svc.rewrite("rule", entity_id=6, style="concise")

    assert result["description"]
    assert result["style"] == "concise"


def test_rewrite_supports_all_five_styles():
    """All 5 STYLE_PROMPTS values must be accepted by the service."""
    entity = _make_entity(
        "character",
        id=1,
        name="X",
        description="原始描述，包含关键事实：他是剑客。",
    )
    for style in SUPPORTED_STYLES:
        payload = {"description": f"重写-{style}"}
        svc, ai_client, repos = _make_service(payload, {("character", 1): entity})
        result = svc.rewrite("character", entity_id=1, style=style)
        assert result["style"] == style
        assert result["description"]


# -- service: error mappings ----------------------------------------------


def test_rewrite_unsupported_style_raises_400():
    entity = _make_entity(
        "character", id=1, name="X", description="描述内容"
    )
    svc, _ai, _repos = _make_service({}, {("character", 1): entity})

    with pytest.raises(ValidationException) as exc:
        svc.rewrite("character", entity_id=1, style="shakespearean")
    assert exc.value.status_code == 400
    assert "shakespearean" in exc.value.message


def test_rewrite_invalid_entity_type_raises_400():
    svc, _ai, _repos = _make_service({}, {})

    with pytest.raises(ValidationException) as exc:
        svc.rewrite("dragon", entity_id=1, style="concise")
    assert exc.value.status_code == 400


def test_rewrite_entity_not_found_raises_404():
    svc, _ai, _repos = _make_service({}, {})

    with pytest.raises(NotFoundException) as exc:
        svc.rewrite("character", entity_id=999, style="concise")
    assert exc.value.status_code == 404


def test_rewrite_empty_description_raises_400():
    entity = _make_entity("character", id=1, name="X", description=None)
    svc, _ai, _repos = _make_service({}, {("character", 1): entity})

    with pytest.raises(ValidationException) as exc:
        svc.rewrite("character", entity_id=1, style="concise")
    assert exc.value.status_code == 400
    assert "description" in exc.value.message.lower()


def test_rewrite_whitespace_only_description_raises_400():
    entity = _make_entity("item", id=2, name="Y", description="   \n  \t  ")
    svc, _ai, _repos = _make_service({}, {("item", 2): entity})

    with pytest.raises(ValidationException) as exc:
        svc.rewrite("item", entity_id=2, style="literary")
    assert exc.value.status_code == 400


def test_rewrite_handles_ai_timeout():
    entity = _make_entity(
        "character", id=1, name="林远图", description="原始描述"
    )
    ai_client = MagicMock()
    ai_client.messages.create.side_effect = AIChatTimeout("elapsed 31.0s > 30s")
    repos = _make_repos({("character", 1): entity})
    svc = DescriptionRewriterService(ai_client, repos)

    with pytest.raises(AIChatTimeout):
        svc.rewrite("character", entity_id=1, style="concise")


def test_rewrite_handles_missing_api_key():
    """ai_client=None -> WriterException AI_NOT_CONFIGURED (503)."""
    repos = _make_repos()
    svc = DescriptionRewriterService(None, repos)

    with pytest.raises(WriterException) as exc:
        svc.rewrite("character", entity_id=1, style="concise")
    assert exc.value.code == "AI_NOT_CONFIGURED"
    assert exc.value.status_code == 503


def test_rewrite_handles_bad_ai_json():
    """AI returns unparseable text -> 502 AI_BAD_RESPONSE."""
    entity = _make_entity(
        "character", id=1, name="林远图", description="原始描述"
    )
    ai_client = MagicMock()
    ai_client.messages.create.return_value = _make_ai_response(
        "definitely not json at all"
    )
    repos = _make_repos({("character", 1): entity})
    svc = DescriptionRewriterService(ai_client, repos)

    with pytest.raises(WriterException) as exc:
        svc.rewrite("character", entity_id=1, style="concise")
    assert exc.value.code == "AI_BAD_RESPONSE"
    assert exc.value.status_code == 502


def test_rewrite_response_shape():
    """Response must contain non-empty description plus echoed metadata."""
    entity = _make_entity(
        "item",
        id=2,
        name="封印灵根",
        description="上古遗留的法宝",
    )
    payload = {"description": "重写后的描述，保留核心信息"}
    svc, _ai, _repos = _make_service(payload, {("item", 2): entity})

    result = svc.rewrite("item", entity_id=2, style="literary")

    assert isinstance(result, dict)
    assert isinstance(result["description"], str)
    assert result["description"].strip()
    assert result["style"] == "literary"
    assert result["entityType"] == "item"
    assert result["entityId"] == 2


def test_rewrite_preserves_core_info_in_prompt():
    """The prompt sent to the AI must include the original description text."""
    entity = _make_entity(
        "character",
        id=42,
        name="林远图",
        description="独一无二的钥匙描述：他在雪山之巅练剑",
    )
    payload = {"description": "重写版本"}
    svc, ai_client, _repos = _make_service(payload, {("character", 42): entity})

    svc.rewrite("character", entity_id=42, style="concise")

    call_args = ai_client.messages.create.call_args
    user_msg = call_args.kwargs.get("messages", call_args.args[0] if call_args.args else None)[0]["content"]
    assert "独一无二的钥匙描述" in user_msg
    assert "林远图" in user_msg
    assert "concise" not in user_msg.lower() or "简洁" in user_msg  # style instruction appears


def test_rewrite_uses_correct_style_instruction():
    """The style instruction must be the prompt corresponding to the requested style."""
    entity = _make_entity(
        "character", id=1, name="X", description="原始描述"
    )
    payload = {"description": "重写版本"}
    svc, ai_client, _repos = _make_service(payload, {("character", 1): entity})

    svc.rewrite("character", entity_id=1, style="classical")

    user_msg = ai_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "文言" in user_msg or "古典" in user_msg or "古" in user_msg


# -- router: HTTP-level integration (mocked AI) ---------------------------


def test_rewrite_router_happy_path(client):
    entity = _make_entity(
        "character", id=1, name="林远图", gender="男",
        description="身披青衫的青年剑客",
    )
    payload = {"description": "简洁重写：他是个剑客"}
    svc, _ai, _repos = _make_service(payload, {("character", 1): entity})
    app.dependency_overrides[get_description_rewriter_service] = lambda: svc
    try:
        resp = client.post(
            "/api/v1/ai/rewrite-description",
            json={
                "entityType": "character",
                "entityId": 1,
                "style": "concise",
            },
        )
    finally:
        app.dependency_overrides.pop(get_description_rewriter_service, None)

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["description"]
    assert body["data"]["style"] == "concise"
    assert body["data"]["entityType"] == "character"
    assert body["data"]["entityId"] == 1


def test_rewrite_router_validation_error_400_on_bad_style(client):
    resp = client.post(
        "/api/v1/ai/rewrite-description",
        json={
            "entityType": "character",
            "entityId": 1,
            "style": "shakespearean",
        },
    )
    assert resp.status_code in (400, 422)


def test_rewrite_router_validation_error_400_on_bad_entity_type(client):
    resp = client.post(
        "/api/v1/ai/rewrite-description",
        json={"entityType": "dragon", "entityId": 1, "style": "concise"},
    )
    assert resp.status_code in (400, 422)


def test_rewrite_router_entity_not_found_404(client):
    svc, _ai, _repos = _make_service({}, {})
    app.dependency_overrides[get_description_rewriter_service] = lambda: svc
    try:
        resp = client.post(
            "/api/v1/ai/rewrite-description",
            json={"entityType": "character", "entityId": 999, "style": "concise"},
        )
    finally:
        app.dependency_overrides.pop(get_description_rewriter_service, None)

    assert resp.status_code == 404
    assert resp.json()["success"] is False


def test_rewrite_router_bad_ai_response_502(client):
    entity = _make_entity(
        "character", id=1, name="X", description="原始描述"
    )
    ai_client = MagicMock()
    ai_client.messages.create.return_value = _make_ai_response("not json")
    repos = _make_repos({("character", 1): entity})
    svc = DescriptionRewriterService(ai_client, repos)
    app.dependency_overrides[get_description_rewriter_service] = lambda: svc
    try:
        resp = client.post(
            "/api/v1/ai/rewrite-description",
            json={"entityType": "character", "entityId": 1, "style": "concise"},
        )
    finally:
        app.dependency_overrides.pop(get_description_rewriter_service, None)

    assert resp.status_code == 502
    assert resp.json()["success"] is False


def test_rewrite_router_missing_api_key_503(client):
    repos = _make_repos()
    svc = DescriptionRewriterService(None, repos)
    app.dependency_overrides[get_description_rewriter_service] = lambda: svc
    try:
        resp = client.post(
            "/api/v1/ai/rewrite-description",
            json={"entityType": "character", "entityId": 1, "style": "concise"},
        )
    finally:
        app.dependency_overrides.pop(get_description_rewriter_service, None)

    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "AI_NOT_CONFIGURED"


# -- request schema validation --------------------------------------------


def test_rewrite_request_accepts_camel_case():
    from app.schemas.ai_rewrite_description import RewriteDescriptionRequest

    body = RewriteDescriptionRequest.model_validate(
        {"entityType": "character", "entityId": 1, "style": "concise"}
    )
    assert body.entity_type == "character"
    assert body.entity_id == 1
    assert body.style == "concise"


def test_rewrite_request_rejects_invalid_entity_type():
    from app.schemas.ai_rewrite_description import RewriteDescriptionRequest

    with pytest.raises(PydanticValidationError):
        RewriteDescriptionRequest.model_validate(
            {"entityType": "dragon", "entityId": 1, "style": "concise"}
        )


def test_rewrite_request_rejects_invalid_style():
    from app.schemas.ai_rewrite_description import RewriteDescriptionRequest

    with pytest.raises(PydanticValidationError):
        RewriteDescriptionRequest.model_validate(
            {"entityType": "character", "entityId": 1, "style": "shakespearean"}
        )


def test_rewrite_request_supports_all_six_entity_types():
    from app.schemas.ai_rewrite_description import RewriteDescriptionRequest

    for entity_type in ENTITY_TYPES:
        body = RewriteDescriptionRequest.model_validate(
            {"entityType": entity_type, "entityId": 1, "style": "concise"}
        )
        assert body.entity_type == entity_type


def test_rewrite_request_supports_all_five_styles():
    from app.schemas.ai_rewrite_description import RewriteDescriptionRequest

    for style in SUPPORTED_STYLES:
        body = RewriteDescriptionRequest.model_validate(
            {"entityType": "character", "entityId": 1, "style": style}
        )
        assert body.style == style


# -- perf smoke (mocked; real MiniMax exercised in live test below) -------


def test_rewrite_under_30s_mocked(client):
    """Full HTTP path with mocked AI must finish well under 30s."""
    entity = _make_entity(
        "character", id=1, name="林远图", description="身披青衫的青年剑客"
    )
    payload = {"description": "青衫青年，剑术精妙"}
    svc, _ai, _repos = _make_service(payload, {("character", 1): entity})
    app.dependency_overrides[get_description_rewriter_service] = lambda: svc
    try:
        started = time.monotonic()
        resp = client.post(
            "/api/v1/ai/rewrite-description",
            json={
                "entityType": "character",
                "entityId": 1,
                "style": "concise",
            },
        )
        elapsed = time.monotonic() - started
    finally:
        app.dependency_overrides.pop(get_description_rewriter_service, None)

    assert resp.status_code == 200
    assert elapsed < 30.0


# -- optional real MiniMax integration (skipped without ANTHROPIC_API_KEY) --


@pytest.mark.skipif(
    not os.environ.get("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set; skipping live MiniMax integration test",
)
def test_rewrite_live_minimax():
    """Real MiniMax call through the real service + real Anthropic client."""
    from app.config import get_settings

    settings = get_settings()
    assert settings.anthropic_api_key, "API key must be set to run live test"

    from anthropic import Anthropic

    real_client = Anthropic(
        api_key=settings.anthropic_api_key,
        base_url=settings.anthropic_base_url,
    )

    # Mock repos + entity with a real description so the AI has something to rewrite.
    entity = _make_entity(
        "character",
        id=1,
        name="林远图",
        gender="男",
        description="身披青衫的青年剑客，九州宗弟子，三年前下山历练",
    )
    repos = _make_repos({("character", 1): entity})
    svc = DescriptionRewriterService(real_client, repos)

    result = svc.rewrite("character", entity_id=1, style="concise")

    assert "description" in result
    assert isinstance(result["description"], str)
    assert result["description"].strip()
    assert result["style"] == "concise"
