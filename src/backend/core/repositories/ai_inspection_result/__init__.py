# Auto Novel Writer - AIInspectionResult Repository Package
from backend.core.repositories.ai_inspection_result.interfaces import AIInspectionResultRepositoryInterface
from backend.core.repositories.ai_inspection_result.sqlalchemy_repository import SQLAlchemyAIInspectionResultRepository

__all__ = ["AIInspectionResultRepositoryInterface", "SQLAlchemyAIInspectionResultRepository"]
