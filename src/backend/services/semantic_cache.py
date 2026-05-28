import hashlib
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime


@dataclass
class CacheEntry:
    prompt_hash: str
    prompt_embedding: Optional[bytes] = None  # for vector similarity
    prompt_text: str = ""
    response: str = ""
    model: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    hit_count: int = 0
    quality_score: float = 1.0  # user feedback or auto-score


class AdaptiveThreshold:
    """VectorQ-style adaptive thresholds per prompt type."""

    def __init__(self, initial: float = 0.92):
        self._thresholds: Dict[str, float] = {}
        self._initial = initial

    def get_threshold(self, prompt_type: str) -> float:
        return self._thresholds.get(prompt_type, self._initial)

    def update(self, prompt_type: str, hit_was_good: bool):
        """2:1 bias ratio: 0.01 down on good hit, 0.02 up on bad hit."""
        current = self.get_threshold(prompt_type)
        if hit_was_good:
            self._thresholds[prompt_type] = max(0.80, current - 0.01)
        else:
            self._thresholds[prompt_type] = min(0.98, current + 0.02)

    def get_all_thresholds(self) -> Dict[str, float]:
        return dict(self._thresholds)


class SemanticCache:
    """2-tier semantic cache: exact hash + vector similarity."""

    def __init__(self, sqlite_vec_service=None):
        self._exact_cache: Dict[str, CacheEntry] = {}  # hash -> entry
        self._sqlite_vec = sqlite_vec_service
        self._adaptive = AdaptiveThreshold()
        self._stats = {"hits": 0, "misses": 0, "exact_hits": 0, "vector_hits": 0}

    @staticmethod
    def _hash_prompt(prompt: str, model: str = "", temperature: float = 0.0) -> str:
        """SHA256 hash of prompt + model + temperature."""
        key = f"{prompt}|{model}|{temperature}"
        return hashlib.sha256(key.encode()).hexdigest()

    def _classify_prompt(self, prompt: str) -> str:
        """Classify prompt type for adaptive thresholds."""
        prompt_lower = prompt.lower()
        if any(kw in prompt_lower for kw in ["什么是", "谁是", "多少", "几", "年龄", "名字"]):
            return "factual_query"
        elif any(kw in prompt_lower for kw in ["写", "创作", "生成", "续写", "扩写"]):
            return "creative_generation"
        elif any(kw in prompt_lower for kw in ["风格", "文笔", "语气"]):
            return "style_analysis"
        elif any(kw in prompt_lower for kw in ["检查", "一致性", "矛盾"]):
            return "consistency_check"
        elif any(kw in prompt_lower for kw in ["角色", "人物", "性格"]):
            return "character_profile"
        return "general"

    def get_exact(self, prompt: str, model: str = "", temperature: float = 0.0) -> Optional[str]:
        """Tier 1: Exact hash lookup. Returns cached response or None."""
        prompt_hash = self._hash_prompt(prompt, model, temperature)
        entry = self._exact_cache.get(prompt_hash)
        if entry:
            entry.hit_count += 1
            self._stats["hits"] += 1
            self._stats["exact_hits"] += 1
            return entry.response
        self._stats["misses"] += 1
        return None

    def store(
        self,
        prompt: str,
        response: str,
        model: str = "",
        temperature: float = 0.0,
        embedding: bytes = None,
    ) -> None:
        """Store prompt-response pair in both tiers."""
        prompt_hash = self._hash_prompt(prompt, model, temperature)
        entry = CacheEntry(
            prompt_hash=prompt_hash,
            prompt_embedding=embedding,
            prompt_text=prompt,
            response=response,
            model=model,
        )
        self._exact_cache[prompt_hash] = entry

        # Store in vector cache if available
        if self._sqlite_vec and embedding:
            self._sqlite_vec.insert_embedding(prompt_hash, embedding)

    def get_vector(
        self, query_embedding: bytes, prompt_type: str = "general"
    ) -> Optional[Tuple[str, float]]:
        """Tier 2: Vector similarity search. Returns (response, similarity) or None."""
        if not self._sqlite_vec:
            return None

        threshold = self._adaptive.get_threshold(prompt_type)
        results = self._sqlite_vec.search_similar(query_embedding, limit=1)

        if results:
            chunk_id, distance = results[0]
            similarity = 1.0 - distance  # convert distance to similarity
            if similarity >= threshold:
                entry = self._exact_cache.get(chunk_id)
                if entry:
                    entry.hit_count += 1
                    self._stats["hits"] += 1
                    self._stats["vector_hits"] += 1
                    return (entry.response, similarity)

        self._stats["misses"] += 1
        return None

    def feedback(self, prompt_type: str, hit_was_good: bool) -> None:
        """Update adaptive threshold based on user feedback."""
        self._adaptive.update(prompt_type, hit_was_good)

    def get_stats(self) -> Dict[str, Any]:
        """Return cache statistics."""
        total = self._stats["hits"] + self._stats["misses"]
        return {
            **self._stats,
            "total": total,
            "hit_rate": self._stats["hits"] / total if total > 0 else 0.0,
            "entries": len(self._exact_cache),
            "thresholds": self._adaptive.get_all_thresholds(),
        }

    def clear(self) -> None:
        """Clear all cached entries."""
        self._exact_cache.clear()
        self._stats = {"hits": 0, "misses": 0, "exact_hits": 0, "vector_hits": 0}
