"""
枚举定义
"""

from enum import Enum


class IntentType(str, Enum):
    """用户意图类型"""
    QUERY = "query"           # 数据查询
    CALCULATE = "calculate"   # 数值计算
    KNOWLEDGE = "knowledge"   # 知识问答
    COMPLEX = "complex"       # 复合任务
    CHAT = "chat"            # 闲聊


class AgentType(str, Enum):
    """Agent类型"""
    SUPERVISOR = "supervisor"
    DATA_AGENT = "data_agent"
    CALC_AGENT = "calc_agent"
    KNOWLEDGE_AGENT = "knowledge_agent"


class TaskStatus(str, Enum):
    """子任务状态"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class FlowRegime(str, Enum):
    """流态类型"""
    LAMINAR = "laminar"               # 层流 Re < 2000
    TRANSITIONAL = "transitional"     # 过渡区 2000 <= Re <= 3000
    SMOOTH_TURBULENT = "smooth"       # 光滑区湍流
    MIXED_FRICTION = "mixed"          # 混合摩擦区
    ROUGH_TURBULENT = "rough"         # 粗糙区湍流


class RetrievalQuality(str, Enum):
    """CRAG检索质量评估"""
    HIGH = "high"       # 直接使用
    MEDIUM = "medium"   # 需要精炼
    LOW = "low"         # 需要降级/Web搜索


class KnowledgeCategory(str, Enum):
    """知识库分类"""
    STANDARDS = "standards"     # 技术规范
    FORMULAS = "formulas"       # 计算原理
    OPERATIONS = "operations"   # 操作指南
    CASES = "cases"            # 案例分析
    FAQ = "faq"                # 常见问题
