"""STUB router (Bhavesh replaces). GET /sources, POST /sources, GET /chunks/{id}."""
from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import User, current_user
from app.modules.ingestion import public

router = APIRouter(tags=["ingestion"])


@router.get("/sources")
def sources(user: User = Depends(current_user)):
    return public.list_sources(user.project_id)


@router.post("/sources")
def upload_source(user: User = Depends(current_user)):
    raise HTTPException(status_code=501, detail="Source upload is not built yet (ingestion stub).")


@router.get("/chunks/{chunk_id}")
def chunk(chunk_id: str, user: User = Depends(current_user)):
    found = public.get_chunk(user.project_id, chunk_id, user.role)
    if found is None:
        raise HTTPException(status_code=404, detail="Chunk not found.")
    return found
