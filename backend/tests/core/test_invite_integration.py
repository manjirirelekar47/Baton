"""Integration tests for Issue 1: Invited Leaver and Reviewers join shared workspace.

Verifies:
1. Approver creates project, uploads sources, and reconstructs claims.
2. Approver creates invitation code specifically for Leaver (and other roles).
3. Leaver redeems invitation code and automatically switches active project_id.
4. Approver sees Team Members count update to 2.
5. Leaver sees shared project data (Dashboard KPIs, Sources, Claims, Knowledge Graph, Risk Radar, Handover).
6. Leaver exercises proper permissions (uploading/connecting sources, capturing notes,
   editing/attesting claims in review, and creating/updating handover items) without role blocks.
"""
import io
import time
import uuid

from tests.conftest import make_supabase_token


def test_invited_leaver_joins_shared_workspace_and_exercises_permissions(client):
    # 1. Approver creates project and uploads architecture source
    appr_uid = f"approver-{uuid.uuid4().hex[:8]}"
    appr_email = f"approver-{uuid.uuid4().hex[:6]}@example.com"
    appr_sb_jwt = make_supabase_token(user_id=appr_uid, email=appr_email)

    s_res = client.post(
        "/auth/session",
        json={"user_id": appr_uid, "email": appr_email, "name": "Elena Approver"},
        headers={"Authorization": f"Bearer {appr_sb_jwt}"},
    )
    assert s_res.status_code == 200
    account_token = s_res.json()["token"]

    p_res = client.post(
        "/projects",
        json={"name": "Core Banking Architecture"},
        headers={"Authorization": f"Bearer {account_token}"},
    )
    assert p_res.status_code == 200
    proj_id = p_res.json()["project"]["id"]
    appr_token = p_res.json()["token"]
    appr_auth = {"Authorization": f"Bearer {appr_token}"}

    file_content = (
        b"# Payment Gateway System\n\n"
        b"Payment processing utilizes Stripe webhook dispatchers with idempotency keys.\n\n"
        b"- [ ] Verify webhook replay resilience.\n"
    )
    upload_res = client.post(
        "/sources",
        files={"file": ("gateway.md", io.BytesIO(file_content), "text/markdown")},
        data={"consent": "true", "acl_label": "L1"},
        headers=appr_auth,
    )
    assert upload_res.status_code == 201

    recon_res = client.post("/reconstruct", headers=appr_auth)
    assert recon_res.status_code == 200
    job_id = recon_res.json()["job_id"]

    for _ in range(60):
        job_res = client.get(f"/jobs/{job_id}", headers=appr_auth)
        if job_res.status_code == 200 and job_res.json().get("status") in ("done", "failed"):
            assert job_res.json().get("status") == "done"
            break
        time.sleep(0.1)

    appr_claims_res = client.get("/claims", headers=appr_auth)
    assert appr_claims_res.status_code == 200
    appr_claims = appr_claims_res.json()["claims"]
    assert len(appr_claims) >= 1

    # Team count is initially 1
    m_res = client.get(f"/projects/{proj_id}/members", headers=appr_auth)
    assert m_res.status_code == 200
    assert len(m_res.json()) == 1

    # 2. Approver creates invitation specifically for role LEAVER
    inv_res = client.post(
        "/auth/invitations",
        json={"role": "leaver"},
        headers=appr_auth,
    )
    assert inv_res.status_code == 200
    invite_code = inv_res.json()["code"]
    assert "LEAVER" in invite_code

    # 3. Leaver signs in and redeems invitation
    leaver_uid = f"leaver-{uuid.uuid4().hex[:8]}"
    leaver_email = f"leaver-{uuid.uuid4().hex[:6]}@example.com"
    leaver_sb_jwt = make_supabase_token(user_id=leaver_uid, email=leaver_email)

    leaver_session = client.post(
        "/auth/session",
        json={"user_id": leaver_uid, "email": leaver_email, "name": "Devin Leaver"},
        headers={"Authorization": f"Bearer {leaver_sb_jwt}"},
    )
    assert leaver_session.status_code == 200
    leaver_acc_token = leaver_session.json()["token"]
    leaver_acc_auth = {"Authorization": f"Bearer {leaver_acc_token}"}

    # Redeem invitation code
    join_res = client.post(
        "/projects/join",
        json={"invitation_code": invite_code},
        headers=leaver_acc_auth,
    )
    assert join_res.status_code == 200
    join_data = join_res.json()
    assert join_data["project"]["id"] == proj_id
    assert join_data["project"]["role"] == "leaver"
    leaver_token = join_data["token"]
    leaver_auth = {"Authorization": f"Bearer {leaver_token}"}

    # 4. Approver sees Team Members count update to 2
    members_after = client.get(f"/projects/{proj_id}/members", headers=appr_auth).json()
    assert len(members_after) == 2
    roles = {m["email"]: m["role"] for m in members_after}
    assert roles[appr_email] == "approver"
    assert roles[leaver_email] == "leaver"

    # 5. Leaver sees Approver's shared project data
    # Claims
    leaver_claims = client.get("/claims", headers=leaver_auth).json()["claims"]
    assert len(leaver_claims) == len(appr_claims)
    assert leaver_claims[0]["statement"] == appr_claims[0]["statement"]

    # Knowledge Graph
    leaver_graph = client.get("/graph", headers=leaver_auth).json()
    assert len(leaver_graph["nodes"]) >= 1

    # Sources list
    leaver_sources = client.get("/sources", headers=leaver_auth).json()
    assert len(leaver_sources) >= 1
    assert any(s.get("title") == "gateway.md" for s in leaver_sources)

    # Risk radar
    leaver_radar = client.get("/risk-radar", headers=leaver_auth)
    assert leaver_radar.status_code == 200

    # 6. Leaver exercises permissions without role blocks:
    # 6a. Uploading/connecting source
    leaver_upload = client.post(
        "/sources",
        files={"file": ("runbook.md", io.BytesIO(b"# Runbook\n\nDatabase migration steps.\n"), "text/markdown")},
        data={"consent": "true", "acl_label": "L1"},
        headers=leaver_auth,
    )
    assert leaver_upload.status_code == 201

    # 6b. Capturing a note
    leaver_note = client.post(
        "/capture",
        json={
            "title": "On-call Escalation Matrix",
            "body": "Tier 1: primary engineer. Tier 2: lead architect.",
            "acl_label": "L1",
            "consent": True,
        },
        headers=leaver_auth,
    )
    assert leaver_note.status_code == 201

    # 6c. Editing/attesting claim in review
    target_claim_id = appr_claims[0]["claim_id"]
    action_res = client.post(
        f"/review/{target_claim_id}/action",
        json={"action": "edit", "edited_statement": "Updated payment processing pipeline with verified retry logic."},
        headers=leaver_auth,
    )
    assert action_res.status_code == 200

    # Leaver confirms/attests the claim
    attest_res = client.post(
        f"/review/{target_claim_id}/action",
        json={"action": "confirm"},
        headers=leaver_auth,
    )
    assert attest_res.status_code == 200

    # 6d. Handover Checklist: Approver approves version 1
    approve_res = client.post("/review/approve", json={}, headers=appr_auth)
    assert approve_res.status_code == 200
    version_id = approve_res.json()["version_id"]

    # Leaver opens Handover plan
    plan_res = client.get(f"/handover/{version_id}/plan", headers=leaver_auth)
    assert plan_res.status_code == 200

    # Leaver creates a new handover task
    create_task_res = client.post(
        f"/handover/{version_id}/tasks",
        json={"title": "Schedule team shadowing session", "status": "not_started", "blocked_by": []},
        headers=leaver_auth,
    )
    assert create_task_res.status_code == 201
    task_id = create_task_res.json()["task_id"]

    # Leaver updates the handover task status & notes
    update_task_res = client.put(
        f"/handover/{version_id}/tasks/{task_id}",
        json={"status": "in_progress", "notes": "Shadowing scheduled for Monday afternoon."},
        headers=leaver_auth,
    )
    assert update_task_res.status_code == 200
    assert update_task_res.json()["status"] == "in_progress"
    assert update_task_res.json()["notes"] == "Shadowing scheduled for Monday afternoon."


