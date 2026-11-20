"""HTTP tests: failure case and permission case for every handover endpoint."""
import json

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.db import get_engine
from app.core.samples import load_sample
from app.modules.handover import service
from tests.conftest import login

RESTRICTED = ["Sponsor funding", "S4-301", "c-010", "free tier, 90 days", "c-009"]


def test_contributor_response_has_no_restricted_text(client):
    resp = client.get("/handover/v1/view", headers=login(client, "incoming_contributor"))
    assert resp.status_code == 200
    for marker in RESTRICTED:
        assert marker not in resp.text
    assert resp.json()["hidden"] == {"count": 2}


def test_plan_response_has_no_restricted_text(client):
    resp = client.get("/handover/v1/plan", headers=login(client, "incoming_contributor"))
    assert resp.status_code == 200
    for marker in RESTRICTED:
        assert marker not in resp.text
    plan = resp.json()["plan"]
    assert [i["claim_id"] for i in plan["week_1"]] == ["c-006"]


def test_requires_login_and_allows_the_leaver(client):
    assert client.get("/handover/v1/view").status_code == 401
    assert client.get("/handover/v1/view", headers=login(client, "leaver")).status_code == 200


def test_unknown_version_is_404(client):
    assert client.get("/handover/nope/view", headers=login(client, "approver")).status_code == 404


def test_cross_project_id_guessing_is_404(client, monkeypatch):
    other = load_sample("version_v1")
    other["project_id"] = "proj-someone-else"
    monkeypatch.setattr(service.review, "get_version", lambda _id: other)
    assert client.get("/handover/v1/view", headers=login(client, "approver")).status_code == 404


def test_unapproved_version_is_never_shared(client, monkeypatch):
    draft = load_sample("version_v1")
    draft["status"] = "draft"
    monkeypatch.setattr(service.review, "get_version", lambda _id: draft)
    assert client.get("/handover/v1/view", headers=login(client, "approver")).status_code == 404


def test_version_not_shared_with_role_is_404(client, monkeypatch):
    v = load_sample("version_v1")
    v["shared_with"] = ["incoming_maintainer"]
    monkeypatch.setattr(service.review, "get_version", lambda _id: v)
    assert client.get("/handover/v1/view", headers=login(client, "incoming_contributor")).status_code == 404
    assert client.get("/handover/v1/view", headers=login(client, "incoming_maintainer")).status_code == 200


def test_acknowledge_is_idempotent_and_shows_in_view(client):
    headers = login(client, "incoming_contributor")
    first = client.post("/handover/ack", json={"version_id": "v1", "section": "decisions"}, headers=headers)
    second = client.post("/handover/ack", json={"version_id": "v1", "section": "decisions"}, headers=headers)
    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["acknowledged_at"] == second.json()["acknowledged_at"]
    sections = client.get("/handover/v1/view", headers=headers).json()["sections"]
    assert next(s for s in sections if s["key"] == "decisions")["acknowledged_at"] == first.json()["acknowledged_at"]


def test_acknowledge_rejects_hidden_unknown_and_wrong_role(client):
    contributor = login(client, "incoming_contributor")
    assert client.post("/handover/ack", json={"version_id": "v1", "section": "risks"}, headers=contributor).status_code == 422
    assert client.post("/handover/ack", json={"version_id": "v1", "section": "nope"}, headers=contributor).status_code == 422
    approver = login(client, "approver")
    assert client.post("/handover/ack", json={"version_id": "v1", "section": "decisions"}, headers=approver).status_code == 403


