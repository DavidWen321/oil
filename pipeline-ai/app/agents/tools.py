from langchain.tools import Tool
from langchain.utilities import SQLDatabase
from app.config import settings
from app.rag.etl import ETLService
import requests
import json

# 1. 数据库工具
db_uri = f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
db = SQLDatabase.from_uri(db_uri)

def run_sql_query(query: str) -> str:
    """执行 SQL 查询"""
    try:
        return db.run(query)
    except Exception as e:
        return f"SQL Execution Error: {str(e)}"

sql_tool = Tool(
    name="SQL_Database",
    func=run_sql_query,
    description="用于查询数据库中的结构化数据，如项目信息、管道参数、泵站数据等。输入应为有效的 SQL 语句。"
)

# 2. 知识库工具
etl_service = ETLService()

def query_knowledge_base(query: str) -> str:
    """查询 RAG 知识库"""
    results = etl_service.query_knowledge(query)
    return "\n\n".join(results) if results else "未找到相关信息。"

rag_tool = Tool(
    name="Knowledge_Base",
    func=query_knowledge_base,
    description="用于查询关于管道能耗分析系统的文档、说明书、行业标准等非结构化知识。"
)

# 3. 计算服务工具 (调用 Java Calculation Service)
def call_hydraulic_analysis(params_json: str) -> str:
    """调用水力分析服务"""
    try:
        url = "http://localhost:9500/calculation/hydraulic-analysis"
        headers = {"Content-Type": "application/json"}
        response = requests.post(url, data=params_json, headers=headers)
        return json.dumps(response.json(), ensure_ascii=False)
    except Exception as e:
        return f"Calculation Service Error: {str(e)}"

calculation_tool = Tool(
    name="Hydraulic_Analysis",
    func=call_hydraulic_analysis,
    description="用于执行水力特性分析计算。输入必须是 JSON 字符串，包含 pipelineId, oilId, flowRate, temperature。"
)

ALL_TOOLS = [sql_tool, rag_tool, calculation_tool]
