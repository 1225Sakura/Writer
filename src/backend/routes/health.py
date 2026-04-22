# Proxy module - routes.health now lives at backend.api.v1.endpoints.health
from backend.api.v1.endpoints.health import (
    router,
    health_check,
    readiness_check,
    liveness_check,
    _check_database,
    _check_ai_service,
    _check_disk_space,
    _check_dependencies,
)
from backend.api.v1.endpoints.health import *
