"""Integration coverage for user-scoped ORM filtering."""
from app.models import Project


def test_filter_by_user_id_isolates_rows(db_session):
    db_session.add_all(
        [
            Project(name="User one project", user_id="u-1"),
            Project(name="User two project", user_id="u-2"),
        ]
    )
    db_session.commit()

    projects = db_session.query(Project).filter_by(user_id="u-1").all()

    assert [project.name for project in projects] == ["User one project"]
    assert all(project.user_id == "u-1" for project in projects)
