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
from app.repositories.faction import FactionRepository
from app.services.faction import FactionService
from app.repositories.world_setting import WorldSettingRepository
from app.services.world_setting import WorldSettingService
from app.repositories.rule import RuleRepository
from app.services.rule import RuleService
from app.repositories.outline import OutlineRepository
from app.services.outline import OutlineService
from app.services.outline_fork import OutlineForkService
from app.config import get_settings
from app.repositories.chapter import ChapterRepository
from app.services.chapter import ChapterService
from app.repositories.draft import DraftRepository
from app.services.draft import DraftService
from app.repositories.ai_provider import AIProviderRepository
from app.services.ai_provider import AIProviderService
from app.services.ai_generate_entity import EntityGeneratorService
from app.services.ai_review_consistency import ConsistencyReviewService
from app.services.ai_fill_fields import FieldFillerService
from app.services.ai_rewrite_description import DescriptionRewriterService
from app.services.outline_generator import OutlineGeneratorService
from app.repositories.chat import ChatSessionRepository, ChatMessageRepository
from app.services.chat import ChatService

__all__ = [
    "get_db",
    "get_project_repository", "get_project_service",
    "get_character_repository", "get_character_service",
    "get_item_repository", "get_item_service",
    "get_location_repository", "get_location_service",
    "get_faction_repository", "get_faction_service",
    "get_world_setting_repository", "get_world_setting_service",
    "get_rule_repository", "get_rule_service",
    "get_outline_repository", "get_outline_service",
    "get_outline_fork_service",
    "get_chapter_repository", "get_chapter_service",
    "get_draft_repository", "get_draft_service",
    "get_ai_provider_repository", "get_ai_provider_service",
    "get_entity_generator_service",
    "get_consistency_review_service",
    "get_field_filler_service",
    "get_description_rewriter_service",
    "get_outline_generator_service",
    "get_chat_service",
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


def get_faction_repository(db=Depends(get_db)):
    return FactionRepository(db)


def get_faction_service(repo=Depends(get_faction_repository)):
    return FactionService(repo)


def get_world_setting_repository(db=Depends(get_db)):
    return WorldSettingRepository(db)


def get_world_setting_service(repo=Depends(get_world_setting_repository)):
    return WorldSettingService(repo)


def get_rule_repository(db=Depends(get_db)):
    return RuleRepository(db)


def get_rule_service(repo=Depends(get_rule_repository)):
    return RuleService(repo)


def get_outline_repository(db=Depends(get_db)):
    return OutlineRepository(db)


def get_outline_service(repo=Depends(get_outline_repository)):
    return OutlineService(repo)


def get_chapter_repository(db=Depends(get_db)):
    return ChapterRepository(db)


def get_chapter_service(repo=Depends(get_chapter_repository)):
    return ChapterService(repo)


def get_outline_fork_service(
    outline_repo: OutlineRepository = Depends(get_outline_repository),
    chapter_repo: ChapterRepository = Depends(get_chapter_repository),
    db=Depends(get_db),
):
    return OutlineForkService(outline_repo, chapter_repo, db)


def get_draft_repository(db=Depends(get_db)):
    return DraftRepository(db)


def get_draft_service(repo=Depends(get_draft_repository)):
    return DraftService(repo)


def get_ai_provider_repository(db=Depends(get_db)):
    return AIProviderRepository(db)


def get_ai_provider_service(repo=Depends(get_ai_provider_repository)):
    return AIProviderService(repo)


def get_entity_generator_service() -> EntityGeneratorService:
    """EntityGeneratorService is stateless (uses global MiniMax config)."""
    return EntityGeneratorService()


def get_consistency_review_service(
    character_repo: CharacterRepository = Depends(get_character_repository),
    item_repo: ItemRepository = Depends(get_item_repository),
    location_repo: LocationRepository = Depends(get_location_repository),
    faction_repo: FactionRepository = Depends(get_faction_repository),
    world_setting_repo: WorldSettingRepository = Depends(get_world_setting_repository),
    rule_repo: RuleRepository = Depends(get_rule_repository),
) -> ConsistencyReviewService:
    """ConsistencyReviewService needs an Anthropic client + 6 entity repos."""
    from anthropic import Anthropic

    settings = get_settings()
    ai_client: object | None = None
    if settings.anthropic_api_key:
        ai_client = Anthropic(
            api_key=settings.anthropic_api_key,
            base_url=settings.anthropic_base_url,
        )
    entity_repos = {
        "character": character_repo,
        "item": item_repo,
        "location": location_repo,
        "faction": faction_repo,
        "world_setting": world_setting_repo,
        "rule": rule_repo,
    }
    return ConsistencyReviewService(ai_client, entity_repos)


# -- chat (US-007: 6 entity services injected for migrate-to-settings) -----


def get_field_filler_service(
    character_repo: CharacterRepository = Depends(get_character_repository),
    item_repo: ItemRepository = Depends(get_item_repository),
    location_repo: LocationRepository = Depends(get_location_repository),
    faction_repo: FactionRepository = Depends(get_faction_repository),
    world_setting_repo: WorldSettingRepository = Depends(get_world_setting_repository),
    rule_repo: RuleRepository = Depends(get_rule_repository),
) -> FieldFillerService:
    """FieldFillerService needs an Anthropic client + 6 entity repos."""
    from anthropic import Anthropic

    settings = get_settings()
    ai_client: object | None = None
    if settings.anthropic_api_key:
        ai_client = Anthropic(
            api_key=settings.anthropic_api_key,
            base_url=settings.anthropic_base_url,
        )
    entity_repos = {
        "character": character_repo,
        "item": item_repo,
        "location": location_repo,
        "faction": faction_repo,
        "world_setting": world_setting_repo,
        "rule": rule_repo,
    }
    return FieldFillerService(ai_client, entity_repos)


def get_description_rewriter_service(
    character_repo: CharacterRepository = Depends(get_character_repository),
    item_repo: ItemRepository = Depends(get_item_repository),
    location_repo: LocationRepository = Depends(get_location_repository),
    faction_repo: FactionRepository = Depends(get_faction_repository),
    world_setting_repo: WorldSettingRepository = Depends(get_world_setting_repository),
    rule_repo: RuleRepository = Depends(get_rule_repository),
) -> DescriptionRewriterService:
    """DescriptionRewriterService needs an Anthropic client + 6 entity repos."""
    from anthropic import Anthropic

    settings = get_settings()
    ai_client: object | None = None
    if settings.anthropic_api_key:
        ai_client = Anthropic(
            api_key=settings.anthropic_api_key,
            base_url=settings.anthropic_base_url,
        )
    entity_repos = {
        "character": character_repo,
        "item": item_repo,
        "location": location_repo,
        "faction": faction_repo,
        "world_setting": world_setting_repo,
        "rule": rule_repo,
    }
    return DescriptionRewriterService(ai_client, entity_repos)


def get_outline_generator_service(
    project_repo: ProjectRepository = Depends(get_project_repository),
    outline_repo: OutlineRepository = Depends(get_outline_repository),
    chapter_repo: ChapterRepository = Depends(get_chapter_repository),
    character_repo: CharacterRepository = Depends(get_character_repository),
    item_repo: ItemRepository = Depends(get_item_repository),
    location_repo: LocationRepository = Depends(get_location_repository),
    faction_repo: FactionRepository = Depends(get_faction_repository),
    world_setting_repo: WorldSettingRepository = Depends(get_world_setting_repository),
    rule_repo: RuleRepository = Depends(get_rule_repository),
) -> OutlineGeneratorService:
    """OutlineGeneratorService needs MiniMax plus project and entity data."""
    from anthropic import Anthropic

    settings = get_settings()
    ai_client: object | None = None
    if settings.anthropic_api_key:
        ai_client = Anthropic(
            api_key=settings.anthropic_api_key,
            base_url=settings.anthropic_base_url,
        )
    entity_repos = {
        "character": character_repo,
        "item": item_repo,
        "location": location_repo,
        "faction": faction_repo,
        "world_setting": world_setting_repo,
        "rule": rule_repo,
    }
    return OutlineGeneratorService(
        ai_client=ai_client,
        project_repo=project_repo,
        outline_repo=outline_repo,
        chapter_repo=chapter_repo,
        entity_repos=entity_repos,
    )


def get_chat_session_repository(db=Depends(get_db)):
    return ChatSessionRepository(db)


def get_chat_message_repository(db=Depends(get_db)):
    return ChatMessageRepository(db)


def get_chat_service(
    session_repo: ChatSessionRepository = Depends(get_chat_session_repository),
    message_repo: ChatMessageRepository = Depends(get_chat_message_repository),
    project_repo: ProjectRepository = Depends(get_project_repository),
    character_service: CharacterService = Depends(get_character_service),
    item_service: ItemService = Depends(get_item_service),
    location_service: LocationService = Depends(get_location_service),
    faction_service: FactionService = Depends(get_faction_service),
    world_setting_service: WorldSettingService = Depends(get_world_setting_service),
    rule_service: RuleService = Depends(get_rule_service),
) -> ChatService:
    return ChatService(
        session_repo=session_repo,
        message_repo=message_repo,
        project_repo=project_repo,
        character_service=character_service,
        item_service=item_service,
        location_service=location_service,
        faction_service=faction_service,
        world_setting_service=world_setting_service,
        rule_service=rule_service,
        user_id="default-user",
    )
