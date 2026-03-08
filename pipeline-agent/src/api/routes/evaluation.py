"""Evaluation routes for benchmark execution and report query."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from src.evaluation import EVAL_DATASET, run_evaluation
from src.persistence import get_eval_report, list_eval_reports, save_eval_report
from src.workflows.graph import get_workflow

router = APIRouter(prefix="/evaluation", tags=["evaluation"])


class EvaluationRunRequest(BaseModel):
    category: Optional[str] = None
    limit: Optional[int] = None


@router.post("/run")
async def run_eval(request: EvaluationRunRequest):
    workflow = get_workflow()
    cases = EVAL_DATASET
    if request.category:
        cases = [case for case in cases if case.category == request.category]
    if request.limit is not None:
        cases = cases[: max(0, int(request.limit))]
    if not cases:
        raise HTTPException(status_code=400, detail="没有可执行的评测用例")

    report = await run_evaluation(workflow, cases=cases)
    data = report.to_dict()
    save_eval_report(report.run_id, data)
    return data


@router.get("/runs")
async def list_eval_runs(limit: int = Query(default=20, ge=1, le=100)):
    return {"items": list_eval_reports(limit=limit)}


@router.get("/runs/{run_id}")
async def get_eval_run(run_id: str):
    report = get_eval_report(run_id)
    if report is None:
        raise HTTPException(status_code=404, detail="评测报告不存在")
    return report
