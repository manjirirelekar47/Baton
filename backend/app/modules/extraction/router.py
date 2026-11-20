"""Extraction router (F3). POST /reconstruct, GET /jobs/{id}."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import User, current_user
from app.modules.extraction import public

router = APIRouter(tags=["extraction"])


class ReconstructPayload(BaseModel):
    mode: str | None = None


@router.post("/reconstruct")
def reconstruct(body: ReconstructPayload | None = None, user: User = Depends(current_user)):
    if user.role != "approver":
        raise HTTPException(status_code=403, detail="Only the project approver can trigger reconstruction.")
    mode = body.mode if body else None
    return public.start_reconstruct(user.project_id, mode=mode)


@router.get("/jobs/{job_id}")
def job(job_id: str, user: User = Depends(current_user)):
    res = public.get_job(job_id, project_id=user.project_id)
    if res is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return res
