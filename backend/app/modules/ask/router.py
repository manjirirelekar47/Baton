"""Grounded Q&A over a role-filtered approved handover snapshot."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import User, current_user
from app.core.db import get_session

from . import public
from .models import AskRequest, AskResponse

router = APIRouter(tags=["ask"])


@router.post("/ask", response_model=AskResponse)
def ask(payload: AskRequest, user: User = Depends(current_user), session: Session = Depends(get_session)):
    return public.answer(payload.question, project_id=user.project_id, role=user.role, session=session)
