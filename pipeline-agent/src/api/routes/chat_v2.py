"""Chat API v2 with unified multi-channel streaming protocol."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from src.guardrails import check_input
from src.streaming import StreamEventProcessor
from src.utils import generate_session_id, generate_trace_id, logger
from src.workflows.graph import get_workflow

router = APIRouter(prefix="/chat", tags=["chat-v2"])

_PUBLIC_STREAM_ERROR_MESSAGE = "服务暂时不可用，请稍后重试。"


class ChatV2Request(BaseModel):
    message: str
    session_id: Optional[str] = None
    stream: bool = True


class HITLConfirmRequest(BaseModel):
    session_id: str
    selected_option: Optional[str] = None
    comment: Optional[str] = None
    modified_data: Optional[dict] = None
    request_id: Optional[str] = None


@router.post("/stream")
async def chat_stream_v2(request: ChatV2Request, http_request: Request):
    """Unified stream endpoint for v2 frontend clients."""
    guard_result = check_input(request.message)
    if not guard_result.passed:
        return JSONResponse(status_code=400, content={"error": guard_result.reason})

    session_id = request.session_id or generate_session_id()
    trace_id = generate_trace_id()
    workflow = get_workflow()
    processor = StreamEventProcessor(trace_id=trace_id)

    async def generate():
        yield processor.trace_init(session_id=session_id)
        try:
            async for item in workflow.astream(
                user_input=guard_result.sanitized_input,
                session_id=session_id,
                trace_id=trace_id,
                user_id=getattr(http_request.state, "user_id", None),
            ):
                for packet in processor.map_workflow_item(item):
                    yield packet
        except Exception as exc:  # noqa: BLE001
            logger.error(f"v2 stream failed: {exc}")
            for packet in processor.map_workflow_item({"type": "error", "error": _PUBLIC_STREAM_ERROR_MESSAGE}):
                yield packet

    return EventSourceResponse(generate())


@router.post("/confirm")
async def chat_confirm_v2(request: HITLConfirmRequest, http_request: Request):
    """HITL confirm endpoint compatible with v2 stream clients."""
    workflow = get_workflow()
    user_choice = {
        "selected_option": request.selected_option,
        "comment": request.comment or "",
        "modified_data": request.modified_data,
        "request_id": request.request_id,
    }
    result = await workflow.resume_from_hitl(
        session_id=request.session_id,
        user_choice=user_choice,
        user_id=getattr(http_request.state, "user_id", None),
    )
    result.setdefault("response_type", "text")
    return result
