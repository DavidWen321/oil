"""Report generation routes."""

from __future__ import annotations

import asyncio
import json
import os
import time
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import text

from src.agents import (
    get_calc_agent,
    get_data_agent,
    get_graph_agent,
    get_knowledge_agent,
    get_report_agent,
)
from src.models.schemas import ReportGenerateRequest, ReportGenerateResponse
from src.tools.database_tools import get_engine
from src.tools.report_tools import generate_docx_report
from src.utils import generate_session_id, generate_trace_id, logger

router = APIRouter(prefix="/report", tags=["Report"])


@router.post("/generate", response_model=ReportGenerateResponse)
async def generate_report(request: ReportGenerateRequest):
    """Generate report with multi-agent collaboration and persist DOCX file."""

    session_id = request.session_id or generate_session_id()
    trace_id = generate_trace_id()
    logger.info(f"开始生成报告: session_id={session_id}, trace_id={trace_id}")

    try:
        report = await _run_parallel_report_pipeline(request.user_request)
        file_info = await asyncio.to_thread(generate_docx_report, report)
        report_id = await asyncio.to_thread(_save_report_record, report, file_info)

        return ReportGenerateResponse(
            trace_id=trace_id,
            report=report,
            java_report_id=report_id,
            java_download_url=f"/api/v1/report/download/{report_id}",
            java_download_url_pdf=f"/api/v1/report/download/{report_id}?format=pdf",
        )

    except Exception as exc:
        logger.error(f"generate_report failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/java/reports")
async def list_java_reports(
    page_num: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
):
    """List persisted reports for frontend download panel."""

    offset = (page_num - 1) * page_size

    try:
        engine = get_engine()
        with engine.connect() as conn:
            total = conn.execute(
                text("SELECT COUNT(*) FROM t_analysis_report WHERE status = 1")
            ).scalar() or 0

            rows = conn.execute(
                text(
                    """
                    SELECT
                        id,
                        report_no AS reportNo,
                        report_type AS reportType,
                        report_title AS reportTitle,
                        report_summary AS reportSummary,
                        file_name AS fileName,
                        file_format AS fileFormat,
                        file_size AS fileSize,
                        create_time AS createTime
                    FROM t_analysis_report
                    WHERE status = 1
                    ORDER BY create_time DESC
                    LIMIT :limit OFFSET :offset
                    """
                ),
                {"limit": page_size, "offset": offset},
            ).mappings().all()

        records = [{k: (str(v) if v is not None else None) for k, v in dict(row).items()} for row in rows]
        return {
            "code": 200,
            "data": {
                "total": int(total),
                "list": records,
                "records": records,
            },
        }
    except Exception as exc:
        logger.error(f"list_java_reports failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/download/{report_id}")
