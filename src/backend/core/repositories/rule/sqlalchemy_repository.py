# Auto Novel Writer - Rule Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of RuleRepositoryInterface

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.rule.interfaces import RuleRepositoryInterface
from backend.core.domain.entities import Rule


class SQLAlchemyRuleRepository(SQLAlchemyBaseRepository[Rule], RuleRepositoryInterface):
    """SQLAlchemy implementation of Rule repository."""

    def __init__(self, db):
        super().__init__(db, Rule)
