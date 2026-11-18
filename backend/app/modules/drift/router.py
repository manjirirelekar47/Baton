"""Source re-import change detection and alert management."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import User, current_user
from app.core.db import get_session
from app.modules.ingestion import public as ingestion

from . import public
from .models import DriftAlert

router = APIRouter(tags=["source drift"])


@router.post("/drift/scan")
def scan_sources(user: User = Depends(current_user), session: Session = Depends(get_session)):
    if not ingestion.can_manage_sources(user.role):
        raise HTTPException(status_code=403, detail="Only the project approver can compare source versions.")
    return public.scan_sources(user.project_id, user.role, session)


@router.get("/drift/alerts", response_model=list[DriftAlert])
def alerts(user: User = Depends(current_user), session: Session = Depends(get_session)):
    return public.get_alerts(user.project_id, user.role, session)


@router.post("/drift/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str, user: User = Depends(current_user), session: Session = Depends(get_session)):
    if not ingestion.can_manage_sources(user.role):
        raise HTTPException(status_code=403, detail="Only the project approver can resolve source-change alerts.")
    if not public.resolve(alert_id, user.project_id, session):
        raise HTTPException(status_code=404, detail="Open source-change alert not found.")
    return {"resolved": True}
