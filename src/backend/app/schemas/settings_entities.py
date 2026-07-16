"""Item, Location, Faction schemas."""
from __future__ import annotations

from app.schemas.base import BaseSchema


class ItemBase(BaseSchema):
    name: str
    description: str | None = None
    owner: str | None = None
    location: str | None = None
    tags: list[str] | None = None


class ItemCreate(ItemBase):
    project_id: int | None = None


class ItemUpdate(BaseSchema):
    name: str | None = None
    description: str | None = None
    owner: str | None = None
    location: str | None = None
    tags: list[str] | None = None


class ItemOut(ItemBase):
    id: int
    project_id: int


class LocationBase(BaseSchema):
    name: str
    description: str | None = None
    importance: str = "normal"
    tags: list[str] | None = None


class LocationCreate(LocationBase):
    project_id: int | None = None


class LocationUpdate(BaseSchema):
    name: str | None = None
    description: str | None = None
    importance: str | None = None
    tags: list[str] | None = None


class LocationOut(LocationBase):
    id: int
    project_id: int


class FactionBase(BaseSchema):
    name: str
    description: str | None = None
    type: str | None = None
    tags: list[str] | None = None


class FactionCreate(FactionBase):
    pass


class FactionUpdate(BaseSchema):
    name: str | None = None
    description: str | None = None
    type: str | None = None
    tags: list[str] | None = None


class FactionOut(FactionBase):
    id: int
    project_id: int
