"""聊天 API 路由 — v1 保留兼容，但已弃用。"""

from __future__ import annotations

import json
import time
from typing import Optional

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from src.guardrails import check_input
from src.utils import generate_session_id, generate_trace_id, logger
from src.workflows.graph import get_workflow

router = APIRouter(prefix="/chat", tags=["chat"])

_PUBLIC_STREAM_ERROR_MESSAGE = "服务暂时不可用，请稍后重试。"

_DEPRECATION_HEADERS = {
    "X-API-Deprecated": "true",
    "Sunset": "2026-12-31",
    "Link": '</api/v2/chat/stream>; rel="successor-version"',
}


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    stream: bool = True


class HITLConfirmRequest(BaseModel):
    session_id: str
    selected_option: Optional[str] = None
    comment: Optional[str] = None
    modified_data: Optional[dict] = None
    request_id: Optional[str] = None


@router.post("")
async def chat(request: ChatRequest, response: Response, http_request: Request):
    """非流式聊天接口。# DEPRECATED: 将在下个大版本移除"""
    response.headers.update(_DEPRECATION_HEADERS)
    guard_result = check_input(request.message)
    if not guard_result.passed:
        return JSONResponse(status_code=400, content={"error": guard_result.reason}, headers=_DEPRECATION_HEADERS)

    session_id = request.session_id or generate_session_id()
    trace_id = generate_trace_id()
    workflow = get_workflow()

    start_time = time.time()
    result = await workflow.ainvoke(
        user_input=guard_result.sanitized_input,
        session_id=session_id,
        trace_id=trace_id,
        user_id=getattr(http_request.state, "user_id", None),
    )
    result["execution_time_ms"] = int((time.time() - start_time) * 1000)
    return result


@router.post("/stream")
async def chat_stream(request: ChatRequest, http_request: Request):
    """真流式聊天接口。# DEPRECATED: 将在下个大版本移除"""
    guard_result = check_input(request.message)
    if not guard_result.passed:
        return JSONResponse(status_code=400, content={"error": guard_result.reason}, headers=_DEPRECATION_HEADERS)

    session_id = request.session_id or generate_session_id()
    trace_id = generate_trace_id()
    workflow = get_workflow()

    async def generate():
        yield {
            "event": "trace_init",
            "data": json.dumps(
                {"session_id": session_id, "trace_id": trace_id, "timestamp": time.time()},
                ensure_ascii=False,
            ),
        }
        try:
            async for item in workflow.astream(
                user_input=guard_result.sanitized_input,
                session_id=session_id,
                trace_id=trace_id,
                user_id=getattr(http_request.state, "user_id", None),
            ):
                item_type = item.get("type")
                if item_type == "token":
                    yield {"event": "response_chunk", "data": json.dumps({"chunk": item["content"]}, ensure_ascii=False)}
                elif item_type == "tool_start":
                    yield {
                        "event": "tool_start",
                        "data": json.dumps(
                            {
                                "tool": item["tool"],
                                "call_id": item.get("call_id", ""),
                                "input": item.get("input", {}),
                                "timestamp": time.time(),
                            },
                            ensure_ascii=False,
                        ),
                    }
                elif item_type == "tool_end":
                    yield {
                        "event": "tool_end",
                        "data": json.dumps(
                            {
                                "tool": item["tool"],
                                "call_id": item.get("call_id", ""),
                                "output": item.get("output", ""),
                                "timestamp": time.time(),
                            },
                            ensure_ascii=False,
                        ),
                    }
                elif item_type == "hitl_waiting":
                    yield {"event": "hitl_waiting", "data": json.dumps(item.get("data", {}), ensure_ascii=False)}
                elif item_type == "done":
                    response_data = item.get("response", {})
                    response_data["trace_id"] = trace_id
                    yield {"event": "final_response", "data": json.dumps(response_data, ensure_ascii=False)}
                elif item_type == "error":
                    yield {"event": "error", "data": json.dumps({"error": _PUBLIC_STREAM_ERROR_MESSAGE}, ensure_ascii=False)}
        except Exception as exc:  # noqa: BLE001
            logger.error(f"Stream generation failed: {exc}")
            yield {"event": "error", "data": json.dumps({"error": _PUBLIC_STREAM_ERROR_MESSAGE}, ensure_ascii=False)}

    return EventSourceResponse(generate(), headers=_DEPRECATION_HEADERS)


@router.post("/confirm")
async def chat_confirm(request: HITLConfirmRequest, response: Response, http_request: Request):
    response.headers.update(_DEPRECATION_HEADERS)
    workflow = get_workflow()
    user_choice = {
        "selected_option": request.selected_option,
        "comment": request.comment or "",
        "modified_data": request.modified_data,
        "request_id": request.request_id,
    }
    return await workflow.resume_from_hitl(
        session_id=request.session_id,
        user_choice=user_choice,
        user_id=getattr(http_request.state, "user_id", None),
    )


@router.get("/history/{session_id}")
async def chat_history(session_id: str, response: Response):
    response.headers.update(_DEPRECATION_HEADERS)
    workflow = get_workflow()
    state = workflow.get_state(session_id)
    if not state:
        return {"session_id": session_id, "messages": []}

    messages = state.get("messages", [])
    history = []
    for msg in messages:
        msg_type = getattr(msg, "type", "unknown")
        content = getattr(msg, "content", "")
        if msg_type in ("human", "ai"):
            history.append({"role": "user" if msg_type == "human" else "assistant", "content": content})
    return {"session_id": session_id, "messages": history}
