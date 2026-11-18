"""Core endpoints: GET /health, POST /auth/demo-login, GET /me, POST /demo/reset,
POST /auth/register, POST /auth/session, invitations and multi-project management.
"""
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
    role: str
    invitation_code: str | None = None
    project_id: str = DEMO_PROJECT_ID
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


class CreateProjectRequest(BaseModel):
    name: str


class JoinProjectRequest(BaseModel):
    invitation_code: str


class SwitchProjectRequest(BaseModel):
    project_id: str


class UpdateMemberRequest(BaseModel):
    role: str | None = None
    active: bool | None = None


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
def health():
    return {"status": "ok"}


@router.post("/auth/demo-login", tags=["core"])
def demo_login(body: DemoLogin, session: Session = Depends(get_session)):
    # 1. Authoritative lookup in project_memberships joined with users
    row = session.execute(
        text("""
            select u.id, u.name, pm.role, pm.project_id
            from project_memberships pm
            join users u on u.id = pm.user_id
            where pm.role = :role and pm.project_id = :pid and pm.active = 1
        """),
        {"role": body.role, "pid": DEMO_PROJECT_ID},
    ).mappings().first()

    # 2. Fallback to legacy members table
    if row is None:
        row = session.execute(
            text("select id, name, role, project_id from members where role = :role and project_id = :pid and active = 1"),
            {"role": body.role, "pid": DEMO_PROJECT_ID},
        ).mappings().first()

    # 3. If neither has the seeded demo user, re-seed and fetch again
    if row is None:
        seed_demo(session)
        row = session.execute(
            text("""
                select u.id, u.name, pm.role, pm.project_id
                from project_memberships pm
                join users u on u.id = pm.user_id
                where pm.role = :role and pm.project_id = :pid and pm.active = 1
            """),
            {"role": body.role, "pid": DEMO_PROJECT_ID},
        ).mappings().first()

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
        assigned_role = existing_by_id["role"]
        if assigned_role != body.role:
            raise HTTPException(
                status_code=400,
                detail=f"Account already registered with role '{assigned_role}'. Unrestricted role switching is disabled.",
            )

    # 2. Approver registration requires invitation code or admin approval
    if body.role == "approver" and not (existing_by_id and existing_by_id.get("role") == "approver"):
        approved = False
        if body.invitation_code and body.invitation_code.strip():
            code_clean = body.invitation_code.strip()
            inv_row = session.execute(
                text("select id, code, role, email, status, project_id from invitations where code = :code and status = 'active'"),
                {"code": code_clean},
            ).mappings().first()
            if inv_row:
                if inv_row["role"] != "approver":
                    raise HTTPException(status_code=403, detail="Invitation code is not valid for Approver access.")
                if inv_row["email"] and inv_row["email"].lower() != email_clean:
                    raise HTTPException(status_code=403, detail="Invitation code was issued to a different email address.")
                approved = True
                if inv_row.get("project_id") and not body.project_id:
                    target_project_id = inv_row["project_id"]
                session.execute(
                    text("update invitations set status = 'used', used_by = :uid, used_at = :now where id = :id"),
                    {"uid": uid, "now": audit.now_iso(), "id": inv_row["id"]},
                )
            else:
                raise HTTPException(
                    status_code=403,
                    detail="Invalid or expired invitation code for Approver access.",
                )
        if not approved:
            admin_appr = session.execute(
                text("select id, project_id from invitations where lower(email) = :email and role = 'approver' and status in ('approved', 'active')"),
                {"email": email_clean},
            ).mappings().first()
            if admin_appr:
                approved = True
                if admin_appr.get("project_id") and not body.project_id:
                    target_project_id = admin_appr["project_id"]
                session.execute(
                    text("update invitations set status = 'used', used_by = :uid, used_at = :now where id = :id"),
                    {"uid": uid, "now": audit.now_iso(), "id": admin_appr["id"]},
                )

        if not approved:
            raise HTTPException(
                status_code=403,
                detail="Approver registration requires a valid invitation code or admin approval.",
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
    session.execute(
        text("""
            insert into project_memberships (user_id, project_id, role, active, created_at)
            values (:uid, :pid, :role, 1, :now)
            on conflict (user_id, project_id) do update set role = :role, active = 1
        """),
        {"uid": uid, "pid": target_project_id, "role": body.role, "now": now},
    )

    # Sync legacy members table
    try:
        session.execute(
            text("insert into members (id, project_id, name, role, active, email, is_demo) values (:id, :project_id, :name, :role, 1, :email, 0) on conflict (id) do update set project_id = :project_id, role = :role, active = 1, name = :name, email = :email"),
            {"id": uid, "project_id": target_project_id, "name": name_clean, "role": body.role, "email": email_clean},
        )
    except Exception:
        pass

    session.commit()
    user = User(
        id=uid,
        name=name_clean,
        role=body.role,
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
        text("select id, code, role, email, status, project_id from invitations where code = :code and status = 'active'"),
        {"code": code_clean},
    ).mappings().first()

    if not inv:
        raise HTTPException(status_code=400, detail="Invalid or expired invitation code.")

    if inv.get("email") and account.email:
        if inv["email"].lower().strip() != account.email.lower().strip():
            raise HTTPException(status_code=403, detail="Invitation code was issued to a different email address.")

    target_pid = inv.get("project_id") or DEMO_PROJECT_ID
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
    session.execute(
        text("""
            insert into project_memberships (user_id, project_id, role, active, created_at)
            values (:uid, :pid, :role, 1, :now)
            on conflict (user_id, project_id) do update set role = :role, active = 1
        """),
        {"uid": account.id, "pid": target_pid, "role": inv["role"], "now": now},
    )

    try:
        session.execute(
            text("""
                insert into members (id, project_id, name, role, active, email, is_demo)
                values (:id, :pid, :name, :role, 1, :email, :demo)
                on conflict (id) do update set project_id = :pid, role = :role, active = 1
            """),
            {
                "id": account.id,
                "pid": target_pid,
                "name": account.name,
                "role": inv["role"],
                "email": account.email,
                "demo": 1 if account.is_demo else 0,
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
    try:
        audit.log(session, user, "auth.switch_project", obj=membership["id"])
    except Exception:
        pass

    return {
        "token": make_token(user),
        "user": user.__dict__,
        "project": {"id": membership["id"], "name": membership["name"], "role": membership["role"]},
    }


@router.get("/projects/{project_id}/members", tags=["projects"])
def list_project_members(
    project_id: str,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    if user.project_id != project_id:
        raise HTTPException(status_code=403, detail="Access denied to this project's members.")

    rows = session.execute(
        text("""
            select u.id, u.name, u.email, u.is_demo, pm.role, pm.active, pm.created_at
            from project_memberships pm
            join users u on u.id = pm.user_id
            where pm.project_id = :pid
            order by pm.created_at asc
        """),
        {"pid": project_id},
    ).mappings().all()

    if not rows:
        rows = session.execute(
            text("""
                select id, name, email, is_demo, role, active
                from members
                where project_id = :pid
            """),
            {"pid": project_id},
        ).mappings().all()

    return [
        {
            "id": r["id"],
            "name": r["name"],
            "email": r.get("email"),
            "role": r["role"],
            "active": bool(r["active"]),
            "is_demo": bool(r.get("is_demo", 0)),
        }
        for r in rows
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


@router.get("/auth/invitations/validate", tags=["core"])
def validate_invitation(code: str = Query(...), session: Session = Depends(get_session)):
    code_clean = code.strip()
    row = session.execute(
        text("""
            select i.id, i.code, i.role, i.email, i.status, i.project_id, p.name as project_name
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
        "role": row["role"],
        "email": row.get("email"),
        "project_id": row.get("project_id"),
        "project_name": row.get("project_name"),
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
    if membership and membership["active"] and membership["role"] == "approver":
        is_approver = True
    else:
        legacy_m = session.execute(
            text("""
                select role, active from members
                where id = :uid and (project_id = :pid or project_id is null)
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
            insert into invitations (id, project_id, code, role, email, status, created_at)
            values (:id, :project_id, :code, :role, :email, 'active', :created_at)
        """),
        {
            "id": inv_id,
            "project_id": target_pid,
            "code": code,
            "role": body.role,
            "email": email_clean,
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
    if membership and membership["active"] and membership["role"] == "approver":
        is_approver = True
    else:
        legacy_m = session.execute(
            text("""
                select role, active from members
                where id = :uid and (project_id = :pid or project_id is null)
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
            select i.id, i.project_id, i.code, i.role, i.email, i.status, i.created_at, i.used_by, i.used_at,
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
            "role": r["role"],
            "email": r["email"],
            "status": "redeemed" if r["status"] == "used" else r["status"],
            "created_at": r["created_at"],
            "used_by": r["used_by"],
            "used_by_name": r["used_by_name"],
            "used_at": r["used_at"],
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
    if membership and membership["active"] and membership["role"] == "approver":
        is_approver = True
    else:
        legacy_m = session.execute(
            text("""
                select role, active from members
                where id = :uid and (project_id = :pid or project_id is null)
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