def test_invited_reviewer_sees_shared_workspace_and_updates_team_count(client):
    # 1. Approver signs up and creates project
    appr_uid = f"approver-{uuid.uuid4().hex[:8]}"
    appr_email = f"approver-{uuid.uuid4().hex[:6]}@example.com"
    appr_sb_jwt = make_supabase_token(user_id=appr_uid, email=appr_email)

    s_res = client.post(
        "/auth/session",
        json={"user_id": appr_uid, "email": appr_email, "name": "Elena Approver"},
        headers={"Authorization": f"Bearer {appr_sb_jwt}"},
    )
    assert s_res.status_code == 200
    account_token = s_res.json()["token"]

    p_res = client.post(
        "/projects",
        json={"name": "Mission Critical Pipeline"},
        headers={"Authorization": f"Bearer {account_token}"},
    )
    assert p_res.status_code == 200
    proj_id = p_res.json()["project"]["id"]
    appr_token = p_res.json()["token"]
    appr_auth = {"Authorization": f"Bearer {appr_token}"}

    file_content = (
        b"# Data Warehouse Blueprint\n\n"
        b"Data warehouse runs on ClickHouse with 3 replication nodes.\n\n"
        b"- [ ] Configure monitoring alerts for replication lag.\n"
    )
    upload_res = client.post(
        "/sources",
        files={"file": ("blueprint.md", io.BytesIO(file_content), "text/markdown")},
        data={"consent": "true", "acl_label": "L1"},
        headers=appr_auth,
    )
    assert upload_res.status_code == 201

    recon_res = client.post("/reconstruct", headers=appr_auth)
    assert recon_res.status_code == 200
    job_id = recon_res.json()["job_id"]

    for _ in range(60):
        job_res = client.get(f"/jobs/{job_id}", headers=appr_auth)
        if job_res.status_code == 200 and job_res.json().get("status") in ("done", "failed"):
            assert job_res.json().get("status") == "done"
            break
        time.sleep(0.1)

    claims_res = client.get("/claims", headers=appr_auth)
    assert claims_res.status_code == 200
    appr_claims = claims_res.json()["claims"]
    assert len(appr_claims) >= 1

    # Team count is initially 1
    m_res = client.get(f"/projects/{proj_id}/members", headers=appr_auth)
    assert m_res.status_code == 200
    assert len(m_res.json()) == 1
    assert m_res.json()[0]["email"] == appr_email

    # 2. Approver creates invitation for a reviewer / contributor
    inv_res = client.post(
        "/auth/invitations",
        json={"role": "contributor"},
        headers=appr_auth,
    )
    assert inv_res.status_code == 200
    invite_code = inv_res.json()["code"]
    assert invite_code.startswith("INV-")

    # 3. Reviewer signs in with Supabase and redeems invitation via /projects/join
    rev_uid = f"reviewer-{uuid.uuid4().hex[:8]}"
    rev_email = f"reviewer-{uuid.uuid4().hex[:6]}@example.com"
    rev_sb_jwt = make_supabase_token(user_id=rev_uid, email=rev_email)

    rev_session = client.post(
        "/auth/session",
        json={"user_id": rev_uid, "email": rev_email, "name": "Marcus Reviewer"},
        headers={"Authorization": f"Bearer {rev_sb_jwt}"},
    )
    assert rev_session.status_code == 200
    rev_account_token = rev_session.json()["token"]
    rev_acc_auth = {"Authorization": f"Bearer {rev_account_token}"}

    # Redeem invitation code
    join_res = client.post(
        "/projects/join",
        json={"invitation_code": invite_code},
        headers=rev_acc_auth,
    )
    assert join_res.status_code == 200
    join_data = join_res.json()
    assert join_data["project"]["id"] == proj_id
    rev_token = join_data["token"]
    rev_auth = {"Authorization": f"Bearer {rev_token}"}

    # 4. Approver's Team Members count is now 2!
    m_res_after = client.get(f"/projects/{proj_id}/members", headers=appr_auth)
    assert m_res_after.status_code == 200
    members = m_res_after.json()
    assert len(members) == 2
    emails = {m["email"] for m in members}
    assert appr_email in emails
    assert rev_email in emails

    # 5. Reviewer sees the shared project's claims, graph, and sources!
    rev_claims_res = client.get("/claims", headers=rev_auth)
    assert rev_claims_res.status_code == 200
    rev_claims = rev_claims_res.json()["claims"]
    assert len(rev_claims) == len(appr_claims)
    assert rev_claims[0]["statement"] == appr_claims[0]["statement"]

    # Reviewer can also view the shared graph
    rev_graph_res = client.get("/graph", headers=rev_auth)
    assert rev_graph_res.status_code == 200
    graph_data = rev_graph_res.json()
    assert len(graph_data["nodes"]) >= 1


