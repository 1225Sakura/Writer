# Auto Novel Writer - Rule Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of RuleRepositoryInterface

from typing import List, Optional
from sqlalchemy import select

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.rule.interfaces import RuleRepositoryInterface
from backend.core.domain.entities import Rule


class SQLAlchemyRuleRepository(SQLAlchemyBaseRepository[Rule], RuleRepositoryInterface):
    """SQLAlchemy implementation of Rule repository."""

    def __init__(self, db):
        super().__init__(db, Rule)

    async def get_by_type(self, rule_type: str, project_id: Optional[int] = None) -> List[Rule]:
        stmt = select(Rule).where(Rule.type == rule_type)
        if project_id is not None:
            stmt = stmt.where(Rule.project_id == project_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_active_rules(self, project_id: Optional[int] = None) -> List[Rule]:
        stmt = select(Rule).where(Rule.type.isnot(None))
        if project_id is not None:
            stmt = stmt.where(Rule.project_id == project_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
