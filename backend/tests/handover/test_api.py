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


def test_requires_login_and_blocks_the_leaver(client):
    assert client.get("/handover/v1/view").status_code == 401
    assert client.get("/handover/v1/view", headers=login(client, "leaver")).status_code == 403


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
