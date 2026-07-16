"""FastAPI dependency providers for routers.
Each module exposes get_<x>_repository / get_<x>_service.
Concrete providers added in US-002 through US-013."""
from fastapi import Depends
from app.database import get_db
from app.repositories.project import ProjectRepository
from app.services.project import ProjectService
from app.repositories.character import CharacterRepository
from app.services.character import CharacterService
from app.repositories.item import ItemRepository
from app.services.item import ItemService
from app.repositories.location import LocationRepository
from app.services.location import LocationService
from app.repositories.outline import OutlineRepository
from app.services.outline import OutlineService
from app.repositories.chapter import ChapterRepository
from app.services.chapter import ChapterService
from app.repositories.draft import DraftRepository
from app.services.draft import DraftService
from app.repositories.ai_provider import AIProviderRepository
from app.services.ai_provider import AIProviderService

__all__ = [
    "get_db",
    "get_project_repository", "get_project_service",
    "get_character_repository", "get_character_service",
    "get_item_repository", "get_item_service",
    "get_location_repository", "get_location_service",
    "get_outline_repository", "get_outline_service",
    "get_chapter_repository", "get_chapter_service",
    "get_draft_repository", "get_draft_service",
    "get_ai_provider_repository", "get_ai_provider_service",
]


def get_project_repository(db=Depends(get_db)):
    return ProjectRepository(db)


def get_project_service(repo=Depends(get_project_repository)):
    return ProjectService(repo)


def get_character_repository(db=Depends(get_db)):
    return CharacterRepository(db)


def get_character_service(repo=Depends(get_character_repository)):
    return CharacterService(repo)


def get_item_repository(db=Depends(get_db)):
    return ItemRepository(db)


def get_item_service(repo=Depends(get_item_repository)):
    return ItemService(repo)


def get_location_repository(db=Depends(get_db)):
    return LocationRepository(db)


def get_location_service(repo=Depends(get_location_repository)):
    return LocationService(repo)


def get_outline_repository(db=Depends(get_db)):
    return OutlineRepository(db)


def get_outline_service(repo=Depends(get_outline_repository)):
    return OutlineService(repo)


def get_chapter_repository(db=Depends(get_db)):
    return ChapterRepository(db)


def get_chapter_service(repo=Depends(get_chapter_repository)):
    return ChapterService(repo)


def get_draft_repository(db=Depends(get_db)):
    return DraftRepository(db)


def get_draft_service(repo=Depends(get_draft_repository)):
    return DraftService(repo)


def get_ai_provider_repository(db=Depends(get_db)):
    return AIProviderRepository(db)


def get_ai_provider_service(repo=Depends(get_ai_provider_repository)):
    return AIProviderService(repo)
