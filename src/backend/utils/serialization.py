# Auto Novel Writer - Serialization Utilities
# DateTime serialization, JSON handling, and pagination wrappers

import json
from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Any, Optional, TypeVar, Generic, List
from uuid import UUID

from pydantic import BaseModel


# ============================================
# Custom JSON Encoder
# ============================================

class CustomJSONEncoder(json.JSONEncoder):
    """Extended JSON encoder supporting common non-serializable types."""

    def default(self, obj: Any) -> Any:
        # datetime with timezone handling
        if isinstance(obj, datetime):
            return serialize_datetime(obj)
        # date
        if isinstance(obj, date):
            return obj.isoformat()
        # Decimal
        if isinstance(obj, Decimal):
            return float(obj)
        # UUID
        if isinstance(obj, UUID):
            return str(obj)
        # bytes
        if isinstance(obj, bytes):
            return obj.decode('utf-8', errors='replace')
        # sets
        if isinstance(obj, set):
            return list(obj)
        # Pydantic models
        if isinstance(obj, BaseModel):
            return obj.model_dump(mode='json')
        # SQLAlchemy objects (fallback)
        if hasattr(obj, '__dict__'):
            return {k: v for k, v in obj.__dict__.items() if not k.startswith('_')}
        return super().default(obj)


def serialize_to_json(
    obj: Any,
    indent: Optional[int] = None,
    ensure_ascii: bool = False,
    **kwargs: Any
) -> str:
    """Serialize any object to JSON string with custom type support.

    Args:
        obj: Object to serialize
        indent: Indentation level for pretty printing
        ensure_ascii: Whether to escape non-ASCII characters
        **kwargs: Additional arguments passed to json.dumps

    Returns:
        JSON string representation
    """
    return json.dumps(
        obj,
        cls=CustomJSONEncoder,
        indent=indent,
        ensure_ascii=ensure_ascii,
        **kwargs
    )


def deserialize_json(json_str: str, **kwargs: Any) -> Any:
    """Deserialize JSON string to Python object.

    Args:
        json_str: JSON string to parse
        **kwargs: Additional arguments passed to json.loads

    Returns:
        Parsed Python object
    """
    return json.loads(json_str, **kwargs)


# ============================================
# DateTime Serialization
# ============================================

DEFAULT_TIMEZONE = timezone.utc
ISO_FORMAT = "%Y-%m-%dT%H:%M:%S"
ISO_FORMAT_MS = "%Y-%m-%dT%H:%M:%S.%f"
ISO_FORMAT_WITH_TZ = "%Y-%m-%dT%H:%M:%S%z"


def serialize_datetime(
    dt: Optional[datetime],
    format_str: Optional[str] = None,
    include_timezone: bool = True
) -> Optional[str]:
    """Serialize datetime to ISO format string with timezone handling.

    Args:
        dt: Datetime to serialize, or None
        format_str: Optional custom format string (defaults to ISO 8601)
        include_timezone: Whether to include timezone info in output

    Returns:
        ISO format datetime string, or None if input was None
    """
    if dt is None:
        return None

    # Ensure timezone awareness
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=DEFAULT_TIMEZONE)

    if format_str:
        return dt.strftime(format_str)

    # Use ISO format
    if include_timezone:
        return dt.isoformat()
    return dt.replace(tzinfo=None).isoformat()


def deserialize_datetime(
    dt_str: Optional[str],
    default_tz: timezone = DEFAULT_TIMEZONE
) -> Optional[datetime]:
    """Deserialize ISO format string to datetime with timezone.

    Args:
        dt_str: ISO format datetime string, or None
        default_tz: Timezone to use if string has no timezone info

    Returns:
        Timezone-aware datetime, or None if input was None
    """
    if dt_str is None:
        return None

    # Try ISO format parsing
    try:
        # Python 3.11+ supports fromisoformat with Z suffix
        dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
    except ValueError:
        # Fallback: try common formats
        for fmt in [ISO_FORMAT_MS, ISO_FORMAT, ISO_FORMAT_WITH_TZ]:
            try:
                dt = datetime.strptime(dt_str, fmt)
                break
            except ValueError:
                continue
        else:
            raise ValueError(f"Unable to parse datetime: {dt_str}")

    # Ensure timezone awareness
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=default_tz)

    return dt


