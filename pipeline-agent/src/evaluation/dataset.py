"""标准化评测数据集。"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EvalCase:
    id: str
    category: str
    input: str
    expected_tools: list[str]
    expected_keywords: list[str]
    expected_intent: str
    difficulty: str
    description: str


EVAL_DATASET: list[EvalCase] = [
    EvalCase(
        id="DQ-001",
        category="data_query",
        input="查一下项目1的管道参数",
        expected_tools=["query_database"],
        expected_keywords=["管道"],
        expected_intent="query",
        difficulty="easy",
        description="简单数据查询",
    ),
    EvalCase(
        id="DQ-002",
        category="data_query",
        input="所有项目的泵站效率对比",
        expected_tools=["query_database"],
        expected_keywords=["泵站", "效率"],
        expected_intent="query",
        difficulty="medium",
        description="多记录对比查询",
    ),
    EvalCase(
        id="CA-001",
        category="calculation",
        input="帮我做一下项目1的水力分析，流量900，温度25度",
        expected_tools=["query_database", "hydraulic_calculation"],
        expected_keywords=["流量"],
        expected_intent="calculate",
        difficulty="medium",
        description="标准水力分析",
    ),
    EvalCase(
        id="CA-002",
        category="calculation",
        input="对比流量800和900时的水力参数差异",
        expected_tools=["query_database", "hydraulic_calculation"],
        expected_keywords=["对比", "差异"],
        expected_intent="calculate",
        difficulty="hard",
        description="方案对比分析",
    ),
    EvalCase(
        id="KB-001",
        category="knowledge",
        input="管道水力计算的基本公式有哪些",
        expected_tools=["search_knowledge_base"],
        expected_keywords=["公式"],
        expected_intent="knowledge",
        difficulty="easy",
        description="知识库基础问题",
    ),
    EvalCase(
        id="FD-001",
        category="fault",
        input="泵站压力异常波动是什么原因",
        expected_tools=["query_fault_cause"],
        expected_keywords=["原因"],
        expected_intent="knowledge",
        difficulty="medium",
        description="故障因果分析",
    ),
    EvalCase(
        id="CH-001",
        category="chat",
        input="你好",
        expected_tools=[],
        expected_keywords=["好"],
        expected_intent="chat",
        difficulty="easy",
        description="问候语识别",
    ),
]
