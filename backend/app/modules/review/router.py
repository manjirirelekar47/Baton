"""STUB router (Samruddhi replaces). Review queue, actions, approve, versions, audit."""
from fastapi import APIRouter, Depends

from app.core.auth import User, current_user
from app.core.samples import load_sample
from app.modules.review import public

router = APIRouter(tags=["review"])


@router.get("/review/queue")
def queue(user: User = Depends(current_user)):
    return load_sample("review_queue")


@router.post("/review/{claim_id}/action")
def action(claim_id: str, user: User = Depends(current_user)):
    return {"claim_id": claim_id, "status": "stub"}


@router.post("/review/approve")
def approve(user: User = Depends(current_user)):
    return load_sample("versions")[0]


@router.get("/versions")
def versions(user: User = Depends(current_user)):
    items = public.list_versions(user.project_id)
    if user.role in ("incoming_maintainer", "incoming_contributor"):
        items = [v for v in items if v["status"] == "approved" and user.role in v.get("shared_with", [])]
    return items


@router.get("/audit")
def audit_trail(user: User = Depends(current_user)):
    return load_sample("audit")
