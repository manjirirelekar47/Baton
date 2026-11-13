"""Verification & Claim Ledger router (F4, F5).

Endpoints:
  GET /claims: returns ACL-filtered claims ledger and hidden_count
  GET /claims/{id}: returns a single claim if permitted
  GET /gaps: returns generated and recorded knowledge gaps
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core import acl
from app.core.auth import User, current_user
from app.core.db import get_session
from app.modules.verification import public

router = APIRouter(tags=["verification"])


@router.get("/claims")
def claims(user: User = Depends(current_user), session: Session = Depends(get_session)):
    all_claims = public.list_claims(user.project_id, session=session)
    result = acl.filter_for_role(user.role, all_claims)
    return {"claims": result.visible, "hidden_count": result.hidden_count}


@router.get("/claims/{claim_id}")
def claim(claim_id: str, user: User = Depends(current_user), session: Session = Depends(get_session)):
    found = public.get_claim(user.project_id, claim_id, session=session)
    if not found:
        raise HTTPException(status_code=404, detail="Claim not found.")
    visible = acl.filter_for_role(user.role, [found]).visible
    if not visible:
        raise HTTPException(status_code=404, detail="Claim not found.")
    return visible[0]


@router.get("/gaps")
def gaps(user: User = Depends(current_user), session: Session = Depends(get_session)):
    all_gaps = public.list_gaps(user.project_id, session=session)
    return [g for g in all_gaps if acl.can_read(user.role, g.get("acl_label", "L1"))]
