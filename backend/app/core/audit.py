"""Audit log writer. FROZEN after Day 0. Every action and every view is logged."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def log(session: Session, user, action: str, obj: str | None = None, detail: str | None = None, commit: bool = True) -> None:
    session.execute(
        text(
            "insert into audit_log (id, project_id, actor_id, role, action, object, detail, created_at) "
            "values (:id, :project_id, :actor_id, :role, :action, :object, :detail, :created_at)"
        ),
        {
            "id": uuid.uuid4().hex,
            "project_id": getattr(user, "project_id", None),
            "actor_id": getattr(user, "id", None),
            "role": getattr(user, "role", None),
            "action": action,
            "object": obj,
            "detail": detail,
            "created_at": now_iso(),
        },
    )
    if commit:
        session.commit()
