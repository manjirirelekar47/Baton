"""Seeded demo users and signed JWTs. FROZEN after Day 0.
The token proves identity only. Role and active status are re-read from the database on every request,
so a revoked member loses access immediately."""
import time
from dataclasses import dataclass

import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_session

DEMO_PROJECT_ID = "proj-campus-event-portal"
SEED_USERS = [
    {"id": "u-approver", "name": "Approver", "role": "approver"},
    {"id": "u-aarav", "name": "Aarav", "role": "leaver"},
    {"id": "u-meera", "name": "Meera", "role": "incoming_maintainer"},
    {"id": "u-contrib", "name": "Incoming Contributor", "role": "incoming_contributor"},
]


@dataclass(frozen=True)
class User:
    id: str
    name: str
    role: str
    project_id: str


def make_token(user: User) -> str:
    settings = get_settings()
    payload = {"sub": user.id, "project_id": user.project_id, "exp": int(time.time()) + settings.jwt_ttl_minutes * 60}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def _unauthorised(detail: str) -> HTTPException:
    return HTTPException(status_code=401, detail=detail, headers={"WWW-Authenticate": "Bearer"})


def current_user(authorization: str | None = Header(default=None), session: Session = Depends(get_session)) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise _unauthorised("Sign in first. Use the role switcher to log in as a demo user.")
    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise _unauthorised("Your session expired or is invalid. Switch role to sign in again.") from None
    row = session.execute(
        text("select id, name, role, project_id, active from members where id = :id"), {"id": claims.get("sub")}
    ).mappings().first()
    if row is None or not row["active"]:
        raise _unauthorised("This account no longer has access to the project.")
    return User(id=row["id"], name=row["name"], role=row["role"], project_id=row["project_id"])
