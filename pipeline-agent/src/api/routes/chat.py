"""
对话路由
处理用户对话请求
"""

import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from src.config import settings
from src.utils import logger, generate_session_id
from src.models.schemas import ChatRequest, ChatResponse, StreamChunk
from src.workflows import get_workflow

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    对话接口

    处理用户消息并返回AI回复
    """
    start_time = time.perf_counter()

    session_id = request.session_id or generate_session_id()

    logger.info(f"收到对话请求: session={session_id}, message={request.message[:50]}...")

    try:
        workflow = get_workflow()

        if request.stream:
            # 流式响应
            return await _stream_response(workflow, request.message, session_id)

        # 同步响应
        result = await workflow.ainvoke(
            user_input=request.message,
            session_id=session_id
        )

        execution_time = int((time.perf_counter() - start_time) * 1000)

        return ChatResponse(
            response=result.get("response", ""),
            session_id=session_id,
            sources=result.get("sources", []),
            intent=result.get("intent"),
            confidence=result.get("confidence", 0.0),
            execution_time_ms=execution_time
        )

    except Exception as e:
        logger.error(f"对话处理失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """
    流式对话接口

    使用Server-Sent Events返回流式响应
    """
    session_id = request.session_id or generate_session_id()

    logger.info(f"收到流式对话请求: session={session_id}")

    try:
        workflow = get_workflow()

        async def generate():
            try:
                async for event in workflow.astream(
                    user_input=request.message,
                    session_id=session_id
                ):
                    event_type = event.get("event", "")

                    # 处理不同类型的事件
                    if event_type == "on_chat_model_stream":
                        # LLM输出流
                        chunk = event.get("data", {}).get("chunk", {})
                        content = chunk.content if hasattr(chunk, "content") else ""
                        if content:
                            yield {
                                "event": "message",
                                "data": content
                            }

                    elif event_type == "on_chain_end":
                        # 链完成
                        output = event.get("data", {}).get("output", {})
                        if isinstance(output, dict) and output.get("final_response"):
                            yield {
                                "event": "done",
                                "data": output.get("final_response")
                            }

                    elif event_type == "error":
                        yield {
                            "event": "error",
                            "data": str(event.get("data", "Unknown error"))
                        }

            except Exception as e:
                logger.error(f"流式生成失败: {e}")
                yield {
                    "event": "error",
                    "data": str(e)
                }

        return EventSourceResponse(generate())

    except Exception as e:
        logger.error(f"流式对话失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{session_id}")
async def get_chat_history(session_id: str):
    """
    获取对话历史

    Args:
        session_id: 会话ID

    Returns:
        对话历史
    """
    try:
        workflow = get_workflow()
        state = workflow.get_state(session_id)

        if not state:
            return {"session_id": session_id, "messages": [], "found": False}

        messages = state.get("messages", [])

        # 转换消息格式
        history = []
        for msg in messages:
            history.append({
                "role": "user" if msg.type == "human" else "assistant",
                "content": msg.content
            })

        return {
            "session_id": session_id,
            "messages": history,
            "found": True
        }

    except Exception as e:
        logger.error(f"获取历史失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _stream_response(workflow, message: str, session_id: str):
    """
    辅助函数：生成流式响应
    """
    async def generate():
        full_response = ""
        async for event in workflow.astream(
            user_input=message,
            session_id=session_id
        ):
            event_type = event.get("event", "")
            if event_type == "on_chat_model_stream":
                chunk = event.get("data", {}).get("chunk", {})
                content = chunk.content if hasattr(chunk, "content") else ""
                if content:
                    full_response += content
                    yield f"data: {content}\n\n"

        yield f"data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )
