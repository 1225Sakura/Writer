# Auto Novel Writer - Entity Linker Service
# Entity disambiguation: same name -> different person, same item -> different names
# Uses existing Character/Item/Location/Faction tables + JSON fields

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
from difflib import SequenceMatcher

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

from backend.core.domain import (
    Character, Item, Location, Faction, CharacterRelationship
)


@dataclass
class DisambiguationResult:
    """消歧结果"""
    mention: str
    entity_id: Optional[int]
    entity_type: str
    confidence: float
    candidates: List[Dict[str, Any]] = field(default_factory=list)
    adopted: bool = False
    warning: Optional[str] = None
    alias_matched: Optional[str] = None


@dataclass
class EntityAlias:
    """实体别名记录"""
    entity_id: int
    entity_type: str
    alias: str
    canonical_name: str


class EntityLinker:
    """实体链接器 - 提供实体消歧与别名管理 (v1.0)

    核心功能：
    1. 别名索引管理（同名不同人、同物不同名）
    2. 置信度判断与自动/人工分流
    3. 批量消歧处理
    4. 实体相似度计算（基于名称、描述、属性）
    """

    # 实体类型到模型/表名的映射
    ENTITY_MODELS = {
        "character": Character,
        "item": Item,
        "location": Location,
        "faction": Faction,
    }

    # 各实体类型的名称字段
    NAME_FIELDS = {
        "character": "name",
        "item": "name",
        "location": "name",
        "faction": "name",
    }

    # 各实体类型的描述字段
    DESC_FIELDS = {
        "character": "description",
        "item": "description",
        "location": "description",
        "faction": "description",
    }

    # 用于相似度计算的额外属性字段
    ATTR_FIELDS = {
        "character": ["gender", "personality", "cultivation_realm", "tier"],
        "item": ["owner", "location"],
        "location": ["importance"],
        "faction": ["type"],
    }

    def __init__(self, db: AsyncSession):
        self.db = db
        self._alias_cache: Dict[str, List[EntityAlias]] = {}
        self._confidence_high = 0.85
        self._confidence_medium = 0.60

    # ==================== 别名管理 ====================

    async def register_alias(
        self,
        entity_id: int,
        entity_type: str,
        alias: str,
        canonical_name: str = ""
    ) -> bool:
        """注册新别名（存储在实体的 JSON 字段中）

        使用现有表的 JSON 扩展字段存储别名，不新增表。
        """
        if not alias or not entity_id or entity_type not in self.ENTITY_MODELS:
            return False

        model = self.ENTITY_MODELS[entity_type]
        result = await self.db.execute(select(model).where(model.id == entity_id))
        entity = result.scalar_one_or_none()
        if not entity:
            return False

        # 使用 description 字段存储别名 JSON（如果数据库支持 JSON 字段则更好）
        # 这里用 description 字段末尾追加 JSON 标记的方式
        aliases = self._extract_aliases(entity)
        if alias not in aliases:
            aliases.append(alias)
            self._write_aliases(entity, aliases)

        # 更新缓存
        cache_key = f"{entity_type}:{alias}"
        if cache_key not in self._alias_cache:
            self._alias_cache[cache_key] = []
        self._alias_cache[cache_key].append(
            EntityAlias(entity_id=entity_id, entity_type=entity_type,
                        alias=alias, canonical_name=canonical_name or alias)
        )
        return True

    async def lookup_alias(
        self,
        mention: str,
        entity_type: Optional[str] = None,
        project_id: Optional[int] = None
    ) -> Optional[int]:
        """查找别名对应的实体ID（返回最佳匹配，可选按类型过滤）"""
        entries = await self.lookup_alias_all(mention, entity_type, project_id)
        if not entries:
            return None
        # 返回置信度最高的
        best = max(entries, key=lambda e: e.get("confidence", 0))
        return best.get("id")

    async def lookup_alias_all(
        self,
        mention: str,
        entity_type: Optional[str] = None,
        project_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """查找别名对应的所有实体（一对多消歧）

        Returns:
            List of {"id": int, "type": str, "name": str, "confidence": float}
        """
        results: List[Dict[str, Any]] = []

        types_to_search = [entity_type] if entity_type else list(self.ENTITY_MODELS.keys())

        for etype in types_to_search:
            if etype not in self.ENTITY_MODELS:
                continue
            model = self.ENTITY_MODELS[etype]
            name_field = getattr(model, self.NAME_FIELDS[etype])

            # 1. 精确匹配名称
            stmt = select(model).where(func.lower(name_field) == mention.lower())
            if project_id is not None and hasattr(model, "project_id"):
                stmt = stmt.where(model.project_id == project_id)

            result = await self.db.execute(stmt)
            for entity in result.scalars().all():
                results.append({
                    "id": entity.id,
                    "type": etype,
                    "name": getattr(entity, self.NAME_FIELDS[etype]),
                    "confidence": 1.0,
                    "match_type": "exact_name"
                })

            # 2. 模糊匹配（子串或相似度）
            stmt2 = select(model).where(
                func.lower(name_field).like(f"%{mention.lower()}%")
            )
            if project_id is not None and hasattr(model, "project_id"):
                stmt2 = stmt2.where(model.project_id == project_id)

            result2 = await self.db.execute(stmt2)
            for entity in result2.scalars().all():
                # 避免重复添加精确匹配项
                if any(r["id"] == entity.id and r["type"] == etype for r in results):
                    continue
                name = getattr(entity, self.NAME_FIELDS[etype])
                sim = SequenceMatcher(None, mention.lower(), name.lower()).ratio()
                results.append({
                    "id": entity.id,
                    "type": etype,
                    "name": name,
                    "confidence": round(sim, 3),
                    "match_type": "fuzzy_name"
                })

            # 3. 检查 description 中存储的别名 JSON
            desc_field = getattr(model, self.DESC_FIELDS[etype], None)
            if desc_field is not None:
                all_entities = await self.db.execute(select(model))
                for entity in all_entities.scalars().all():
                    if any(r["id"] == entity.id and r["type"] == etype for r in results):
                        continue
                    aliases = self._extract_aliases(entity)
                    for alias in aliases:
                        if mention.lower() == alias.lower():
                            results.append({
                                "id": entity.id,
                                "type": etype,
                                "name": getattr(entity, self.NAME_FIELDS[etype]),
                                "confidence": 0.95,
                                "match_type": "alias",
                                "alias": alias
                            })
                            break
                        elif mention.lower() in alias.lower() or alias.lower() in mention.lower():
                            sim = SequenceMatcher(None, mention.lower(), alias.lower()).ratio()
                            if sim > 0.7:
                                results.append({
                                    "id": entity.id,
                                    "type": etype,
                                    "name": getattr(entity, self.NAME_FIELDS[etype]),
                                    "confidence": round(sim * 0.9, 3),
                                    "match_type": "fuzzy_alias",
                                    "alias": alias
                                })

        # 按置信度排序
        results.sort(key=lambda x: x.get("confidence", 0), reverse=True)
        return results

    async def get_all_aliases(self, entity_id: int, entity_type: str) -> List[str]:
        """获取实体的所有别名"""
        if entity_type not in self.ENTITY_MODELS:
            return []
        model = self.ENTITY_MODELS[entity_type]
        result = await self.db.execute(select(model).where(model.id == entity_id))
        entity = result.scalar_one_or_none()
        if not entity:
            return []
        return self._extract_aliases(entity)

    # ==================== 置信度判断 ====================

    def evaluate_confidence(self, confidence: float) -> Tuple[str, bool, Optional[str]]:
        """评估置信度，返回 (action, adopt, warning)

        - action: "auto" | "warn" | "manual"
        - adopt: 是否采用
        - warning: 警告信息
        """
        if confidence >= self._confidence_high:
            return ("auto", True, None)
        elif confidence >= self._confidence_medium:
            return ("warn", True, f"中置信度匹配 (confidence: {confidence:.2f})")
        else:
            return ("manual", False, f"需人工确认 (confidence: {confidence:.2f})")

    def process_uncertain(
        self,
        mention: str,
        candidates: List[Dict[str, Any]],
        suggested_id: Optional[int] = None,
        suggested_type: str = "character",
        confidence: float = 0.0
    ) -> DisambiguationResult:
        """处理不确定的实体匹配

        返回消歧结果，包含是否采用、警告信息等
        """
        action, adopt, warning = self.evaluate_confidence(confidence)

        result = DisambiguationResult(
            mention=mention,
            entity_id=suggested_id if adopt else None,
            entity_type=suggested_type,
            confidence=confidence,
            candidates=candidates,
            adopted=adopt,
            warning=warning
        )
        return result

    # ==================== 实体相似度计算 ====================

    async def compute_similarity(
        self,
        entity_a_id: int,
        entity_a_type: str,
        entity_b_id: int,
        entity_b_type: str
    ) -> float:
        """计算两个实体之间的综合相似度 (0.0-1.0)

        基于名称、描述、属性等多维度计算。
        """
        if entity_a_type not in self.ENTITY_MODELS or entity_b_type not in self.ENTITY_MODELS:
            return 0.0

        model_a = self.ENTITY_MODELS[entity_a_type]
        model_b = self.ENTITY_MODELS[entity_b_type]

        result_a = await self.db.execute(select(model_a).where(model_a.id == entity_a_id))
        result_b = await self.db.execute(select(model_b).where(model_b.id == entity_b_id))
        entity_a = result_a.scalar_one_or_none()
        entity_b = result_b.scalar_one_or_none()

        if not entity_a or not entity_b:
            return 0.0

        scores = []

        # 名称相似度
        name_a = getattr(entity_a, self.NAME_FIELDS[entity_a_type], "") or ""
        name_b = getattr(entity_b, self.NAME_FIELDS[entity_b_type], "") or ""
        name_sim = SequenceMatcher(None, name_a.lower(), name_b.lower()).ratio()
        scores.append((name_sim, 0.4))  # 权重 0.4

        # 描述相似度
        desc_a = getattr(entity_a, self.DESC_FIELDS[entity_a_type], "") or ""
        desc_b = getattr(entity_b, self.DESC_FIELDS[entity_b_type], "") or ""
        if desc_a and desc_b:
            desc_sim = SequenceMatcher(None, desc_a.lower(), desc_b.lower()).ratio()
            scores.append((desc_sim, 0.3))  # 权重 0.3

        # 属性相似度
        attrs_a = self._extract_attrs(entity_a, entity_a_type)
        attrs_b = self._extract_attrs(entity_b, entity_b_type)
        if attrs_a and attrs_b:
            matched = sum(1 for k, v in attrs_a.items() if attrs_b.get(k) == v)
            total = len(set(attrs_a.keys()) | set(attrs_b.keys()))
            if total > 0:
                attr_sim = matched / total
                scores.append((attr_sim, 0.3))  # 权重 0.3

        # 加权平均
        if not scores:
            return 0.0
        total_weight = sum(w for _, w in scores)
        weighted_sum = sum(s * w for s, w in scores)
        return round(weighted_sum / total_weight, 3) if total_weight > 0 else 0.0

    async def find_potential_duplicates(
        self,
        entity_type: str,
        project_id: Optional[int] = None,
        threshold: float = 0.75
    ) -> List[Dict[str, Any]]:
        """查找指定类型中可能的重复实体（同名或高相似度）

        Returns:
            List of {"entity_a": {...}, "entity_b": {...}, "similarity": float}
        """
        if entity_type not in self.ENTITY_MODELS:
            return []

        model = self.ENTITY_MODELS[entity_type]
        stmt = select(model)
        if project_id is not None and hasattr(model, "project_id"):
            stmt = stmt.where(model.project_id == project_id)

        result = await self.db.execute(stmt)
        entities = list(result.scalars().all())

        duplicates = []
        for i, ea in enumerate(entities):
            for eb in entities[i + 1 :]:
                name_a = getattr(ea, self.NAME_FIELDS[entity_type], "") or ""
                name_b = getattr(eb, self.NAME_FIELDS[entity_type], "") or ""
                name_sim = SequenceMatcher(None, name_a.lower(), name_b.lower()).ratio()

                # 快速筛选：名称相似度或完全相同
                if name_sim >= threshold or name_a.lower() == name_b.lower():
                    # 计算综合相似度
                    full_sim = await self.compute_similarity(
                        ea.id, entity_type, eb.id, entity_type
                    )
                    if full_sim >= threshold or name_a.lower() == name_b.lower():
                        duplicates.append({
                            "entity_a": {
                                "id": ea.id,
                                "name": name_a,
                                "type": entity_type,
                            },
                            "entity_b": {
                                "id": eb.id,
                                "name": name_b,
                                "type": entity_type,
                            },
                            "similarity": full_sim if full_sim >= threshold else name_sim,
                            "reason": "same_name" if name_a.lower() == name_b.lower() else "high_similarity"
                        })

        # 按相似度排序
        duplicates.sort(key=lambda x: x["similarity"], reverse=True)
        return duplicates

    # ==================== 批量处理 ====================

    async def process_extraction_result(
        self,
        uncertain_items: List[Dict[str, Any]],
        project_id: Optional[int] = None
    ) -> Tuple[List[DisambiguationResult], List[str]]:
        """处理 AI 提取结果中的 uncertain 项

        返回 (results, warnings)
        """
        results = []
        warnings = []

        for item in uncertain_items:
            mention = item.get("mention", "")
            candidates = await self.lookup_alias_all(mention, project_id=project_id)

            suggested_id = item.get("suggested_id")
            suggested_type = item.get("suggested_type", "character")
            confidence = item.get("confidence", 0.0)

            # 如果没有建议ID但有候选，取最佳候选
            if suggested_id is None and candidates:
                best = candidates[0]
                suggested_id = best["id"]
                suggested_type = best["type"]
                confidence = best.get("confidence", 0.0)

            result = self.process_uncertain(
                mention=mention,
                candidates=candidates,
                suggested_id=suggested_id,
                suggested_type=suggested_type,
                confidence=confidence
            )
            results.append(result)

            if result.warning:
                warnings.append(
                    f"{result.mention} -> {result.entity_id} ({result.entity_type}): {result.warning}"
                )

        return results, warnings

    async def register_new_entities(
        self,
        new_entities: List[Dict[str, Any]]
    ) -> List[int]:
        """注册新实体的别名

        返回注册的实体ID列表
        """
        registered = []

        for entity in new_entities:
            entity_id = entity.get("id") or entity.get("suggested_id")
            if not entity_id:
                continue

            entity_type = entity.get("type", "character")
            canonical = entity.get("name", "")

            # 注册主名称
            if canonical:
                await self.register_alias(entity_id, entity_type, canonical, canonical)

            # 注册提及方式/别名
            for alias in entity.get("aliases", []):
                if alias and alias != canonical:
                    await self.register_alias(entity_id, entity_type, alias, canonical)

            registered.append(entity_id)

        return registered

    # ==================== 内部工具方法 ====================

    def _extract_aliases(self, entity) -> List[str]:
        """从实体 description 字段中提取别名 JSON"""
        desc = getattr(entity, "description", None) or ""
        if not desc:
            return []
        # 查找 JSON 标记: <!--aliases:["a","b"]-->
        import re
        match = re.search(r'<!--aliases:(.*?)-->', desc)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                return []
        return []

    def _write_aliases(self, entity, aliases: List[str]) -> None:
        """将别名 JSON 写入实体 description 字段"""
        desc = getattr(entity, "description", None) or ""
        import re
        alias_json = json.dumps(aliases, ensure_ascii=False)
        new_tag = f"<!--aliases:{alias_json}-->"

        # 移除旧的别名标记
        desc = re.sub(r'<!--aliases:.*?-->', '', desc).strip()

        # 追加新的别名标记
        if desc:
            setattr(entity, "description", desc + "\n" + new_tag)
        else:
            setattr(entity, "description", new_tag)

    def _extract_attrs(self, entity, entity_type: str) -> Dict[str, Any]:
        """提取实体用于相似度计算的属性"""
        attrs = {}
        for field_name in self.ATTR_FIELDS.get(entity_type, []):
            val = getattr(entity, field_name, None)
            if val is not None and val != "":
                attrs[field_name] = val
        return attrs