def test_owner_accept_decline_and_unknown_owner_stays_unknown(client):
    contributor = login(client, "incoming_contributor")
    body = {"version_id": "v1", "claim_id": "c-002", "response": "accept"}
    ok = client.post("/handover/ownership", json=body, headers=contributor)
    assert ok.status_code == 200 and ok.json()["owner"] is None  # snapshot owner is never rewritten
    changed = client.post("/handover/ownership", json={**body, "response": "decline"}, headers=contributor)
    assert changed.status_code == 200
    assert client.get("/handover/v1/view", headers=contributor).json()["ownership_responses"] == {"c-002": "decline"}
    # proposed for someone else
    other = {"version_id": "v1", "claim_id": "c-001", "response": "accept"}
    assert client.post("/handover/ownership", json=other, headers=contributor).status_code == 403
    # nobody proposed: nothing to accept
    unknown = {"version_id": "v1", "claim_id": "c-003", "response": "accept"}
    assert client.post("/handover/ownership", json=unknown, headers=contributor).status_code == 422
    # restricted or non-owner claim ids look like they do not exist
    hidden = {"version_id": "v1", "claim_id": "c-010", "response": "accept"}
    assert client.post("/handover/ownership", json=hidden, headers=contributor).status_code == 404
    # invalid response value
    bad = {"version_id": "v1", "claim_id": "c-002", "response": "maybe"}
    assert client.post("/handover/ownership", json=bad, headers=contributor).status_code == 422
    # the maintainer can accept the item proposed for Meera
    meera = login(client, "incoming_maintainer")
    assert client.post("/handover/ownership", json=other, headers=meera).status_code == 200


def test_role_revocation_takes_effect_immediately(client):
    headers = login(client, "incoming_contributor")
    assert client.get("/me", headers=headers).status_code == 200
    with Session(get_engine()) as session:
        session.execute(text("update members set active = 0 where id = 'u-contrib'"))
        session.commit()
    assert client.get("/me", headers=headers).status_code == 401
    assert client.get("/handover/v1/view", headers=headers).status_code == 401


def test_every_view_is_audited_and_reset_restores_the_demo(client):
    headers = login(client, "incoming_contributor")
    client.get("/handover/v1/view", headers=headers)
    client.post("/handover/ack", json={"version_id": "v1", "section": "decisions"}, headers=headers)
    with Session(get_engine()) as session:
        actions = [r[0] for r in session.execute(text("select action from audit_log"))]
    assert "handover.view" in actions and "handover.ack" in actions
    assert client.post("/demo/reset").status_code == 200
    headers = login(client, "incoming_contributor")
    sections = client.get("/handover/v1/view", headers=headers).json()["sections"]
    assert all(s["acknowledged_at"] is None for s in sections)
    json.dumps(sections)


def test_action_status_lifecycle(client):
    headers = login(client, "incoming_maintainer")
    # 1. Fetch initial plan - all items start as 'not_started'
    plan_resp = client.get("/handover/v1/plan", headers=headers)
    assert plan_resp.status_code == 200
    plan_data = plan_resp.json()["plan"]
    d1_items = plan_data.get("day_1", [])
    assert len(d1_items) > 0
    target_claim_id = d1_items[0]["claim_id"]
    assert d1_items[0]["action_status"] == "not_started"

    # Incoming maintainer cannot update unassigned task
    update_body = {
        "version_id": "v1",
        "claim_id": target_claim_id,
        "status": "in_progress",
        "notes": "Currently verifying dependencies",
    }
    unassigned_resp = client.post("/handover/action-status", json=update_body, headers=headers)
    assert unassigned_resp.status_code == 403

    # Approver assigns task to Meera (incoming_maintainer)
    approver = login(client, "approver")
    assign_resp = client.patch(
        f"/handover/tasks/{target_claim_id}",
        json={"version_id": "v1", "owner": "Meera"},
        headers=approver,
    )
    assert assign_resp.status_code == 200

    # 2. Update status to 'in_progress' with a note now succeeds
    up_resp = client.post("/handover/action-status", json=update_body, headers=headers)
    assert up_resp.status_code == 200
    assert up_resp.json()["status"] == "in_progress"
    assert up_resp.json()["notes"] == "Currently verifying dependencies"

    # 3. Verify status persisted in plan response
    plan_after = client.get("/handover/v1/plan", headers=headers).json()["plan"]
    updated_item = next(it for it in plan_after["day_1"] if it["claim_id"] == target_claim_id)
    assert updated_item["action_status"] == "in_progress"
    assert updated_item["action_notes"] == "Currently verifying dependencies"

    # 4. Update status to 'completed'
    client.post("/handover/action-status", json={
        "version_id": "v1",
        "claim_id": target_claim_id,
        "status": "completed",
        "notes": "Done",
    }, headers=headers)
    plan_completed = client.get("/handover/v1/plan", headers=headers).json()["plan"]
    comp_item = next(it for it in plan_completed["day_1"] if it["claim_id"] == target_claim_id)
    assert comp_item["action_status"] == "completed"


