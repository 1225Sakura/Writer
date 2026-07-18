"""Outline generation endpoint tests (US-012).

Automated cases mock the Anthropic SDK. The optional live MiniMax test is
skipped unless ANTHROPIC_API_KEY is available.
"""
from __future__ import annotations

import json
import os
import time
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from pydantic import ValidationError as PydanticValidationError

from app.core.exceptions import NotFoundException, ValidationException, WriterException
from app.main import app
from app.models import Chapter, Outline, Project
from app.repositories.chapter import ChapterRepository
from app.repositories.outline import OutlineRepository
from app.repositories.project import ProjectRepository
from app.services.ai_chat import AIChatTimeout


ENTITY_TYPES = (
    "character",
    "item",
    "location",
    "faction",
    "world_setting",
    "rule",
)


def _make_ai_response(payload: dict | list | str) -> MagicMock:
    text = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
    block = MagicMock()
    block.text = text
    response = MagicMock()
    response.content = [block]
    return response


def _chapters(count: int) -> list[dict[str, object]]:
    return [
        {"title": f"第{i}章", "summary": f"第{i}章剧情摘要"}
        for i in range(1, count + 1)
    ]


def _rich_chapters(count: int) -> list[dict[str, object]]:
    return [
        {
            "title": f"第{i}章",
            "summary": f"第{i}章剧情摘要",
            "sections": [f"第{i}章开端", f"第{i}章转折"],
            "pacingNotes": "张弛有度",
            "characterDynamics": "主角与同伴的信任加深",
            "foreshadowing": "埋下玉佩来历的线索",
        }
        for i in range(1, count + 1)
    ]


def _make_entity_repos(entities_by_type: dict[str, list] | None = None) -> dict[str, MagicMock]:
    entities_by_type = entities_by_type or {}
    repos: dict[str, MagicMock] = {}
    for entity_type in ENTITY_TYPES:
        repo = MagicMock()
        repo.list.return_value = entities_by_type.get(entity_type, [])
        repos[entity_type] = repo
    return repos


def _make_mock_service(
    payload: dict | list | str,
    *,
    project: object | None = None,
    entities_by_type: dict[str, list] | None = None,
    ai_client: object | None = None,
):
    from app.services.outline_generator import OutlineGeneratorService

    if project is None:
        project = SimpleNamespace(id=1, name="测试小说", description="测试简介", genre="玄幻")
    project_repo = MagicMock()
    project_repo.get.return_value = project

    outline_repo = MagicMock()

    def create_outline(outline):
        outline.id = 77
        return outline

    outline_repo.create.side_effect = create_outline

    chapter_repo = MagicMock()
    created_chapters = []

    def create_chapter(chapter):
        chapter.id = len(created_chapters) + 101
        created_chapters.append(chapter)
        return chapter

    chapter_repo.create.side_effect = create_chapter
    entity_repos = _make_entity_repos(entities_by_type)

    if ai_client is None:
        ai_client = MagicMock()
        ai_client.messages.create.return_value = _make_ai_response(payload)

    service = OutlineGeneratorService(
        ai_client=ai_client,
        project_repo=project_repo,
        outline_repo=outline_repo,
        chapter_repo=chapter_repo,
        entity_repos=entity_repos,
    )
    return (
        service,
        ai_client,
        project_repo,
        outline_repo,
        chapter_repo,
        entity_repos,
        created_chapters,
    )


def _make_db_service(db_session, payload: dict | list | str):
    from app.services.outline_generator import OutlineGeneratorService

    project_repo = ProjectRepository(db_session)
    project = project_repo.create(Project(name="测试小说", description="测试简介", genre="玄幻"))
    ai_client = MagicMock()
    ai_client.messages.create.return_value = _make_ai_response(payload)
    service = OutlineGeneratorService(
        ai_client=ai_client,
        project_repo=project_repo,
        outline_repo=OutlineRepository(db_session),
        chapter_repo=ChapterRepository(db_session),
        entity_repos=_make_entity_repos(),
    )
    return service, project, ai_client


# -- RED: endpoint must exist ------------------------------------------------


def test_generate_endpoint_exists(client):
    from app.dependencies import get_outline_generator_service

    service, *_rest = _make_mock_service({"chapters": _chapters(1)})
    app.dependency_overrides[get_outline_generator_service] = lambda: service
    try:
        response = client.post(
            "/api/v1/chapters/outlines/generate",
            json={"projectId": 1, "chapterCount": 1},
        )
    finally:
        app.dependency_overrides.pop(get_outline_generator_service, None)

    assert response.status_code == 200


