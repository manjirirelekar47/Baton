"""Demo project seed and reset. FROZEN after Day 0."""
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.audit import now_iso
from app.core.auth import DEMO_PROJECT_ID, SEED_USERS


def seed_demo(session: Session) -> None:
    now = now_iso()
    exists = session.execute(text("select 1 from projects where id = :id"), {"id": DEMO_PROJECT_ID}).first()
    if not exists:
        session.execute(
            text("insert into projects (id, name, created_at) values (:id, :name, :created_at)"),
            {"id": DEMO_PROJECT_ID, "name": "Campus Event Portal", "created_at": now},
        )
    for user in SEED_USERS:
        email = f"{user['role']}@baton.internal"

        # 1. Canonical users table
        try:
            session.execute(
                text("""
                    insert into users (id, email, name, is_demo, created_at)
                    values (:id, :email, :name, 1, :now)
                    on conflict (id) do update set name = :name, email = :email, is_demo = 1
                """),
                {"id": user["id"], "email": email, "name": user["name"], "now": now},
            )
        except Exception:
            try:
                session.execute(
                    text("update users set name = :name, email = :email, is_demo = 1 where id = :id"),
                    {"id": user["id"], "email": email, "name": user["name"]},
                )
            except Exception:
                pass

        # 2. Canonical project_memberships table
        try:
            session.execute(
                text("""
                    insert into project_memberships (user_id, project_id, role, active, created_at)
                    values (:uid, :pid, :role, 1, :now)
                    on conflict (user_id, project_id) do update set role = :role, active = 1
                """),
                {"uid": user["id"], "pid": DEMO_PROJECT_ID, "role": user["role"], "now": now},
            )
        except Exception:
            try:
                session.execute(
                    text("update project_memberships set role = :role, active = 1 where user_id = :uid and project_id = :pid"),
                    {"uid": user["id"], "pid": DEMO_PROJECT_ID, "role": user["role"]},
                )
            except Exception:
                pass

        # 3. Legacy members table (keep in sync for backwards compatibility)
        present = session.execute(text("select 1 from members where id = :id"), {"id": user["id"]}).first()
        if not present:
            try:
                session.execute(
                    text("insert into members (id, project_id, name, role, active, email, is_demo) values (:id, :project_id, :name, :role, 1, :email, 1)"),
                    {**user, "project_id": DEMO_PROJECT_ID, "email": email},
                )
            except Exception:
                session.execute(
                    text("insert into members (id, project_id, name, role, active) values (:id, :project_id, :name, :role, 1)"),
                    {**user, "project_id": DEMO_PROJECT_ID},
                )
        else:
            try:
                session.execute(
                    text("update members set project_id = :project_id, active = 1, role = :role, is_demo = 1, email = :email where id = :id"),
                    {**user, "project_id": DEMO_PROJECT_ID, "email": email},
                )
            except Exception:
                session.execute(
                    text("update members set project_id = :project_id, active = 1, role = :role where id = :id"),
                    {**user, "project_id": DEMO_PROJECT_ID},
                )

    session.commit()
