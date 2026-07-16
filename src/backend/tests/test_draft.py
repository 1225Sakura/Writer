"""Tests for Draft versioning + TOCTOU-safe create_next_version.

Coverage:
  - 4 CRUD: list, create, get-by-version, get-latest
  - 2 version increment: 2 consecutive creates produce versions 1, 2
  - 1 empty-table edge: first create starts at version_number=1
    (COALESCE(MAX(version_number), 0) + 1 over no rows yields 0+1=1).
"""
from app.models import Chapter
from app.repositories.draft import DraftRepository
from app.services.draft import DraftService


def _make_chapter_via_models(db_session, project_id: int = 1) -> int:
    """Direct ORM insert (no service dependency) for draft-edge tests."""
    ch = Chapter(project_id=project_id, title="T")
    db_session.add(ch)
    db_session.commit()
    db_session.refresh(ch)
    return ch.id


# ---------- 4 CRUD tests ----------


def test_create_first_draft(db_session):
    repo = DraftRepository(db_session)
    svc = DraftService(repo)
    chapter_id = _make_chapter_via_models(db_session)
    d = svc.create_next_version(chapter_id=chapter_id, content="hello world")
    assert d.id is not None
    assert d.chapter_id == chapter_id
    assert d.content == "hello world"


def test_list_drafts(db_session):
    repo = DraftRepository(db_session)
    svc = DraftService(repo)
    chapter_id = _make_chapter_via_models(db_session)
    svc.create_next_version(chapter_id=chapter_id, content="v1")
    svc.create_next_version(chapter_id=chapter_id, content="v2")
    assert len(svc.list(chapter_id=chapter_id)) == 2


def test_get_draft_by_version(db_session):
    repo = DraftRepository(db_session)
    svc = DraftService(repo)
    chapter_id = _make_chapter_via_models(db_session)
    svc.create_next_version(chapter_id=chapter_id, content="v1")
    svc.create_next_version(chapter_id=chapter_id, content="v2")
    fetched = svc.get(chapter_id=chapter_id, version_number=2)
    assert fetched is not None
    assert fetched.content == "v2"
    assert fetched.version_number == 2


def test_get_latest_draft(db_session):
    repo = DraftRepository(db_session)
    svc = DraftService(repo)
    chapter_id = _make_chapter_via_models(db_session)
    svc.create_next_version(chapter_id=chapter_id, content="v1")
    svc.create_next_version(chapter_id=chapter_id, content="v2")
    latest = svc.get_latest(chapter_id=chapter_id)
    assert latest is not None
    assert latest.version_number == 2
    assert latest.content == "v2"


# ---------- 2 version increment tests ----------


def test_two_consecutive_creates_yield_versions_1_and_2(db_session):
    repo = DraftRepository(db_session)
    svc = DraftService(repo)
    chapter_id = _make_chapter_via_models(db_session)
    first = svc.create_next_version(chapter_id=chapter_id, content="first")
    second = svc.create_next_version(chapter_id=chapter_id, content="second")
    assert first.version_number == 1
    assert second.version_number == 2


def test_three_consecutive_creates_yield_versions_1_2_3(db_session):
    """Sanity check that the increment scales beyond two."""
    repo = DraftRepository(db_session)
    svc = DraftService(repo)
    chapter_id = _make_chapter_via_models(db_session)
    versions = [
        svc.create_next_version(chapter_id=chapter_id, content=f"v{i}").version_number
        for i in range(1, 4)
    ]
    assert versions == [1, 2, 3]


# ---------- 1 empty-table edge test ----------


def test_first_create_on_empty_table_starts_at_one(db_session):
    """Empty drafts table → MAX over no rows yields NULL → COALESCE → 0 → +1 → 1."""
    repo = DraftRepository(db_session)
    svc = DraftService(repo)
    chapter_id = _make_chapter_via_models(db_session)
    d = svc.create_next_version(chapter_id=chapter_id, content="")
    assert d.version_number == 1
