"""EntityRegistry — shared entity name-to-ID mapping, singleton per project.

Provides O(1) lookup of entities (Character, Item, Location, Faction) by
canonical name or alias. Aliases are extracted from the `description` field
using the same ``<!--aliases:[...]-->`` convention as entity_linker.py.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.domain.entities import Character, Item, Location, Faction

_ALIAS_RE = re.compile(r"<!--aliases:(.*?)-->")


@dataclass
class EntityRecord:
    """A single entity entry in the registry."""

    canonical_id: int  # Primary key in the source table
    entity_type: str  # "character" | "item" | "location" | "faction"
    canonical_name: str
    aliases: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class EntityRegistry:
    """Shared entity name-to-ID mapping, singleton per project."""

    def __init__(self) -> None:
        self._cache: Dict[str, List[EntityRecord]] = {}  # lowercase name -> records
        self._loaded: bool = False

    # ------------------------------------------------------------------
    # Loading
    # ------------------------------------------------------------------

    async def load_from_db(self, db_session: AsyncSession) -> int:
        """Load all entities from Character, Item, Location, Faction tables.

        Returns the count of loaded entities.
        """
        self.invalidate_cache()

        entity_specs = [
            (Character, "character"),
            (Item, "item"),
            (Location, "location"),
            (Faction, "faction"),
        ]

        total = 0
        for model, etype in entity_specs:
            result = await db_session.execute(select(model))
            rows = result.scalars().all()
            for row in rows:
                aliases = _extract_aliases(row.description or "")
                record = EntityRecord(
                    canonical_id=row.id,
                    entity_type=etype,
                    canonical_name=row.name,
                    aliases=aliases,
                )
                self.register(record)
                total += 1

        self._loaded = True
        return total

    # ------------------------------------------------------------------
    # Resolution
    # ------------------------------------------------------------------

    def resolve(
        self, name: str, entity_type: Optional[str] = None
    ) -> Optional[EntityRecord]:
        """O(1) lookup by name or alias.

        Returns the first match, optionally filtered by type.
        """
        key = name.lower().strip()
        records = self._cache.get(key, [])
        if entity_type:
            records = [r for r in records if r.entity_type == entity_type]
        return records[0] if records else None

    def resolve_all(self, name: str) -> List[EntityRecord]:
        """Return all matches for a name (may span multiple entity types)."""
        return list(self._cache.get(name.lower().strip(), []))

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(self, record: EntityRecord) -> None:
        """Register an entity record. Indexes by name and all aliases."""
        key = record.canonical_name.lower().strip()
        self._cache.setdefault(key, []).append(record)

        for alias in record.aliases:
            alias_key = alias.lower().strip()
            if alias_key:  # skip empty strings
                self._cache.setdefault(alias_key, []).append(record)

    def bulk_register(self, records: List[EntityRecord]) -> int:
        """Register multiple entities. Returns count."""
        for r in records:
            self.register(r)
        return len(records)

    # ------------------------------------------------------------------
    # Cache management
    # ------------------------------------------------------------------

    def invalidate_cache(self) -> None:
        """Clear the in-memory cache."""
        self._cache.clear()
        self._loaded = False

    def get_stats(self) -> Dict[str, int]:
        """Return cache statistics."""
        unique_records: set = set()
        for records in self._cache.values():
            for r in records:
                unique_records.add((r.entity_type, r.canonical_id))
        return {
            "total_keys": len(self._cache),
            "unique_entities": len(unique_records),
        }


# ------------------------------------------------------------------
# Internal helpers
# ------------------------------------------------------------------


def _extract_aliases(description: str) -> List[str]:
    """Extract aliases from a description field using the
    ``<!--aliases:["a","b"]-->`` convention (same as entity_linker.py).
    """
    if not description:
        return []
    match = _ALIAS_RE.search(description)
    if match:
        try:
            return json.loads(match.group(1))
        except (json.JSONDecodeError, TypeError):
            return []
    return []
