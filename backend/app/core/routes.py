"""Core endpoints: GET /health, POST /auth/demo-login, GET /me, POST /demo/reset,
POST /auth/register, POST /auth/session, invitations and multi-project management.
"""
import os
import secrets
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import acl, audit
from app.core.auth import (
    DEMO_PROJECT_ID,
    AccountUser,
    User,
    current_account_user,
    current_user,
    make_account_token,
    make_token,
    record_identity_mapping,
    verify_supabase_token,
)
from app.core.db import get_session
from app.core.demo import seed_demo
from app.core.registry import reset_hooks

router = APIRouter()


class DemoLogin(BaseModel):
    role: str


class RegisterRequest(BaseModel):
    user_id: str | None = None
    email: str
    name: str
    role: str = "incoming_contributor"
    invitation_code: str | None = None
    project_id: str | None = None
    supabase_token: str | None = None


class SessionRequest(BaseModel):
    user_id: str
    email: str
    name: str | None = None
    project_id: str | None = None
    supabase_token: str | None = None


class CreateInvitationRequest(BaseModel):
    role: str = "approver"
    email: str | None = None
    handover_deadline: str | None = None


class CreateProjectRequest(BaseModel):
    name: str


class JoinProjectRequest(BaseModel):
    invitation_code: str


class SwitchProjectRequest(BaseModel):
    project_id: str


class UpdateMemberRequest(BaseModel):
    role: str | None = None
    active: bool | None = None
    handover_deadline: str | None = None
    handover_status: str | None = None


class TransferTasksRequest(BaseModel):
    target_member_id: str
    task_ids: list[str] | None = None


def assert_not_last_approver(session: Session, project_id: str, target_user_id: str) -> None:
    """Verify that removing or demoting target_user_id does not leave the project with zero active Approvers."""
    count_pm = session.execute(
        text(
            "select count(*) from project_memberships "
            "where project_id = :pid and role = 'approver' and active = 1"
        ),
        {"pid": project_id},
    ).scalar() or 0

    if count_pm == 0:
        count_pm = session.execute(
            text(
                "select count(*) from members "
                "where project_id = :pid and role = 'approver' and active = 1"
            ),
            {"pid": project_id},
        ).scalar() or 0

    if count_pm <= 1:
        is_target_approver = session.execute(
            text(
                "select 1 from project_memberships "
                "where project_id = :pid and user_id = :uid and role = 'approver' and active = 1"
            ),
            {"pid": project_id, "uid": target_user_id},
        ).first()
        if not is_target_approver:
            is_target_approver = session.execute(
                text(
                    "select 1 from members "
                    "where project_id = :pid and id = :uid and role = 'approver' and active = 1"
                ),
                {"pid": project_id, "uid": target_user_id},
            ).first()

        if is_target_approver:
            raise HTTPException(
                status_code=400,
                detail="Cannot demote or deactivate the last active Approver of this project.",
            )


@router.get("/health", tags=["core"])
def health(session: Session = Depends(get_session)):
    is_postgres = "postgresql" in str(session.bind.url).lower()
    return {
        "status": "ok",
        "database": "PostgreSQL" if is_postgres else "SQLite / WAL",
        "storage": "Encrypted SQL Store" if is_postgres else "SQLite / WAL",
        "engine": "FastAPI / Uvicorn",
        "environment": os.getenv("ENVIRONMENT", "Production" if is_postgres else "Development"),
    }


@router.post("/auth/demo-login", tags=["core"])
def demo_login(body: DemoLogin, session: Session = Depends(get_session)):
    is_contrib = 1 if body.role in ("contributor", "incoming_contributor") else 0
    # 1. Authoritative lookup in project_memberships joined with users
    try:
        row = session.execute(
            text("""
                select u.id, u.name, pm.role, pm.project_id
                from project_memberships pm
                join users u on u.id = pm.user_id
                where (pm.role = :role or (:is_contrib = 1 and pm.role in ('contributor', 'incoming_contributor')))
                  and pm.project_id = :pid and pm.active = 1
            """),
            {"role": body.role, "is_contrib": is_contrib, "pid": DEMO_PROJECT_ID},
        ).mappings().first()
    except Exception:
        row = None

    # 2. Fallback to legacy members table
    if row is None:
        try:
            row = session.execute(
                text("""
                    select id, name, role, project_id from members
                    where (role = :role or (:is_contrib = 1 and role in ('contributor', 'incoming_contributor')))
                      and project_id = :pid and active = 1
                """),
                {"role": body.role, "is_contrib": is_contrib, "pid": DEMO_PROJECT_ID},
            ).mappings().first()
        except Exception:
            row = None

    # 3. If neither has the seeded demo user, re-seed and fetch again
    if row is None:
        seed_demo(session)
        try:
            row = session.execute(
                text("""
                    select u.id, u.name, pm.role, pm.project_id
                    from project_memberships pm
                    join users u on u.id = pm.user_id
                    where (pm.role = :role or (:is_contrib = 1 and pm.role in ('contributor', 'incoming_contributor')))
                      and pm.project_id = :pid and pm.active = 1
                """),
                {"role": body.role, "is_contrib": is_contrib, "pid": DEMO_PROJECT_ID},
            ).mappings().first()
        except Exception:
            row = None

    if row is None:
        raise HTTPException(status_code=404, detail="No demo user has that role.")

    user = User(
        id=row["id"],
        name=row["name"],
        role=row["role"],
        project_id=row["project_id"],
        email=f"{body.role}@baton.internal",
        is_demo=True,
    )
    audit.log(session, user, "auth.demo_login", obj=user.id)

    # Fetch projects the demo user belongs to (Campus Event Portal first)
    projects = session.execute(
        text("""
            select p.id, p.name, pm.role
            from project_memberships pm
            join projects p on p.id = pm.project_id
            where pm.user_id = :uid and pm.active = 1
            order by (case when p.id = :pid then 0 else 1 end), p.name asc
        """),
        {"uid": user.id, "pid": DEMO_PROJECT_ID},
    ).mappings().all()

    if not projects:
        projects = [{"id": DEMO_PROJECT_ID, "name": "Campus Event Portal", "role": user.role}]
    else:
        projects = [{"id": p["id"], "name": p["name"], "role": p["role"]} for p in projects]

    return {"token": make_token(user), "user": user.__dict__, "projects": projects, "active_project_id": user.project_id}


