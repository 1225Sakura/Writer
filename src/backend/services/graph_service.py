# Auto Novel Writer - Graph Service
# Build entity relationship graph, support multi-hop queries
# Uses existing Character/Item/Location/Faction/CharacterRelationship tables

from __future__ import annotations

import json
import logging
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from backend.core.domain import (
    Character, Item, Location, Faction, CharacterRelationship
)

# NetworkX is optional — graceful fallback if not installed
try:
    import networkx as nx
    _HAS_NETWORKX = True
except ImportError:
    nx = None  # type: ignore[assignment]
    _HAS_NETWORKX = False

logger = logging.getLogger(__name__)


@dataclass
class GraphNode:
    """图谱节点"""
    id: int
    type: str  # character, item, location, faction
    label: str
    properties: Dict[str, Any] = field(default_factory=dict)
    color: Optional[str] = None
    size: int = 1


@dataclass
class GraphEdge:
    """图谱边"""
    source: int
    target: int
    label: str
    type: str
    properties: Dict[str, Any] = field(default_factory=dict)
    directed: bool = True


@dataclass
class GraphData:
    """图谱数据（节点+边）"""
    nodes: List[GraphNode] = field(default_factory=list)
    edges: List[GraphEdge] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "nodes": [
                {
                    "id": n.id,
                    "type": n.type,
                    "label": n.label,
                    "properties": n.properties,
                    "color": n.color,
                    "size": n.size,
                }
                for n in self.nodes
            ],
            "edges": [
                {
                    "source": e.source,
                    "target": e.target,
                    "label": e.label,
                    "type": e.type,
                    "properties": e.properties,
                    "directed": e.directed,
                }
                for e in self.edges
            ],
        }


