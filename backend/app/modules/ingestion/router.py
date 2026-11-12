"""Consent-aware source ingestion and ACL-filtered evidence access."""
import json
import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.auth import User, current_user
from app.core.db import get_session
from app.modules.ingestion import public, service

router = APIRouter(tags=["ingestion"])


@router.get("/sources")
def sources(user: User = Depends(current_user), session: Session = Depends(get_session)):
    return public.list_sources(user.project_id, user.role, session)


@router.post("/sources", status_code=201)
async def upload_source(
    file: UploadFile = File(...),
    consent: bool = Form(...),
    acl_label: str = Form(...),
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    if not service.can_manage_sources(user.role):
        raise HTTPException(status_code=403, detail="Only the project approver can connect sources.")
    if consent is not True:
        raise HTTPException(status_code=422, detail="Confirm that you are authorised to connect this source.")
    if acl_label not in {"L1", "L2", "L3", "L4"}:
        raise HTTPException(status_code=422, detail="Access label must be L1, L2, L3 or L4.")
    if acl_label == "L4":
        raise HTTPException(status_code=422, detail="L4 secret sources are never accepted or stored.")
    try:
        content = await file.read(service.MAX_UPLOAD_BYTES + 1)
        allow_chat = os.getenv("INGEST_ENABLE_CHAT", "false").lower() == "true"
        source_type, records = service.parse_upload(file.filename or "", content, allow_chat=allow_chat)
        return service.persist_source(session, project_id=user.project_id, filename=file.filename or "upload", source_type=source_type,
                                      acl_label=acl_label, records=records)
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        session.rollback()
        raise
    finally:
        await file.close()


@router.get("/chunks/{chunk_id}")
def chunk(chunk_id: str, user: User = Depends(current_user), session: Session = Depends(get_session)):
    found = public.get_chunk(user.project_id, chunk_id, user.role, session)
    if found is None:
        raise HTTPException(status_code=404, detail="Chunk not found.")
    return found
