"""Chat routes with streaming trace and HITL resume support."""

from __future__ import annotations

import json
import time

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from src.models.schemas import (
    ChatRequest,
    ChatResponse,
    HITLConfirmRequest,
    HITLConfirmResponse,
)
from src.utils import generate_session_id, generate_trace_id, logger
from src.workflows import get_workflow
from src.workflows.hitl import HITLResponse as HITLSubmitResponse, get_hitl_manager

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Standard non-stream chat endpoint."""

    start = time.perf_counter()
    session_id = request.session_id or generate_session_id()
    trace_id = generate_trace_id()

    try:
        workflow = get_workflow()
        result = await workflow.ainvoke(
            user_input=request.message,
            session_id=session_id,
            trace_id=trace_id,
        )

        return ChatResponse(
            response=result.get("response", ""),
            session_id=result.get("session_id", session_id),
            sources=result.get("sources", []),
            intent=result.get("intent", "chat"),
            confidence=result.get("confidence", 0.0),
            execution_time_ms=int((time.perf_counter() - start) * 1000),
            trace_id=result.get("trace_id", trace_id),
            tool_calls=result.get("tool_calls", []),
        )
    except Exception as exc:
        logger.error(f"chat failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """Stream trace events and final response over SSE."""

    session_id = request.session_id or generate_session_id()
    trace_id = generate_trace_id()
    workflow = get_workflow()

    async def generate():
        yield {
            "event": "trace_init",
            "data": json.dumps({"trace_id": trace_id, "session_id": session_id}, ensure_ascii=False),
        }

        result = await workflow.ainvoke(
            user_input=request.message,
            session_id=session_id,
            trace_id=trace_id,
        )

        # 分块发送响应文本（模拟流式）
        response_text = result.get("response", "")
        chunk_size = 20  # 每次发送的字符数
        for i in range(0, len(response_text), chunk_size):
            chunk = response_text[i:i + chunk_size]
            yield {
                "event": "response_chunk",
                "data": json.dumps({"chunk": chunk}, ensure_ascii=False),
            }

        yield {
            "event": "final_response",
            "data": json.dumps(result, ensure_ascii=False, default=str),
        }

    return EventSourceResponse(generate())


@router.post("/confirm", response_model=HITLConfirmResponse)
async def confirm_hitl(request: HITLConfirmRequest):
    """Resume HITL-interrupted workflow with user decision."""

    try:
        response_payload = request.response or {
            "request_id": request.request_id,
            "selected_option": request.selected_option,
            "modified_data": request.modified_data,
            "comment": request.comment,
        }

        manager = get_hitl_manager()
        pending = manager.get_pending_request(request.session_id)
        request_id = str(response_payload.get("request_id") or (pending or {}).get("request_id") or "")
        if request_id:
            try:
                manager.submit_response(
                    session_id=request.session_id,
                    response=HITLSubmitResponse(
                        request_id=request_id,
                        selected_option=response_payload.get("selected_option"),
                        modified_data=response_payload.get("modified_data"),
                        comment=response_payload.get("comment"),
                    ),
                )
            except Exception as persist_error:
                logger.debug(f"submit HITL response skipped: {persist_error}")

        workflow = get_workflow()
        result = await workflow.resume_from_hitl(
            session_id=request.session_id,
            response=response_payload,
        )
        return HITLConfirmResponse(status="resumed", result=result)
    except Exception as exc:
        logger.error(f"HITL confirm failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/pending/{session_id}")
async def get_pending_hitl(session_id: str):
    """Get pending HITL request for polling fallback."""

    manager = get_hitl_manager()
    pending = manager.get_pending_request(session_id)
    return {
        "session_id": session_id,
        "pending": pending is not None,
        "request": pending,
    }


@router.get("/history/{session_id}")
async def get_chat_history(session_id: str):
    """Return message history from checkpoint state."""

    workflow = get_workflow()
    state = workflow.get_state(session_id)

    if not state:
        return {"session_id": session_id, "messages": [], "found": False}

    messages = state.get("messages", [])
    history = [
        {
            "role": "user" if getattr(msg, "type", "") == "human" else "assistant",
            "content": getattr(msg, "content", ""),
        }
        for msg in messages
    ]

    return {
        "session_id": session_id,
        "messages": history,
        "found": True,
    }