# -- parser -----------------------------------------------------------------


def test_parse_outline_payload_tolerates_fenced_json():
    from app.services.outline_generator import _parse_outline_payload

    raw = "```json\n" + json.dumps({"chapters": _chapters(1)}, ensure_ascii=False) + "\n```"
    assert _parse_outline_payload(raw) == _chapters(1)


def test_parse_outline_payload_tolerates_wrapped_json():
    from app.services.outline_generator import _parse_outline_payload

    raw = json.dumps({"result": {"chapters": _chapters(1)}}, ensure_ascii=False)
    assert _parse_outline_payload(raw) == _chapters(1)


# -- service happy paths -----------------------------------------------------


@pytest.mark.parametrize("chapter_count", [5, 1, 10])
def test_generate_requested_chapter_count(chapter_count):
    service, *_rest = _make_mock_service({"chapters": _chapters(chapter_count)})

    result = service.generate(project_id=1, chapter_count=chapter_count)

    assert result["outlineId"] == 77
    assert len(result["chapters"]) == chapter_count
    assert result["chapters"][0]["title"] == "第1章"
    assert result["chapters"][-1]["summary"] == f"第{chapter_count}章剧情摘要"


def test_generate_respects_configured_max_output_tokens():
    from app.config import get_settings

    service, ai_client, *_rest = _make_mock_service({"chapters": _chapters(50)})

    service.generate(project_id=1, chapter_count=50)

    assert ai_client.messages.create.call_args.kwargs["max_tokens"] == get_settings().max_output_tokens


def test_generate_with_settings_snapshot_merges_context_and_uses_title():
    service, ai_client, _projects, outline_repo, *_rest = _make_mock_service(
        {"chapters": _chapters(2)}
    )
    snapshot = {"title": "第一卷 风起青云", "tone": "热血", "pointOfView": "第三人称"}

    service.generate(project_id=1, chapter_count=2, settings_snapshot=snapshot)

    prompt = ai_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "第一卷 风起青云" in prompt
    assert "热血" in prompt
    assert "第三人称" in prompt
    outline = outline_repo.create.call_args.args[0]
    assert outline.title == "第一卷 风起青云"


def test_generate_without_settings_snapshot_uses_default_title():
    service, _ai, _projects, outline_repo, *_rest = _make_mock_service(
        {"chapters": _chapters(1)}
    )

    service.generate(project_id=1, chapter_count=1, settings_snapshot=None)

    outline = outline_repo.create.call_args.args[0]
    assert outline.title == "新大纲"


def test_generate_collects_all_project_entities_for_context():
    character = SimpleNamespace(id=9, name="林远图", description="青衫剑客", tier="protagonist")
    service, ai_client, _projects, _outlines, _chapters_repo, repos, _created = _make_mock_service(
        {"chapters": _chapters(1)},
        entities_by_type={"character": [character]},
    )

    service.generate(project_id=42, chapter_count=1)

    for repo in repos.values():
        repo.list.assert_called_once_with(project_id=42)
    prompt = ai_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "林远图" in prompt
    assert "青衫剑客" in prompt


def test_generate_empty_project_entities_still_generates():
    service, ai_client, *_rest = _make_mock_service({"chapters": _chapters(1)})

    result = service.generate(project_id=1, chapter_count=1)

    assert len(result["chapters"]) == 1
    ai_client.messages.create.assert_called_once()


def test_generate_preserves_persists_and_prompts_for_rich_chapter_fields():
    service, ai_client, *_prefix, created_chapters = _make_mock_service(
        {"chapters": _rich_chapters(1)}
    )

    result = service.generate(project_id=1, chapter_count=1)

    assert result["chapters"][0] == {
        "id": 101,
        **_rich_chapters(1)[0],
    }
    created = created_chapters[0]
    assert created.sections == ["第1章开端", "第1章转折"]
    assert created.pacing_notes == "张弛有度"
    assert created.character_dynamics == "主角与同伴的信任加深"
    assert created.foreshadowing == "埋下玉佩来历的线索"
    prompt = ai_client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "sections (string[])" in prompt
    assert "pacingNotes (string)" in prompt
    assert "characterDynamics (string)" in prompt
    assert "foreshadowing (string)" in prompt
    assert "不要生成 sections" not in prompt


