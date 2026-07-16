"""ChatService: business logic for ChatSession/ChatMessage + AI extraction +
chat → 6 entity migration (US-007)."""
from __future__ import annotations

from datetime import datetime, timezone

from app.core.exceptions import NotFoundException, ValidationException
from app.models import ChatSession, ChatMessage, Project
from app.repositories.chat import ChatSessionRepository, ChatMessageRepository
from app.repositories.project import ProjectRepository
from app.schemas.chat import ExtractedEntity
from app.schemas.character import CharacterCreate
from app.schemas.settings_entities import (
    FactionCreate,
    ItemCreate,
    LocationCreate,
    RuleCreate,
    WorldSettingCreate,
)
from app.services.ai_chat import extract_entities as ai_extract_entities
from app.services.character import CharacterService
from app.services.faction import FactionService
from app.services.item import ItemService
from app.services.location import LocationService
from app.services.rule import RuleService
from app.services.world_setting import WorldSettingService


class ChatService:
    def __init__(
        self,
        session_repo: ChatSessionRepository,
        message_repo: ChatMessageRepository,
        project_repo: ProjectRepository,
        character_service: CharacterService | None = None,
        item_service: ItemService | None = None,
        location_service: LocationService | None = None,
        faction_service: FactionService | None = None,
        world_setting_service: WorldSettingService | None = None,
        rule_service: RuleService | None = None,
        user_id: str = "default-user",
    ):
        self._sessions = session_repo
        self._messages = message_repo
        self._projects = project_repo
        self._character_svc = character_service
        self._item_svc = item_service
        self._location_svc = location_service
        self._faction_svc = faction_service
        self._world_setting_svc = world_setting_service
        self._rule_svc = rule_service
        self._user_id = user_id

    def _service_for_type(self, entity_type: str):
        """Return the matching settings-entity service for an AI type label."""
        mapping = {
            "world": (self._world_setting_svc, WorldSettingCreate),
            "character": (self._character_svc, CharacterCreate),
            "item": (self._item_svc, ItemCreate),
            "location": (self._location_svc, LocationCreate),
            "faction": (self._faction_svc, FactionCreate),
            "rule": (self._rule_svc, RuleCreate),
        }
        if entity_type not in mapping:
            raise ValidationException(f"unsupported entity type: {entity_type}")
        svc, schema_cls = mapping[entity_type]
        if svc is None:
            raise ValidationException(
                f"service for type '{entity_type}' is not configured"
            )
        return svc, schema_cls

    def create_session(self, project_id: int) -> ChatSession:
        project = self._projects.get(project_id)
        if not project:
            raise NotFoundException("Project", project_id)
        session = ChatSession(project_id=project_id, user_id=self._user_id)
        return self._sessions.create(session)

    def send_message(self, session_id: int, role: str, content: str) -> ChatMessage:
        if not content.strip():
            raise ValidationException("content must be non-empty")
        session = self._sessions.get(session_id)
        if not session:
            raise NotFoundException("ChatSession", session_id)
        if role not in {"user", "assistant", "system"}:
            raise ValidationException(f"invalid role: {role}")
        message = ChatMessage(session_id=session_id, role=role, content=content)
        session.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        self._sessions._db.add(session)
        self._sessions._db.commit()
        return self._messages.create(message)

    def list_sessions(self, user_id: str | None = None) -> list[dict]:
        target_user = user_id or self._user_id
        sessions = self._sessions.list_for_user(target_user)
        out: list[dict] = []
        for sess in sessions:
            message_count = self._messages.count_for_session(sess.id)
            last_at = self._messages.last_message_at_for_session(sess.id)
            out.append(
                {
                    "id": sess.id,
                    "project_id": sess.project_id,
                    "created_at": sess.created_at.isoformat()
                    if sess.created_at
                    else None,
                    "last_message_at": last_at.isoformat() if last_at else None,
                    "message_count": message_count,
                }
            )
        return out

    def extract_entities(self, content: str) -> list[ExtractedEntity]:
        if not content.strip():
            raise ValidationException("content must be non-empty for entity extraction")
        raw = ai_extract_entities(content)
        return [
            ExtractedEntity(
                type=str(item.get("type", "world")),
                name=str(item.get("name", "")),
                attrs=dict(item.get("attrs") or {}),
            )
            for item in raw
            if item.get("name")
        ]

    # US-007 ----------------------------------------------------------------

    def _build_payload(self, schema_cls, project_id: int, attrs: dict) -> dict:
        """Map AI attrs → Create-schema payload (with project_id)."""
        attrs = attrs or {}
        if schema_cls is WorldSettingCreate:
            payload = {
                "project_id": project_id,
                "name": attrs.get("name", ""),
                "description": attrs.get("description"),
                "category": attrs.get("category", "geography"),
            }
        elif schema_cls is CharacterCreate:
            payload = {
                "project_id": project_id,
                "name": attrs.get("name", ""),
                "gender": attrs.get("gender"),
                "personality": attrs.get("personality"),
                "desires": attrs.get("desires"),
                "flaws": attrs.get("flaws"),
                "description": attrs.get("description"),
                "tier": attrs.get("tier", "supporting"),
                "cultivation_realm": attrs.get("cultivation_realm"),
            }
        elif schema_cls is ItemCreate:
            payload = {
                "project_id": project_id,
                "name": attrs.get("name", ""),
                "description": attrs.get("description"),
                "owner": attrs.get("owner"),
                "location": attrs.get("location"),
                "tags": attrs.get("tags"),
            }
        elif schema_cls is LocationCreate:
            payload = {
                "project_id": project_id,
                "name": attrs.get("name", ""),
                "description": attrs.get("description"),
                "importance": attrs.get("importance", "normal"),
                "tags": attrs.get("tags"),
            }
        elif schema_cls is FactionCreate:
            payload = {
                "project_id": project_id,
                "name": attrs.get("name", ""),
                "description": attrs.get("description"),
                "type": attrs.get("type") or attrs.get("faction_type", "sect"),
                "tags": attrs.get("tags"),
            }
        elif schema_cls is RuleCreate:
            payload = {
                "project_id": project_id,
                "name": attrs.get("name", ""),
                "description": attrs.get("description"),
                "rule_type": attrs.get("rule_type", "magic"),
            }
        else:
            payload = {"project_id": project_id, "name": attrs.get("name", "")}
        return {k: v for k, v in payload.items() if v is not None}

    def _existing_names_by_type(self, project_id: int) -> dict[str, set[str]]:
        """Return existing entity names per type for idempotency check."""
        existing: dict[str, set[str]] = {}
        pairs = [
            ("character", self._character_svc),
            ("item", self._item_svc),
            ("location", self._location_svc),
            ("faction", self._faction_svc),
            ("world", self._world_setting_svc),
            ("rule", self._rule_svc),
        ]
        for type_name, svc in pairs:
            if svc is None:
                existing[type_name] = set()
                continue
            try:
                rows = svc.list(project_id=project_id)
            except Exception:
                existing[type_name] = set()
                continue
            existing[type_name] = {
                getattr(row, "name", "") for row in rows if getattr(row, "name", None)
            }
        return existing

    def migrate_to_settings(
        self,
        session_id: int,
        project_id: int,
        target_categories: list[str],
    ) -> dict:
        """Extract entities from session messages and persist as settings entities.

        Returns:
          {
            "created": [{"type": str, "id": int, "name": str}, ...],
            "skipped": [{"type": str, "name": str, "reason": str}, ...],
            "partial": bool,
            "errors": [{"type": str, "name": str, "error": str}, ...],
          }
        """
        if not session_id or not project_id:
            raise ValidationException("session_id and project_id are required")
        if not target_categories:
            raise ValidationException("target_categories must not be empty")

        session = self._sessions.get(session_id)
        if not session:
            raise NotFoundException("ChatSession", session_id)

        project = self._projects.get(project_id)
        if not project:
            raise NotFoundException("Project", project_id)

        messages = self._messages.list_for_session(session_id)
        user_text = "\n".join(
            m.content for m in messages if m.role == "user" and m.content.strip()
        )
        if not user_text.strip():
            return {
                "created": [],
                "skipped": [],
                "partial": False,
                "errors": [],
            }

        raw_entities = self.extract_entities(user_text)
        allowed = set(target_categories)
        candidates = [e for e in raw_entities if e.type in allowed and e.name]

        existing_names = self._existing_names_by_type(project_id)

        created: list[dict] = []
        skipped: list[dict] = []
        errors: list[dict] = []

        for entity in candidates:
            entity_type = entity.type
            entity_name = entity.name
            attrs = dict(entity.attrs or {})
            attrs.setdefault("name", entity_name)
            if entity_name in existing_names.get(entity_type, set()):
                skipped.append(
                    {
                        "type": entity_type,
                        "name": entity_name,
                        "reason": "already_exists",
                    }
                )
                continue
            try:
                svc, schema_cls = self._service_for_type(entity_type)
                payload = self._build_payload(schema_cls, project_id, attrs)
                create_obj = schema_cls(**payload)
                # CharacterService.create expects project_id in the schema
                # body; the other 5 services accept project_id as kwarg.
                if entity_type == "character":
                    new_entity = svc.create(create_obj)
                else:
                    new_entity = svc.create(create_obj, project_id=project_id)
                created.append(
                    {
                        "type": entity_type,
                        "id": getattr(new_entity, "id", None),
                        "name": getattr(new_entity, "name", entity_name),
                    }
                )
                existing_names.setdefault(entity_type, set()).add(entity_name)
            except Exception as exc:  # noqa: BLE001 - capture & continue
                errors.append(
                    {
                        "type": entity_type,
                        "name": entity_name,
                        "error": str(exc) or exc.__class__.__name__,
                    }
                )

        return {
            "created": created,
            "skipped": skipped,
            "partial": bool(errors),
            "errors": errors,
        }