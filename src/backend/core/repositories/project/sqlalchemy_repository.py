# Auto Novel Writer - Project Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of ProjectRepositoryInterface

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.project.interfaces import ProjectRepositoryInterface
from backend.core.domain.entities import Project


class SQLAlchemyProjectRepository(SQLAlchemyBaseRepository[Project], ProjectRepositoryInterface):
    """SQLAlchemy implementation of Project repository."""

    def __init__(self, db):
        super().__init__(db, Project)