def test_invited_reviewer_register_flow_with_invitation_code(client):
    """Reviewer uses /auth/register with invitation_code directly."""
    # Approver setup
    appr_uid = f"appr-{uuid.uuid4().hex[:8]}"
    appr_email = f"appr-{uuid.uuid4().hex[:6]}@example.com"
    appr_jwt = make_supabase_token(user_id=appr_uid, email=appr_email)

    s_res = client.post(
        "/auth/session",
        json={"user_id": appr_uid, "email": appr_email, "name": "Lead Eng"},
        headers={"Authorization": f"Bearer {appr_jwt}"},
    )
    acc_token = s_res.json()["token"]

    p_res = client.post(
        "/projects",
        json={"name": "Billing Automation"},
        headers={"Authorization": f"Bearer {acc_token}"},
    )
    proj_id = p_res.json()["project"]["id"]
    appr_token = p_res.json()["token"]
    appr_auth = {"Authorization": f"Bearer {appr_token}"}

    inv_res = client.post(
        "/auth/invitations",
        json={"role": "incoming_maintainer"},
        headers=appr_auth,
    )
    invite_code = inv_res.json()["code"]

    # Reviewer registers with the invitation code directly
    rev_uid = f"newuser-{uuid.uuid4().hex[:8]}"
    rev_email = f"newuser-{uuid.uuid4().hex[:6]}@example.com"
    rev_jwt = make_supabase_token(user_id=rev_uid, email=rev_email)

    reg_res = client.post(
        "/auth/register",
        json={
            "user_id": rev_uid,
            "email": rev_email,
            "name": "Jordan Maintainer",
            "role": "incoming_maintainer",
            "invitation_code": invite_code,
            "supabase_token": rev_jwt,
        },
    )
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert reg_data["user"]["project_id"] == proj_id

    # Approver sees 2 members
    m_res = client.get(f"/projects/{proj_id}/members", headers=appr_auth)
    assert len(m_res.json()) == 2
