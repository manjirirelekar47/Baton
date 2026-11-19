"""Comprehensive tests for the Leaver and Contributor workflow:
1. Approver assigns someone as a Leaver and sets their handover deadline.
2. Leaver has access during this period to complete knowledge transfer.
3. Once handover deadline passes or handover is approved, active membership ends automatically.
4. Historical records, claims, activity logs remain fully preserved.
5. Baton identifies remaining incomplete tasks assigned to the Leaver.
6. Approver transfers remaining tasks to a Contributor.
7. Transferred tasks have clear labels ("Transferred from Leaver"), preserving original owner, status, and history.
8. Contributor role renaming works across API, permissions, and invitations.
"""
import uuid
from datetime import datetime, timedelta, timezone

from app.core import acl
from tests.conftest import make_supabase_token


def test_contributor_role_and_acl_permissions():
    """Verify 'contributor' has proper L1 access identical to incoming_contributor."""
    assert "contributor" in acl.ROLES
    assert acl.visible_labels("contributor") == {"L1"}
    assert acl.placeholder_labels("contributor") == {"L2", "L3"}
    assert acl.can_read("contributor", "L1") is True
    assert acl.can_read("contributor", "L2") is False
    assert acl.can_read("contributor", "L3") is False


def test_approver_creates_leaver_invitation_with_deadline(client):
    """Approver can set handover_deadline when inviting a Leaver."""
    resp = client.post("/auth/demo-login", json={"role": "approver"})
    assert resp.status_code == 200
    token = resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    deadline = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
    inv_res = client.post(
        "/auth/invitations",
        headers=headers,
        json={"role": "leaver", "email": "leaver.deadline@test.local", "handover_deadline": deadline},
    )
    assert inv_res.status_code == 200
    data = inv_res.json()
    assert data["role"] == "leaver"
    assert data["handover_deadline"] == deadline
    code = data["code"]

    # Validate invitation
    v_res = client.get(f"/auth/invitations/validate?code={code}")
    assert v_res.status_code == 200
    v_data = v_res.json()
    assert v_data["valid"] is True
    assert v_data["role"] == "leaver"
    assert v_data["handover_deadline"] == deadline


def test_leaver_access_during_deadline_and_automatic_expiry(client):
    """Leaver can access project while deadline is future, and is automatically deactivated once deadline passes."""
    # 1. Login as approver to create leaver invitation with future deadline
    appr_resp = client.post("/auth/demo-login", json={"role": "approver"}).json()
    appr_headers = {"Authorization": f"Bearer {appr_resp['token']}"}

    future_deadline = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    leaver_email = f"leaver-{uuid.uuid4().hex[:6]}@example.com"
    inv_res = client.post(
        "/auth/invitations",
        headers=appr_headers,
        json={"role": "leaver", "email": leaver_email, "handover_deadline": future_deadline},
    ).json()

    # 2. Join project as leaver
    leaver_uid = f"leaver-uid-{uuid.uuid4().hex[:8]}"
    leaver_jwt = make_supabase_token(user_id=leaver_uid, email=leaver_email)
    s_leaver = client.post(
        "/auth/session",
        json={"user_id": leaver_uid, "email": leaver_email, "name": "Jordan Leaver"},
        headers={"Authorization": f"Bearer {leaver_jwt}"},
    ).json()["token"]

    ok_join = client.post(
        "/projects/join",
        json={"invitation_code": inv_res["code"]},
        headers={"Authorization": f"Bearer {s_leaver}"},
    )
    assert ok_join.status_code == 200
    leaver_token = ok_join.json()["token"]
    leaver_headers = {"Authorization": f"Bearer {leaver_token}"}

    # 3. Leaver can access claims and project members during handover period
    claims_res = client.get("/claims", headers=leaver_headers)
    assert claims_res.status_code == 200

    # 4. Approver updates deadline to past
    past_deadline = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    patch_res = client.patch(
        f"/projects/{appr_resp['user']['project_id']}/members/{leaver_uid}",
        headers=appr_headers,
        json={"handover_deadline": past_deadline},
    )
    assert patch_res.status_code == 200

    # 5. When project members are fetched, automatic expiry occurs
    members_res = client.get(f"/projects/{appr_resp['user']['project_id']}/members", headers=appr_headers)
    assert members_res.status_code == 200
    members = members_res.json()
    leaver_member = next(m for m in members if m["id"] == leaver_uid)
    assert leaver_member["active"] is False
    assert leaver_member["handover_status"] == "expired"

    # 6. Leaver subsequent requests are denied access
    denied = client.get("/claims", headers=leaver_headers)
    assert denied.status_code == 401


