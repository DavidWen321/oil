from fastapi import APIRouter

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.agents.graph import app_graph
from app.rag.etl import ETLService
from langchain.schema import HumanMessage

router = APIRouter()
etl_service = ETLService()

class ChatRequest(BaseModel):
    message: str

class IngestRequest(BaseModel):
    directory_path: str

@router.post("/chat")
def chat_endpoint(request: ChatRequest):
    """
    AI 助手对话接口
    """
    try:
        inputs = {"messages": [HumanMessage(content=request.message)]}
        result = app_graph.invoke(inputs)
        # 提取最后一条消息作为回复
        # 注意：根据 graph 的定义，result['messages'] 可能是字符串列表或对象列表
        # 在 general_agent_node 中我们返回的是 {"messages": [result['output']]}，其中 output 是字符串
        return {"response": result['messages'][-1]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ingest")
def ingest_endpoint(request: IngestRequest):
    """
    文档入库接口
    """
    return etl_service.ingest_directory(request.directory_path)

@router.get("/test")
def test_endpoint():
    return {"message": "API is working"}
