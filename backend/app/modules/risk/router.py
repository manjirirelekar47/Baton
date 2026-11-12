"""STUB router (Bhavesh replaces). GET /timeline, /risk-radar, /delivery-status."""
from fastapi import APIRouter, Depends

from app.core.auth import User, current_user
from app.modules.risk import public

router = APIRouter(tags=["risk"])


@router.get("/timeline")
def timeline(user: User = Depends(current_user)):
    return public.timeline(user.project_id)


@router.get("/risk-radar")
def risk_radar(user: User = Depends(current_user)):
    return public.risk_radar(user.project_id)


@router.get("/delivery-status")
def delivery_status(user: User = Depends(current_user)):
    return public.delivery_status(user.project_id)