def test_task_crud_by_approver(client):
    approver = login(client, "approver")

    # 1. Create task
    create_body = {
        "version_id": "v1",
        "title": "Verify database backup restoration",
        "kind": "next_action",
        "owner": "Meera",
        "due_date": "2026-11-25",
        "status": "not_started",
        "notes": "Run in staging environment first",
        "blocked_by": ["c-004"],
    }
    create_resp = client.post("/handover/tasks", json=create_body, headers=approver)
    assert create_resp.status_code == 201
    task = create_resp.json()
    task_id = task["task_id"]
    assert task["title"] == "Verify database backup restoration"
    assert task["owner"] == "Meera"
    assert task["blocked_by"] == ["c-004"]

    # 2. Verify task appears in plan
    plan_resp = client.get("/handover/v1/plan", headers=approver)
    assert plan_resp.status_code == 200
    all_plan_items = [item for bucket in plan_resp.json()["plan"].values() for item in bucket]
    assert any(item["claim_id"] == task_id for item in all_plan_items)

    # 3. Update task owner, due date, and notes
    update_resp = client.patch(
        f"/handover/tasks/{task_id}",
        json={
            "version_id": "v1",
            "owner": "Incoming Contributor",
            "due_date": "2026-11-28",
            "notes": "Updated instructions",
        },
        headers=approver,
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["owner"] == "Incoming Contributor"
    assert updated["due_date"] == "2026-11-28"
    assert updated["notes"] == "Updated instructions"

    # 4. Delete task
    del_resp = client.delete(f"/handover/tasks/{task_id}", headers=approver)
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "deleted"

    # 5. Verify task is no longer in plan
    plan_after_del = client.get("/handover/v1/plan", headers=approver).json()["plan"]
    all_after_del = [item for bucket in plan_after_del.values() for item in bucket]
    assert not any(item["claim_id"] == task_id for item in all_after_del)


def test_task_cycle_detection(client):
    approver = login(client, "approver")

    # 1. Create initial tasks
    t1_resp = client.post(
        "/handover/tasks",
        json={"version_id": "v1", "title": "Task Alpha", "blocked_by": []},
        headers=approver,
    )
    assert t1_resp.status_code == 201
    t1_id = t1_resp.json()["task_id"]

    t2_resp = client.post(
        "/handover/tasks",
        json={"version_id": "v1", "title": "Task Beta", "blocked_by": [t1_id]},
        headers=approver,
    )
    assert t2_resp.status_code == 201
    t2_id = t2_resp.json()["task_id"]

    # Self-dependency on update is rejected with 422
    self_loop = client.patch(
        f"/handover/tasks/{t1_id}",
        json={"version_id": "v1", "blocked_by": [t1_id]},
        headers=approver,
    )
    assert self_loop.status_code == 422
    assert "Self-dependency" in self_loop.json()["detail"]

    # 2-cycle: T1 depends on T2, while T2 already depends on T1 -> rejected with 422
    cycle_2 = client.patch(
        f"/handover/tasks/{t1_id}",
        json={"version_id": "v1", "blocked_by": [t2_id]},
        headers=approver,
    )
    assert cycle_2.status_code == 422
    assert "cycle detected" in cycle_2.json()["detail"].lower()

    # 3-cycle: T1 -> T2 -> T3 -> T1
    t3_resp = client.post(
        "/handover/tasks",
        json={"version_id": "v1", "title": "Task Gamma", "blocked_by": [t2_id]},
        headers=approver,
    )
    assert t3_resp.status_code == 201
    t3_id = t3_resp.json()["task_id"]

    cycle_3 = client.patch(
        f"/handover/tasks/{t1_id}",
        json={"version_id": "v1", "blocked_by": [t3_id]},
        headers=approver,
    )
    assert cycle_3.status_code == 422
    assert "cycle detected" in cycle_3.json()["detail"].lower()


def test_task_rbac_constraints(client):
    approver = login(client, "approver")
    contributor = login(client, "incoming_contributor")

    # 1. Non-approver cannot create tasks
    create_forbidden = client.post(
        "/handover/tasks",
        json={"version_id": "v1", "title": "Unauthorized task"},
        headers=contributor,
    )
    assert create_forbidden.status_code == 403

    # 2. Approver creates task assigned to Meera
    task_resp = client.post(
        "/handover/tasks",
        json={
            "version_id": "v1",
            "title": "Maintainer Task",
            "owner": "Meera",
            "due_date": "2026-11-20",
        },
        headers=approver,
    )
    assert task_resp.status_code == 201
    task_id = task_resp.json()["task_id"]

    # 3. Contributor cannot update task assigned to Meera
    unassigned_update = client.patch(
        f"/handover/tasks/{task_id}",
        json={"version_id": "v1", "status": "in_progress"},
        headers=contributor,
    )
    assert unassigned_update.status_code == 403

    # 4. Contributor cannot delete tasks
    del_forbidden = client.delete(f"/handover/tasks/{task_id}", headers=contributor)
    assert del_forbidden.status_code == 403

    # 5. Maintainer (Meera) can update status and notes on task assigned to her
    maintainer = login(client, "incoming_maintainer")
    assignee_update = client.patch(
        f"/handover/tasks/{task_id}",
        json={"version_id": "v1", "status": "in_progress", "notes": "Started investigation"},
        headers=maintainer,
    )
    assert assignee_update.status_code == 200
    assert assignee_update.json()["status"] == "in_progress"

    # 6. Maintainer CANNOT reassign owner or change due date
    reassign_forbidden = client.patch(
        f"/handover/tasks/{task_id}",
        json={"version_id": "v1", "owner": "Incoming Contributor"},
        headers=maintainer,
    )
    assert reassign_forbidden.status_code == 403


def test_task_activity_history(client):
    approver = login(client, "approver")
    maintainer = login(client, "incoming_maintainer")

    # 1. Create task
    task_resp = client.post(
        "/handover/tasks",
        json={
            "version_id": "v1",
            "title": "Audit SSL Certs",
            "owner": "Meera",
            "due_date": "2026-11-22",
            "status": "not_started",
        },
        headers=approver,
    )
    assert task_resp.status_code == 201
    task_id = task_resp.json()["task_id"]

    # 2. Maintainer updates status
    client.patch(
        f"/handover/tasks/{task_id}",
        json={"version_id": "v1", "status": "in_progress", "notes": "Checking cert expiry"},
        headers=maintainer,
    )

    # 3. Approver extends due date
    client.patch(
        f"/handover/tasks/{task_id}",
        json={"version_id": "v1", "due_date": "2026-11-30"},
        headers=approver,
    )

    # 4. Fetch activity history
    history_resp = client.get(f"/handover/tasks/{task_id}/history", headers=maintainer)
    assert history_resp.status_code == 200
    items = history_resp.json()["history"]
    assert len(items) >= 4

    actions = [i["action"] for i in items]
    assert "created" in actions
    assert "status_changed" in actions
    assert "notes_changed" in actions
    assert "due_date_changed" in actions

    status_entry = next(i for i in items if i["action"] == "status_changed")
    assert status_entry["field"] == "status"
    assert status_entry["old_value"] == "not_started"
    assert status_entry["new_value"] == "in_progress"
    assert status_entry["actor_name"] == "Meera"

    due_entry = next(i for i in items if i["action"] == "due_date_changed")
    assert due_entry["field"] == "due_date"
    assert due_entry["old_value"] == "2026-11-22"
    assert due_entry["new_value"] == "2026-11-30"
    assert due_entry["actor_name"] == "Approver"