def test_generate_response_shape_includes_persisted_ids():
    service, *_rest = _make_mock_service({"chapters": _chapters(2)})

    result = service.generate(project_id=1, chapter_count=2)

    assert set(result) == {"outlineId", "chapters"}
    assert set(result["chapters"][0]) == {
        "id",
        "title",
        "summary",
        "sections",
        "pacingNotes",
        "characterDynamics",
        "foreshadowing",
    }
    assert isinstance(result["outlineId"], int)
    assert all(isinstance(chapter["id"], int) for chapter in result["chapters"])


def test_generate_chapter_ordering_is_one_based():
    service, *_prefix, created_chapters = _make_mock_service({"chapters": _chapters(5)})

    service.generate(project_id=1, chapter_count=5)

    assert [chapter.chapter_order for chapter in created_chapters] == [1, 2, 3, 4, 5]


def test_generate_persists_outline_and_chapters_to_db(db_session):
    service, project, _ai = _make_db_service(db_session, {"chapters": _chapters(5)})

    result = service.generate(project_id=project.id, chapter_count=5)

    outline = db_session.query(Outline).filter(Outline.id == result["outlineId"]).one()
    chapters = (
        db_session.query(Chapter)
        .filter(Chapter.outline_id == outline.id)
        .order_by(Chapter.chapter_order)
        .all()
    )
    assert outline.project_id == project.id
    assert len(chapters) == 5
    assert [chapter.chapter_order for chapter in chapters] == [1, 2, 3, 4, 5]
    assert [(chapter.title, chapter.summary) for chapter in chapters] == [
        (item["title"], item["summary"]) for item in _chapters(5)
    ]


# -- service errors ----------------------------------------------------------


@pytest.mark.parametrize("chapter_count", [0, -1, 51])
def test_generate_invalid_chapter_count_raises_400(chapter_count):
    service, *_rest = _make_mock_service({"chapters": _chapters(1)})

    with pytest.raises(ValidationException) as exc:
        service.generate(project_id=1, chapter_count=chapter_count)
    assert exc.value.status_code == 400


def test_generate_project_not_found_raises_404():
    service, *_rest = _make_mock_service(
        {"chapters": _chapters(1)},
        project=SimpleNamespace(id=1),
    )
    service._projects.get.return_value = None

    with pytest.raises(NotFoundException) as exc:
        service.generate(project_id=999, chapter_count=1)
    assert exc.value.status_code == 404


def test_generate_handles_ai_timeout():
    ai_client = MagicMock()
    ai_client.messages.create.side_effect = AIChatTimeout("elapsed 31.0s > 30s")
    service, *_rest = _make_mock_service(
        {"chapters": _chapters(1)}, ai_client=ai_client
    )

    with pytest.raises(AIChatTimeout):
        service.generate(project_id=1, chapter_count=1)


def test_generate_handles_missing_api_key():
    service, *_rest = _make_mock_service(
        {"chapters": _chapters(1)}, ai_client=MagicMock()
    )
    service._ai = None

    with pytest.raises(WriterException) as exc:
        service.generate(project_id=1, chapter_count=1)
    assert exc.value.code == "AI_NOT_CONFIGURED"
    assert exc.value.status_code == 503


def test_generate_handles_bad_ai_json():
    service, *_rest = _make_mock_service("not parseable json")

    with pytest.raises(WriterException) as exc:
        service.generate(project_id=1, chapter_count=1)
    assert exc.value.code == "AI_BAD_RESPONSE"
    assert exc.value.status_code == 502


def test_generate_rejects_wrong_ai_chapter_count():
    service, *_rest = _make_mock_service({"chapters": _chapters(2)})

    with pytest.raises(WriterException) as exc:
        service.generate(project_id=1, chapter_count=5)
    assert exc.value.code == "AI_BAD_RESPONSE"
    assert exc.value.status_code == 502


# -- request schema and HTTP integration ------------------------------------


def test_generate_request_accepts_camel_case_and_bounds():
    from app.schemas.outline_generator import GenerateOutlineRequest

    body = GenerateOutlineRequest.model_validate(
        {"projectId": 1, "chapterCount": 50, "settingsSnapshot": {"title": "卷一"}}
    )
    assert body.project_id == 1
    assert body.chapter_count == 50
    assert body.settings_snapshot == {"title": "卷一"}


@pytest.mark.parametrize("chapter_count", [0, 51])
def test_generate_request_rejects_out_of_bounds_count(chapter_count):
    from app.schemas.outline_generator import GenerateOutlineRequest

    with pytest.raises(PydanticValidationError):
        GenerateOutlineRequest.model_validate(
            {"projectId": 1, "chapterCount": chapter_count}
        )