@router.post("/auth/register", tags=["core"])
def register(
    body: RegisterRequest,
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    if body.role not in acl.ROLES:
        raise HTTPException(status_code=422, detail=f"Invalid role '{body.role}'. Must be one of: {', '.join(acl.ROLES)}")

    raw_token = body.supabase_token or authorization
    token_claims = verify_supabase_token(raw_token, expected_user_id=body.user_id, expected_email=body.email)
    uid = token_claims.get("sub") or (body.user_id.strip() if body.user_id else None)
    if not uid:
        raise HTTPException(status_code=400, detail="Missing user_id from token or payload.")

    email_clean = body.email.strip().lower()
    name_clean = body.name.strip()
    target_project_id = body.project_id

    # 1. Duplicate email check across distinct users
    existing_by_email = session.execute(
        text("select id, name, email from users where lower(email) = :email and is_demo = 0"),
        {"email": email_clean},
    ).mappings().first()
    if not existing_by_email:
        existing_by_email = session.execute(
            text("select id, name, email from members where lower(email) = :email and is_demo = 0"),
            {"email": email_clean},
        ).mappings().first()

    if existing_by_email and existing_by_email["id"] != uid:
        raise HTTPException(
            status_code=400,
            detail="An account with this email is already registered. Please sign in instead.",
        )

    # Check if user already exists and has a locked role
    existing_by_id = session.execute(
        text("select id, name, role, project_id, active, email, is_demo from members where id = :id and is_demo = 0"),
        {"id": uid},
    ).mappings().first()
    if not existing_by_id:
        existing_pm = session.execute(
            text("select user_id, project_id, role, active from project_memberships where user_id = :id and (project_id = :pid or :pid is null)"),
            {"id": uid, "pid": target_project_id},
        ).mappings().first()
        if existing_pm:
            existing_by_id = {"id": uid, "role": existing_pm["role"], "project_id": existing_pm["project_id"]}

    if existing_by_id:
        existing_role = existing_by_id["role"]
        if body.role and body.role != existing_role:
            raise HTTPException(
                status_code=400,
                detail=f"Account already registered with role '{existing_role}'. Unrestricted role switching is disabled.",
            )

    assigned_role = body.role
    inv_row = None

    # 2. Invitation Code Validation or Approver Approval Check
    if body.invitation_code and body.invitation_code.strip():
        code_clean = body.invitation_code.strip()
        inv_row = session.execute(
            text("select id, code, role, email, status, project_id, handover_deadline from invitations where code = :code and status = 'active'"),
            {"code": code_clean},
        ).mappings().first()
        if not inv_row:
            detail = "Invalid or expired invitation code for Approver access." if body.role == "approver" else "Invalid or expired invitation code."
            raise HTTPException(
                status_code=403,
                detail=detail,
            )
        if body.role == "approver" and inv_row["role"] != "approver":
            raise HTTPException(
                status_code=403,
                detail="Invitation code is not valid for Approver access.",
            )
        if inv_row["email"] and inv_row["email"].lower() != email_clean:
            raise HTTPException(status_code=403, detail="Invitation code was issued to a different email address.")

        assigned_role = inv_row["role"]
        if body.project_id:
            target_project_id = body.project_id
        elif inv_row.get("project_id"):
            target_project_id = inv_row["project_id"]

        res = session.execute(
            text("update invitations set status = 'used', used_by = :uid, used_at = :now where id = :id and status = 'active'"),
            {"uid": uid, "now": audit.now_iso(), "id": inv_row["id"]},
        )
        if res.rowcount == 0:
            raise HTTPException(
                status_code=403,
                detail="Invitation code has already been redeemed.",
            )
    elif body.role == "approver" and not (existing_by_id and existing_by_id.get("role") == "approver"):
        admin_appr = session.execute(
            text("select id, project_id from invitations where lower(email) = :email and role = 'approver' and status in ('approved', 'active')"),
            {"email": email_clean},
        ).mappings().first()
        if admin_appr:
            assigned_role = "approver"
            if admin_appr.get("project_id"):
                target_project_id = admin_appr["project_id"]
            session.execute(
                text("update invitations set status = 'used', used_by = :uid, used_at = :now where id = :id"),
                {"uid": uid, "now": audit.now_iso(), "id": admin_appr["id"]},
            )
        else:
            raise HTTPException(
                status_code=403,
                detail="Approver registration requires a valid invitation code or admin approval.",
            )

    if not target_project_id:
        target_project_id = f"proj-{uuid.uuid4().hex[:12]}"

    if existing_by_id:
        existing_role = existing_by_id["role"]
        if existing_role != assigned_role:
            raise HTTPException(
                status_code=400,
                detail=f"Account already registered with role '{existing_role}'. Unrestricted role switching is disabled.",
            )

    # Ensure workspace project row exists
    session.execute(
        text(
            "insert into projects (id, name, created_at) "
            "values (:id, :name, :created_at) "
            "on conflict (id) do nothing"
        ),
        {"id": target_project_id, "name": f"{name_clean}'s Workspace", "created_at": audit.now_iso()},
    )

    # Ensure canonical users table has user
    now = audit.now_iso()
    session.execute(
        text("""
            insert into users (id, email, name, is_demo, created_at)
            values (:id, :email, :name, 0, :now)
            on conflict (id) do update set name = :name, email = :email
        """),
        {"id": uid, "email": email_clean, "name": name_clean, "now": now},
    )

    # Insert project membership
    handover_dl = inv_row.get("handover_deadline") if inv_row else None
    session.execute(
        text("""
            insert into project_memberships (user_id, project_id, role, active, created_at, handover_deadline)
            values (:uid, :pid, :role, 1, :now, :handover_dl)
            on conflict (user_id, project_id) do update set role = :role, active = 1, handover_deadline = coalesce(:handover_dl, handover_deadline)
        """),
        {"uid": uid, "pid": target_project_id, "role": assigned_role, "now": now, "handover_dl": handover_dl},
    )

    # Sync legacy members table
    try:
        session.execute(
            text("insert into members (id, project_id, name, role, active, email, is_demo, handover_deadline) values (:id, :project_id, :name, :role, 1, :email, 0, :handover_dl) on conflict (id) do update set project_id = :project_id, role = :role, active = 1, name = :name, email = :email, handover_deadline = coalesce(:handover_dl, handover_deadline)"),
            {"id": uid, "project_id": target_project_id, "name": name_clean, "role": assigned_role, "email": email_clean, "handover_dl": handover_dl},
        )
    except Exception:
        try:
            fallback_role = "incoming_contributor" if assigned_role == "contributor" else assigned_role
            session.execute(
                text("insert into members (id, project_id, name, role, active, email, is_demo, handover_deadline) values (:id, :project_id, :name, :role, 1, :email, 0, :handover_dl) on conflict (id) do update set project_id = :project_id, role = :role, active = 1, name = :name, email = :email, handover_deadline = coalesce(:handover_dl, handover_deadline)"),
                {"id": uid, "project_id": target_project_id, "name": name_clean, "role": fallback_role, "email": email_clean, "handover_dl": handover_dl},
            )
        except Exception:
            pass

    session.commit()
    user = User(
        id=uid,
        name=name_clean,
        role=assigned_role,
        project_id=target_project_id,
        email=email_clean,
        is_demo=False,
    )
    # Additive mapping from Supabase sub to member, project, and role
    record_identity_mapping(
        session=session,
        supabase_sub=uid,
        member_id=user.id,
        project_id=user.project_id,
        role=user.role,
        email=user.email,
    )
    audit.log(session, user, "auth.register", obj=user.id, detail=f"Registered as {user.role} for project {target_project_id}")
    return {"token": make_token(user), "user": user.__dict__}


@router.post("/auth/session", tags=["core"])
def sync_session(
    body: SessionRequest,
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    """Authenticate or sync an existing Supabase authenticated user with Baton."""
    raw_token = body.supabase_token or authorization
    token_claims = verify_supabase_token(raw_token, expected_user_id=body.user_id, expected_email=body.email)
    uid = token_claims.get("sub") or body.user_id.strip()
    email_clean = body.email.strip().lower()
    name_clean = body.name or token_claims.get("name") or token_claims.get("user_metadata", {}).get("full_name") or email_clean.split("@")[0]

    # Look up user's active projects from project_memberships
    p_rows = session.execute(
        text("""
            select p.id, p.name, p.owner_id, pm.role, pm.active
            from project_memberships pm
            join projects p on p.id = pm.project_id
            where pm.user_id = :uid and pm.active = 1
            order by pm.created_at asc
        """),
        {"uid": uid},
    ).mappings().all()

    if not p_rows:
        # Fallback to project_memberships via canonical users email
        p_rows = session.execute(
            text("""
                select p.id, p.name, p.owner_id, pm.role, pm.active
                from project_memberships pm
                join projects p on p.id = pm.project_id
                join users u on u.id = pm.user_id
                where lower(u.email) = :email and pm.active = 1
                order by pm.created_at asc
            """),
            {"email": email_clean},
        ).mappings().all()

    if not p_rows:
        # Fallback to members table
        p_rows = session.execute(
            text("""
                select p.id, p.name, m.role, m.active
                from members m
                join projects p on p.id = m.project_id
                where (m.id = :uid or lower(m.email) = :email) and m.active = 1 and m.is_demo = 0
            """),
            {"uid": uid, "email": email_clean},
        ).mappings().all()

    # User with zero active memberships
    if not p_rows:
        u_row = session.execute(
            text("select id, name, email, is_demo from users where id = :uid or lower(email) = :email"),
            {"uid": uid, "email": email_clean},
        ).mappings().first()
        if not u_row:
            u_row = session.execute(
                text("select id, name, email, is_demo from members where (id = :uid or lower(email) = :email) and is_demo = 0"),
                {"uid": uid, "email": email_clean},
            ).mappings().first()

        # If user is unknown to Baton and no explicit name was provided (pre-registration check)
        if not u_row and not body.name:
            return {
                "registered": False,
                "requires_role": True,
                "user_id": uid,
                "email": email_clean,
            }

        # Ensure user is recorded in canonical users table
        now = audit.now_iso()
        session.execute(
            text("""
                insert into users (id, email, name, is_demo, created_at)
                values (:id, :email, :name, 0, :now)
                on conflict (id) do update set name = :name, email = :email
            """),
            {"id": uid, "email": email_clean, "name": name_clean, "now": now},
        )
        session.commit()
        account_user = AccountUser(
            id=uid,
            name=(u_row["name"] if (u_row and u_row.get("name")) else name_clean),
            email=email_clean,
            is_demo=False,
        )
        return {
            "registered": True,
            "has_projects": False,
            "requires_project": True,
            "token": make_account_token(account_user),
            "user": account_user.__dict__,
            "projects": [],
        }

    projects_list = [{"id": r["id"], "name": r["name"], "role": r["role"]} for r in p_rows]

    # Select active project: requested project_id if valid for this user, else first project
    active_row = next((r for r in p_rows if body.project_id and r["id"] == body.project_id), p_rows[0])

    user_name = name_clean
    u_row = session.execute(
        text("select name from users where id = :uid"),
        {"uid": uid},
    ).mappings().first()
    if u_row and u_row.get("name"):
        user_name = u_row["name"]
    else:
        m_row = session.execute(
            text("select name from members where id = :uid"),
            {"uid": uid},
        ).mappings().first()
        if m_row and m_row.get("name"):
            user_name = m_row["name"]

    user = User(
        id=uid,
        name=user_name,
        role=active_row["role"],
        project_id=active_row["id"],
        email=email_clean,
        is_demo=False,
    )
    # Additive mapping from Supabase sub to member, project, and role
    record_identity_mapping(
        session=session,
        supabase_sub=uid,
        member_id=user.id,
        project_id=user.project_id,
        role=user.role,
        email=user.email,
    )
    try:
        audit.log(session, user, "auth.session_sync", obj=user.id)
    except Exception:
        pass

    return {
        "registered": True,
        "has_projects": True,
        "token": make_token(user),
        "user": user.__dict__,
        "projects": projects_list,
        "active_project_id": active_row["id"],
    }


@router.get("/projects", tags=["projects"])
def list_projects(
    account: AccountUser = Depends(current_account_user),
    session: Session = Depends(get_session),
):
    """List all active projects the user has membership in."""
    rows = session.execute(
        text("""
            select p.id, p.name, p.owner_id, pm.role, pm.active
            from project_memberships pm
            join projects p on p.id = pm.project_id
            where pm.user_id = :uid and pm.active = 1
            order by p.name asc
        """),
        {"uid": account.id},
    ).mappings().all()

    if not rows:
        # Fallback to members table
        rows = session.execute(
            text("""
                select p.id, p.name, m.role, m.active
                from members m
                join projects p on p.id = m.project_id
                where m.id = :uid and m.active = 1
            """),
            {"uid": account.id},
        ).mappings().all()

    return [
        {
            "id": r["id"],
            "name": r["name"],
            "role": r["role"],
            "owner_id": r.get("owner_id"),
        }
        for r in rows
    ]


@router.post("/projects", tags=["projects"])
def create_project(
    body: CreateProjectRequest,
    account: AccountUser = Depends(current_account_user),
    session: Session = Depends(get_session),
):
    """Create a new project. The creator is granted Approver role atomically."""
    project_name = body.name.strip()
    if len(project_name) < 2:
        raise HTTPException(status_code=422, detail="Project name must be at least 2 characters long.")

    project_id = f"proj-{uuid.uuid4()}"
    now = audit.now_iso()

    # 1. Insert into projects
    session.execute(
        text("""
            insert into projects (id, name, owner_id, created_at)
            values (:pid, :name, :owner_id, :now)
        """),
        {"pid": project_id, "name": project_name, "owner_id": account.id, "now": now},
    )

    # 2. Ensure users record exists
    session.execute(
        text("""
            insert into users (id, email, name, is_demo, created_at)
            values (:id, :email, :name, :demo, :now)
            on conflict (id) do update set name = :name
        """),
        {
            "id": account.id,
            "email": account.email,
            "name": account.name,
            "demo": 1 if account.is_demo else 0,
            "now": now,
        },
    )

    # 3. Insert approver membership
    session.execute(
        text("""
            insert into project_memberships (user_id, project_id, role, active, created_at)
            values (:uid, :pid, 'approver', 1, :now)
        """),
        {"uid": account.id, "pid": project_id, "now": now},
    )

    # 4. Insert into legacy members for backwards compatibility (preserve demo users in demo project)
    if not account.is_demo:
        try:
            session.execute(
                text("""
                    insert into members (id, project_id, name, role, active, email, is_demo)
                    values (:id, :pid, :name, 'approver', 1, :email, :demo)
                    on conflict (id) do update set project_id = :pid, role = 'approver', active = 1
                """),
                {
                    "id": account.id,
                    "pid": project_id,
                    "name": account.name,
                    "email": account.email,
                    "demo": 0,
                },
            )
        except Exception:
            pass

    user = User(
        id=account.id,
        name=account.name,
        role="approver",
        project_id=project_id,
        email=account.email,
        is_demo=account.is_demo,
    )
    record_identity_mapping(
        session=session,
        supabase_sub=account.id,
        member_id=account.id,
        project_id=project_id,
        role="approver",
        email=account.email,
    )
    audit.log(session, user, "projects.create", obj=project_id, detail=f"Created project '{project_name}'")
    session.commit()

    return {
        "project": {"id": project_id, "name": project_name, "role": "approver", "owner_id": account.id},
        "token": make_token(user),
        "user": user.__dict__,
    }


@router.post("/projects/join", tags=["projects"])
def join_project(
    body: JoinProjectRequest,
    account: AccountUser = Depends(current_account_user),
    session: Session = Depends(get_session),
):
    """Redeem an invitation code to join an existing project."""
    code_clean = body.invitation_code.strip()
    inv = session.execute(
        text("select id, code, role, email, status, project_id, handover_deadline from invitations where code = :code and status = 'active'"),
        {"code": code_clean},
    ).mappings().first()

    if not inv:
        raise HTTPException(status_code=400, detail="Invalid or expired invitation code.")

    if inv.get("email") and account.email:
        if inv["email"].lower().strip() != account.email.lower().strip():
            raise HTTPException(status_code=403, detail="Invitation code was issued to a different email address.")

    target_pid = inv.get("project_id")
    if not target_pid:
        raise HTTPException(status_code=400, detail="Invitation is not associated with any project.")

    proj = session.execute(
        text("select id, name from projects where id = :pid"),
        {"pid": target_pid},
    ).mappings().first()

    if not proj:
        raise HTTPException(status_code=404, detail="Target project for this invitation does not exist.")

    # Reject if already a member of this project
    existing_pm = session.execute(
        text("select role, active from project_memberships where user_id = :uid and project_id = :pid"),
        {"uid": account.id, "pid": target_pid},
    ).mappings().first()

    if existing_pm:
        raise HTTPException(
            status_code=409,
            detail="You are already a member of this project. Role changes must be performed by a project administrator.",
        )

    # Atomic single-use redemption
    now = audit.now_iso()
    res = session.execute(
        text("update invitations set status = 'used', used_by = :uid, used_at = :now where id = :id and status = 'active'"),
        {"uid": account.id, "now": now, "id": inv["id"]},
    )
    if res.rowcount == 0:
        raise HTTPException(status_code=409, detail="Invitation code has already been redeemed.")

    # Insert into canonical tables
    session.execute(
        text("""
            insert into users (id, email, name, is_demo, created_at)
            values (:id, :email, :name, :demo, :now)
            on conflict (id) do update set name = :name
        """),
        {
            "id": account.id,
            "email": account.email,
            "name": account.name,
            "demo": 1 if account.is_demo else 0,
            "now": now,
        },
    )
    handover_dl = inv.get("handover_deadline")
    session.execute(
        text("""
            insert into project_memberships (user_id, project_id, role, active, created_at, handover_deadline)
            values (:uid, :pid, :role, 1, :now, :handover_dl)
            on conflict (user_id, project_id) do update set role = :role, active = 1, handover_deadline = coalesce(:handover_dl, handover_deadline)
        """),
        {"uid": account.id, "pid": target_pid, "role": inv["role"], "now": now, "handover_dl": handover_dl},
    )

    try:
        session.execute(
            text("""
                insert into members (id, project_id, name, role, active, email, is_demo, handover_deadline)
                values (:id, :pid, :name, :role, 1, :email, :demo, :handover_dl)
                on conflict (id) do update set project_id = :pid, role = :role, active = 1, handover_deadline = coalesce(:handover_dl, handover_deadline)
            """),
            {
                "id": account.id,
                "pid": target_pid,
                "name": account.name,
                "role": inv["role"],
                "email": account.email,
                "demo": 1 if account.is_demo else 0,
                "handover_dl": handover_dl,
            },
        )
    except Exception:
        try:
            fallback_role = "incoming_contributor" if inv["role"] == "contributor" else inv["role"]
            session.execute(
                text("""
                    insert into members (id, project_id, name, role, active, email, is_demo, handover_deadline)
                    values (:id, :pid, :name, :role, 1, :email, :demo, :handover_dl)
                    on conflict (id) do update set project_id = :pid, role = :role, active = 1, handover_deadline = coalesce(:handover_dl, handover_deadline)
                """),
                {
                    "id": account.id,
                    "pid": target_pid,
                    "name": account.name,
                    "role": fallback_role,
                    "email": account.email,
                    "demo": 1 if account.is_demo else 0,
                    "handover_dl": handover_dl,
                },
            )
        except Exception:
            pass

    user = User(
        id=account.id,
        name=account.name,
        role=inv["role"],
        project_id=target_pid,
        email=account.email,
        is_demo=account.is_demo,
    )
    record_identity_mapping(
        session=session,
        supabase_sub=account.id,
        member_id=account.id,
        project_id=target_pid,
        role=inv["role"],
        email=account.email,
    )
    audit.log(session, user, "projects.join", obj=target_pid, detail=f"Joined project '{proj['name']}' as {inv['role']}")
    session.commit()

    return {
        "project": {"id": target_pid, "name": proj["name"], "role": inv["role"]},
        "token": make_token(user),
        "user": user.__dict__,
    }


@router.post("/auth/switch-project", tags=["core"])
def switch_project(
    body: SwitchProjectRequest,
    account: AccountUser = Depends(current_account_user),
    session: Session = Depends(get_session),
):
    """Switch active project and return a new project-scoped Baton token."""
    membership = session.execute(
        text("""
            select pm.role, pm.active, p.id, p.name
            from project_memberships pm
            join projects p on p.id = pm.project_id
            where pm.user_id = :uid and pm.project_id = :pid and pm.active = 1
        """),
        {"uid": account.id, "pid": body.project_id},
    ).mappings().first()

    if not membership:
        membership = session.execute(
            text("""
                select m.role, m.active, p.id, p.name
                from members m
                join projects p on p.id = m.project_id
                where m.id = :uid and m.project_id = :pid and m.active = 1
            """),
            {"uid": account.id, "pid": body.project_id},
        ).mappings().first()

    if not membership:
        raise HTTPException(status_code=403, detail="You do not have active access to this project.")

    user = User(
        id=account.id,
        name=account.name,
        role=membership["role"],
        project_id=membership["id"],
        email=account.email,
        is_demo=account.is_demo,
    )
    record_identity_mapping(
        session=session,
        supabase_sub=account.id,
        member_id=account.id,
        project_id=membership["id"],
        role=membership["role"],
        email=account.email,
    )
    session.commit()
    try:
        audit.log(session, user, "auth.switch_project", obj=membership["id"])
    except Exception:
        pass

    return {
        "token": make_token(user),
        "user": user.__dict__,
        "project": {"id": membership["id"], "name": membership["name"], "role": membership["role"]},
    }


def check_and_expire_leavers(session: Session, project_id: str | None = None) -> list[str]:
    """Find active leavers whose handover_deadline has passed and automatically deactivate them."""
    now_str = audit.now_iso()
    today_str = now_str[:10]
    query = """
        select user_id, project_id, handover_deadline from project_memberships
        where role = 'leaver' and active = 1 and handover_deadline is not null
    """
    params = {}
    if project_id:
        query += " and project_id = :pid"
        params["pid"] = project_id
    rows = session.execute(text(query), params).mappings().all()
    expired_ids = []
    for r in rows:
        dl = r["handover_deadline"]
        if dl and (dl < now_str or dl <= today_str):
            session.execute(
                text("update project_memberships set active = 0, handover_status = 'expired' where user_id = :uid and project_id = :pid"),
                {"uid": r["user_id"], "pid": r["project_id"]},
            )
            try:
                session.execute(
                    text("update members set active = 0, handover_status = 'expired' where id = :uid and project_id = :pid"),
                    {"uid": r["user_id"], "pid": r["project_id"]},
                )
            except Exception:
                pass
            expired_ids.append(r["user_id"])
    if expired_ids:
        session.commit()
    return expired_ids


@router.get("/projects/{project_id}/members", tags=["projects"])
def list_project_members(
    project_id: str,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    if user.project_id != project_id:
        membership = session.execute(
            text("select 1 from project_memberships where user_id = :uid and project_id = :pid and active = 1"),
            {"uid": user.id, "pid": project_id},
        ).scalar()
        if not membership:
            legacy_m = session.execute(
                text("select 1 from members where id = :uid and project_id = :pid and active = 1"),
                {"uid": user.id, "pid": project_id},
            ).scalar()
            if not legacy_m:
                raise HTTPException(status_code=403, detail="Access denied to this project's members.")

    check_and_expire_leavers(session, project_id)

    rows = session.execute(
        text("""
            select coalesce(u.id, pm.user_id) as id, coalesce(u.name, m.name, pm.user_id) as name,
                   coalesce(u.email, m.email) as email, coalesce(u.is_demo, m.is_demo, 0) as is_demo,
                   pm.role, pm.active, pm.created_at, pm.handover_deadline, pm.handover_status
            from project_memberships pm
            left join users u on u.id = pm.user_id
            left join members m on m.id = pm.user_id and m.project_id = pm.project_id
            where pm.project_id = :pid
            order by pm.created_at asc
        """),
        {"pid": project_id},
    ).mappings().all()

    seen_ids = {r["id"] for r in rows}
    legacy_rows = session.execute(
        text("""
            select id, name, email, is_demo, role, active, handover_deadline, handover_status
            from members
            where project_id = :pid
        """),
        {"pid": project_id},
    ).mappings().all()

    combined_rows = list(rows)
    for lr in legacy_rows:
        if lr["id"] not in seen_ids:
            seen_ids.add(lr["id"])
            combined_rows.append(lr)

    return [
        {
            "id": r["id"],
            "name": r["name"],
            "email": r.get("email"),
            "role": "contributor" if r["role"] == "incoming_contributor" else r["role"],
            "raw_role": r["role"],
            "active": bool(r["active"]),
            "is_demo": bool(r.get("is_demo", 0)),
            "handover_deadline": r.get("handover_deadline"),
            "handover_status": r.get("handover_status") or ("active" if bool(r["active"]) else "inactive"),
        }
        for r in combined_rows
    ]


@router.patch("/projects/{project_id}/members/{member_id}", tags=["projects"])
def update_project_member(
    project_id: str,
    member_id: str,
    body: UpdateMemberRequest,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    if user.project_id != project_id or user.role != "approver":
        raise HTTPException(status_code=403, detail="Only approvers can modify member roles and statuses.")

    if body.role is not None and body.role not in acl.ROLES:
        raise HTTPException(status_code=422, detail=f"Invalid role: {body.role}")

    # Check last-Approver protection
    if (body.role is not None and body.role != "approver") or (body.active is False):
        assert_not_last_approver(session, project_id, member_id)

    # In PostgreSQL, acquire exclusive row lock on the project record to serialize concurrent member updates
    if session.bind and session.bind.dialect.name == "postgresql":
        session.execute(
            text("select id from projects where id = :pid for update"),
            {"pid": project_id},
        )

    updates = []
    params = {"pid": project_id, "uid": member_id}
    if body.role is not None:
        updates.append("role = :role")
        params["role"] = body.role
    if body.active is not None:
        updates.append("active = :active")
        params["active"] = 1 if body.active else 0
    if body.handover_deadline is not None:
        updates.append("handover_deadline = :handover_deadline")
        params["handover_deadline"] = body.handover_deadline
    if body.handover_status is not None:
        updates.append("handover_status = :handover_status")
        params["handover_status"] = body.handover_status

    if updates:
        session.execute(
            text(f"update project_memberships set {', '.join(updates)} where project_id = :pid and user_id = :uid"),
            params,
        )
        try:
            session.execute(
                text(f"update members set {', '.join(updates)} where project_id = :pid and id = :uid"),
                params,
            )
        except Exception:
            pass

        # Post-update verification: ensure at least one active Approver remains in the project
        remaining_approvers = session.execute(
            text("select count(*) from project_memberships where project_id = :pid and role = 'approver' and active = 1"),
            {"pid": project_id},
        ).scalar() or 0
        if remaining_approvers == 0:
            remaining_approvers = session.execute(
                text("select count(*) from members where project_id = :pid and role = 'approver' and active = 1"),
                {"pid": project_id},
            ).scalar() or 0

        if remaining_approvers == 0:
            session.rollback()
            raise HTTPException(
                status_code=400,
                detail="Cannot demote or deactivate the last active Approver of this project.",
            )

        session.commit()
        audit.log(session, user, "projects.update_member", obj=f"{project_id}:{member_id}", detail=str(body.model_dump(exclude_unset=True)))

    return {"status": "updated", "member_id": member_id, "project_id": project_id}


@router.post("/projects/{project_id}/members/{member_id}/complete-handover", tags=["projects"])
def complete_leaver_handover(
    project_id: str,
    member_id: str,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    if user.project_id != project_id or user.role != "approver":
        raise HTTPException(status_code=403, detail="Only approvers can finalize member handover transitions.")

    pm = session.execute(
        text("select role, active from project_memberships where user_id = :uid and project_id = :pid"),
        {"uid": member_id, "pid": project_id},
    ).mappings().first()

    if not pm:
        raise HTTPException(status_code=404, detail="Member not found in project.")

    session.execute(
        text("update project_memberships set active = 0, handover_status = 'completed' where user_id = :uid and project_id = :pid"),
        {"uid": member_id, "pid": project_id},
    )
    try:
        session.execute(
            text("update members set active = 0, handover_status = 'completed' where id = :uid and project_id = :pid"),
            {"uid": member_id, "pid": project_id},
        )
    except Exception:
        pass

    session.commit()
    audit.log(session, user, "projects.complete_handover", obj=f"{project_id}:{member_id}", detail="Completed handover transition; ended active membership while preserving historical contributions.")
    return {"status": "completed", "member_id": member_id, "project_id": project_id, "active": False, "handover_status": "completed"}


@router.get("/projects/{project_id}/members/{member_id}/remaining-tasks", tags=["projects"])
def get_member_remaining_tasks(
    project_id: str,
    member_id: str,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    if user.project_id != project_id or user.role != "approver":
        raise HTTPException(status_code=403, detail="Only approvers can inspect remaining tasks for transition.")

    member = session.execute(
        text("select u.id, u.name, pm.role from users u join project_memberships pm on pm.user_id = u.id where u.id = :uid and pm.project_id = :pid"),
        {"uid": member_id, "pid": project_id},
    ).mappings().first()
    if not member:
        member = session.execute(
            text("select id, name, role from members where id = :uid and project_id = :pid"),
            {"uid": member_id, "pid": project_id},
        ).mappings().first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    m_name = member["name"]
    m_id = member["id"]
    m_role = member["role"]

    # 1. Handover custom tasks
    tasks = []
    ht_rows = session.execute(
        text("""
            select id, title, kind, status, owner, due_date, notes, blocked_by, transferred_from, original_owner, is_transferred
            from handover_tasks
            where project_id = :pid and status != 'completed'
              and (lower(owner) in (:uname, :uid, 'leaver') or created_by = :uid)
        """),
        {"pid": project_id, "uname": m_name.lower(), "uid": m_id.lower()},
    ).mappings().all()
    seen_ids = set()
    for r in ht_rows:
        seen_ids.add(r["id"])
        tasks.append({
            "id": r["id"],
            "title": r["title"],
            "kind": r["kind"] or "next_action",
            "status": r["status"] or "not_started",
            "due_date": r["due_date"],
            "notes": r["notes"],
            "original_owner": r["original_owner"] or m_name,
            "transferred_from": r["transferred_from"],
            "is_transferred": bool(r["is_transferred"]),
            "source_type": "handover_task",
        })

    # 2. Plan action status items
    pas_rows = session.execute(
        text("""
            select claim_id as id, status, owner, due_date, notes, transferred_from, original_owner, is_transferred
            from plan_action_status
            where project_id = :pid and status != 'completed'
              and (lower(owner) in (:uname, :uid, 'leaver'))
        """),
        {"pid": project_id, "uname": m_name.lower(), "uid": m_id.lower()},
    ).mappings().all()
    for r in pas_rows:
        if r["id"] not in seen_ids:
            seen_ids.add(r["id"])
            tasks.append({
                "id": r["id"],
                "title": f"Action on {r['id']}",
                "kind": "next_action",
                "status": r["status"] or "not_started",
                "due_date": r["due_date"],
                "notes": r["notes"],
                "original_owner": r["original_owner"] or m_name,
                "transferred_from": r["transferred_from"],
                "is_transferred": bool(r["is_transferred"]),
                "source_type": "plan_action_status",
            })

    # 3. Claims assigned to leaver
    claim_rows = session.execute(
        text("""
            select id, statement as title, type as kind, state as status, owner, due_date, transferred_from, original_owner, is_transferred
            from claims
            where project_id = :pid
              and (lower(owner) in (:uname, :uid, 'leaver') or lower(proposed_owner) in (:uname, :uid, 'leaver') or proposed_owner_id = :uid)
              and state != 'verified'
        """),
        {"pid": project_id, "uname": m_name.lower(), "uid": m_id.lower()},
    ).mappings().all()
    for r in claim_rows:
        if r["id"] not in seen_ids:
            seen_ids.add(r["id"])
            tasks.append({
                "id": r["id"],
                "title": r["title"],
                "kind": r["kind"] or "next_action",
                "status": r["status"] or "in_progress",
                "due_date": r["due_date"],
                "notes": None,
                "original_owner": r["original_owner"] or m_name,
                "transferred_from": r["transferred_from"],
                "is_transferred": bool(r["is_transferred"]),
                "source_type": "claim",
            })

    return {
        "member_id": m_id,
        "member_name": m_name,
        "member_role": m_role,
        "remaining_tasks_count": len(tasks),
        "tasks": tasks,
    }


@router.post("/projects/{project_id}/members/{member_id}/transfer-tasks", tags=["projects"])
def transfer_leaver_tasks(
    project_id: str,
    member_id: str,
    body: TransferTasksRequest,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    if user.project_id != project_id or user.role != "approver":
        raise HTTPException(status_code=403, detail="Only approvers can reassign leaver tasks.")

    leaver = session.execute(
        text("select u.id, u.name from users u join project_memberships pm on pm.user_id = u.id where u.id = :uid and pm.project_id = :pid"),
        {"uid": member_id, "pid": project_id},
    ).mappings().first()
    if not leaver:
        leaver = session.execute(
            text("select id, name from members where id = :uid and project_id = :pid"),
            {"uid": member_id, "pid": project_id},
        ).mappings().first()
    if not leaver:
        raise HTTPException(status_code=404, detail="Leaver not found in this project.")

    target = session.execute(
        text("select u.id, u.name, pm.role from users u join project_memberships pm on pm.user_id = u.id where u.id = :uid and pm.project_id = :pid and pm.active = 1"),
        {"uid": body.target_member_id, "pid": project_id},
    ).mappings().first()
    if not target:
        target = session.execute(
            text("select id, name, role from members where id = :uid and project_id = :pid and active = 1"),
            {"uid": body.target_member_id, "pid": project_id},
        ).mappings().first()
    if not target:
        raise HTTPException(status_code=404, detail="Target contributor not found or inactive in this project.")

    leaver_name = leaver["name"]
    target_name = target["name"]
    now = audit.now_iso()
    transfer_note = f"Transferred from Leaver ({leaver_name})"

    filter_ids = body.task_ids

    # 1. Update handover_tasks
    ht_query = """
        update handover_tasks
        set owner = :target_name,
            transferred_from = :leaver_name,
            original_owner = coalesce(original_owner, :leaver_name),
            is_transferred = 1,
            transfer_notes = :note,
            updated_by = :uid,
            updated_at = :now
        where project_id = :pid and status != 'completed'
    """
    params = {
        "target_name": target_name,
        "leaver_name": leaver_name,
        "note": transfer_note,
        "uid": user.id,
        "now": now,
        "pid": project_id,
        "lid": member_id.lower(),
        "lname": leaver_name.lower(),
    }
    if filter_ids:
        placeholders = ", ".join(f":ht_id_{i}" for i in range(len(filter_ids)))
        ht_query += f" and id in ({placeholders})"
        for i, fid in enumerate(filter_ids):
            params[f"ht_id_{i}"] = fid
    else:
        ht_query += " and (lower(owner) in (:lname, :lid, 'leaver') or created_by = :lid)"

    session.execute(text(ht_query), params)

    # 2. Update plan_action_status
    pas_query = """
        update plan_action_status
        set owner = :target_name,
            transferred_from = :leaver_name,
            original_owner = coalesce(original_owner, :leaver_name),
            is_transferred = 1,
            updated_by = :uid,
            updated_at = :now
        where project_id = :pid and status != 'completed'
    """
    pas_params = {
        "target_name": target_name,
        "leaver_name": leaver_name,
        "uid": user.id,
        "now": now,
        "pid": project_id,
        "lid": member_id.lower(),
        "lname": leaver_name.lower(),
    }
    if filter_ids:
        pas_placeholders = ", ".join(f":pas_id_{i}" for i in range(len(filter_ids)))
        pas_query += f" and claim_id in ({pas_placeholders})"
        for i, fid in enumerate(filter_ids):
            pas_params[f"pas_id_{i}"] = fid
    else:
        pas_query += " and (lower(owner) in (:lname, :lid, 'leaver'))"

    session.execute(text(pas_query), pas_params)

    # 3. Update claims
    c_query = """
        update claims
        set owner = :target_name,
            transferred_from = :leaver_name,
            original_owner = coalesce(original_owner, :leaver_name),
            is_transferred = 1,
            updated_at = :now
        where project_id = :pid and state != 'verified'
    """
    c_params = {
        "target_name": target_name,
        "leaver_name": leaver_name,
        "now": now,
        "pid": project_id,
        "lid": member_id.lower(),
        "lname": leaver_name.lower(),
    }
    if filter_ids:
        c_placeholders = ", ".join(f":c_id_{i}" for i in range(len(filter_ids)))
        c_query += f" and id in ({c_placeholders})"
        for i, fid in enumerate(filter_ids):
            c_params[f"c_id_{i}"] = fid
    else:
        c_query += " and (lower(owner) in (:lname, :lid, 'leaver') or lower(proposed_owner) in (:lname, :lid, 'leaver') or proposed_owner_id = :lid)"

    session.execute(text(c_query), c_params)

    session.commit()
    audit.log(
        session,
        user,
        "tasks.transferred",
        obj=f"{project_id}:{body.target_member_id}",
        detail=f"Reassigned unfinished tasks from Leaver {leaver_name} to Contributor {target_name}",
    )
    return {
        "status": "success",
        "leaver_id": member_id,
        "leaver_name": leaver_name,
        "target_member_id": body.target_member_id,
        "target_name": target_name,
        "transferred_at": now,
    }


@router.get("/auth/invitations/validate", tags=["core"])
def validate_invitation(code: str = Query(...), session: Session = Depends(get_session)):
    code_clean = code.strip()
    row = session.execute(
        text("""
            select i.id, i.code, i.role, i.email, i.status, i.project_id, i.handover_deadline, p.name as project_name
            from invitations i
            left join projects p on p.id = i.project_id
            where i.code = :code and i.status = 'active'
        """),
        {"code": code_clean},
    ).mappings().first()
    if row is None:
        return {"valid": False, "detail": "Invalid or expired invitation code."}
    return {
        "valid": True,
        "role": "contributor" if row["role"] == "incoming_contributor" else row["role"],
        "raw_role": row["role"],
        "email": row.get("email"),
        "project_id": row.get("project_id"),
        "project_name": row.get("project_name"),
        "handover_deadline": row.get("handover_deadline"),
    }


@router.post("/auth/invitations", tags=["core"])
@router.post("/projects/{project_id}/invitations", tags=["projects"])
def create_invitation(
    body: CreateInvitationRequest,
    project_id: str | None = None,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    target_pid = project_id or user.project_id
    if not target_pid:
        raise HTTPException(status_code=400, detail="No active project specified.")

    # 1. Authoritative check: verify active Approver membership in target_pid
    membership = session.execute(
        text("""
            select role, active from project_memberships
            where user_id = :uid and project_id = :pid
        """),
        {"uid": user.id, "pid": target_pid},
    ).mappings().first()

    is_approver = False
    if membership is not None:
        is_approver = bool(membership["active"] and membership["role"] == "approver")
    else:
        legacy_m = session.execute(
            text("""
                select role, active from members
                where id = :uid and project_id = :pid
            """),
            {"uid": user.id, "pid": target_pid},
        ).mappings().first()
        if legacy_m and legacy_m["active"] and legacy_m["role"] == "approver":
            is_approver = True

    if not is_approver:
        raise HTTPException(
            status_code=403,
            detail="Only active Approvers of this project can create invitations.",
        )

    if body.role not in acl.ROLES:
        raise HTTPException(status_code=422, detail=f"Invalid role: {body.role}")

    code = f"INV-{body.role.upper()}-{secrets.token_hex(8).upper()}"
    inv_id = f"inv-{uuid.uuid4().hex[:10]}"
    email_clean = body.email.strip().lower() if body.email else None
    now = audit.now_iso()

    session.execute(
        text("""
            insert into invitations (id, project_id, code, role, email, status, handover_deadline, created_at)
            values (:id, :project_id, :code, :role, :email, 'active', :handover_deadline, :created_at)
        """),
        {
            "id": inv_id,
            "project_id": target_pid,
            "code": code,
            "role": body.role,
            "email": email_clean,
            "handover_deadline": body.handover_deadline,
            "created_at": now,
        },
    )
    session.commit()
    audit.log(session, user, "auth.create_invitation", obj=inv_id, detail=f"Code: {code} for role: {body.role} in project: {target_pid}")
    return {
        "id": inv_id,
        "project_id": target_pid,
        "code": code,
        "role": body.role,
        "email": email_clean,
        "status": "active",
        "handover_deadline": body.handover_deadline,
        "created_at": now,
    }


@router.get("/auth/invitations", tags=["core"])
@router.get("/projects/{project_id}/invitations", tags=["projects"])
def list_invitations(
    project_id: str | None = None,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    """List all active, redeemed, and revoked invitations bound to the active project."""
    target_pid = project_id or user.project_id
    if not target_pid:
        raise HTTPException(status_code=400, detail="No active project specified.")

    # Verify active Approver membership in target_pid
    membership = session.execute(
        text("""
            select role, active from project_memberships
            where user_id = :uid and project_id = :pid
        """),
        {"uid": user.id, "pid": target_pid},
    ).mappings().first()

    is_approver = False
    if membership is not None:
        is_approver = bool(membership["active"] and membership["role"] == "approver")
    else:
        legacy_m = session.execute(
            text("""
                select role, active from members
                where id = :uid and project_id = :pid
            """),
            {"uid": user.id, "pid": target_pid},
        ).mappings().first()
        if legacy_m and legacy_m["active"] and legacy_m["role"] == "approver":
            is_approver = True

    if not is_approver:
        raise HTTPException(
            status_code=403,
            detail="Only active Approvers of this project can view invitations.",
        )

    rows = session.execute(
        text("""
            select i.id, i.project_id, i.code, i.role, i.email, i.status, i.created_at, i.used_by, i.used_at, i.handover_deadline,
                   coalesce(u.name, m.name) as used_by_name
            from invitations i
            left join users u on u.id = i.used_by
            left join members m on m.id = i.used_by
            where i.project_id = :pid
            order by i.created_at desc
        """),
        {"pid": target_pid},
    ).mappings().all()

    return [
        {
            "id": r["id"],
            "project_id": r["project_id"],
            "code": r["code"],
            "role": "contributor" if r["role"] == "incoming_contributor" else r["role"],
            "raw_role": r["role"],
            "email": r["email"],
            "status": "redeemed" if r["status"] == "used" else r["status"],
            "created_at": r["created_at"],
            "used_by": r["used_by"],
            "used_by_name": r["used_by_name"],
            "used_at": r["used_at"],
            "handover_deadline": r.get("handover_deadline"),
        }
        for r in rows
    ]


@router.post("/auth/invitations/{invitation_id}/revoke", tags=["core"])
@router.delete("/auth/invitations/{invitation_id}", tags=["core"])
@router.post("/projects/{project_id}/invitations/{invitation_id}/revoke", tags=["projects"])
@router.delete("/projects/{project_id}/invitations/{invitation_id}", tags=["projects"])
def revoke_invitation(
    invitation_id: str,
    project_id: str | None = None,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    """Revoke an active invitation in the user's active project."""
    target_pid = project_id or user.project_id
    if not target_pid:
        raise HTTPException(status_code=400, detail="No active project specified.")

    membership = session.execute(
        text("""
            select role, active from project_memberships
            where user_id = :uid and project_id = :pid
        """),
        {"uid": user.id, "pid": target_pid},
    ).mappings().first()

    is_approver = False
    if membership is not None:
        is_approver = bool(membership["active"] and membership["role"] == "approver")
    else:
        legacy_m = session.execute(
            text("""
                select role, active from members
                where id = :uid and project_id = :pid
            """),
            {"uid": user.id, "pid": target_pid},
        ).mappings().first()
        if legacy_m and legacy_m["active"] and legacy_m["role"] == "approver":
            is_approver = True

    if not is_approver:
        raise HTTPException(
            status_code=403,
            detail="Only active Approvers of this project can revoke invitations.",
        )

    inv = session.execute(
        text("select id, code, role, email, status, project_id from invitations where id = :id and project_id = :pid"),
        {"id": invitation_id, "pid": target_pid},
    ).mappings().first()

    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found in active project.")

    if inv["status"] != "active":
        raise HTTPException(status_code=400, detail=f"Cannot revoke invitation with status '{inv['status']}'.")

    session.execute(
        text("update invitations set status = 'revoked' where id = :id"),
        {"id": invitation_id},
    )
    session.commit()
    audit.log(session, user, "auth.revoke_invitation", obj=invitation_id, detail=f"Revoked code {inv['code']} in project {target_pid}")
    return {"status": "revoked", "id": invitation_id}


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
