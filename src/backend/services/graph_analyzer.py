# Auto Novel Writer - Graph Analyzer
# NetworkX-based graph analysis for entity relationship graphs
# Provides path queries, community detection, and centrality analysis

from __future__ import annotations

import logging
from typing import Dict, List, Optional, Set, Tuple, Any

import networkx as nx

from backend.services.graph_service import GraphData, GraphNode, GraphEdge

logger = logging.getLogger(__name__)


class GraphAnalyzer:
    """基于 NetworkX 的图分析器

    提供以下功能：
    - 最短路径查询
    - 全路径查询（限深度）
    - 社区检测（连通分量）
    - 中心性分析（度中心性、介数中心性、接近中心性）
    """

    def __init__(self, graph_data: GraphData):
        """初始化分析器

        Args:
            graph_data: 图谱数据（节点+边）
        """
        self.graph_data = graph_data
        self.G: Optional[nx.DiGraph] = None
        self.undirected_G: Optional[nx.Graph] = None
        self._node_key_to_id_type: Dict[Tuple[int, str], str] = {}
        self._id_type_to_node_key: Dict[Tuple[int, str], str] = {}
        self._build_networkx_graph()

    def _node_key(self, entity_id: int, entity_type: str) -> str:
        """生成节点唯一键"""
        return f"{entity_type}:{entity_id}"

    def _parse_node_key(self, key: str) -> Tuple[int, str]:
        """解析节点键为 (id, type)"""
        parts = key.split(":", 1)
        return int(parts[1]), parts[0]

    def _build_networkx_graph(self) -> None:
        """将 GraphData 转换为 NetworkX 有向图和无向图"""
        try:
            self.G = nx.DiGraph()
            self.undirected_G = nx.Graph()

            # 添加节点
            for node in self.graph_data.nodes:
                key = self._node_key(node.id, node.type)
                self.G.add_node(
                    key,
                    id=node.id,
                    type=node.type,
                    label=node.label,
                    **node.properties
                )
                self.undirected_G.add_node(
                    key,
                    id=node.id,
                    type=node.type,
                    label=node.label,
                    **node.properties
                )
                self._node_key_to_id_type[key] = (node.id, node.type)
                self._id_type_to_node_key[(node.id, node.type)] = key

            # 添加边
            for edge in self.graph_data.edges:
                src_key = self._id_type_to_node_key.get((edge.source, self._infer_type(edge.source)))
                tgt_key = self._id_type_to_node_key.get((edge.target, self._infer_type(edge.target)))
                if src_key and tgt_key:
                    self.G.add_edge(
                        src_key, tgt_key,
                        label=edge.label,
                        type=edge.type,
                        directed=edge.directed,
                        **edge.properties
                    )
                    if not edge.directed:
                        self.undirected_G.add_edge(src_key, tgt_key, **edge.properties)
                    else:
                        self.undirected_G.add_edge(src_key, tgt_key, **edge.properties)

            logger.info(
                f"Built NetworkX graph with {self.G.number_of_nodes()} nodes "
                f"and {self.G.number_of_edges()} edges"
            )
        except Exception as e:
            logger.error(f"Failed to build NetworkX graph: {e}")
            self.G = nx.DiGraph()
            self.undirected_G = nx.Graph()

    def _infer_type(self, entity_id: int) -> Optional[str]:
        """从图数据推断实体类型"""
        for node in self.graph_data.nodes:
            if node.id == entity_id:
                return node.type
        return None

    # ==================== 路径查询 ====================

    def shortest_path(
        self,
        source_id: int,
        source_type: str,
        target_id: int,
        target_type: str,
        directed: bool = False
    ) -> Optional[List[Dict[str, Any]]]:
        """查找两个实体间的最短路径

        Args:
            source_id: 起始实体ID
            source_type: 起始实体类型
            target_id: 目标实体ID
            target_type: 目标实体类型
            directed: 是否考虑边的方向

        Returns:
            路径节点列表，每项包含 id, type, label
            未找到路径时返回 None
        """
        if not self.G:
            return None

        src_key = self._id_type_to_node_key.get((source_id, source_type))
        tgt_key = self._id_type_to_node_key.get((target_id, target_type))

        if not src_key or not tgt_key:
            logger.warning(f"Node not found: {source_type}:{source_id} or {target_type}:{target_id}")
            return None

        try:
            G = self.G if directed else self.undirected_G
            path_keys = nx.shortest_path(G, src_key, tgt_key)

            return [
                {
                    "id": self.G.nodes[k].get("id"),
                    "type": self.G.nodes[k].get("type"),
                    "label": self.G.nodes[k].get("label"),
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
        source_id: int,
        source_type: str,
        target_id: int,
        target_type: str,
        max_depth: int = 5,
        directed: bool = False
    ) -> List[List[Dict[str, Any]]]:
        """查找两个实体间的所有简单路径（限深度）

        Args:
            source_id: 起始实体ID
            source_type: 起始实体类型
            target_id: 目标实体ID
            target_type: 目标实体类型
            max_depth: 最大路径深度
            directed: 是否考虑边的方向

        Returns:
            所有有效路径的列表
        """
        if not self.G:
            return []

        src_key = self._id_type_to_node_key.get((source_id, source_type))
        tgt_key = self._id_type_to_node_key.get((target_id, target_type))

        if not src_key or not tgt_key:
            return []

        try:
            G = self.G if directed else self.undirected_G
            path_keys_list = list(
                nx.all_simple_paths(G, src_key, tgt_key, cutoff=max_depth)
            )

            return [
                [
                    {
                        "id": self.G.nodes[k].get("id"),
                        "type": self.G.nodes[k].get("type"),
                        "label": self.G.nodes[k].get("label"),
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
        source_id: int,
        source_type: str,
        max_depth: int = 3,
        directed: bool = False
    ) -> List[Dict[str, Any]]:
        """查找从指定实体可达的所有节点

        Args:
            source_id: 起始实体ID
            source_type: 起始实体类型
            max_depth: 最大深度
            directed: 是否考虑边的方向

        Returns:
            可达节点列表（去重）
        """
        if not self.G:
            return []

        src_key = self._id_type_to_node_key.get((source_id, source_type))
        if not src_key:
            return []

        try:
            G = self.G if directed else self.undirected_G
            reachable_keys = set()

            for depth in range(1, max_depth + 1):
                nodes_at_depth = nx.nodes_at_distance(G, src_key, depth)
                reachable_keys.update(nodes_at_depth)

            return [
                {
                    "id": self.G.nodes[k].get("id"),
                    "type": self.G.nodes[k].get("type"),
                    "label": self.G.nodes[k].get("label"),
                    "distance": nx.shortest_path_length(G, src_key, k) if G.has_node(k) else None,
                }
                for k in reachable_keys
                if k != src_key
            ]
        except nx.NetworkXError as e:
            logger.warning(f"Error finding reachable nodes: {e}")
            return []

    # ==================== 社区检测 ====================

    def community_detection(self, method: str = "connected_components") -> List[List[Dict[str, Any]]]:
        """社区检测（社群发现）

        Args:
            method: 检测方法
                - "connected_components": 无向连通分量（默认）
                - "weakly_connected": 有向弱连通分量
                - "label_propagation": 标签传播算法

        Returns:
            社区列表，每项是节点列表
        """
        if not self.undirected_G:
            return []

        try:
            if method == "connected_components":
                components = list(nx.connected_components(self.undirected_G))
            elif method == "weakly_connected" and self.G:
                components = list(nx.weakly_connected_components(self.G))
            elif method == "label_propagation":
                components = list(nx.label_propagation_communities(self.undirected_G))
            else:
                components = list(nx.connected_components(self.undirected_G))

            return [
                [
                    {
                        "id": self.undirected_G.nodes[k].get("id"),
                        "type": self.undirected_G.nodes[k].get("type"),
                        "label": self.undirected_G.nodes[k].get("label"),
                    }
                    for k in component
                ]
                for component in components
            ]
        except nx.NetworkXError as e:
            logger.warning(f"Error in community detection ({method}): {e}")
            return []

    def find_cliques(self, min_size: int = 3) -> List[List[Dict[str, Any]]]:
        """查找图中所有极大团（cliques）

        Args:
            min_size: 最小团大小

        Returns:
            团列表
        """
        if not self.undirected_G:
            return []

        try:
            cliques = list(nx.find_cliques(self.undirected_G))
            return [
                [
                    {
                        "id": self.undirected_G.nodes[k].get("id"),
                        "type": self.undirected_G.nodes[k].get("type"),
                        "label": self.undirected_G.nodes[k].get("label"),
                    }
                    for k in clique
                ]
                for clique in cliques
                if len(clique) >= min_size
            ]
        except nx.NetworkXError as e:
            logger.warning(f"Error finding cliques: {e}")
            return []

    # ==================== 中心性分析 ====================

    def centrality(self, metric: str = "degree") -> Dict[Tuple[int, str], float]:
        """计算节点中心性

        Args:
            metric: 中心性指标
                - "degree": 度中心性（邻居数量）
                - "betweenness": 介数中心性
                - "closeness": 接近中心性
                - "pagerank": PageRank

        Returns:
            Dict[(entity_id, entity_type), score]
        """
        if not self.G or not self.undirected_G:
            return {}

        try:
            G = self.undirected_G if metric != "pagerank" else self.G

            if metric == "degree":
                scores = nx.degree_centrality(G)
            elif metric == "betweenness":
                scores = nx.betweenness_centrality(G)
            elif metric == "closeness":
                scores = nx.closeness_centrality(G)
            elif metric == "pagerank":
                scores = nx.pagerank(self.G)
            else:
                scores = nx.degree_centrality(G)

            result = {}
            for key, score in scores.items():
                id_type = self._node_key_to_id_type.get(key)
                if id_type:
                    result[id_type] = round(score, 4)

            return result
        except nx.NetworkXError as e:
            logger.warning(f"Error computing centrality ({metric}): {e}")
            return {}

    def top_centrality(
        self,
        metric: str = "degree",
        top_n: int = 10,
        entity_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """获取中心性最高的节点

        Args:
            metric: 中心性指标
            top_n: 返回前N个
            entity_type: 过滤实体类型

        Returns:
            排序后的节点列表
        """
        all_scores = self.centrality(metric)

        filtered = [
            {"id": id_type[0], "type": id_type[1], "score": score}
            for id_type, score in all_scores.items()
            if entity_type is None or id_type[1] == entity_type
        ]

        filtered.sort(key=lambda x: x["score"], reverse=True)
        return filtered[:top_n]

    # ==================== 图统计 ====================

    def graph_stats(self) -> Dict[str, Any]:
        """获取图的基本统计信息

        Returns:
            统计信息字典
        """
        if not self.G:
            return {}

        return {
            "num_nodes": self.G.number_of_nodes(),
            "num_edges": self.G.number_of_edges(),
            "num_undirected_edges": self.undirected_G.number_of_edges() if self.undirected_G else 0,
            "density": nx.density(self.G) if self.G else 0,
            "is_directed": self.G.is_directed(),
            "is_connected": nx.is_connected(self.undirected_G) if self.undirected_G else False,
            "num_connected_components": (
                nx.number_connected_components(self.undirected_G)
                if self.undirected_G else 0
            ),
            "node_types": self._count_by_type(),
        }

    def _count_by_type(self) -> Dict[str, int]:
        """统计各类型节点数量"""
        counts: Dict[str, int] = {}
        for node in self.graph_data.nodes:
            counts[node.type] = counts.get(node.type, 0) + 1
        return counts
