# Migration Guide: From database_service to DDD Services

## Overview

`database_service.py` is a legacy functional module that predates the DDD (Domain-Driven Design) architecture. It provides basic CRUD operations but lacks:
- Event publishing for domain changes
- Proper domain entity encapsulation
- Transaction management
- Dependency injection support

## Why Migrate?

| Aspect | database_service | DDD Services |
|--------|------------------|--------------|
| Architecture | Functional/procedural | Object-oriented/DDD |
| Events | None | Event publishing via EventBus |
| Caching | Manual, scattered | Centralized via CacheService |
| Testing | Hard to mock | Dependency injection |
| Entity Access | Dict-based | Strongly typed domain entities |

## Migration Mapping

### Characters

| Old (database_service) | New (DDD) |
|------------------------|-----------|
| `get_character(id)` | `CharacterService.get_character(id)` |
| `get_all_characters()` | `CharacterService.list_characters()` |
| `create_character(data)` | `CharacterService.create_character(data)` |
| `update_character(id, data)` | `CharacterService.update_character(id, data)` |
| `delete_character(id)` | `CharacterService.delete_character(id)` |

### Chapters

| Old (database_service) | New (DDD) |
|------------------------|-----------|
| `get_chapter(id)` | `ChapterService.get_chapter(id)` |
| `get_all_chapters()` | `ChapterService.list_chapters()` |
| `create_chapter(data)` | `ChapterService.create_chapter(data)` |
| `update_chapter(id, data)` | `ChapterService.update_chapter(id, data)` |
| `delete_chapter(id)` | `ChapterService.delete_chapter(id)` |

### Chat Sessions

| Old (database_service) | New (DDD) |
|------------------------|-----------|
| `get_chat_session(id)` | `ChatService.get_session(id)` |
| `get_all_chat_sessions()` | `ChatService.list_sessions()` |
| `create_chat_session(data)` | `ChatService.create_session(data)` |
| `update_chat_session(id, data)` | `ChatService.update_session(id, data)` |
| `delete_chat_session(id)` | `ChatService.delete_session(id)` |

### Messages

| Old (database_service) | New (DDD) |
|------------------------|-----------|
| `get_message(id)` | `ChatService.get_message(id)` |
| `get_all_messages(session_id)` | `ChatService.list_messages(session_id)` |
| `create_message(data)` | `ChatService.create_message(data)` |
| `update_message(id, data)` | `ChatService.update_message(id, data)` |
| `delete_message(id)` | `ChatService.delete_message(id)` |

### Outlines

| Old (database_service) | New (DDD) |
|------------------------|-----------|
| `get_outline(id)` | `OutlineService.get_outline(id)` |
| `get_all_outlines()` | `OutlineService.list_outlines()` |
| `create_outline(data)` | `OutlineService.create_outline(data)` |
| `update_outline(id, data)` | `OutlineService.update_outline(id, data)` |
| `delete_outline(id)` | `OutlineService.delete_outline(id)` |

## Service Locations

```
backend.core.services/
├── character/
│   └── character_service.py    # CharacterService
├── chapter/
│   └── chapter_service.py       # ChapterService
├── chat/
│   └── chat_service.py          # ChatService
├── outline/
│   └── outline_service.py       # OutlineService
└── style/
    └── style_constraint.py      # WritingStyle enforcement
```

## Usage Examples

### Old Way (database_service)

```python
from backend.services import database_service

# Get all characters
characters = await database_service.get_all_characters()

# Create a character
new_id = await database_service.create_character({
    "name": "张三",
    "gender": "男",
    "tier": "main"
})
```

### New Way (DDD Service)

```python
from backend.core.services.character import CharacterService
from utils.event_bus import event_bus

service = CharacterService(db, event_bus)

# Get all characters
characters = await service.list_characters()

# Create a character (events auto-published)
character = await service.create_character({
    "name": "张三",
    "gender": "男",
    "tier": "main"
})
```

## Dependency Injection

DDD services support dependency injection for easier testing:

```python
# In a route handler
@router.post("/characters")
async def create_character(
    db: AsyncSession,
    event_bus: AsyncEventBus,
    data: CharacterCreate
):
    service = CharacterService(db, event_bus)
    return await service.create_character(data.dict())
```

## Deprecation Warning

Importing `database_service` will now emit a `DeprecationWarning`:

```python
from backend.services import database_service  # Warning emitted!
```

The warning message:
> database_service is deprecated. Use CharacterService/ChapterService/ChatService/OutlineService instead.

## Timeline

- **Phase 2**: Add deprecation warnings (current)
- **Phase 3**: Complete repository pattern migration
- **Phase 4**: Remove database_service (target: Q3 2026)

## Getting Help

- See `docs/design/OVERALL-ARCHITECTURE.md` for architecture overview
- See `docs/design/service-layer.md` for service layer design
- Run tests in `tests/` to verify migration