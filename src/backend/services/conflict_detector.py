# Auto Novel Writer - Conflict Detector
# Detect logical conflicts in entity relationships
# Ownership, location, and timeline conflicts

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any

from backend.services.graph_service import GraphData, GraphNode, GraphEdge

logger = logging.getLogger(__name__)


@dataclass
class Conflict:
    """冲突记录"""
    conflict_type: str  # ownership | location | timeline | faction
    severity: str  # error | warning
    message: str
    entity_a: Dict[str, Any]
    entity_b: Dict[str, Any]
    edge_info: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conflict_type": self.conflict_type,
            "severity": self.severity,
            "message": self.message,
            "entity_a": self.entity_a,
            "entity_b": self.entity_b,
            "edge_info": self.edge_info,
        }


class ConflictDetector:
    """实体关系冲突检测器

    检测以下类型的冲突：
    - 所有权冲突：同一物品被多个角色声称拥有
    - 位置冲突：角色同时出现在两个地点
    - 势力冲突：地点被多个势力声称控制
    - 时间线冲突：实体状态矛盾
    """

    def __init__(self, graph_data: GraphData):
        """初始化冲突检测器

        Args:
            graph_data: 图谱数据
        """
        self.graph_data = graph_data
        self._build_indexes()

    def _build_indexes(self) -> None:
        """构建索引以加速冲突检测"""
        # (entity_id, type) -> node
        self._node_map: Dict[Tuple[int, str], GraphNode] = {}
        # name -> nodes (用于同名检测)
        self._name_map: Dict[str, List[GraphNode]] = {}

        for node in self.graph_data.nodes:
            key = (node.id, node.type)
            self._node_map[key] = node

            name_lower = node.label.lower()
            if name_lower not in self._name_map:
                self._name_map[name_lower] = []
            self._name_map[name_lower].append(node)

        # 构建边索引
        self._ownership_edges: List[GraphEdge] = []
        self._location_edges: List[GraphEdge] = []
        self._faction_edges: List[GraphEdge] = []
        self._character_rels: List[GraphEdge] = []

        for edge in self.graph_data.edges:
            if edge.type == "ownership":
                self._ownership_edges.append(edge)
            elif edge.type in ("location", "location_visit"):
                self._location_edges.append(edge)
            elif edge.type in ("faction_control", "faction_location"):
                self._faction_edges.append(edge)
            elif edge.type == "character_relationship":
                self._character_rels.append(edge)

    # ==================== 所有权冲突 ====================

    def detect_ownership_conflicts(self) -> List[Conflict]:
        """检测所有权冲突

        冲突场景：
        - 同一物品被多个角色声称拥有
        - 物品的 owner 属性与图谱边矛盾
        """
        conflicts: List[Conflict] = []

        # 按物品分组所有权关系
        item_owners: Dict[int, List[tuple]] = {}

        for edge in self._ownership_edges:
            item_key = (edge.target, self._infer_type(edge.target))
            if item_key not in item_owners:
                item_owners[item_key] = []
            owner_key = (edge.source, self._infer_type(edge.source))
            item_owners[item_key].append(owner_key)

        # 检测同一物品被多人拥有
        for (item_id, item_type), owners in item_owners.items():
            unique_owners = list(set(owners))
            if len(unique_owners) > 1:
                item_node = self._node_map.get((item_id, item_type))
                owner_nodes = [self._node_map.get(o) for o in unique_owners]

                if item_node and all(owner_nodes):
                    conflict = Conflict(
                        conflict_type="ownership",
                        severity="error",
                        message=f"物品「{item_node.label}」被多个角色声称拥有",
                        entity_a={
                            "id": item_id,
                            "type": item_type,
                            "name": item_node.label,
                        },
                        entity_b={
                            "owners": [
                                {"id": o.id, "type": o.type, "name": o.label}
                                for o in owner_nodes
                            ]
                        },
                        edge_info={
                            "type": "ownership",
                            "owner_count": len(unique_owners),
                        }
                    )
                    conflicts.append(conflict)
                    logger.warning(conflict.message)

        # 检测 owner 属性与图谱边矛盾
        for node in self.graph_data.nodes:
            if node.type == "item":
                owner_prop = node.properties.get("owner", "")
                if owner_prop:
                    # 检查 owner 属性指向的角色是否在图中拥有该物品
                    matching_chars = [
                        n for n in self._name_map.get(owner_prop.lower(), [])
                        if n.type == "character"
                    ]
                    for char_node in matching_chars:
                        # 检查是否存在 (char -> item) 的 ownership 边
                        has_edge = any(
                            e.source == char_node.id and e.target == node.id
                            for e in self._ownership_edges
                        )
                        if not has_edge:
                            conflict = Conflict(
                                conflict_type="ownership",
                                severity="warning",
                                message=f"物品「{node.label}」的 owner 属性为「{owner_prop}」，"
                                        f"但图中不存在所有权关系边",
                                entity_a={
                                    "id": node.id,
                                    "type": "item",
                                    "name": node.label,
                                },
                                entity_b={
                                    "id": char_node.id,
                                    "type": "character",
                                    "name": char_node.label,
                                },
                                edge_info={
                                    "property_owner": owner_prop,
                                    "missing_edge": True,
                                }
                            )
                            conflicts.append(conflict)

        return conflicts

    # ==================== 位置冲突 ====================

    def detect_location_conflicts(self) -> List[Conflict]:
        """检测位置冲突

        冲突场景：
        - 角色同时出现在两个不同地点
        - 物品同时位于两个地点
        """
        conflicts: List[Conflict] = []

        # 按实体分组位置关系
        entity_locations: Dict[Tuple[int, str], List[tuple]] = {}

        for edge in self._location_edges:
            # edge.source 是角色/物品，edge.target 是地点
            entity_key = (edge.source, self._infer_type(edge.source))
            if entity_key not in entity_locations:
                entity_locations[entity_key] = []
            loc_key = (edge.target, self._infer_type(edge.target))
            entity_locations[entity_key].append(loc_key)

        # 检测同时在多个地点
        for (entity_id, entity_type), locations in entity_locations.items():
            unique_locs = list(set(locations))
            if len(unique_locs) > 1:
                entity_node = self._node_map.get((entity_id, entity_type))
                loc_nodes = [self._node_map.get(l) for l in unique_locs]

                if entity_node and all(loc_nodes):
                    conflict = Conflict(
                        conflict_type="location",
                        severity="error",
                        message=f"「{entity_node.label}」同时出现在多个地点",
                        entity_a={
                            "id": entity_id,
                            "type": entity_type,
                            "name": entity_node.label,
                        },
                        entity_b={
                            "locations": [
                                {"id": l.id, "type": l.type, "name": l.label}
                                for l in loc_nodes
                            ]
                        },
                        edge_info={
                            "location_count": len(unique_locs),
                        }
                    )
                    conflicts.append(conflict)
                    logger.warning(conflict.message)

        # 检测物品 location 属性与图谱边矛盾
        for node in self.graph_data.nodes:
            if node.type == "item":
                loc_prop = node.properties.get("location", "")
                if loc_prop:
                    matching_locs = [
                        n for n in self._name_map.get(loc_prop.lower(), [])
                        if n.type == "location"
                    ]
                    for loc_node in matching_locs:
                        has_edge = any(
                            e.source == node.id and e.target == loc_node.id
                            for e in self._location_edges
                        )
                        if not has_edge:
                            conflict = Conflict(
                                conflict_type="location",
                                severity="warning",
                                message=f"物品「{node.label}」的 location 属性为「{loc_prop}」，"
                                        f"但图中不存在位置关系边",
                                entity_a={
                                    "id": node.id,
                                    "type": "item",
                                    "name": node.label,
                                },
                                entity_b={
                                    "id": loc_node.id,
                                    "type": "location",
                                    "name": loc_node.label,
                                },
                                edge_info={
                                    "property_location": loc_prop,
                                    "missing_edge": True,
                                }
                            )
                            conflicts.append(conflict)

        return conflicts

    # ==================== 势力冲突 ====================

    def detect_faction_conflicts(self) -> List[Conflict]:
        """检测势力控制冲突

        冲突场景：
        - 同一地点被多个势力控制
        """
        conflicts: List[Conflict] = []

        # 按地点分组势力控制关系
        location_controllers: Dict[Tuple[int, str], List[tuple]] = {}

        for edge in self._faction_edges:
            loc_key = (edge.target, self._infer_type(edge.target))
            if loc_key not in location_controllers:
                location_controllers[loc_key] = []
            fac_key = (edge.source, self._infer_type(edge.source))
            location_controllers[loc_key].append(fac_key)

        # 检测同一地点被多方控制
        for (loc_id, loc_type), controllers in location_controllers.items():
            unique_facs = list(set(controllers))
            if len(unique_facs) > 1:
                loc_node = self._node_map.get((loc_id, loc_type))
                fac_nodes = [self._node_map.get(f) for f in unique_facs]

                if loc_node and all(fac_nodes):
                    conflict = Conflict(
                        conflict_type="faction",
                        severity="error",
                        message=f"地点「{loc_node.label}」被多个势力声称控制",
                        entity_a={
                            "id": loc_id,
                            "type": loc_type,
                            "name": loc_node.label,
                        },
                        entity_b={
                            "factions": [
                                {"id": f.id, "type": f.type, "name": f.label}
                                for f in fac_nodes
                            ]
                        },
                        edge_info={
                            "type": "faction_control",
                            "controller_count": len(unique_facs),
                        }
                    )
                    conflicts.append(conflict)
                    logger.warning(conflict.message)

        # 检测 location.importance 属性指向势力
        for node in self.graph_data.nodes:
            if node.type == "location":
                imp_prop = node.properties.get("importance", "")
                if imp_prop:
                    matching_facs = [
                        n for n in self._name_map.get(imp_prop.lower(), [])
                        if n.type == "faction"
                    ]
                    for fac_node in matching_facs:
                        has_edge = any(
                            e.source == fac_node.id and e.target == node.id
                            for e in self._faction_edges
                        )
                        if not has_edge:
                            conflict = Conflict(
                                conflict_type="faction",
                                severity="warning",
                                message=f"地点「{node.label}」的 importance 属性指向「{imp_prop}」，"
                                        f"但图中不存在控制关系边",
                                entity_a={
                                    "id": node.id,
                                    "type": "location",
                                    "name": node.label,
                                },
                                entity_b={
                                    "id": fac_node.id,
                                    "type": "faction",
                                    "name": fac_node.label,
                                },
                                edge_info={
                                    "property_importance": imp_prop,
                                    "missing_edge": True,
                                }
                            )
                            conflicts.append(conflict)

        return conflicts

    # ==================== 综合检测 ====================

    def detect_all_conflicts(self) -> Dict[str, List[Conflict]]:
        """执行所有冲突检测

        Returns:
            按冲突类型分组的冲突列表
        """
        all_conflicts: Dict[str, List[Conflict]] = {
            "ownership": [],
            "location": [],
            "faction": [],
        }

        all_conflicts["ownership"].extend(self.detect_ownership_conflicts())
        all_conflicts["location"].extend(self.detect_location_conflicts())
        all_conflicts["faction"].extend(self.detect_faction_conflicts())

        return all_conflicts

    def has_conflicts(self) -> bool:
        """快速检查是否存在冲突"""
        for edge in self._ownership_edges:
            item_owners = [
                e for e in self._ownership_edges
                if e.target == edge.target
            ]
            if len(set(e.source for e in item_owners)) > 1:
                return True

        for edge in self._faction_edges:
            loc_controllers = [
                e for e in self._faction_edges
                if e.target == edge.target
            ]
            if len(set(e.source for e in loc_controllers)) > 1:
                return True

        return False

    # ==================== 内部工具 ====================

    def _infer_type(self, entity_id: int) -> Optional[str]:
        """从图数据推断实体类型"""
        for node in self.graph_data.nodes:
            if node.id == entity_id:
                return node.type
        return None
