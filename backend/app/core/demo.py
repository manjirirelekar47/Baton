"""Demo project seed and reset. FROZEN after Day 0."""
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.audit import now_iso
from app.core.auth import DEMO_PROJECT_ID, SEED_USERS


def seed_demo(session: Session) -> None:
    exists = session.execute(text("select 1 from projects where id = :id"), {"id": DEMO_PROJECT_ID}).first()
    if not exists:
        session.execute(
            text("insert into projects (id, name, created_at) values (:id, :name, :created_at)"),
            {"id": DEMO_PROJECT_ID, "name": "Campus Event Portal", "created_at": now_iso()},
        )
    for user in SEED_USERS:
        present = session.execute(text("select 1 from members where id = :id"), {"id": user["id"]}).first()
        if not present:
            session.execute(
                text("insert into members (id, project_id, name, role, active) values (:id, :project_id, :name, :role, 1)"),
                {**user, "project_id": DEMO_PROJECT_ID},
            )
        else:
            session.execute(text("update members set active = 1, role = :role where id = :id"), user)
    session.commit()
