# Auto Novel Writer - Tiered Cache (L1/L2/L3)
# L1: In-memory LRUCache | L2: Disk cache (diskcache) | L3: Database

import json
import logging
from typing import Any, Callable, Optional

from backend.infrastructure.cache.cache_service import LRUCache

logger = logging.getLogger(__name__)

try:
    from diskcache import Cache
except ImportError:
    # Fallback to vendor stub if diskcache is not installed
    import sys
    from pathlib import Path

    vendor_path = str(Path(__file__).parent.parent.parent / "vendor")
    if vendor_path not in sys.path:
        sys.path.insert(0, vendor_path)
    from diskcache import Cache


class TieredCache:
    """Three-tier cache: L1 (memory LRU) -> L2 (disk) -> L3 (database).

    - L1: Hot data, fastest access, smallest capacity
    - L2: Warm data, disk-backed, larger capacity
    - L3: Cold data, persistent database storage

    On get: search L1 -> L2 -> L3, promote hit to upper tier.
    On set: store to specified tier (or auto-detect based on value size).
    """

    def __init__(
        self,
        l1_cache: LRUCache,
        l2_cache: Optional[Cache],
        db_session_factory: Callable[[], Any],
    ):
        self.l1 = l1_cache
        self.l2 = l2_cache
        self._db_session_factory = db_session_factory

    # ------------------------------------------------------------------
    # Core operations
    # ------------------------------------------------------------------

    def get(self, key: str) -> Any:
        """Retrieve value from L1 -> L2 -> L3, promoting on hit."""
        # L1 lookup
        value = self.l1.get(key)
        if value is not None:
            return value

        # L2 lookup
        if self.l2 is not None:
            value = self.l2.get(key)
            if value is not None:
                # Promote to L1
                self.l1.set(key, value)
                return value

        # L3 lookup (database cache table)
        value = self._l3_get(key)
        if value is not None:
            # Promote to L1 and L2
            self.l1.set(key, value)
            if self.l2 is not None:
                self.l2.set(key, value)
            return value

        return None

    def set(
        self,
        key: str,
        value: Any,
        ttl: int = 300,
        tier: str = "auto",
    ) -> None:
        """Store value to the specified tier."""
        if tier == "auto":
            tier = self._auto_tier(value)

        if tier == "l1":
            self.l1.set(key, value, ttl=ttl)
        elif tier == "l2":
            if self.l2 is not None:
                self.l2.set(key, value, expire=ttl)
            else:
                self.l1.set(key, value, ttl=ttl)
        elif tier == "l3":
            self._l3_set(key, value, ttl=ttl)
        elif tier == "all":
            self.l1.set(key, value, ttl=ttl)
            if self.l2 is not None:
                self.l2.set(key, value, expire=ttl)
            self._l3_set(key, value, ttl=ttl)
        else:
            raise ValueError(f"Unknown tier: {tier}")

    def invalidate(self, key: str) -> bool:
        """Remove a key from all cache tiers."""
        found = False
        if self.l1.delete(key):
            found = True
        if self.l2 is not None and self.l2.delete(key):
            found = True
        if self._l3_delete(key):
            found = True
        return found

    def invalidate_pattern(self, pattern: str) -> int:
        """Remove keys containing *pattern* from L1 and L2."""
        count = self.l1.delete_pattern(pattern)
        if self.l2 is not None:
            for k in list(self.l2):
                if pattern in k:
                    if self.l2.delete(k):
                        count += 1
        count += self._l3_delete_pattern(pattern)
        return count

    # ------------------------------------------------------------------
    # L3 (database) helpers
    # ------------------------------------------------------------------

    def _l3_get(self, key: str) -> Any:
        try:
            db = self._db_session_factory()
            row = db.execute(
                "SELECT value, expire_at FROM cache_entries WHERE key = ?",
                (key,),
            ).fetchone()
            if row is None:
                return None
            import time

            value_json, expire_at = row
            if expire_at is not None and time.time() > expire_at:
                db.execute("DELETE FROM cache_entries WHERE key = ?", (key,))
                db.commit()
                return None
            return json.loads(value_json)
        except Exception as exc:
            logger.warning("L3 cache get failed: %s", exc)
            return None

    def _l3_set(self, key: str, value: Any, ttl: int) -> None:
        try:
            import time

            db = self._db_session_factory()
            expire_at = time.time() + ttl
            db.execute(
                """
                INSERT INTO cache_entries (key, value, expire_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    expire_at = excluded.expire_at
                """,
                (key, json.dumps(value), expire_at),
            )
            db.commit()
        except Exception as exc:
            logger.warning("L3 cache set failed: %s", exc)

    def _l3_delete(self, key: str) -> bool:
        try:
            db = self._db_session_factory()
            cur = db.execute("DELETE FROM cache_entries WHERE key = ?", (key,))
            db.commit()
            return cur.rowcount > 0
        except Exception as exc:
            logger.warning("L3 cache delete failed: %s", exc)
            return False

    def _l3_delete_pattern(self, pattern: str) -> int:
        try:
            db = self._db_session_factory()
            cur = db.execute(
                "DELETE FROM cache_entries WHERE key LIKE ?",
                (f"%{pattern}%",),
            )
            db.commit()
            return cur.rowcount
        except Exception as exc:
            logger.warning("L3 cache pattern delete failed: %s", exc)
            return 0

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    @staticmethod
    def _auto_tier(value: Any) -> str:
        """Determine appropriate tier based on serialized size."""
        try:
            size = len(json.dumps(value))
        except (TypeError, ValueError):
            size = 0
        if size < 1024:
            return "l1"
        elif size < 64 * 1024:
            return "l2"
        return "l3"

    def stats(self) -> dict[str, Any]:
        """Return statistics for all tiers."""
        stats = {
            "l1": self.l1.stats(),
        }
        if self.l2 is not None:
            stats["l2"] = {"size": len(self.l2)}
        try:
            db = self._db_session_factory()
            row = db.execute(
                "SELECT COUNT(*) FROM cache_entries"
            ).fetchone()
            stats["l3"] = {"size": row[0] if row else 0}
        except Exception as exc:
            stats["l3"] = {"error": str(exc)}
        return stats
