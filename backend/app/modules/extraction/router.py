"""STUB router (Samiksha replaces). POST /reconstruct, GET /jobs/{id}. The stub is a labelled replay."""
from fastapi import APIRouter, Depends

from app.core.auth import User, current_user
from app.modules.extraction import public

router = APIRouter(tags=["extraction"])


@router.post("/reconstruct")
def reconstruct(user: User = Depends(current_user)):
    return public.start_reconstruct(user.project_id)


@router.get("/jobs/{job_id}")
def job(job_id: str, user: User = Depends(current_user)):
    return public.get_job(job_id)
