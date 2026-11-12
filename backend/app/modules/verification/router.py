"""STUB router (Samiksha replaces). GET /claims, /claims/{id}, /gaps. Reads go through core.acl."""
from fastapi import APIRouter, Depends, HTTPException

from app.core import acl
from app.core.auth import User, current_user
from app.modules.verification import public

router = APIRouter(tags=["verification"])


@router.get("/claims")
def claims(user: User = Depends(current_user)):
    result = acl.filter_for_role(user.role, public.list_claims(user.project_id))
    return {"claims": result.visible, "hidden_count": result.hidden_count}


@router.get("/claims/{claim_id}")
def claim(claim_id: str, user: User = Depends(current_user)):
    found = public.get_claim(user.project_id, claim_id)
    visible = acl.filter_for_role(user.role, [found]).visible if found else []
    if not visible:
        raise HTTPException(status_code=404, detail="Claim not found.")
    return visible[0]


@router.get("/gaps")
def gaps(user: User = Depends(current_user)):
    return public.list_gaps(user.project_id)
