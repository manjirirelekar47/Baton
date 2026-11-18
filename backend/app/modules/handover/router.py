"""Handover endpoints: GET /handover/{version_id}/view, GET /handover/{version_id}/plan,
POST /handover/ack, POST /handover/ownership."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import User, current_user
from app.core.db import get_session
from app.modules.handover import service
from app.modules.handover.models import (
    AckRequest,
    ActionStatusRequest,
    ActivityHistoryResponse,
    OwnershipRequest,
    TaskCreateRequest,
    TaskUpdateRequest,
)

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


@router.post("/action-status")
def action_status(body: ActionStatusRequest, user: User = Depends(current_user), session: Session = Depends(get_session)):
    return service.update_action_status(
        session, user, body.version_id, body.claim_id, body.status, body.owner, body.due_date, body.notes
    )


@router.post("/tasks", status_code=201)
@router.post("/{version_id}/tasks", status_code=201)
def create_task(
    body: TaskCreateRequest,
    version_id: str | None = None,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    vid = version_id or body.version_id
    return service.create_task(session, user, vid, body)


@router.get("/tasks/{task_id}")
@router.get("/{version_id}/tasks/{task_id}")
def get_task(
    task_id: str,
    version_id: str = "v1",
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    return service.get_task(session, user, version_id, task_id)


@router.patch("/tasks/{task_id}")
@router.patch("/{version_id}/tasks/{task_id}")
@router.put("/tasks/{task_id}")
@router.put("/{version_id}/tasks/{task_id}")
def update_task(
    task_id: str,
    body: TaskUpdateRequest,
    version_id: str | None = None,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    vid = version_id or body.version_id
    return service.update_task(session, user, vid, task_id, body)


@router.delete("/tasks/{task_id}")
@router.delete("/{version_id}/tasks/{task_id}")
def delete_task(
    task_id: str,
    version_id: str = "v1",
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    return service.delete_task(session, user, version_id, task_id)


@router.get("/tasks/{task_id}/history", response_model=ActivityHistoryResponse)
@router.get("/{version_id}/tasks/{task_id}/history", response_model=ActivityHistoryResponse)
def get_task_history(
    task_id: str,
    version_id: str = "v1",
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    return service.get_task_history(session, user, version_id, task_id)