class GraphService:
    """实体关系图谱服务

    构建项目内所有实体（角色、物品、地点、势力）的关系图谱，
    支持多跳查询、路径发现、中心性分析等图算法。
    """

    # 实体类型到颜色映射（与前端色彩系统一致）
    NODE_COLORS = {
        "character": "#e8b87d",   # 角色橙
        "item": "#9b7ed9",        # 物品紫
        "location": "#5eb5a6",    # 地点青
        "faction": "#d45d5d",     # 势力红
    }

    # 实体类型到显示名称
    TYPE_LABELS = {
        "character": "角色",
        "item": "物品",
        "location": "地点",
        "faction": "势力",
    }

    ENTITY_MODELS = {
        "character": Character,
        "item": Item,
        "location": Location,
        "faction": Faction,
    }

    def __init__(self, db: AsyncSession):
        self.db = db

    # ==================== 图谱构建 ====================

    async def build_project_graph(
        self,
        project_id: Optional[int] = None,
        entity_types: Optional[List[str]] = None
    ) -> GraphData:
        """构建项目级完整关系图谱

        Args:
            project_id: 项目ID，None则返回所有项目
            entity_types: 限定实体类型列表，None则包含全部

        Returns:
            GraphData containing all nodes and edges
        """
        graph = GraphData()
        types = entity_types or list(self.ENTITY_MODELS.keys())

        # 1. 加载所有节点
        for etype in types:
            nodes = await self._load_entities(etype, project_id)
            graph.nodes.extend(nodes)

        # 2. 加载角色关系边
        if "character" in types:
            edges = await self._load_character_relationships(project_id)
            graph.edges.extend(edges)

        # 3. 加载隐式关联边（基于属性字段）
        implicit_edges = await self._load_implicit_edges(graph.nodes, project_id)
        graph.edges.extend(implicit_edges)

        # 4. 计算节点大小（基于连接度）
        self._compute_node_sizes(graph)

        return graph

    async def build_entity_neighborhood(
        self,
        entity_id: int,
        entity_type: str,
        depth: int = 1,
        project_id: Optional[int] = None
    ) -> GraphData:
        """构建指定实体的邻域子图

        Args:
            entity_id: 中心实体ID
            entity_type: 中心实体类型
            depth: 邻域深度（跳数）
            project_id: 项目ID过滤

        Returns:
            GraphData of the neighborhood subgraph
        """
        graph = GraphData()
        visited: Set[Tuple[int, str]] = set()
        queue = deque([(entity_id, entity_type, 0)])

        # BFS 遍历
        while queue:
            current_id, current_type, current_depth = queue.popleft()
            key = (current_id, current_type)

            if key in visited or current_depth > depth:
                continue
            visited.add(key)

            # 加载当前节点
            node = await self._load_single_entity(current_id, current_type)
            if node:
                graph.nodes.append(node)

            if current_depth >= depth:
                continue

            # 查找邻居
            neighbors = await self._get_neighbors(current_id, current_type, project_id)
            for neighbor_id, neighbor_type, edge_info in neighbors:
                neighbor_key = (neighbor_id, neighbor_type)
                if neighbor_key not in visited:
                    queue.append((neighbor_id, neighbor_type, current_depth + 1))
                    # 添加边
                    edge = GraphEdge(
                        source=current_id,
                        target=neighbor_id,
                        label=edge_info.get("label", "关联"),
                        type=edge_info.get("type", "implicit"),
                        properties=edge_info.get("properties", {}),
                    )
                    # 避免重复边
                    if not any(
                        e.source == edge.source and e.target == edge.target and e.label == edge.label
                        for e in graph.edges
                    ):
                        graph.edges.append(edge)

        return graph

    # ==================== 多跳查询 ====================

    async def multi_hop_query(
        self,
        start_entity_id: int,
        start_entity_type: str,
        end_entity_id: Optional[int] = None,
        end_entity_type: Optional[str] = None,
        max_hops: int = 3,
        relation_types: Optional[List[str]] = None,
        project_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """多跳路径查询

        查找从起点到终点的所有路径（在 max_hops 限制内）。
        如果未指定终点，则返回所有可达实体。

        Returns:
            List of paths, each path is {"nodes": [...], "edges": [...], "hops": int}
        """
        paths: List[Dict[str, Any]] = []
        visited: Set[Tuple[int, str]] = set()

        async def dfs(
            current_id: int,
            current_type: str,
            current_path_nodes: List[Dict],
            current_path_edges: List[Dict],
            depth: int
        ):
            key = (current_id, current_type)
            if key in visited and depth > 0:
                return
            if depth > 0:
                visited.add(key)

            # 检查是否到达终点
            if end_entity_id is not None and depth > 0:
                if current_id == end_entity_id and current_type == end_entity_type:
                    paths.append({
                        "nodes": list(current_path_nodes),
                        "edges": list(current_path_edges),
                        "hops": depth,
                    })
                    return

            if depth >= max_hops:
                # 如果没有终点，记录当前可达路径
                if end_entity_id is None and depth > 0:
                    paths.append({
                        "nodes": list(current_path_nodes),
                        "edges": list(current_path_edges),
                        "hops": depth,
                    })
                return

            neighbors = await self._get_neighbors(current_id, current_type, project_id)
            for neighbor_id, neighbor_type, edge_info in neighbors:
                if relation_types and edge_info.get("type") not in relation_types:
                    continue

                neighbor_node = await self._load_single_entity(neighbor_id, neighbor_type)
                if not neighbor_node:
                    continue

                node_dict = {
                    "id": neighbor_node.id,
                    "type": neighbor_node.type,
                    "label": neighbor_node.label,
                }
                edge_dict = {
                    "source": current_id,
                    "target": neighbor_id,
                    "label": edge_info.get("label", "关联"),
                    "type": edge_info.get("type", "implicit"),
                }

                await dfs(
                    neighbor_id,
                    neighbor_type,
                    current_path_nodes + [node_dict],
                    current_path_edges + [edge_dict],
                    depth + 1
                )

        start_node = await self._load_single_entity(start_entity_id, start_entity_type)
        if not start_node:
            return []

        start_dict = {
            "id": start_node.id,
            "type": start_node.type,
            "label": start_node.label,
        }
        await dfs(start_entity_id, start_entity_type, [start_dict], [], 0)

        # 去重并按跳数排序
        seen = set()
        unique_paths = []
        for p in paths:
            path_key = tuple((n["id"], n["type"]) for n in p["nodes"])
            if path_key not in seen:
                seen.add(path_key)
                unique_paths.append(p)

        unique_paths.sort(key=lambda x: x["hops"])
        return unique_paths

    async def find_shortest_path(
        self,
        start_entity_id: int,
        start_entity_type: str,
        end_entity_id: int,
        end_entity_type: str,
        max_hops: int = 5,
        project_id: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """使用 BFS 查找两个实体间的最短路径

        Returns:
            {"nodes": [...], "edges": [...], "hops": int} or None
        """
        queue = deque([(
            start_entity_id,
            start_entity_type,
            [{"id": start_entity_id, "type": start_entity_type, "label": ""}],
            [],
            0
        )])
        visited: Set[Tuple[int, str]] = set()

        # 预加载起点标签
        start_node = await self._load_single_entity(start_entity_id, start_entity_type)
        if start_node:
            queue[0][2][0]["label"] = start_node.label

        while queue:
            curr_id, curr_type, path_nodes, path_edges, depth = queue.popleft()
            key = (curr_id, curr_type)

            if key in visited:
                continue
            visited.add(key)

            if curr_id == end_entity_id and curr_type == end_entity_type and depth > 0:
                # 更新终点标签
                end_node = await self._load_single_entity(end_entity_id, end_entity_type)
                if end_node:
                    path_nodes[-1]["label"] = end_node.label
                return {
                    "nodes": path_nodes,
                    "edges": path_edges,
                    "hops": depth,
                }

            if depth >= max_hops:
                continue

            neighbors = await self._get_neighbors(curr_id, curr_type, project_id)
            for neighbor_id, neighbor_type, edge_info in neighbors:
                n_key = (neighbor_id, neighbor_type)
                if n_key in visited:
                    continue

                neighbor_node = await self._load_single_entity(neighbor_id, neighbor_type)
                if not neighbor_node:
                    continue

                new_nodes = path_nodes + [{
                    "id": neighbor_id,
                    "type": neighbor_type,
                    "label": neighbor_node.label,
                }]
                new_edges = path_edges + [{
                    "source": curr_id,
                    "target": neighbor_id,
                    "label": edge_info.get("label", "关联"),
                    "type": edge_info.get("type", "implicit"),
                }]
                queue.append((neighbor_id, neighbor_type, new_nodes, new_edges, depth + 1))

        return None

    # ==================== 图分析 ====================

    async def compute_centrality(
        self,
        project_id: Optional[int] = None,
        metric: str = "degree"
    ) -> List[Dict[str, Any]]:
        """计算节点中心性

        Args:
            project_id: 项目ID
            metric: "degree" | "betweenness" (简化版) | "closeness"

        Returns:
            List of {"entity_id": int, "type": str, "score": float}
        """
        graph = await self.build_project_graph(project_id)

        # 构建邻接表
        adj: Dict[Tuple[int, str], List[Tuple[int, str]]] = defaultdict(list)
        for edge in graph.edges:
            src_key = (edge.source, self._infer_type(edge.source, graph.nodes))
            tgt_key = (edge.target, self._infer_type(edge.target, graph.nodes))
            if src_key[1] and tgt_key[1]:
                adj[src_key].append(tgt_key)
                if not edge.directed:
                    adj[tgt_key].append(src_key)

        scores = []
        for node in graph.nodes:
            key = (node.id, node.type)
            if metric == "degree":
                score = len(adj.get(key, []))
            elif metric == "betweenness":
                score = self._approx_betweenness(key, adj, graph.nodes)
            else:
                score = len(adj.get(key, []))

            scores.append({
                "entity_id": node.id,
                "type": node.type,
                "name": node.label,
                "score": round(score, 3),
            })

        scores.sort(key=lambda x: x["score"], reverse=True)
        return scores

    async def find_clusters(
        self,
        project_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """基于连通分量发现实体簇/社群

        Returns:
            List of {"cluster_id": int, "members": [...], "size": int}
        """
        graph = await self.build_project_graph(project_id)

        # 构建无向邻接表
        adj: Dict[Tuple[int, str], Set[Tuple[int, str]]] = defaultdict(set)
        for edge in graph.edges:
            src_type = self._infer_type(edge.source, graph.nodes)
            tgt_type = self._infer_type(edge.target, graph.nodes)
            if src_type and tgt_type:
                src_key = (edge.source, src_type)
                tgt_key = (edge.target, tgt_type)
                adj[src_key].add(tgt_key)
                adj[tgt_key].add(src_key)

        # 连通分量
        visited: Set[Tuple[int, str]] = set()
        clusters = []
        cluster_id = 0

        for node in graph.nodes:
            key = (node.id, node.type)
            if key in visited:
                continue

            component = []
            stack = [key]
            while stack:
                curr = stack.pop()
                if curr in visited:
                    continue
                visited.add(curr)
                component.append({
                    "id": curr[0],
                    "type": curr[1],
                    "name": next((n.label for n in graph.nodes if n.id == curr[0] and n.type == curr[1]), ""),
                })
                for neighbor in adj.get(curr, set()):
                    if neighbor not in visited:
                        stack.append(neighbor)

            if component:
                clusters.append({
                    "cluster_id": cluster_id,
                    "members": component,
                    "size": len(component),
                })
                cluster_id += 1

        clusters.sort(key=lambda x: x["size"], reverse=True)
        return clusters

    # ==================== 内部数据加载 ====================

    async def _load_entities(
        self,
        entity_type: str,
        project_id: Optional[int] = None
    ) -> List[GraphNode]:
        """加载指定类型的所有实体为图谱节点"""
        if entity_type not in self.ENTITY_MODELS:
            return []

        model = self.ENTITY_MODELS[entity_type]
        stmt = select(model)
        if project_id is not None and hasattr(model, "project_id"):
            stmt = stmt.where(model.project_id == project_id)

        result = await self.db.execute(stmt)
        nodes = []
        for entity in result.scalars().all():
            props = {}
            for attr in ["description", "gender", "personality", "cultivation_realm",
                         "tier", "owner", "location", "importance", "type"]:
                val = getattr(entity, attr, None)
                if val is not None:
                    props[attr] = val

            nodes.append(GraphNode(
                id=entity.id,
                type=entity_type,
                label=getattr(entity, "name", f"{entity_type}_{entity.id}"),
                properties=props,
                color=self.NODE_COLORS.get(entity_type),
            ))
        return nodes

    async def _load_single_entity(
        self,
        entity_id: int,
        entity_type: str
    ) -> Optional[GraphNode]:
        """加载单个实体"""
        if entity_type not in self.ENTITY_MODELS:
            return None

        model = self.ENTITY_MODELS[entity_type]
        result = await self.db.execute(select(model).where(model.id == entity_id))
        entity = result.scalar_one_or_none()
        if not entity:
            return None

        return GraphNode(
            id=entity.id,
            type=entity_type,
            label=getattr(entity, "name", f"{entity_type}_{entity.id}"),
            properties={"description": getattr(entity, "description", None) or ""},
            color=self.NODE_COLORS.get(entity_type),
        )

    async def _load_character_relationships(
        self,
        project_id: Optional[int] = None
    ) -> List[GraphEdge]:
        """加载角色间显式关系边"""
        stmt = select(CharacterRelationship)
        if project_id is not None:
            stmt = stmt.where(CharacterRelationship.project_id == project_id)

        result = await self.db.execute(stmt)
        edges = []
        for rel in result.scalars().all():
            edges.append(GraphEdge(
                source=rel.character_id,
                target=rel.target_id,
                label=rel.type,
                type="character_relationship",
                properties={"description": rel.description or ""},
                directed=True,
            ))
        return edges

    async def _load_implicit_edges(
        self,
        nodes: List[GraphNode],
        project_id: Optional[int] = None
    ) -> List[GraphEdge]:
        """加载隐式关联边（基于属性引用）

        例如：物品.owner 引用角色名、角色与地点关联等
        """
        edges = []
        node_map = {(n.id, n.type): n for n in nodes}

        # 构建名称到节点的映射（用于模糊匹配）
        name_to_nodes: Dict[str, List[GraphNode]] = defaultdict(list)
        for n in nodes:
            name_to_nodes[n.label.lower()].append(n)

        # 检查物品.owner -> 角色
        if "item" in {n.type for n in nodes} and "character" in {n.type for n in nodes}:
            item_nodes = [n for n in nodes if n.type == "item"]
            char_nodes = [n for n in nodes if n.type == "character"]
            char_names = {n.label.lower(): n for n in char_nodes}

            for item_node in item_nodes:
                owner = item_node.properties.get("owner", "")
                if owner and owner.lower() in char_names:
                    char_node = char_names[owner.lower()]
                    edges.append(GraphEdge(
                        source=char_node.id,
                        target=item_node.id,
                        label="拥有",
                        type="ownership",
                        directed=True,
                    ))

        # 检查地点.importance 关联势力
        if "location" in {n.type for n in nodes} and "faction" in {n.type for n in nodes}:
            loc_nodes = [n for n in nodes if n.type == "location"]
            fac_nodes = [n for n in nodes if n.type == "faction"]
            fac_names = {n.label.lower(): n for n in fac_nodes}

            for loc_node in loc_nodes:
                importance = loc_node.properties.get("importance", "")
                if importance and importance.lower() in fac_names:
                    fac_node = fac_names[importance.lower()]
                    edges.append(GraphEdge(
                        source=fac_node.id,
                        target=loc_node.id,
                        label="控制/关联",
                        type="faction_location",
                        directed=True,
                    ))

        return edges

    async def _get_neighbors(
        self,
        entity_id: int,
        entity_type: str,
        project_id: Optional[int] = None
    ) -> List[Tuple[int, str, Dict[str, Any]]]:
        """获取实体的所有邻居

        Returns:
            List of (neighbor_id, neighbor_type, edge_info)
        """
        neighbors = []

        # 1. 角色关系邻居
        if entity_type == "character":
            # 作为 source 的关系
            stmt = select(CharacterRelationship).where(
                CharacterRelationship.character_id == entity_id
            )
            if project_id is not None:
                stmt = stmt.where(CharacterRelationship.project_id == project_id)
            result = await self.db.execute(stmt)
            for rel in result.scalars().all():
                neighbors.append((rel.target_id, "character", {
                    "label": rel.type,
                    "type": "character_relationship",
                    "properties": {"description": rel.description or ""},
                }))

            # 作为 target 的关系
            stmt2 = select(CharacterRelationship).where(
                CharacterRelationship.target_id == entity_id
            )
            if project_id is not None:
                stmt2 = stmt2.where(CharacterRelationship.project_id == project_id)
            result2 = await self.db.execute(stmt2)
            for rel in result2.scalars().all():
                neighbors.append((rel.character_id, "character", {
                    "label": rel.type,
                    "type": "character_relationship",
                    "properties": {"description": rel.description or ""},
                }))

        # 2. 隐式关联邻居（通过属性）
        if entity_type == "character":
            # 角色拥有的物品
            result = await self.db.execute(select(Item))
            if project_id is not None:
                result = await self.db.execute(select(Item).where(Item.project_id == project_id))
            else:
                result = await self.db.execute(select(Item))

            char_result = await self.db.execute(
                select(Character).where(Character.id == entity_id)
            )
            char = char_result.scalar_one_or_none()
            char_name = char.name if char else ""

            for item in result.scalars().all():
                if item.owner and char_name and item.owner.lower() == char_name.lower():
                    neighbors.append((item.id, "item", {
                        "label": "拥有",
                        "type": "ownership",
                    }))

        elif entity_type == "item":
            # 物品关联的角色（owner）
            item_result = await self.db.execute(select(Item).where(Item.id == entity_id))
            item = item_result.scalar_one_or_none()
            if item and item.owner:
                char_result = await self.db.execute(
                    select(Character).where(Character.name == item.owner)
                )
                if project_id is not None:
                    char_result = await self.db.execute(
                        select(Character).where(
                            Character.name == item.owner,
                            Character.project_id == project_id
                        )
                    )
                char = char_result.scalar_one_or_none()
                if char:
                    neighbors.append((char.id, "character", {
                        "label": "拥有者",
                        "type": "ownership",
                    }))

        return neighbors

    def _compute_node_sizes(self, graph: GraphData) -> None:
        """根据连接度计算节点大小"""
        degree: Dict[int, int] = defaultdict(int)
        for edge in graph.edges:
            degree[edge.source] += 1
            degree[edge.target] += 1

        for node in graph.nodes:
            node.size = 1 + min(degree.get(node.id, 0), 10)  # 最大 11

    def _infer_type(self, entity_id: int, nodes: List[GraphNode]) -> Optional[str]:
        """从节点列表推断实体类型"""
        for n in nodes:
            if n.id == entity_id:
                return n.type
        return None

    def _approx_betweenness(
        self,
        target_key: Tuple[int, str],
        adj: Dict[Tuple[int, str], List[Tuple[int, str]]],
        nodes: List[GraphNode]
    ) -> float:
        """近似 betweenness centrality（基于采样）"""
        all_nodes = [(n.id, n.type) for n in nodes]
        if len(all_nodes) < 3:
            return 0.0

        import random
        sample_size = min(50, len(all_nodes))
        sampled = random.sample(all_nodes, sample_size)

        count = 0
        total_paths = 0

        for start in sampled:
            for end in sampled:
                if start == end or start == target_key or end == target_key:
                    continue
                # BFS 找最短路径
                path = self._bfs_path(start, end, adj)
                if path and target_key in path:
                    count += 1
                if path:
                    total_paths += 1

        return count / max(total_paths, 1)

    def _bfs_path(
        self,
        start: Tuple[int, str],
        end: Tuple[int, str],
        adj: Dict[Tuple[int, str], List[Tuple[int, str]]]
    ) -> Optional[List[Tuple[int, str]]]:
        """BFS 找最短路径，返回路径上的节点列表"""
        if start == end:
            return [start]

        queue = deque([(start, [start])])
        visited = {start}

        while queue:
            curr, path = queue.popleft()
            for neighbor in adj.get(curr, []):
                if neighbor in visited:
                    continue
                new_path = path + [neighbor]
                if neighbor == end:
                    return new_path
                visited.add(neighbor)
                queue.append((neighbor, new_path))

        return None

    # ==================== NetworkX 图分析（来自 GraphAnalyzer） ====================

    def build_networkx_graph(
        self,
        graph_data: GraphData,
        *,
        _entity_id_to_type: Optional[Dict[int, str]] = None,
    ) -> Tuple[Any, Any]:
        """将 GraphData 转换为 NetworkX 有向图和无向图

        Args:
            graph_data: 图谱数据（节点+边）
            _entity_id_to_type: 可选的预构建 id->type 映射（O(1)查找）

        Returns:
            (DiGraph, Graph) 元组
        """
        if not _HAS_NETWORKX:
            logger.warning("NetworkX not installed, cannot build NetworkX graph")
            return None, None

        # 构建 O(1) 实体类型查找索引
        if _entity_id_to_type is None:
            _entity_id_to_type = {node.id: node.type for node in graph_data.nodes}

        G = nx.DiGraph()
        undirected_G = nx.Graph()

        _node_key_to_id_type: Dict[str, Tuple[int, str]] = {}
        _id_type_to_node_key: Dict[Tuple[int, str], str] = {}

        def _node_key(entity_id: int, entity_type: str) -> str:
            return f"{entity_type}:{entity_id}"

        try:
            # 添加节点
            for node in graph_data.nodes:
                key = _node_key(node.id, node.type)
                node_attrs = dict(
                    id=node.id,
                    type=node.type,
                    label=node.label,
                    **node.properties,
                )
                G.add_node(key, **node_attrs)
                undirected_G.add_node(key, **node_attrs)
                _node_key_to_id_type[key] = (node.id, node.type)
                _id_type_to_node_key[(node.id, node.type)] = key

            # 添加边
            for edge in graph_data.edges:
                src_type = _entity_id_to_type.get(edge.source)
                tgt_type = _entity_id_to_type.get(edge.target)
                src_key = _id_type_to_node_key.get((edge.source, src_type)) if src_type else None
                tgt_key = _id_type_to_node_key.get((edge.target, tgt_type)) if tgt_type else None
                if src_key and tgt_key:
                    edge_attrs = dict(
                        label=edge.label,
                        type=edge.type,
                        directed=edge.directed,
                        **edge.properties,
                    )
                    G.add_edge(src_key, tgt_key, **edge_attrs)
                    undirected_G.add_edge(src_key, tgt_key, **edge_attrs)

            logger.info(
                f"Built NetworkX graph with {G.number_of_nodes()} nodes "
                f"and {G.number_of_edges()} edges"
            )
        except Exception as e:
            logger.error(f"Failed to build NetworkX graph: {e}")

        # 将辅助映射附加到图对象上，供后续方法使用
        G._node_key_to_id_type = _node_key_to_id_type
        G._id_type_to_node_key = _id_type_to_node_key
        undirected_G._node_key_to_id_type = _node_key_to_id_type
        undirected_G._id_type_to_node_key = _id_type_to_node_key

        return G, undirected_G

    def nx_shortest_path(
        self,
        graph_data: GraphData,
        source_id: int,
        source_type: str,
        target_id: int,
        target_type: str,
        directed: bool = False,
    ) -> Optional[List[Dict[str, Any]]]:
        """NetworkX 最短路径查询

        Args:
            graph_data: 图谱数据
            source_id: 起始实体ID
            source_type: 起始实体类型
            target_id: 目标实体ID
            target_type: 目标实体类型
            directed: 是否考虑边的方向

        Returns:
            路径节点列表，每项包含 id, type, label
            未找到路径时返回 None
        """
        if not _HAS_NETWORKX:
            logger.warning("NetworkX not installed, cannot use nx_shortest_path")
            return None

        G, undirected_G = self.build_networkx_graph(graph_data)
        if not G:
            return None

        _id_type_to_node_key = G._id_type_to_node_key

        src_key = _id_type_to_node_key.get((source_id, source_type))
        tgt_key = _id_type_to_node_key.get((target_id, target_type))

        if not src_key or not tgt_key:
            logger.warning(f"Node not found: {source_type}:{source_id} or {target_type}:{target_id}")
            return None

        try:
            g = G if directed else undirected_G
            path_keys = nx.shortest_path(g, src_key, tgt_key)

            return [
                {
                    "id": G.nodes[k].get("id"),
                    "type": G.nodes[k].get("type"),
                    "label": G.nodes[k].get("label"),
                }
                for k in path_keys
            ]
        except nx.NetworkXNoPath:
            logger.debug(f"No path found between {source_type}:{source_id} and {target_type}:{target_id}")
            return None
        except nx.NodeNotFound as e:
            logger.warning(f"Node not found in graph: {e}")
            return None

    def all_paths(
        self,
        graph_data: GraphData,
        source_id: int,
        source_type: str,
        target_id: int,
        target_type: str,
        max_depth: int = 5,
        directed: bool = False,
    ) -> List[List[Dict[str, Any]]]:
        """查找两个实体间的所有简单路径（限深度）

        Args:
            graph_data: 图谱数据
            source_id: 起始实体ID
            source_type: 起始实体类型
            target_id: 目标实体ID
            target_type: 目标实体类型
            max_depth: 最大路径深度
            directed: 是否考虑边的方向

        Returns:
            所有有效路径的列表
        """
        if not _HAS_NETWORKX:
            logger.warning("NetworkX not installed, cannot use all_paths")
            return []

        G, undirected_G = self.build_networkx_graph(graph_data)
        if not G:
            return []

        _id_type_to_node_key = G._id_type_to_node_key

        src_key = _id_type_to_node_key.get((source_id, source_type))
        tgt_key = _id_type_to_node_key.get((target_id, target_type))

        if not src_key or not tgt_key:
            return []

        try:
            g = G if directed else undirected_G
            path_keys_list = list(
                nx.all_simple_paths(g, src_key, tgt_key, cutoff=max_depth)
            )

            return [
                [
                    {
                        "id": G.nodes[k].get("id"),
                        "type": G.nodes[k].get("type"),
                        "label": G.nodes[k].get("label"),
                    }
                    for k in path_keys
                ]
                for path_keys in path_keys_list
            ]
        except (nx.NodeNotFound, nx.NetworkXError) as e:
            logger.warning(f"Error finding all paths: {e}")
            return []

    def find_reachable(
        self,
        graph_data: GraphData,
        source_id: int,
        source_type: str,
        max_depth: int = 3,
        directed: bool = False,
    ) -> List[Dict[str, Any]]:
        """查找从指定实体可达的所有节点

        Args:
            graph_data: 图谱数据
            source_id: 起始实体ID
            source_type: 起始实体类型
            max_depth: 最大深度
            directed: 是否考虑边的方向

        Returns:
            可达节点列表（去重）
        """
        if not _HAS_NETWORKX:
            logger.warning("NetworkX not installed, cannot use find_reachable")
            return []

        G, undirected_G = self.build_networkx_graph(graph_data)
        if not G:
            return []

        _id_type_to_node_key = G._id_type_to_node_key

        src_key = _id_type_to_node_key.get((source_id, source_type))
        if not src_key:
            return []

        try:
            g = G if directed else undirected_G
            reachable_keys: Set[str] = set()

            for depth in range(1, max_depth + 1):
                nodes_at_depth = nx.nodes_at_distance(g, src_key, depth)
                reachable_keys.update(nodes_at_depth)

            return [
                {
                    "id": G.nodes[k].get("id"),
                    "type": G.nodes[k].get("type"),
                    "label": G.nodes[k].get("label"),
                    "distance": nx.shortest_path_length(g, src_key, k) if g.has_node(k) else None,
                }
                for k in reachable_keys
                if k != src_key
            ]
        except nx.NetworkXError as e:
            logger.warning(f"Error finding reachable nodes: {e}")
            return []

    def community_detection(
        self,
        graph_data: GraphData,
        method: str = "connected_components",
    ) -> List[List[Dict[str, Any]]]:
        """社区检测（社群发现）

        Args:
            graph_data: 图谱数据
            method: 检测方法
                - "connected_components": 无向连通分量（默认）
                - "weakly_connected": 有向弱连通分量
                - "label_propagation": 标签传播算法

        Returns:
            社区列表，每项是节点列表
        """
        if not _HAS_NETWORKX:
            logger.warning("NetworkX not installed, cannot use community_detection")
            return []

        G, undirected_G = self.build_networkx_graph(graph_data)
        if not undirected_G:
            return []

        try:
            if method == "connected_components":
                components = list(nx.connected_components(undirected_G))
            elif method == "weakly_connected" and G:
                components = list(nx.weakly_connected_components(G))
            elif method == "label_propagation":
                components = list(nx.label_propagation_communities(undirected_G))
            else:
                components = list(nx.connected_components(undirected_G))

            return [
                [
                    {
                        "id": undirected_G.nodes[k].get("id"),
                        "type": undirected_G.nodes[k].get("type"),
                        "label": undirected_G.nodes[k].get("label"),
                    }
                    for k in component
                ]
                for component in components
            ]
        except nx.NetworkXError as e:
            logger.warning(f"Error in community detection ({method}): {e}")
            return []

    def find_cliques(
        self,
        graph_data: GraphData,
        min_size: int = 3,
    ) -> List[List[Dict[str, Any]]]:
        """查找图中所有极大团（cliques）

        Args:
            graph_data: 图谱数据
            min_size: 最小团大小

        Returns:
            团列表
        """
        if not _HAS_NETWORKX:
            logger.warning("NetworkX not installed, cannot use find_cliques")
            return []

        _, undirected_G = self.build_networkx_graph(graph_data)
        if not undirected_G:
            return []

        try:
            cliques = list(nx.find_cliques(undirected_G))
            return [
                [
                    {
                        "id": undirected_G.nodes[k].get("id"),
                        "type": undirected_G.nodes[k].get("type"),
                        "label": undirected_G.nodes[k].get("label"),
                    }
                    for k in clique
                ]
                for clique in cliques
                if len(clique) >= min_size
            ]
        except nx.NetworkXError as e:
            logger.warning(f"Error finding cliques: {e}")
            return []

    def nx_centrality(
        self,
        graph_data: GraphData,
        metric: str = "degree",
    ) -> Dict[Tuple[int, str], float]:
        """NetworkX 中心性分析

        Args:
            graph_data: 图谱数据
            metric: 中心性指标
                - "degree": 度中心性（邻居数量）
                - "betweenness": 介数中心性
                - "closeness": 接近中心性
                - "pagerank": PageRank

        Returns:
            Dict[(entity_id, entity_type), score]
        """
        if not _HAS_NETWORKX:
            logger.warning("NetworkX not installed, cannot use nx_centrality")
            return {}

        G, undirected_G = self.build_networkx_graph(graph_data)
        if not G or not undirected_G:
            return {}

        _node_key_to_id_type = G._node_key_to_id_type

        try:
            g = undirected_G if metric != "pagerank" else G

            if metric == "degree":
                scores = nx.degree_centrality(g)
            elif metric == "betweenness":
                scores = nx.betweenness_centrality(g)
            elif metric == "closeness":
                scores = nx.closeness_centrality(g)
            elif metric == "pagerank":
                scores = nx.pagerank(G)
            else:
                scores = nx.degree_centrality(g)

            result: Dict[Tuple[int, str], float] = {}
            for key, score in scores.items():
                id_type = _node_key_to_id_type.get(key)
                if id_type:
                    result[id_type] = round(score, 4)

            return result
        except nx.NetworkXError as e:
            logger.warning(f"Error computing centrality ({metric}): {e}")
            return {}

    def top_centrality(
        self,
        graph_data: GraphData,
        metric: str = "degree",
        top_n: int = 10,
        entity_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """获取中心性最高的节点

        Args:
            graph_data: 图谱数据
            metric: 中心性指标
            top_n: 返回前N个
            entity_type: 过滤实体类型

        Returns:
            排序后的节点列表
        """
        all_scores = self.nx_centrality(graph_data, metric)

        filtered = [
            {"id": id_type[0], "type": id_type[1], "score": score}
            for id_type, score in all_scores.items()
            if entity_type is None or id_type[1] == entity_type
        ]

        filtered.sort(key=lambda x: x["score"], reverse=True)
        return filtered[:top_n]

    def graph_stats(self, graph_data: GraphData) -> Dict[str, Any]:
        """获取图的基本统计信息

        Args:
            graph_data: 图谱数据

        Returns:
            统计信息字典
        """
        if not _HAS_NETWORKX:
            logger.warning("NetworkX not installed, cannot use graph_stats")
            return {}

        G, undirected_G = self.build_networkx_graph(graph_data)
        if not G:
            return {}

        return {
            "num_nodes": G.number_of_nodes(),
            "num_edges": G.number_of_edges(),
            "num_undirected_edges": undirected_G.number_of_edges() if undirected_G else 0,
            "density": nx.density(G) if G else 0,
            "is_directed": G.is_directed(),
            "is_connected": nx.is_connected(undirected_G) if undirected_G else False,
            "num_connected_components": (
                nx.number_connected_components(undirected_G)
                if undirected_G else 0
            ),
            "node_types": self._count_by_type(graph_data),
        }

    def _count_by_type(self, graph_data: GraphData) -> Dict[str, int]:
        """统计各类型节点数量"""
        counts: Dict[str, int] = {}
        for node in graph_data.nodes:
            counts[node.type] = counts.get(node.type, 0) + 1
        return counts
