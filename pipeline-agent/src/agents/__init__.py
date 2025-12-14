"""
Agent!W
ž°AgentO\ûß
"""

from .prompts import (
    SUPERVISOR_SYSTEM_PROMPT,
    DATA_AGENT_SYSTEM_PROMPT,
    CALC_AGENT_SYSTEM_PROMPT,
    KNOWLEDGE_AGENT_SYSTEM_PROMPT,
    SYNTHESIS_PROMPT
)

from .supervisor import (
    SupervisorAgent,
    get_supervisor
)

from .data_agent import (
    DataAgent,
    get_data_agent
)

from .calc_agent import (
    CalcAgent,
    get_calc_agent
)

from .knowledge_agent import (
    KnowledgeAgent,
    get_knowledge_agent
)

__all__ = [
    # Prompts
    "SUPERVISOR_SYSTEM_PROMPT",
    "DATA_AGENT_SYSTEM_PROMPT",
    "CALC_AGENT_SYSTEM_PROMPT",
    "KNOWLEDGE_AGENT_SYSTEM_PROMPT",
    "SYNTHESIS_PROMPT",
    # Agents
    "SupervisorAgent",
    "get_supervisor",
    "DataAgent",
    "get_data_agent",
    "CalcAgent",
    "get_calc_agent",
    "KnowledgeAgent",
    "get_knowledge_agent"
]