def serialize_date(d: Optional[date]) -> Optional[str]:
    """Serialize date to ISO format string.

    Args:
        d: Date to serialize, or None

    Returns:
        ISO format date string, or None if input was None
    """
    if d is None:
        return None
    return d.isoformat()


def deserialize_date(date_str: Optional[str]) -> Optional[date]:
    """Deserialize ISO format string to date.

    Args:
        date_str: ISO format date string, or None

    Returns:
        Date object, or None if input was None
    """
    if date_str is None:
        return None
    return date.fromisoformat(date_str)


# ============================================
# Pagination Response Wrapper
# ============================================

T = TypeVar('T')


class PaginationWrapper(Generic[T]):
    """Wrapper for paginated query results."""

    def __init__(
        self,
        items: List[T],
        total: int,
        skip: int = 0,
        limit: int = 50
    ):
        self.items = items
        self.total = total
        self.skip = skip
        self.limit = limit

    @property
    def has_more(self) -> bool:
        """Check if there are more items beyond current page."""
        return (self.skip + len(self.items)) < self.total

    @property
    def page(self) -> int:
        """Calculate current page number (1-based)."""
        if self.limit <= 0:
            return 1
        return (self.skip // self.limit) + 1

    @property
    def total_pages(self) -> int:
        """Calculate total number of pages."""
        if self.limit <= 0:
            return 1
        return (self.total + self.limit - 1) // self.limit

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "items": self.items,
            "total": self.total,
            "skip": self.skip,
            "limit": self.limit,
            "has_more": self.has_more,
            "page": self.page,
            "total_pages": self.total_pages,
        }

    def to_json(self, **kwargs: Any) -> str:
        """Serialize to JSON string."""
        return serialize_to_json(self.to_dict(), **kwargs)


def create_pagination_wrapper(
    items: List[T],
    total: int,
    skip: int = 0,
    limit: int = 50
) -> PaginationWrapper[T]:
    """Create a pagination wrapper from query results.

    Args:
        items: List of items for current page
        total: Total count of all items
        skip: Number of items skipped
        limit: Maximum items per page

    Returns:
        PaginationWrapper instance
    """
    return PaginationWrapper(items=items, total=total, skip=skip, limit=limit)


# ============================================
# SQLAlchemy Model Serialization
# ============================================

def serialize_sqlalchemy_object(
    obj: Any,
    exclude: Optional[set] = None,
    include: Optional[set] = None
) -> dict:
    """Serialize a SQLAlchemy model instance to dictionary.

    Args:
        obj: SQLAlchemy model instance
        exclude: Set of attribute names to exclude
        include: Set of attribute names to include (if None, include all)

    Returns:
        Dictionary representation of the model
    """
    if obj is None:
        return {}

    exclude = exclude or set()
    data = {}

    # Get all column attributes
    if hasattr(obj, '__table__'):
        columns = {c.name for c in obj.__table__.columns}
    else:
        columns = set(obj.__dict__.keys())

    for key in columns:
        if key.startswith('_'):
            continue
        if key in exclude:
            continue
        if include is not None and key not in include:
            continue

        value = getattr(obj, key, None)
        # Handle datetime fields
        if isinstance(value, datetime):
            value = serialize_datetime(value)
        data[key] = value

    return data


def serialize_sqlalchemy_list(
    objects: List[Any],
    exclude: Optional[set] = None
) -> List[dict]:
    """Serialize a list of SQLAlchemy objects to dictionaries.

    Args:
        objects: List of SQLAlchemy model instances
        exclude: Set of attribute names to exclude

    Returns:
        List of dictionary representations
    """
    return [serialize_sqlalchemy_object(obj, exclude=exclude) for obj in objects]


# ============================================
# Safe Serialization Helpers
# ============================================

def safe_json_loads(json_str: Optional[str], default: Any = None) -> Any:
    """Safely parse JSON string with fallback default.

    Args:
        json_str: JSON string to parse
        default: Default value to return on parse error

    Returns:
        Parsed object, or default on error
    """
    if json_str is None:
        return default
    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return default


def safe_json_dumps(
    obj: Any,
    default: str = '{}',
    **kwargs: Any
) -> str:
    """Safely serialize object to JSON string with fallback.

    Args:
        obj: Object to serialize
        default: Default string to return on error
        **kwargs: Additional arguments for json.dumps

    Returns:
        JSON string, or default on error
    """
    try:
        return serialize_to_json(obj, **kwargs)
    except (TypeError, ValueError):
        return default
