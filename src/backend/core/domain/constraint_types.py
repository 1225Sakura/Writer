"""Constraint domain types.

Pure data types (enums and dataclasses) for the constraint subsystem.
Lives in core/domain/ so both core/services/ and services/ can import
without layering violations.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional


class Severity(str, Enum):
    """Violation severity levels."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class LawType(str, Enum):
    """The three anti-hallucination laws."""

    OUTLINE_LAW = "outline_law"          # 大纲即法律
    SETTING_PHYSICS = "setting_physics"  # 设定即物理
    INVENTION_REGISTRATION = "invention_registration"  # 发明需识别


class RuleStatus(str, Enum):
    """Constraint rule status."""

    ACTIVE = "active"
    DISABLED = "disabled"
    DEPRECATED = "deprecated"


@dataclass
class ConstraintRule:
    """A single constraint rule definition."""

    id: str
    law_type: LawType
    name: str
    description: str
    pattern: Optional[str] = None
    severity: Severity = Severity.HIGH
    status: RuleStatus = RuleStatus.ACTIVE
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "law_type": self.law_type.value,
            "name": self.name,
            "description": self.description,
            "pattern": self.pattern,
            "severity": self.severity.value,
            "status": self.status.value,
            "metadata": self.metadata,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ConstraintRule:
        return cls(
            id=data["id"],
            law_type=LawType(data.get("law_type", "outline_law")),
            name=data["name"],
            description=data.get("description", ""),
            pattern=data.get("pattern"),
            severity=Severity(data.get("severity", "high")),
            status=RuleStatus(data.get("status", "active")),
            metadata=data.get("metadata", {}),
            created_at=data.get("created_at", datetime.now(timezone.utc).isoformat()),
        )


@dataclass
class ConstraintViolation:
    """A detected constraint violation."""

    rule_id: str
    law_type: LawType
    severity: Severity
    message: str
    evidence: str = ""
    location: Optional[str] = None
    suggestion: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ConstraintCheckResult:
    """Result of a constraint check."""

    violations: list[ConstraintViolation] = field(default_factory=list)
    checked_rules: int = 0
    passed_rules: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)
