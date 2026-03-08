"""Scheme card routes."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from src.persistence import get_scheme_card, list_scheme_cards, update_scheme_card_status

router = APIRouter(prefix="/scheme", tags=["scheme-card"])


@router.get("/cards")
async def list_cards(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    session_id: Optional[str] = Query(default=None),
):
    return {
        "items": list_scheme_cards(session_id=session_id, page=page, size=size),
        "page": page,
        "size": size,
    }


@router.get("/cards/{card_id}")
async def get_card(card_id: str):
    card = get_scheme_card(card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="方案卡不存在")
    return card


@router.post("/cards/{card_id}/approve")
async def approve_card(card_id: str, comment: str = ""):
    success = update_scheme_card_status(card_id, "approved", comment)
    if not success:
        raise HTTPException(status_code=404, detail="方案卡不存在")
    return {"status": "approved", "card_id": card_id}


@router.post("/cards/{card_id}/reject")
async def reject_card(card_id: str, reason: str = ""):
    success = update_scheme_card_status(card_id, "rejected", reason)
    if not success:
        raise HTTPException(status_code=404, detail="方案卡不存在")
    return {"status": "rejected", "card_id": card_id}