def test_generate_router_happy_path(client):
    from app.dependencies import get_outline_generator_service

    service, *_rest = _make_mock_service({"chapters": _rich_chapters(5)})
    app.dependency_overrides[get_outline_generator_service] = lambda: service
    try:
        response = client.post(
            "/api/v1/chapters/outlines/generate",
            json={"projectId": 1, "chapterCount": 5},
        )
    finally:
        app.dependency_overrides.pop(get_outline_generator_service, None)

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert isinstance(body["data"]["outlineId"], int)
    assert len(body["data"]["chapters"]) == 5
    assert set(body["data"]["chapters"][0]) == {
        "id",
        "title",
        "summary",
        "sections",
        "pacingNotes",
        "characterDynamics",
        "foreshadowing",
    }
    assert body["data"]["chapters"][0]["sections"]
    assert body["data"]["chapters"][0]["pacingNotes"]
    assert body["data"]["chapters"][0]["characterDynamics"]
    assert body["data"]["chapters"][0]["foreshadowing"]


def test_generate_router_validates_response_schema(client):
    from app.dependencies import get_outline_generator_service

    service = MagicMock()
    service.generate.return_value = {
        "outlineId": "77",
        "chapters": [{"id": "101", "title": "第一章", "summary": "摘要"}],
    }
    app.dependency_overrides[get_outline_generator_service] = lambda: service
    try:
        response = client.post(
            "/api/v1/chapters/outlines/generate",
            json={"projectId": 1, "chapterCount": 1},
        )
    finally:
        app.dependency_overrides.pop(get_outline_generator_service, None)

    assert response.status_code == 200
    assert response.json()["data"]["outlineId"] == 77
    assert response.json()["data"]["chapters"][0]["id"] == 101


def test_generate_router_project_not_found_404(client):
    from app.dependencies import get_outline_generator_service

    service, *_rest = _make_mock_service({"chapters": _chapters(1)})
    service._projects.get.return_value = None
    app.dependency_overrides[get_outline_generator_service] = lambda: service
    try:
        response = client.post(
            "/api/v1/chapters/outlines/generate",
            json={"projectId": 999, "chapterCount": 1},
        )
    finally:
        app.dependency_overrides.pop(get_outline_generator_service, None)

    assert response.status_code == 404
    assert response.json()["success"] is False


def test_generate_router_validation_error_400_or_422(client):
    response = client.post(
        "/api/v1/chapters/outlines/generate",
        json={"projectId": 1, "chapterCount": 0},
    )
    assert response.status_code in (400, 422)


def test_generate_perf_smoke_under_60s(client):
    from app.dependencies import get_outline_generator_service

    service, *_rest = _make_mock_service({"chapters": _chapters(5)})
    app.dependency_overrides[get_outline_generator_service] = lambda: service
    try:
        started = time.monotonic()
        response = client.post(
            "/api/v1/chapters/outlines/generate",
            json={"projectId": 1, "chapterCount": 5},
        )
        elapsed = time.monotonic() - started
    finally:
        app.dependency_overrides.pop(get_outline_generator_service, None)

    assert response.status_code == 200
    assert elapsed < 60.0


@pytest.mark.skipif(
    not os.environ.get("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set; skipping live MiniMax integration test",
)
def test_generate_live_minimax(db_session):
    from anthropic import Anthropic

    from app.config import get_settings
    from app.services.outline_generator import OutlineGeneratorService

    settings = get_settings()
    project_repo = ProjectRepository(db_session)
    project = project_repo.create(Project(name="实时大纲测试", genre="玄幻"))
    service = OutlineGeneratorService(
        ai_client=Anthropic(
            api_key=settings.anthropic_api_key,
            base_url=settings.anthropic_base_url,
        ),
        project_repo=project_repo,
        outline_repo=OutlineRepository(db_session),
        chapter_repo=ChapterRepository(db_session),
        entity_repos=_make_entity_repos(),
    )

    result = service.generate(project_id=project.id, chapter_count=1)

    assert result["outlineId"] > 0
    assert len(result["chapters"]) == 1
    assert result["chapters"][0]["title"]
    assert result["chapters"][0]["summary"]
    assert result["chapters"][0]["sections"]
    assert result["chapters"][0]["pacingNotes"]
    assert result["chapters"][0]["characterDynamics"]
    assert result["chapters"][0]["foreshadowing"]
