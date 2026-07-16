"""RuleService: business logic for rule CRUD."""
from app.models import Rule
from app.repositories.rule import RuleRepository
from app.schemas.settings_entities import RuleCreate, RuleUpdate


class RuleService:
    def __init__(self, repo: RuleRepository):
        self._repo = repo

    def create(self, data: RuleCreate, *, project_id: int | None = None) -> Rule:
        project_id = project_id if project_id is not None else 1
        payload = data.model_dump(exclude_unset=True, exclude={"project_id"})
        return self._repo.create(Rule(project_id=project_id, **payload))

    def list(
        self, project_id: int | None = None, skip: int = 0, limit: int = 100
    ) -> list[Rule]:
        return self._repo.list(project_id=project_id, skip=skip, limit=limit)

    def get(self, id: int) -> Rule | None:
        return self._repo.get(id)

    def update(self, id: int, data: RuleUpdate) -> Rule | None:
        rule = self._repo.get(id)
        if not rule:
            return None
        return self._repo.update(rule, data.model_dump(exclude_unset=True))

    def delete(self, id: int) -> bool:
        return self._repo.delete(id)
