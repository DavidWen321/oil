"""
知识图谱 Agent — 通过 query_type 参数决定查询类型，不做关键词路由。
query_type 由 agent_tools.py 中的 3 个独立工具传入，
而这 3 个工具由 ReAct 主图的 LLM 自主选择调用。
"""

from __future__ import annotations

import threading
import json
from typing import Any, Optional

from src.utils import logger


class GraphAgent:
    """知识图谱查询 Agent。"""

    def __init__(self):
        self._graph = None

    def _get_graph(self):
        """懒加载知识图谱实例。"""
        if self._graph is None:
            try:
                from src.knowledge_graph import get_knowledge_graph_builder

                self._graph = get_knowledge_graph_builder()
            except Exception as e:
                logger.error(f"Failed to load knowledge graph: {e}")
                self._graph = None
        return self._graph

    def execute(self, query: str, query_type: Optional[str] = None) -> Any:
        """
        执行知识图谱查询。

        Args:
            query: 用户的查询文本
            query_type: 查询类型，由调用方（agent_tools.py 中的工具）指定：
                - "fault_cause": 故障因果推理
                - "standards": 标准规范查询
                - "equipment_chain": 设备关联链路查询
                - None: 综合查询（模糊匹配）

        Returns:
            query_type 指定时返回文本（供工具调用）；
            query_type 为 None 时返回结构化结果（兼容 /graph/query 接口）。
        """
        graph = self._get_graph()
        if graph is None:
            return "知识图谱服务不可用，请稍后重试。"

        try:
            if query_type == "fault_cause":
                # 当前项目方法名为 query_fault_causes
                result = graph.query_fault_causes(query)
            elif query_type == "standards":
                # 当前项目方法名为 find_related_standards
                result = graph.find_related_standards(query)
            elif query_type == "equipment_chain":
                result = graph.query_equipment_chain(query)
            else:
                # 综合查询：优先使用 query_fuzzy（若存在），否则走文本匹配+子图
                if hasattr(graph, "query_fuzzy"):
                    result = graph.query_fuzzy(query)
                else:
                    node_ids = graph.match_nodes_by_text(query)
                    if not node_ids:
                        result = {"message": f"未找到与 '{query}' 相关的知识图谱信息。"}
                    else:
                        result = graph.get_subgraph_for_visualization(node_ids[0], depth=2)

            if not result:
                return f"未找到与 '{query}' 相关的知识图谱信息。"

            # 兼容旧的 /graph/query 接口：保持结构化对象返回
            if query_type is None:
                if isinstance(result, dict):
                    return result
                return {"result": result}

            if isinstance(result, (dict, list)):
                return json.dumps(result, ensure_ascii=False)
            return str(result)

        except Exception as e:
            logger.error(f"GraphAgent execute failed: {e}")
            return f"知识图谱查询失败: {str(e)}"


# 单例
_graph_agent: Optional[GraphAgent] = None
_graph_agent_lock = threading.Lock()


def get_graph_agent() -> GraphAgent:
    global _graph_agent
    if _graph_agent is None:
        with _graph_agent_lock:
            if _graph_agent is None:
                _graph_agent = GraphAgent()
    return _graph_agent
