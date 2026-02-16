"""Graph reasoning agent backed by knowledge graph."""

from __future__ import annotations

from typing import Optional

from src.utils import logger


class GraphAgent:
    """Knowledge graph query and reasoning agent."""

    def execute(self, query: str) -> dict:
        """Execute graph query and return structured result."""

        from src.knowledge_graph import get_knowledge_graph_builder

        kg = get_knowledge_graph_builder()

        if "故障" in query and ("原因" in query or "因果" in query):
            causes = kg.query_fault_causes(query)
            center = causes[0]["fault_id"] if causes else ""
            graph = kg.get_subgraph_for_visualization(center, depth=2) if center else {"nodes": [], "edges": []}
            return {
                "query_type": "fault_causal",
                "causes": causes,
                "graph": graph,
            }

        if "标准" in query or "规范" in query:
            standards = kg.find_related_standards(query)
            return {
                "query_type": "standards",
                "standards": standards,
            }

        if "管道" in query and ("链路" in query or "设备" in query):
            chain = kg.query_equipment_chain(query)
            return {
                "query_type": "equipment_chain",
                "chain": chain,
            }

        # generic fallback: fuzzy node match via subgraph
        node_ids = kg.match_nodes_by_text(query)
        if not node_ids:
            return {
                "query_type": "generic",
                "message": "未找到匹配的图谱实体",
                "graph": {"nodes": [], "edges": []},
            }

        graph = kg.get_subgraph_for_visualization(node_ids[0], depth=2)
        return {
            "query_type": "generic",
            "center_node": node_ids[0],
            "graph": graph,
        }


_graph_agent: Optional[GraphAgent] = None


def get_graph_agent() -> GraphAgent:
    """Return singleton graph agent."""

    global _graph_agent
    if _graph_agent is None:
        _graph_agent = GraphAgent()
    return _graph_agent
