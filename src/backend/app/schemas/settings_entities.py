"""Item, Location, Faction, WorldSetting, and Rule schemas."""
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
    project_id: int | None = None


class FactionUpdate(BaseSchema):
    name: str | None = None
    description: str | None = None
    type: str | None = None
    tags: list[str] | None = None


class FactionOut(FactionBase):
    id: int
    project_id: int


class WorldSettingBase(BaseSchema):
    name: str
    description: str | None = None
    category: str | None = None


class WorldSettingCreate(WorldSettingBase):
    project_id: int | None = None


class WorldSettingUpdate(BaseSchema):
    name: str | None = None
    description: str | None = None
    category: str | None = None


class WorldSettingOut(WorldSettingBase):
    id: int
    project_id: int


class RuleBase(BaseSchema):
    name: str
    description: str | None = None
    rule_type: str | None = None


class RuleCreate(RuleBase):
    project_id: int | None = None


class RuleUpdate(BaseSchema):
    name: str | None = None
    description: str | None = None
    rule_type: str | None = None


class RuleOut(RuleBase):
    id: int
    project_id: int
