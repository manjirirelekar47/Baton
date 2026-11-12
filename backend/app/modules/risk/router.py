"""Risk Radar and delivery endpoints backed by deterministic, inspectable calculations."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import User, current_user
from app.core.db import get_session
from app.modules.risk import public

router = APIRouter(tags=["risk"])


@router.get("/timeline")
def timeline(user: User = Depends(current_user), session: Session = Depends(get_session)):
    return public.timeline(user.project_id, session, user.role)


@router.get("/risk-radar")
def risk_radar(user: User = Depends(current_user), session: Session = Depends(get_session)):
    return public.risk_radar(user.project_id, session, user.role)


@router.get("/delivery-status")
def delivery_status(user: User = Depends(current_user), session: Session = Depends(get_session)):
    return public.delivery_status(user.project_id, session, user.role)
