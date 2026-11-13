"""Audit trail for the review module (append-only)."""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .actor import Actor
from .models import ReviewEvent
from .schemas import AuditEntry


def record_event(
    session: Session,
    actor: Actor,
    event_type: str,
    object_type: str,
    object_id: str,
    detail: dict[str, Any] | None = None,
) -> ReviewEvent:
    row = ReviewEvent(
        project_id=actor.project_id,
        actor_id=actor.user_id,
        actor_role=actor.role,
        event_type=event_type,
        object_type=object_type,
        object_id=object_id,
        detail_json=json.dumps(detail or {}, sort_keys=True, default=str),
    )
    session.add(row)
    session.flush()

    # Mirror to core audit_log if available
    try:
        from app.core import audit as core_audit
        core_audit.log(
            session=session,
            user=actor,
            action=event_type,
            obj=object_id,
            detail=json.dumps(detail or {}, sort_keys=True, default=str),
            commit=False,
        )
    except Exception:
        pass

    return row


def list_events(
    session: Session, project_id: str, limit: int = 100, offset: int = 0
) -> list[AuditEntry]:
    rows = session.scalars(
        select(ReviewEvent)
        .where(ReviewEvent.project_id == project_id)
        .order_by(ReviewEvent.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return [
        AuditEntry(
            id=r.id,
            project_id=r.project_id,
            actor_id=r.actor_id,
            actor_role=r.actor_role,
            event_type=r.event_type,
            object_type=r.object_type,
            object_id=r.object_id,
            detail=json.loads(r.detail_json or "{}"),
            created_at=r.created_at,
        )
        for r in rows
    ]
