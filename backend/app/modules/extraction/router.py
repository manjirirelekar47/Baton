"""Extraction router (F3). POST /reconstruct, GET /jobs/{id}."""
from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import User, current_user
from app.modules.extraction import public

router = APIRouter(tags=["extraction"])


@router.post("/reconstruct")
def reconstruct(user: User = Depends(current_user)):
    if user.role != "approver":
        raise HTTPException(status_code=403, detail="Only the project approver can trigger reconstruction.")
    return public.start_reconstruct(user.project_id)


@router.get("/jobs/{job_id}")
def job(job_id: str, user: User = Depends(current_user)):
    res = public.get_job(job_id, project_id=user.project_id)
    if res is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return res