async def download_java_report(report_id: int, format: str = Query(default="docx")):
    """Download generated report file."""

    try:
        engine = get_engine()
        with engine.connect() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT file_name, file_path, file_format
                    FROM t_analysis_report
                    WHERE id = :id
                    """
                ),
                {"id": report_id},
            ).mappings().first()

        if not row:
            raise HTTPException(status_code=404, detail="报告不存在")

        file_path = str(row["file_path"])
        file_name = str(row["file_name"])
        requested_format = format.lower().strip()

        download_path = file_path
        download_name = file_name

        if requested_format == "pdf":
            pdf_path = os.path.splitext(file_path)[0] + ".pdf"
            if os.path.exists(pdf_path):
                download_path = pdf_path
                download_name = os.path.basename(pdf_path)

        if not os.path.exists(download_path):
            raise HTTPException(status_code=404, detail="报告文件不存在")

        media_type = (
            "application/pdf"
            if download_path.lower().endswith(".pdf")
            else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )

        return FileResponse(
            path=download_path,
            filename=download_name,
            media_type=media_type,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"download_java_report failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


async def _run_parallel_report_pipeline(user_request: str) -> dict:
    """Run multi-agent collaboration with parallel data collection."""

    data_agent = get_data_agent()
    calc_agent = get_calc_agent()
    knowledge_agent = get_knowledge_agent()
    graph_agent = get_graph_agent()
    report_agent = get_report_agent()

    data_task = asyncio.to_thread(data_agent.execute, user_request)
    knowledge_task = asyncio.to_thread(knowledge_agent.execute, user_request)
    graph_task = asyncio.to_thread(graph_agent.execute, user_request)

    data_result, knowledge_result, graph_result = await asyncio.gather(
        data_task,
        knowledge_task,
        graph_task,
        return_exceptions=True,
    )

    data_normalized = _normalize_result(data_result)
    calc_available = _extract_calc_available_data(data_normalized)
    calc_result = await asyncio.to_thread(calc_agent.execute, user_request, calc_available)

    collected = {
        "data": data_normalized,
        "calc": _normalize_result(calc_result),
        "knowledge": _normalize_result(knowledge_result),
        "graph": _normalize_result(graph_result),
    }

    outline = await asyncio.to_thread(
        report_agent.generate_outline,
        user_request=user_request,
        available_data=collected,
    )

    section_specs = outline.get("sections", []) if isinstance(outline, dict) else []
    if not section_specs:
        section_specs = [
            {"title": "一、运行概况"},
            {"title": "二、水力分析"},
            {"title": "三、优化建议"},
        ]

    section_tasks = [
        asyncio.to_thread(
            report_agent.generate_section,
            section_title=section.get("title", "章节"),
            data=collected,
            calc_results=collected.get("calc", {}),
            standards={
                "knowledge": collected.get("knowledge", {}),
                "graph": collected.get("graph", {}),
            },
        )
        for section in section_specs
    ]

    section_results = await asyncio.gather(*section_tasks, return_exceptions=True)
    normalized_sections = [
        _normalize_result(item) if isinstance(item, Exception) else item
        for item in section_results
    ]

    return await asyncio.to_thread(
        report_agent.generate_full_report,
        outline,
        normalized_sections,
    )


def _save_report_record(report_data: dict, file_info: dict) -> int:
    """Persist report file metadata into t_analysis_report."""

    report_no = f"RPT-{int(time.time())}"
    project_id = _extract_project_id(report_data)

    engine = get_engine()
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                INSERT INTO t_analysis_report
                (pro_id, report_no, report_type, report_title, report_summary,
                 file_name, file_path, file_format, file_size, status, create_by)
                VALUES (:pro_id, :report_no, :report_type, :report_title, :report_summary,
                        :file_name, :file_path, :file_format, :file_size, :status, :create_by)
                """
            ),
            {
                "pro_id": project_id,
                "report_no": report_no,
                "report_type": "HYDRAULIC_ANALYSIS",
                "report_title": report_data.get("title", "分析报告"),
                "report_summary": report_data.get("summary", ""),
                "file_name": file_info["file_name"],
                "file_path": file_info["file_path"],
                "file_format": "DOCX",
                "file_size": file_info["file_size"],
                "status": 1,
                "create_by": "agent",
            },
        )
        conn.commit()
        report_id = conn.execute(text("SELECT LAST_INSERT_ID() AS id")).scalar()

    return int(report_id or 0)


def _extract_project_id(report_data: dict) -> int:
    """Try to infer project id from report payload."""

    if not isinstance(report_data, dict):
        return 0

    direct = report_data.get("project_id")
    if isinstance(direct, int):
        return direct

    sections = report_data.get("sections")
    if not isinstance(sections, list):
        return 0

    for section in sections:
        if not isinstance(section, dict):
            continue
        for key in ("project_id", "pro_id"):
            value = section.get(key)
            if isinstance(value, int):
                return value
    return 0


def _normalize_result(value: Any) -> Any:
    if isinstance(value, Exception):
        return {"error": str(value)}
    if isinstance(value, str):
        text_value = value.strip()
        if text_value.startswith("{") and text_value.endswith("}"):
            try:
                parsed = json.loads(text_value)
                if isinstance(parsed, dict) and parsed.get("success") is True and "data" in parsed:
                    return parsed["data"]
                return parsed
            except Exception:
                return {"raw": value}
        return {"raw": value}
    return value


def _extract_calc_available_data(data_result: Any) -> Optional[dict]:
    """Extract structured payload for calc agent from data agent output."""

    if not isinstance(data_result, dict):
        return None

    if "pipeline" in data_result or "oil" in data_result or "pump_station" in data_result:
        return data_result

    nested_data = data_result.get("data")
    if isinstance(nested_data, dict):
        return nested_data

    return data_result
