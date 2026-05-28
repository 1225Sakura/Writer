# Auto Novel Writer - AI Routes Package
# Aggregates all AI sub-routers under /ai prefix

from fastapi import APIRouter

from backend.middleware.auth import require_auth

from .ai_generation import router as gen_router
from .ai_review import router as review_router
from .ai_agent import router as agent_router
from .ai_checkers import router as checker_router
from .ai_config import router as config_router
from .ai_review_history import router as review_history_router
from .dependencies import set_ai_provider  # re-export for external callers

router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[require_auth])
router.include_router(gen_router)
router.include_router(review_router)
router.include_router(agent_router)
router.include_router(checker_router)
router.include_router(config_router)
router.include_router(review_history_router)
