"""Handover endpoints: GET /handover/{version_id}/view, GET /handover/{version_id}/plan,
POST /handover/ack, POST /handover/ownership."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import User, current_user
from app.core.db import get_session
from app.modules.handover import service
from app.modules.handover.models import AckRequest, OwnershipRequest

router = APIRouter(prefix="/handover", tags=["handover"])


@router.get("/{version_id}/view")
def view(version_id: str, user: User = Depends(current_user), session: Session = Depends(get_session)):
    return service.get_view(session, user, version_id)


@router.get("/{version_id}/plan")
def plan(version_id: str, user: User = Depends(current_user), session: Session = Depends(get_session)):
    return service.get_plan(session, user, version_id)


@router.post("/ack")
def ack(body: AckRequest, user: User = Depends(current_user), session: Session = Depends(get_session)):
    return service.acknowledge(session, user, body.version_id, body.section)


@router.post("/ownership")
def ownership(body: OwnershipRequest, user: User = Depends(current_user), session: Session = Depends(get_session)):
    return service.respond_ownership(session, user, body.version_id, body.claim_id, body.response, body.note)
