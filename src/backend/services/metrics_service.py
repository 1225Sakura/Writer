# Re-export shim — actual implementation moved to infrastructure/observability/metrics_service.py
# This shim exists temporarily for backward compatibility. Will be deleted in Phase 5.
from backend.infrastructure.observability.metrics_service import *  # noqa: F401,F403
from backend.infrastructure.observability.metrics_service import (  # noqa: F401
    MetricsService,
    metrics_service,
)
