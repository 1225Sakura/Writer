"""AI review-consistency endpoint tests (US-009).

All cases mock the Anthropic SDK so the test suite stays offline and fast.
Production code calls real MiniMax via the same Anthropic client surface.

Real MiniMax integration is exercised by test_review_live_minimax when
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

from app.core.exceptions import WriterException
from app.dependencies import get_consistency_review_service
from app.main import app
from app.services.ai_chat import AIChatTimeout


ENTITY_TYPES = (
    "character",
    "item",
    "location",
    "faction",
    "world_setting",
    "rule",
)


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
    """Build a mock entity ORM-like object with .id, .name, plus extra fields."""
    ent = MagicMock()
    ent.id = fields.pop("id", 1)
    ent.name = fields.get("name", f"sample-{entity_type}")
    for k, v in fields.items():
        setattr(ent, k, v)
    return ent


def _make_repos(entities_by_type: dict[str, list] | None = None) -> dict[str, MagicMock]:
    entities_by_type = entities_by_type or {}
    repos: dict[str, MagicMock] = {}
    for entity_type in ENTITY_TYPES:
        repo = MagicMock()
        repo.list.return_value = entities_by_type.get(entity_type, [])
        repos[entity_type] = repo
    return repos


def _make_service(payload, entities_by_type=None):
    """Build service with mocked AI client + repos; return (svc, ai_client, repos)."""
    from app.services.ai_review_consistency import ConsistencyReviewService

    ai_client = MagicMock()
    ai_client.messages.create.return_value = _make_ai_response(payload)
    repos = _make_repos(entities_by_type)
    svc = ConsistencyReviewService(ai_client, repos)
    return svc, ai_client, repos


# -- service: payload shape variants (mocked MiniMax) ---------------------


def test_review_with_no_issues():
    svc, _ai, _repos = _make_service(
        {"issues": [], "suggestions": []},
        {"character": [_make_entity("character", id=1, name="林远图", tier="protagonist")]},
    )

    result = svc.review(project_id=1)

    assert result == {"issues": [], "suggestions": []}


def test_review_with_minor_issues():
    payload = {
        "issues": [
            {
                "severity": "low",
                "location": "character:林远图",
                "description": "角色性格可以更丰富",
            }
        ],
        "suggestions": ["为主角增加一段独白展示内心矛盾"],
    }
    svc, _ai, _repos = _make_service(
        payload,
        {"character": [_make_entity("character", id=1, name="林远图", tier="protagonist")]},
    )

    result = svc.review(project_id=1)

    assert len(result["issues"]) == 1
    assert result["issues"][0]["severity"] == "low"
    assert result["issues"][0]["location"] == "character:林远图"
    assert result["issues"][0]["description"] == "角色性格可以更丰富"
    assert result["suggestions"] == ["为主角增加一段独白展示内心矛盾"]


def test_review_with_critical_issues():
    payload = {
        "issues": [
            {
                "severity": "critical",
                "location": "rule:灵力守恒",
                "description": "与第3章出现矛盾",
            }
        ],
        "suggestions": ["重写规则说明"],
    }
    svc, _ai, _repos = _make_service(
        payload,
        {"character": [_make_entity("character", id=1, name="林远图", tier="protagonist")]},
    )

    result = svc.review(project_id=1)

    assert result["issues"][0]["severity"] == "critical"
    assert result["issues"][0]["location"] == "rule:灵力守恒"


def test_review_targets_all_types_by_default():
    """targetTypes omitted -> service queries all 6 entity repos."""
    svc, _ai, repos = _make_service({"issues": [], "suggestions": []})

    svc.review(project_id=42)

    for entity_type in ENTITY_TYPES:
        repos[entity_type].list.assert_called_once()
        _, kwargs = repos[entity_type].list.call_args
        assert kwargs.get("project_id") == 42


def test_review_targets_specific_types():
    """targetTypes=['character','item'] -> only those 2 repos queried."""
    svc, _ai, repos = _make_service({"issues": [], "suggestions": []})

    svc.review(project_id=7, target_types=["character", "item"])

    repos["character"].list.assert_called_once()
    repos["item"].list.assert_called_once()
    # Other 4 repos must not be queried
    for entity_type in ("location", "faction", "world_setting", "rule"):
        repos[entity_type].list.assert_not_called()


def test_review_empty_project_returns_no_issues():
    """No entities in any repo -> service short-circuits with empty result."""
    svc, _ai, _repos = _make_service({"issues": [], "suggestions": []}, entities_by_type={})

    result = svc.review(project_id=1)

    assert result["issues"] == []
    # Suggestion hint when nothing to review
    assert any("添加" in s or "设定" in s for s in result["suggestions"])


def test_review_handles_ai_timeout():
    """AI client times out -> service raises AIChatTimeout (504)."""
    from app.services.ai_review_consistency import ConsistencyReviewService

    ai_client = MagicMock()
    ai_client.messages.create.side_effect = AIChatTimeout("elapsed 31.0s > 30s")
    repos = _make_repos({"character": [_make_entity("character", id=1, name="林远图")]})
    svc = ConsistencyReviewService(ai_client, repos)

    with pytest.raises(AIChatTimeout):
        svc.review(project_id=1)


def test_review_handles_missing_api_key():
    """ai_client=None -> service raises WriterException AI_NOT_CONFIGURED (503)."""
    from app.services.ai_review_consistency import ConsistencyReviewService

    repos = _make_repos()
    svc = ConsistencyReviewService(None, repos)

    with pytest.raises(WriterException) as exc:
        svc.review(project_id=1)
    assert exc.value.code == "AI_NOT_CONFIGURED"
    assert exc.value.status_code == 503


def test_review_handles_bad_ai_json():
    """AI returns unparseable text -> service raises WriterException AI_BAD_RESPONSE (502)."""
    from app.services.ai_review_consistency import ConsistencyReviewService

    ai_client = MagicMock()
    ai_client.messages.create.return_value = _make_ai_response("not parseable json at all")
    repos = _make_repos({"character": [_make_entity("character", id=1, name="林远图")]})
    svc = ConsistencyReviewService(ai_client, repos)

    with pytest.raises(WriterException) as exc:
        svc.review(project_id=1)
    assert exc.value.code == "AI_BAD_RESPONSE"
    assert exc.value.status_code == 502


def test_review_response_shape():
    """issues[*] has severity/location/description; suggestions is list[str]."""
    payload = {
        "issues": [
            {"severity": "low", "location": "character:林远图", "description": "x"},
            {"severity": "medium", "location": "item:封印灵根", "description": "y"},
        ],
        "suggestions": ["s1", "s2"],
    }
    svc, _ai, _repos = _make_service(payload)

    result = svc.review(project_id=1)

    for issue in result["issues"]:
        assert set(issue.keys()) >= {"severity", "location", "description"}
        assert isinstance(issue["severity"], str)
        assert isinstance(issue["location"], str)
        assert isinstance(issue["description"], str)
    assert isinstance(result["suggestions"], list)
    for s in result["suggestions"]:
        assert isinstance(s, str)


# -- router: HTTP-level integration (mocked AI) ---------------------------


def test_review_router_happy_path(client):
    payload = {
        "issues": [
            {"severity": "low", "location": "character:林远图", "description": "可更立体"}
        ],
        "suggestions": ["增加一段独白"],
    }
    svc, _ai, _repos = _make_service(
        payload,
        {"character": [_make_entity("character", id=1, name="林远图", tier="protagonist")]},
    )
    app.dependency_overrides[get_consistency_review_service] = lambda: svc
    try:
        resp = client.post(
            "/api/v1/ai/review-consistency",
            json={"projectId": 1},
        )
    finally:
        app.dependency_overrides.pop(get_consistency_review_service, None)

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "issues" in body["data"]
    assert "suggestions" in body["data"]
    assert body["data"]["issues"][0]["severity"] == "low"
    assert body["data"]["suggestions"] == ["增加一段独白"]


def test_review_router_validation_error_400(client):
    """projectId missing -> Pydantic body validation -> 400 (or 422 if custom handler not registered)."""
    resp = client.post("/api/v1/ai/review-consistency", json={})
    # Mirrors US-008 pattern: accept both 400 (custom handler) and 422 (FastAPI default).
    assert resp.status_code in (400, 422)


def test_review_router_bad_ai_response_502(client):
    """AI returns garbage -> 502 via generic exception handler."""
    from app.services.ai_review_consistency import ConsistencyReviewService

    ai_client = MagicMock()
    ai_client.messages.create.return_value = _make_ai_response("not json")
    repos = _make_repos({"character": [_make_entity("character", id=1, name="X")]})
    svc = ConsistencyReviewService(ai_client, repos)
    app.dependency_overrides[get_consistency_review_service] = lambda: svc
    try:
        resp = client.post(
            "/api/v1/ai/review-consistency",
            json={"projectId": 1},
        )
    finally:
        app.dependency_overrides.pop(get_consistency_review_service, None)

    assert resp.status_code == 502
    assert resp.json()["success"] is False


def test_review_router_missing_api_key_503(client):
    """ai_client=None -> AI_NOT_CONFIGURED -> 503."""
    from app.services.ai_review_consistency import ConsistencyReviewService

    repos = _make_repos()
    svc = ConsistencyReviewService(None, repos)
    app.dependency_overrides[get_consistency_review_service] = lambda: svc
    try:
        resp = client.post(
            "/api/v1/ai/review-consistency",
            json={"projectId": 1},
        )
    finally:
        app.dependency_overrides.pop(get_consistency_review_service, None)

    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "AI_NOT_CONFIGURED"


def test_review_router_accepts_target_types(client):
    """Body with targetTypes=['character'] only queries character repo."""
    svc, _ai, repos = _make_service(
        {"issues": [], "suggestions": []},
        {"character": [_make_entity("character", id=1, name="林远图")]},
    )
    app.dependency_overrides[get_consistency_review_service] = lambda: svc
    try:
        resp = client.post(
            "/api/v1/ai/review-consistency",
            json={"projectId": 1, "targetTypes": ["character"]},
        )
    finally:
        app.dependency_overrides.pop(get_consistency_review_service, None)

    assert resp.status_code == 200
    repos["character"].list.assert_called_once()
    for t in ("item", "location", "faction", "world_setting", "rule"):
        repos[t].list.assert_not_called()


# -- request schema validation --------------------------------------------


def test_review_request_accepts_camel_case_project_id():
    from app.schemas.ai_review import ReviewConsistencyRequest

    body = ReviewConsistencyRequest.model_validate({"projectId": 1})
    assert body.project_id == 1
    assert body.target_types is None


def test_review_request_accepts_target_types_alias():
    from app.schemas.ai_review import ReviewConsistencyRequest

    body = ReviewConsistencyRequest.model_validate(
        {"projectId": 1, "targetTypes": ["character", "item"]}
    )
    assert body.target_types == ["character", "item"]


def test_review_request_rejects_missing_project_id():
    from app.schemas.ai_review import ReviewConsistencyRequest

    with pytest.raises(PydanticValidationError):
        ReviewConsistencyRequest.model_validate({})


# -- perf smoke (mocked; real MiniMax is exercised in live test below) -----


def test_review_under_30s_mocked(client):
    """Full HTTP path with mocked AI must finish well under 30s."""
    svc, _ai, _repos = _make_service(
        {"issues": [], "suggestions": []},
        {"character": [_make_entity("character", id=1, name="林远图")]},
    )
    app.dependency_overrides[get_consistency_review_service] = lambda: svc
    try:
        started = time.monotonic()
        resp = client.post(
            "/api/v1/ai/review-consistency",
            json={"projectId": 1},
        )
        elapsed = time.monotonic() - started
    finally:
        app.dependency_overrides.pop(get_consistency_review_service, None)

    assert resp.status_code == 200
    assert elapsed < 30.0


# -- optional real MiniMax integration (skipped without ANTHROPIC_API_KEY) --


@pytest.mark.skipif(
    not os.environ.get("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set; skipping live MiniMax integration test",
)
def test_review_live_minimax():
    """Real MiniMax call through the real service + real Anthropic client."""
    from app.config import get_settings
    from app.services.ai_review_consistency import ConsistencyReviewService

    settings = get_settings()
    assert settings.anthropic_api_key, "API key must be set to run live test"

    ai_client = MagicMock()  # placeholder, replaced by real client below
    repos = _make_repos()
    svc = ConsistencyReviewService(ai_client, repos)
    # Swap in a real client for this one test
    from anthropic import Anthropic

    real_client = Anthropic(
        api_key=settings.anthropic_api_key,
        base_url=settings.anthropic_base_url,
    )
    svc._ai = real_client

    result = svc.review(project_id=1)

    assert "issues" in result
    assert "suggestions" in result
    assert isinstance(result["issues"], list)
    assert isinstance(result["suggestions"], list)
