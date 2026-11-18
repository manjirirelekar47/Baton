"""Regression tests for Multi-Project Support, RBAC, isolation, and last-approver guard."""
import uuid

from tests.conftest import login, make_supabase_token


def test_zero_membership_account_and_create_project(client):
    """Users with zero memberships can authenticate at account level and create a project."""
    uid = f"user-{uuid.uuid4().hex[:8]}"
    email = f"lead-{uuid.uuid4().hex[:6]}@example.com"
    token = make_supabase_token(user_id=uid, email=email)

    # 1. POST /auth/session for a brand new user with 0 projects
    session_res = client.post(
        "/auth/session",
        json={"user_id": uid, "email": email, "name": "Lead User"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert session_res.status_code == 200
    data = session_res.json()
    assert data["registered"] is True
    assert data["has_projects"] is False
    assert data["requires_project"] is True
    account_token = data["token"]

    # 2. GET /projects with account token returns empty list
    projs_res = client.get("/projects", headers={"Authorization": f"Bearer {account_token}"})
    assert projs_res.status_code == 200
    assert projs_res.json() == []

    # 3. Create project via POST /projects
    create_res = client.post(
        "/projects",
        json={"name": "Alpha Payment Gateway"},
        headers={"Authorization": f"Bearer {account_token}"},
    )
    assert create_res.status_code == 200
    created_data = create_res.json()
    project = created_data["project"]
    assert project["name"] == "Alpha Payment Gateway"
    assert project["role"] == "approver"
    assert project["id"].startswith("proj-")
    project_token = created_data["token"]

    # 4. With project token, GET /projects returns the project
    projs_res2 = client.get("/projects", headers={"Authorization": f"Bearer {project_token}"})
    assert projs_res2.status_code == 200
    assert len(projs_res2.json()) == 1
    assert projs_res2.json()[0]["id"] == project["id"]
    assert projs_res2.json()[0]["role"] == "approver"


def test_project_invitation_creation_and_atomic_join(client):
    """Approver creates invitation, another user redeems it atomically, cannot double-redeem."""
    # Seed approver on a new project
    admin_uid = f"admin-{uuid.uuid4().hex[:8]}"
    admin_email = f"admin-{uuid.uuid4().hex[:6]}@example.com"
    admin_jwt = make_supabase_token(user_id=admin_uid, email=admin_email)
    s_res = client.post(
        "/auth/session",
        json={"user_id": admin_uid, "email": admin_email, "name": "Admin User"},
        headers={"Authorization": f"Bearer {admin_jwt}"},
    )
    acc_token = s_res.json()["token"]

    p_res = client.post(
        "/projects",
        json={"name": "Logistics Platform"},
        headers={"Authorization": f"Bearer {acc_token}"},
    )
    proj_id = p_res.json()["project"]["id"]
    admin_token = p_res.json()["token"]

    # 1. Non-approver cannot create invitation
    contrib_token = login(client, "incoming_contributor")
    inv_fail = client.post(
        "/auth/invitations",
        json={"role": "incoming_maintainer"},
        headers=contrib_token,
    )
    assert inv_fail.status_code == 403

    # 2. Approver creates invitation
    inv_res = client.post(
        "/auth/invitations",
        json={"role": "incoming_maintainer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert inv_res.status_code == 200
    inv_code = inv_res.json()["code"]
    assert inv_res.json()["project_id"] == proj_id

    # 3. New user joins project with invitation code
    joiner_uid = f"joiner-{uuid.uuid4().hex[:8]}"
    joiner_email = f"joiner-{uuid.uuid4().hex[:6]}@example.com"
    joiner_jwt = make_supabase_token(user_id=joiner_uid, email=joiner_email)
    joiner_s = client.post(
        "/auth/session",
        json={"user_id": joiner_uid, "email": joiner_email, "name": "Joiner User"},
        headers={"Authorization": f"Bearer {joiner_jwt}"},
    )
    joiner_acc_token = joiner_s.json()["token"]

    join_res = client.post(
        "/projects/join",
        json={"invitation_code": inv_code},
        headers={"Authorization": f"Bearer {joiner_acc_token}"},
    )
    assert join_res.status_code == 200
    join_data = join_res.json()
    assert join_data["project"]["id"] == proj_id
    assert join_data["project"]["role"] == "incoming_maintainer"
    assert join_data["user"]["role"] == "incoming_maintainer"

    # 4. Atomic single-use: same code cannot be redeemed again
    other_uid = f"other-{uuid.uuid4().hex[:8]}"
    other_email = f"other-{uuid.uuid4().hex[:6]}@example.com"
    other_jwt = make_supabase_token(user_id=other_uid, email=other_email)
    other_s = client.post(
        "/auth/session",
        json={"user_id": other_uid, "email": other_email, "name": "Other User"},
        headers={"Authorization": f"Bearer {other_jwt}"},
    )
    other_token = other_s.json()["token"]

    double_redeem = client.post(
        "/projects/join",
        json={"invitation_code": inv_code},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert double_redeem.status_code == 400 or double_redeem.status_code == 409

    # 5. User who is already a member cannot join the same project again
    existing_member_join = client.post(
        "/projects/join",
        json={"invitation_code": inv_code},
        headers={"Authorization": f"Bearer {join_data['token']}"},
    )
    assert existing_member_join.status_code in (400, 409)


def test_project_switching_and_isolation(client):
    """User with access to multiple projects can switch between them without re-logging in."""
    uid = f"multi-{uuid.uuid4().hex[:8]}"
    email = f"multi-{uuid.uuid4().hex[:6]}@example.com"
    jwt_token = make_supabase_token(user_id=uid, email=email)
    s_res = client.post(
        "/auth/session",
        json={"user_id": uid, "email": email, "name": "Multi Project User"},
        headers={"Authorization": f"Bearer {jwt_token}"},
    )
    acc_token = s_res.json()["token"]

    # Create project 1
    p1 = client.post(
        "/projects",
        json={"name": "Project One"},
        headers={"Authorization": f"Bearer {acc_token}"},
    ).json()["project"]

    # Create project 2
    p2 = client.post(
        "/projects",
        json={"name": "Project Two"},
        headers={"Authorization": f"Bearer {acc_token}"},
    ).json()["project"]

    # Switch to project 1
    sw1 = client.post(
        "/auth/switch-project",
        json={"project_id": p1["id"]},
        headers={"Authorization": f"Bearer {acc_token}"},
    )
    assert sw1.status_code == 200
    t1 = sw1.json()["token"]
    assert sw1.json()["project"]["id"] == p1["id"]

    # Switch to project 2
    sw2 = client.post(
        "/auth/switch-project",
        json={"project_id": p2["id"]},
        headers={"Authorization": f"Bearer {t1}"},
    )
    assert sw2.status_code == 200
    assert sw2.json()["project"]["id"] == p2["id"]

    # Attempt to switch to an unauthorized project
    sw_bad = client.post(
        "/auth/switch-project",
        json={"project_id": "proj-nonexistent-999"},
        headers={"Authorization": f"Bearer {t1}"},
    )
    assert sw_bad.status_code == 403


def test_last_approver_protection(client):
    """Cannot demote or deactivate the last active Approver in a project."""
    admin_uid = f"solo-{uuid.uuid4().hex[:8]}"
    admin_email = f"solo-{uuid.uuid4().hex[:6]}@example.com"
    admin_jwt = make_supabase_token(user_id=admin_uid, email=admin_email)
    s_res = client.post(
        "/auth/session",
        json={"user_id": admin_uid, "email": admin_email, "name": "Solo Admin"},
        headers={"Authorization": f"Bearer {admin_jwt}"},
    )
    token = client.post(
        "/projects",
        json={"name": "Protected Project"},
        headers={"Authorization": f"Bearer {s_res.json()['token']}"},
    ).json()["token"]
    proj_id = client.get("/projects", headers={"Authorization": f"Bearer {token}"}).json()[0]["id"]

    # Attempt to demote the solo approver
    demote_res = client.patch(
        f"/projects/{proj_id}/members/{admin_uid}",
        json={"role": "incoming_maintainer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert demote_res.status_code == 400
    assert "last active Approver" in demote_res.json()["detail"]

    # Attempt to deactivate the solo approver
    deactivate_res = client.patch(
        f"/projects/{proj_id}/members/{admin_uid}",
        json={"active": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert deactivate_res.status_code == 400
    assert "last active Approver" in deactivate_res.json()["detail"]


def test_inactive_or_missing_project_memberships_cannot_be_bypassed_via_legacy_members(client):
    """Check 1: Inactive or missing project_memberships cannot be bypassed via legacy members records."""
    from sqlalchemy import text

    from app.core.db import get_engine

    uid = f"revoked-{uuid.uuid4().hex[:8]}"
    email = f"revoked-{uuid.uuid4().hex[:6]}@example.com"
    proj_id = f"proj-{uuid.uuid4()}"

    # Setup database state directly:
    # user has project_memberships with active=0, but legacy members with active=1
    with get_engine().begin() as conn:
        conn.execute(
            text("insert into projects (id, name, created_at) values (:pid, 'Revocation Test', '2026-01-01T00:00:00Z')"),
            {"pid": proj_id},
        )
        conn.execute(
            text("insert into users (id, email, name, is_demo, created_at) values (:uid, :email, 'Revoked User', 0, '2026-01-01T00:00:00Z')"),
            {"uid": uid, "email": email},
        )
        # Deactivated in project_memberships!
        conn.execute(
            text("insert into project_memberships (user_id, project_id, role, active, created_at) values (:uid, :pid, 'approver', 0, '2026-01-01T00:00:00Z')"),
            {"uid": uid, "pid": proj_id},
        )
        # Active in legacy members
        conn.execute(
            text("insert into members (id, project_id, name, role, active, email, is_demo) values (:uid, :pid, 'Revoked User', 'approver', 1, :email, 0)"),
            {"uid": uid, "pid": proj_id, "email": email},
        )

    # Attempt to authenticate with project-scoped token
    from app.core.auth import User, make_token
    token = make_token(User(id=uid, name="Revoked User", role="approver", project_id=proj_id, email=email, is_demo=False))

    # /me endpoint must reject with 401
    me_res = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 401
    assert "no longer has access" in me_res.json()["detail"].lower()


def test_new_email_and_oauth_users_create_and_join_without_global_role(client):
    """Check 2: New email and OAuth users can create or join projects without selecting a global role."""
    # 1. New email/password user logs in via Supabase -> session sync
    email_uid = f"email-user-{uuid.uuid4().hex[:8]}"
    email_addr = f"user-{uuid.uuid4().hex[:6]}@example.com"
    email_jwt = make_supabase_token(user_id=email_uid, email=email_addr)

    s1 = client.post(
        "/auth/session",
        json={"user_id": email_uid, "email": email_addr, "name": "Email Creator"},
        headers={"Authorization": f"Bearer {email_jwt}"},
    )
    assert s1.status_code == 200
    assert s1.json()["registered"] is True
    assert s1.json()["requires_project"] is True
    creator_acc_token = s1.json()["token"]

    # User creates project WITHOUT selecting a global role
    p_res = client.post(
        "/projects",
        json={"name": "No Role Global Project"},
        headers={"Authorization": f"Bearer {creator_acc_token}"},
    )
    assert p_res.status_code == 200
    p_data = p_res.json()
    proj_id = p_data["project"]["id"]
    creator_proj_token = p_data["token"]
    assert p_data["user"]["role"] == "approver"

    # Creator generates an invitation for a collaborator
    inv_res = client.post(
        "/auth/invitations",
        json={"role": "incoming_maintainer"},
        headers={"Authorization": f"Bearer {creator_proj_token}"},
    )
    assert inv_res.status_code == 200
    inv_code = inv_res.json()["code"]

    # 2. New OAuth user authenticates via OAuth -> session sync without selecting a global role
    oauth_uid = f"oauth-user-{uuid.uuid4().hex[:8]}"
    oauth_addr = f"oauth-{uuid.uuid4().hex[:6]}@gmail.com"
    oauth_jwt = make_supabase_token(user_id=oauth_uid, email=oauth_addr)

    s2 = client.post(
        "/auth/session",
        json={"user_id": oauth_uid, "email": oauth_addr, "name": "OAuth Joiner"},
        headers={"Authorization": f"Bearer {oauth_jwt}"},
    )
    assert s2.status_code == 200
    assert s2.json()["requires_project"] is True
    joiner_acc_token = s2.json()["token"]

    # OAuth user joins project using the invitation code
    join_res = client.post(
        "/projects/join",
        json={"invitation_code": inv_code},
        headers={"Authorization": f"Bearer {joiner_acc_token}"},
    )
    assert join_res.status_code == 200
    join_data = join_res.json()
    assert join_data["project"]["id"] == proj_id
    assert join_data["user"]["role"] == "incoming_maintainer"


def test_last_approver_protection_concurrent_demotions(client):
    """Check 3: Concurrent/sequential demotions of multiple approvers cannot leave 0 active approvers."""
    # Create project with Approver 1
    a1_uid = f"appr1-{uuid.uuid4().hex[:8]}"
    a1_email = f"appr1-{uuid.uuid4().hex[:6]}@example.com"
    a1_jwt = make_supabase_token(user_id=a1_uid, email=a1_email)
    s1 = client.post(
        "/auth/session",
        json={"user_id": a1_uid, "email": a1_email, "name": "Approver One"},
        headers={"Authorization": f"Bearer {a1_jwt}"},
    )
    p_res = client.post(
        "/projects",
        json={"name": "Multi-Approver Project"},
        headers={"Authorization": f"Bearer {s1.json()['token']}"},
    )
    proj_id = p_res.json()["project"]["id"]
    t1 = p_res.json()["token"]

    # Invite Approver 2
    inv_code = client.post(
        "/auth/invitations",
        json={"role": "approver"},
        headers={"Authorization": f"Bearer {t1}"},
    ).json()["code"]

    a2_uid = f"appr2-{uuid.uuid4().hex[:8]}"
    a2_email = f"appr2-{uuid.uuid4().hex[:6]}@example.com"
    a2_jwt = make_supabase_token(user_id=a2_uid, email=a2_email)
    s2 = client.post(
        "/auth/session",
        json={"user_id": a2_uid, "email": a2_email, "name": "Approver Two"},
        headers={"Authorization": f"Bearer {a2_jwt}"},
    )
    client.post(
        "/projects/join",
        json={"invitation_code": inv_code},
        headers={"Authorization": f"Bearer {s2.json()['token']}"},
    )

    # Both a1 and a2 are approvers. Demoting a1 succeeds (since a2 remains)
    demote_a1 = client.patch(
        f"/projects/{proj_id}/members/{a1_uid}",
        json={"role": "incoming_maintainer"},
        headers={"Authorization": f"Bearer {t1}"},
    )
    assert demote_a1.status_code == 200

    # Demoting a2 MUST FAIL because a2 is now the last active approver
    # Refresh token or switch to a2
    sw_a2 = client.post(
        "/auth/switch-project",
        json={"project_id": proj_id},
        headers={"Authorization": f"Bearer {s2.json()['token']}"},
    )
    t2 = sw_a2.json()["token"]

    demote_a2 = client.patch(
        f"/projects/{proj_id}/members/{a2_uid}",
        json={"role": "incoming_maintainer"},
        headers={"Authorization": f"Bearer {t2}"},
    )
    assert demote_a2.status_code == 400
    assert "last active Approver" in demote_a2.json()["detail"]


def test_oauth_callback_rejected_when_membership_revoked_during_oauth(client):
    """Check 6: OAuth flow is rejected if the initiating Approver is revoked before callback completes."""
    from sqlalchemy import text

    from app.core.db import get_engine
    from app.modules.ingestion import crypto
    from app.modules.ingestion import service as ingestion_service

    # Create project and approver
    uid = f"oauth-lead-{uuid.uuid4().hex[:8]}"
    email = f"lead-{uuid.uuid4().hex[:6]}@example.com"
    token = make_supabase_token(user_id=uid, email=email)
    s = client.post(
        "/auth/session",
        json={"user_id": uid, "email": email, "name": "OAuth Lead"},
        headers={"Authorization": f"Bearer {token}"},
    )
    p = client.post(
        "/projects",
        json={"name": "OAuth Source Project"},
        headers={"Authorization": f"Bearer {s.json()['token']}"},
    ).json()["project"]
    proj_id = p["id"]

    # Generate OAuth state
    engine = get_engine()
    from sqlalchemy.orm import Session as SASession
    with SASession(engine) as session:
        state_token = crypto.generate_oauth_state(
            session,
            project_id=proj_id,
            provider="github",
            target_name="github-repo",
            acl_label="L1",
            user_id=uid,
        )

        # Simulate revocation: deactivate user in project_memberships while OAuth was in progress
        session.execute(
            text("update project_memberships set active = 0 where user_id = :uid and project_id = :pid"),
            {"uid": uid, "pid": proj_id},
        )
        session.commit()

    # Attempting to complete the OAuth flow must raise OAuthStateError / reject
    import pytest
    with pytest.raises(crypto.OAuthStateError, match="no longer an active Approver"):
        with SASession(engine) as session:
            ingestion_service.complete_oauth_flow(
                session,
                provider="github",
                code="fake-auth-code",
                state_token=state_token,
            )


def test_cross_project_isolation_endpoints_and_jobs(client):
    """Check 7: Cross-project access is strictly blocked across projects."""
    # Create Project A
    u1_uid = f"user-a-{uuid.uuid4().hex[:8]}"
    u1_email = f"usera-{uuid.uuid4().hex[:6]}@example.com"
    jwt_a = make_supabase_token(user_id=u1_uid, email=u1_email)
    s_a = client.post("/auth/session", json={"user_id": u1_uid, "email": u1_email, "name": "User A"}, headers={"Authorization": f"Bearer {jwt_a}"})
    p_a = client.post("/projects", json={"name": "Project Alpha"}, headers={"Authorization": f"Bearer {s_a.json()['token']}"}).json()["project"]
    client.post("/auth/switch-project", json={"project_id": p_a["id"]}, headers={"Authorization": f"Bearer {s_a.json()['token']}"})

    # Create Project B
    u2_uid = f"user-b-{uuid.uuid4().hex[:8]}"
    u2_email = f"userb-{uuid.uuid4().hex[:6]}@example.com"
    jwt_b = make_supabase_token(user_id=u2_uid, email=u2_email)
    s_b = client.post("/auth/session", json={"user_id": u2_uid, "email": u2_email, "name": "User B"}, headers={"Authorization": f"Bearer {jwt_b}"})
    p_b = client.post("/projects", json={"name": "Project Beta"}, headers={"Authorization": f"Bearer {s_b.json()['token']}"}).json()["project"]
    token_b = client.post("/auth/switch-project", json={"project_id": p_b["id"]}, headers={"Authorization": f"Bearer {s_b.json()['token']}"}).json()["token"]

    # User B cannot access Project A's member list
    bad_members = client.get(f"/projects/{p_a['id']}/members", headers={"Authorization": f"Bearer {token_b}"})
    assert bad_members.status_code == 403

    # User B cannot modify Project A's members
    bad_mod = client.patch(f"/projects/{p_a['id']}/members/{u1_uid}", json={"role": "leaver"}, headers={"Authorization": f"Bearer {token_b}"})
    assert bad_mod.status_code == 403


def test_project_invitation_lifecycle_and_rbac(client):
    """Complete project invitation lifecycle: role selection, optional email, list, revoke, single-use, RBAC."""
    # 1. Create Project as Approver
    approver_uid = f"appr-{uuid.uuid4().hex[:8]}"
    approver_email = f"lead-{uuid.uuid4().hex[:6]}@example.com"
    jwt_appr = make_supabase_token(user_id=approver_uid, email=approver_email)
    s_res = client.post("/auth/session", json={"user_id": approver_uid, "email": approver_email, "name": "Team Lead"}, headers={"Authorization": f"Bearer {jwt_appr}"})
    proj = client.post("/projects", json={"name": "Mission Critical Service"}, headers={"Authorization": f"Bearer {s_res.json()['token']}"}).json()["project"]
    proj_id = proj["id"]
    token_approver = client.post("/auth/switch-project", json={"project_id": proj_id}, headers={"Authorization": f"Bearer {s_res.json()['token']}"}).json()["token"]

    # 2. Approver generates invitations for all 4 roles
    roles = ["leaver", "incoming_maintainer", "incoming_contributor", "approver"]
    created_invs = {}
    for r in roles:
        inv_res = client.post(
            "/auth/invitations",
            json={"role": r},
            headers={"Authorization": f"Bearer {token_approver}"},
        )
        assert inv_res.status_code == 200
        inv_data = inv_res.json()
        assert inv_data["role"] == r
        assert inv_data["project_id"] == proj_id
        assert inv_data["code"].startswith(f"INV-{r.upper()}-")
        assert inv_data["status"] == "active"
        created_invs[r] = inv_data

    # 3. Create invitation with restricted email
    restricted_email = f"restricted-{uuid.uuid4().hex[:6]}@example.com"
    restricted_inv = client.post(
        f"/projects/{proj_id}/invitations",
        json={"role": "incoming_maintainer", "email": restricted_email},
        headers={"Authorization": f"Bearer {token_approver}"},
    ).json()
    assert restricted_inv["email"] == restricted_email

    # Wrong user attempts to redeem email-bound invitation
    wrong_uid = f"wrong-{uuid.uuid4().hex[:8]}"
    wrong_email = f"wrong-{uuid.uuid4().hex[:6]}@example.com"
    wrong_jwt = make_supabase_token(user_id=wrong_uid, email=wrong_email)
    s_wrong = client.post("/auth/session", json={"user_id": wrong_uid, "email": wrong_email, "name": "Wrong User"}, headers={"Authorization": f"Bearer {wrong_jwt}"}).json()["token"]
    fail_join = client.post("/projects/join", json={"invitation_code": restricted_inv["code"]}, headers={"Authorization": f"Bearer {s_wrong}"})
    assert fail_join.status_code == 403
    assert "different email" in fail_join.json()["detail"]

    # Target user redeems email-bound invitation successfully
    target_uid = f"target-{uuid.uuid4().hex[:8]}"
    target_jwt = make_supabase_token(user_id=target_uid, email=restricted_email)
    s_target = client.post("/auth/session", json={"user_id": target_uid, "email": restricted_email, "name": "Target Maintainer"}, headers={"Authorization": f"Bearer {target_jwt}"}).json()["token"]
    ok_join = client.post("/projects/join", json={"invitation_code": restricted_inv["code"]}, headers={"Authorization": f"Bearer {s_target}"})
    assert ok_join.status_code == 200
    token_target = ok_join.json()["token"]
    assert ok_join.json()["project"]["role"] == "incoming_maintainer"

    # Single-use protection: cannot be redeemed again
    repeat_join = client.post("/projects/join", json={"invitation_code": restricted_inv["code"]}, headers={"Authorization": f"Bearer {s_wrong}"})
    assert repeat_join.status_code in (400, 409)

    # 4. Approver views invitations list (active, redeemed, revoked)
    list_res = client.get("/auth/invitations", headers={"Authorization": f"Bearer {token_approver}"})
    assert list_res.status_code == 200
    invitations = list_res.json()
    assert len(invitations) >= 5
    redeemed_entry = next((i for i in invitations if i["id"] == restricted_inv["id"]), None)
    assert redeemed_entry is not None
    assert redeemed_entry["status"] == "redeemed"
    assert redeemed_entry["used_by"] == target_uid
    assert redeemed_entry["used_by_name"] == "Target Maintainer"

    # Also check /projects/{project_id}/invitations endpoint
    list_proj_res = client.get(f"/projects/{proj_id}/invitations", headers={"Authorization": f"Bearer {token_approver}"})
    assert list_proj_res.status_code == 200
    assert len(list_proj_res.json()) == len(invitations)

    # 5. Approver revokes an active invitation
    to_revoke = created_invs["leaver"]
    revoke_res = client.post(f"/auth/invitations/{to_revoke['id']}/revoke", headers={"Authorization": f"Bearer {token_approver}"})
    assert revoke_res.status_code == 200
    assert revoke_res.json()["status"] == "revoked"

    # Revoked invitation cannot be redeemed
    leaver_uid = f"leaver-{uuid.uuid4().hex[:8]}"
    leaver_email = f"leaver-{uuid.uuid4().hex[:6]}@example.com"
    leaver_jwt = make_supabase_token(user_id=leaver_uid, email=leaver_email)
    s_leaver = client.post("/auth/session", json={"user_id": leaver_uid, "email": leaver_email, "name": "Leaver Candidate"}, headers={"Authorization": f"Bearer {leaver_jwt}"}).json()["token"]
    revoked_join = client.post("/projects/join", json={"invitation_code": to_revoke["code"]}, headers={"Authorization": f"Bearer {s_leaver}"})
    assert revoked_join.status_code == 400
    assert "Invalid or expired" in revoked_join.json()["detail"]

    # Revoked entry reflected in list
    refreshed_list = client.get("/auth/invitations", headers={"Authorization": f"Bearer {token_approver}"}).json()
    revoked_entry = next(i for i in refreshed_list if i["id"] == to_revoke["id"])
    assert revoked_entry["status"] == "revoked"

    # 6. Non-approver (Target Maintainer) CANNOT create, list, or revoke invitations
    assert client.post("/auth/invitations", json={"role": "leaver"}, headers={"Authorization": f"Bearer {token_target}"}).status_code == 403
    assert client.get("/auth/invitations", headers={"Authorization": f"Bearer {token_target}"}).status_code == 403
    assert client.post(f"/auth/invitations/{created_invs['incoming_contributor']['id']}/revoke", headers={"Authorization": f"Bearer {token_target}"}).status_code == 403

    # 7. Cross-project isolation: Approver of Project B cannot access Project A invitations
    b_uid = f"lead-b-{uuid.uuid4().hex[:8]}"
    b_email = f"leadb-{uuid.uuid4().hex[:6]}@example.com"
    b_jwt = make_supabase_token(user_id=b_uid, email=b_email)
    s_b = client.post("/auth/session", json={"user_id": b_uid, "email": b_email, "name": "Lead B"}, headers={"Authorization": f"Bearer {b_jwt}"}).json()["token"]
    proj_b = client.post("/projects", json={"name": "Project Beta"}, headers={"Authorization": f"Bearer {s_b}"}).json()["project"]
    token_b = client.post("/auth/switch-project", json={"project_id": proj_b["id"]}, headers={"Authorization": f"Bearer {s_b}"}).json()["token"]

    assert client.get(f"/projects/{proj_id}/invitations", headers={"Authorization": f"Bearer {token_b}"}).status_code == 403
    assert client.post(f"/projects/{proj_id}/invitations", json={"role": "leaver"}, headers={"Authorization": f"Bearer {token_b}"}).status_code == 403
    assert client.post(f"/auth/invitations/{created_invs['approver']['id']}/revoke", headers={"Authorization": f"Bearer {token_b}"}).status_code == 404


def test_project_specific_invitation_creation_endpoint_approver_membership(client):
    """Regression test: POST /projects/{project_id}/invitations validates Approver membership in newly created project."""
    import re
    # 1. User signs in and creates a new project
    uid = f"appr-lead-{uuid.uuid4().hex[:8]}"
    email = f"lead-{uuid.uuid4().hex[:6]}@enterprise.test"
    jwt_tok = make_supabase_token(user_id=uid, email=email)

    session_res = client.post(
        "/auth/session",
        json={"user_id": uid, "email": email, "name": "Enterprise Lead"},
        headers={"Authorization": f"Bearer {jwt_tok}"},
    )
    assert session_res.status_code == 200
    account_token = session_res.json()["token"]

    create_proj_res = client.post(
        "/projects",
        json={"name": "Cloud Architecture Platform"},
        headers={"Authorization": f"Bearer {account_token}"},
    )
    assert create_proj_res.status_code == 200
    p_data = create_proj_res.json()
    proj_id = p_data["project"]["id"]
    proj_token = p_data["token"]
    assert p_data["user"]["role"] == "approver"
    assert p_data["user"]["project_id"] == proj_id

    # 2. Approver calls POST /projects/{project_id}/invitations to generate single-use code
    for role in ["approver", "leaver", "incoming_maintainer", "incoming_contributor"]:
        inv_res = client.post(
            f"/projects/{proj_id}/invitations",
            json={"role": role, "email": f"{role}@enterprise.test"},
            headers={"Authorization": f"Bearer {proj_token}"},
        )
        assert inv_res.status_code == 200, f"Failed to create invitation for {role}: {inv_res.text}"
        inv_data = inv_res.json()
        assert inv_data["project_id"] == proj_id
        assert inv_data["role"] == role
        assert inv_data["email"] == f"{role}@enterprise.test"
        assert inv_data["status"] == "active"
        assert re.match(rf"^INV-{role.upper()}-[A-F0-9]{{16}}$", inv_data["code"])

    # 3. Verify invitations appear under Manage Invitations GET /projects/{project_id}/invitations
    list_res = client.get(
        f"/projects/{proj_id}/invitations",
        headers={"Authorization": f"Bearer {proj_token}"},
    )
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) == 4
    for it in items:
        assert it["project_id"] == proj_id
        assert it["status"] == "active"

    # 4. Another user who is NOT an Approver of this project cannot generate invitations for it
    other_uid = f"other-{uuid.uuid4().hex[:8]}"
    other_email = f"other-{uuid.uuid4().hex[:6]}@enterprise.test"
    other_jwt = make_supabase_token(user_id=other_uid, email=other_email)
    other_session = client.post(
        "/auth/session",
        json={"user_id": other_uid, "email": other_email, "name": "Other User"},
        headers={"Authorization": f"Bearer {other_jwt}"},
    ).json()["token"]

    # Other user creates their own project and gets their own token
    other_proj = client.post(
        "/projects",
        json={"name": "Separate Project"},
        headers={"Authorization": f"Bearer {other_session}"},
    ).json()["project"]
    other_token = client.post(
        "/auth/switch-project",
        json={"project_id": other_proj["id"]},
        headers={"Authorization": f"Bearer {other_session}"},
    ).json()["token"]

    # Attempting to create invitation for proj_id using other_token fails with 403
    forbidden_res = client.post(
        f"/projects/{proj_id}/invitations",
        json={"role": "incoming_contributor"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert forbidden_res.status_code == 403
    assert "Only active Approvers" in forbidden_res.json()["detail"]
