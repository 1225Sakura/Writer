# Re-export shim — actual implementation moved to infrastructure/cache/tiered_cache.py
# This shim exists temporarily for backward compatibility. Will be deleted in Phase 5.
from backend.infrastructure.cache.tiered_cache import *  # noqa: F401,F403
from backend.infrastructure.cache.tiered_cache import (  # noqa: F401
    TieredCache,
)
