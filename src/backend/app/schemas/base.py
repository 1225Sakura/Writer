from __future__ import annotations

"""Pydantic v2 base schemas matching frontend types exactly.

2026 Decision: Separate Create/Update/Response schemas (FastAPI security best practice).
Never return ORM models directly from endpoints.
"""

from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel as PydanticBaseModel, ConfigDict, field_validator

T = TypeVar("T")


class BaseSchema(PydanticBaseModel):
    model_config = ConfigDict(from_attributes=True)


class TimestampSchema(BaseSchema):
    """Mixin for created_at / updated_at fields — auto-converts datetime → ISO string."""
    created_at: str
    updated_at: str

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def _datetime_to_str(cls, v):
        if isinstance(v, datetime):
            return v.isoformat()
        return v


class ApiResponse(BaseSchema, Generic[T]):
    success: bool = True
    data: T | None = None
    message: str | None = None


class PaginatedResponse(BaseSchema, Generic[T]):
    success: bool = True
    data: list[T] = []
    pagination: dict = {}


class ErrorResponse(BaseSchema):
    success: bool = False
    error: dict
