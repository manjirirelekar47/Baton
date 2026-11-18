"""Consent-based capture endpoint; captured notes enter the normal evidence pipeline."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import User, current_user
from app.core.db import get_session
from app.modules.ingestion import public as ingestion

from . import public
from .models import CaptureRequest

router = APIRouter(tags=["capture"])


@router.post("/capture", status_code=201)
def capture(payload: CaptureRequest, user: User = Depends(current_user), session: Session = Depends(get_session)):
    if not ingestion.can_manage_sources(user.role):
        raise HTTPException(status_code=403, detail="Only the project approver can capture shared project knowledge.")
    try:
        return public.create_note(
            project_id=user.project_id,
            author=user.name,
            title=payload.title,
            body=payload.body,
            acl_label=payload.acl_label,
            session=session,
        )
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
