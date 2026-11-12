"""Core endpoints: GET /health, POST /auth/demo-login, GET /me, POST /demo/reset. FROZEN after Day 0."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import audit
from app.core.auth import DEMO_PROJECT_ID, User, current_user, make_token
from app.core.db import get_session
from app.core.demo import seed_demo
from app.core.registry import reset_hooks

router = APIRouter()


class DemoLogin(BaseModel):
    role: str


@router.get("/health", tags=["core"])
def health():
    return {"status": "ok"}


@router.post("/auth/demo-login", tags=["core"])
def demo_login(body: DemoLogin, session: Session = Depends(get_session)):
    row = session.execute(
        text("select id, name, role, project_id from members where role = :role and project_id = :pid and active = 1"),
        {"role": body.role, "pid": DEMO_PROJECT_ID},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="No demo user has that role.")
    user = User(id=row["id"], name=row["name"], role=row["role"], project_id=row["project_id"])
    audit.log(session, user, "auth.demo_login", obj=user.id)
    return {"token": make_token(user), "user": user.__dict__}


@router.get("/me", tags=["core"])
def me(user: User = Depends(current_user)):
    return user.__dict__


@router.post("/demo/reset", tags=["core"])
def demo_reset(session: Session = Depends(get_session)):
    """One-click restore of the demo project. Open on purpose: demo data only, synthetic."""
    for hook in reset_hooks():
        hook(session)
    session.execute(text("delete from audit_log"))
    session.commit()
    seed_demo(session)
    return {"status": "reset", "project_id": DEMO_PROJECT_ID}
