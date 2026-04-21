# Auto Novel Writer - API Routes
# Router aggregation

from fastapi import APIRouter

from .chat import router as chat_router
from .settings import router as settings_router
from .chapters import router as chapters_router
from .ai import router as ai_router
from .styles import router as styles_router
from .export_import import router as export_import_router
from .auth import router as auth_router
from .tasks import router as tasks_router
from .health import router as health_router
from .cache import router as cache_router
from .workflows import router as workflows_router
from .agents import router as agents_router
from .stats import router as stats_router
from .metrics import router as metrics_router

# Main API router with version prefix
api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(chat_router)
api_router.include_router(settings_router)
api_router.include_router(chapters_router)
api_router.include_router(ai_router)
api_router.include_router(styles_router)
api_router.include_router(export_import_router)
api_router.include_router(tasks_router)
api_router.include_router(health_router)
api_router.include_router(cache_router)
api_router.include_router(workflows_router)
api_router.include_router(agents_router)
api_router.include_router(stats_router)
api_router.include_router(metrics_router)