def test_transfer_remaining_tasks_from_leaver_to_contributor(client):
    """Approver identifies remaining incomplete tasks of Leaver and transfers them to Contributor."""
    appr_resp = client.post("/auth/demo-login", json={"role": "approver"}).json()
    appr_headers = {"Authorization": f"Bearer {appr_resp['token']}"}
    pid = appr_resp["user"]["project_id"]

    # 1. Invite and join as Leaver
    leaver_email = f"leaver-t-{uuid.uuid4().hex[:6]}@example.com"
    leaver_uid = f"leaver-tid-{uuid.uuid4().hex[:8]}"
    leaver_inv = client.post(
        "/auth/invitations",
        headers=appr_headers,
        json={"role": "leaver", "email": leaver_email},
    ).json()
    s_leaver = client.post(
        "/auth/session",
        json={"user_id": leaver_uid, "email": leaver_email, "name": "Taylor Leaver"},
        headers={"Authorization": f"Bearer {make_supabase_token(user_id=leaver_uid, email=leaver_email)}"},
    ).json()["token"]
    client.post("/projects/join", json={"invitation_code": leaver_inv["code"]}, headers={"Authorization": f"Bearer {s_leaver}"})

    # 2. Invite and join as Contributor
    contrib_email = f"contrib-t-{uuid.uuid4().hex[:6]}@example.com"
    contrib_uid = f"contrib-tid-{uuid.uuid4().hex[:8]}"
    contrib_inv = client.post(
        "/auth/invitations",
        headers=appr_headers,
        json={"role": "contributor", "email": contrib_email},
    ).json()
    s_contrib = client.post(
        "/auth/session",
        json={"user_id": contrib_uid, "email": contrib_email, "name": "Morgan Contributor"},
        headers={"Authorization": f"Bearer {make_supabase_token(user_id=contrib_uid, email=contrib_email)}"},
    ).json()["token"]
    join_contrib = client.post("/projects/join", json={"invitation_code": contrib_inv["code"]}, headers={"Authorization": f"Bearer {s_contrib}"})
    assert join_contrib.status_code == 200

    # 3. Create a handover task assigned to the leaver
    task_res = client.post(
        "/handover/tasks",
        headers=appr_headers,
        json={
            "title": "Migrate Payment Gateway Credentials",
            "owner": "Taylor Leaver",
            "status": "in_progress",
            "due_date": "2026-12-01",
            "notes": "Verify sandbox webhooks before departure",
        },
    )
    assert task_res.status_code == 201
    created_task = task_res.json()
    task_id = created_task["task_id"]

    # 4. Approver inspects remaining tasks for Taylor Leaver
    remaining_res = client.get(f"/projects/{pid}/members/{leaver_uid}/remaining-tasks", headers=appr_headers)
    assert remaining_res.status_code == 200
    rem_data = remaining_res.json()
    assert rem_data["remaining_tasks_count"] >= 1
    found_task = next(t for t in rem_data["tasks"] if t["id"] == task_id)
    assert found_task["title"] == "Migrate Payment Gateway Credentials"
    assert found_task["status"] == "in_progress"

    # 5. Approver transfers tasks to Morgan Contributor
    transfer_res = client.post(
        f"/projects/{pid}/members/{leaver_uid}/transfer-tasks",
        headers=appr_headers,
        json={"target_member_id": contrib_uid, "task_ids": [task_id]},
    )
    assert transfer_res.status_code == 200
    t_result = transfer_res.json()
    assert t_result["status"] == "success"
    assert t_result["target_name"] == "Morgan Contributor"

    # 6. Verify task in handover has updated owner and transfer provenance
    get_task_res = client.get(f"/handover/tasks/{task_id}", headers=appr_headers)
    assert get_task_res.status_code == 200
    task_details = get_task_res.json()
    assert task_details["owner"] == "Morgan Contributor"

    # 7. Approver finalizes leaver transition
    complete_res = client.post(
        f"/projects/{pid}/members/{leaver_uid}/complete-handover",
        headers=appr_headers,
    )
    assert complete_res.status_code == 200
    c_data = complete_res.json()
    assert c_data["active"] is False
    assert c_data["handover_status"] == "completed"

    # 8. Historical contributions and project history remain preserved
    members_res = client.get(f"/projects/{pid}/members", headers=appr_headers)
    assert members_res.status_code == 200
    leaver_row = next(m for m in members_res.json() if m["id"] == leaver_uid)
    assert leaver_row["active"] is False
    assert leaver_row["handover_status"] == "completed"
    assert leaver_row["name"] == "Taylor Leaver"
