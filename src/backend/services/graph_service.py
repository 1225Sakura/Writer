# Auto Novel Writer - Graph Service
# Build entity relationship graph, support multi-hop queries
# Uses existing Character/Item/Location/Faction/CharacterRelationship tables

from __future__ import annotations

import json
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from backend.core.domain import (
    Character, Item, Location, Faction, CharacterRelationship
)


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
