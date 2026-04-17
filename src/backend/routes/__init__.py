# Auto Novel Writer - API Routes
# Router aggregation

from fastapi import APIRouter

from .chat import router as chat_router
from .settings import router as settings_router
from .chapters import router as chapters_router
from .ai import router as ai_router
from .styles import router as styles_router

# Main API router
api_router = APIRouter(prefix="/api")

api_router.include_router(chat_router)
api_router.include_router(settings_router)
api_router.include_router(chapters_router)
api_router.include_router(ai_router)
api_router.include_router(styles_router)
