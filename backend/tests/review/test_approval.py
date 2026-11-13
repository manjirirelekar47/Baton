"""Readiness gate, immutable versions, snapshot hash, post-approval drift."""
import pytest

from app.modules.review.errors import ImmutableError
from app.modules.review.models import Review, Version, VersionClaim

from .conftest import H


def test_gate_closed_initially_with_reasons(client):
    r = client.get("/review/readiness", headers=H()).json()
    assert r["ready"] is False
    assert set(r["unresolved_conflicts"]) == {"c-pay-A", "c-pay-B"}
    assert r["unaccepted_inferred"] == ["c-staging"]


def test_approve_blocked_until_ready_returns_409_with_readiness(client):
    r = client.post("/review/approve", json={}, headers=H())
    assert r.status_code == 409 and r.json()["detail"]["code"] == "not_ready"
    assert r.json()["detail"]["readiness"]["ready"] is False


def test_empty_project_cannot_be_approved(client):
    r = client.post("/review/approve", json={}, headers=H(project="p-empty"))
    assert r.status_code == 409
    assert "nothing to share" in " ".join(r.json()["detail"]["readiness"]["reasons"])


def test_confirm_does_not_open_gate_for_conflict(client, act):
    act("c-test", "confirm")
    assert client.get("/review/readiness", headers=H()).json()["ready"] is False


def test_gate_opens_after_resolve_and_decide(ready_project):
    r = ready_project.get("/review/readiness", headers=H()).json()
    assert r["ready"] is True and r["reasons"] == []


def test_approve_creates_v1_with_hash_and_counts(ready_project):
    r = ready_project.post("/review/approve", json={}, headers=H())
    assert r.status_code == 200
    v = r.json()
    assert v["version_number"] == 1 and len(v["snapshot_hash"]) == 64
    assert v["accepted_uncertainty_count"] == 1
    assert sorted(v["shared_roles"]) == ["incoming_contributor", "incoming_maintainer"]


def test_snapshot_excludes_rejected_pending_and_secrets(ready_project):
    v = ready_project.post("/review/approve", json={}, headers=H()).json()
    d = ready_project.get(f"/versions/{v['id']}", headers=H()).json()
    ids = {c["claim_id"] for c in d["claims"]}
    assert "c-pay-B" in ids and "c-pay-A" not in ids        # losing side rejected
    assert "c-domain" not in ids and "c-friday" not in ids  # never decided
    assert "c-secret" not in ids
    assert d["hash_valid"] is True
    assert all(c["evidence"] or c["state"] == "Attested" or c["unknown"] for c in d["claims"])


def test_accepted_uncertainty_keeps_honest_label_in_snapshot(ready_project):
    v = ready_project.post("/review/approve", json={}, headers=H()).json()
    d = ready_project.get(f"/versions/{v['id']}", headers=H()).json()
    staging = next(c for c in d["claims"] if c["claim_id"] == "c-staging")
    assert staging["state"] == "Inferred" and staging["decision"] == "accept_uncertainty"


def test_mark_unknown_never_asserts_the_value(client, act):
    act("c-pay-A", "resolve_conflict", chosen_claim_id="c-pay-B", note="n")
    act("c-staging", "mark_unknown")
    act("c-test", "confirm")
    v = client.post("/review/approve", json={}, headers=H()).json()
    d = client.get(f"/versions/{v['id']}", headers=H()).json()
    s = next(c for c in d["claims"] if c["claim_id"] == "c-staging")
    assert s["unknown"] is True and s["evidence"] == [] and "expires" not in s["statement"]


def test_second_approval_is_v2_and_v1_untouched(ready_project):
    v1 = ready_project.post("/review/approve", json={}, headers=H()).json()
    ready_project.post("/review/confirm-verified", headers=H())
    v2 = ready_project.post("/review/approve", json={}, headers=H()).json()
    assert v2["version_number"] == 2 and v2["snapshot_hash"] == v1["snapshot_hash"]  # same content
    assert [v["version_number"] for v in ready_project.get("/versions", headers=H()).json()] == [2, 1]


def test_versions_are_immutable_in_orm(ready_project, Session):
    ready_project.post("/review/approve", json={}, headers=H())
    s = Session()
    v = s.query(Version).first()
    v.approved_by = "attacker"
    with pytest.raises(ImmutableError):
        s.commit()
    s.rollback()
    vc = s.query(VersionClaim).first()
    vc.snapshot_json = "{}"
    with pytest.raises(ImmutableError):
        s.commit()
    s.rollback()
    s.delete(s.query(Review).first())
    with pytest.raises(ImmutableError):
        s.commit()


def test_tampering_with_snapshot_breaks_hash(ready_project, engine):
    v = ready_project.post("/review/approve", json={}, headers=H()).json()
    raw = engine.raw_connection()
    raw.execute("update version_claims set snapshot_json = replace(snapshot_json, 'Rohan', 'Mallory')")
    raw.commit()
    assert ready_project.get(f"/versions/{v['id']}", headers=H()).json()["hash_valid"] is False


def test_source_changed_after_approval_flips_claim_back_to_review(ready_project, fake):
    v = ready_project.post("/review/approve", json={}, headers=H()).json()
    fake.set_state("p1", "c-test", "Stale")                     # drift detected upstream
    q = ready_project.get("/review/queue", headers=H()).json()["items"]
    item = next(i for i in q if i["claim_id"] == "c-test")
    assert item["pending"] is True and item["state"] == "Stale"
    assert q[0]["claim_id"] == "c-test" or q[0]["state"] in {"Conflicting", "Stale"}
    d = ready_project.get(f"/versions/{v['id']}", headers=H()).json()
    assert d["hash_valid"] is True                              # approved v1 is untouched
    assert any(c["claim_id"] == "c-test" for c in d["claims"])
    # a new approval no longer includes the stale claim
    v2 = ready_project.post("/review/approve", json={}, headers=H()).json()
    d2 = ready_project.get(f"/versions/{v2['id']}", headers=H()).json()
    assert all(c["claim_id"] != "c-test" for c in d2["claims"])


def test_role_revocation_blocks_next_request(ready_project):
    assert ready_project.post("/review/approve", json={}, headers=H("approver")).status_code == 200
    # same user, role revoked/downgraded: every request re-reads the current role
    assert ready_project.post("/review/approve", json={}, headers=H("incoming_contributor", user="approver-u")).status_code == 403
    assert ready_project.get("/review/queue", headers=H("incoming_contributor")).status_code == 403


def test_version_ids_from_other_project_are_404(ready_project):
    v = ready_project.post("/review/approve", json={}, headers=H()).json()
    assert ready_project.get(f"/versions/{v['id']}", headers=H(project="p2")).status_code == 404
    assert ready_project.get("/versions", headers=H(project="p2")).json() == []


def test_cannot_share_to_unknown_role(ready_project):
    r = ready_project.post("/review/approve", json={"shared_to_roles": ["approver"]}, headers=H())
    assert r.status_code == 422


def test_approval_marks_claims_approved_in_ledger(ready_project, fake):
    ready_project.post("/review/approve", json={}, headers=H())
    assert any(c[0] == "mark" and c[2] == "Approved" for c in fake.calls)


def test_approval_is_audited(ready_project):
    ready_project.post("/review/approve", json={}, headers=H())
    ev = [e for e in ready_project.get("/audit", headers=H()).json() if e["event_type"] == "version.approve"]
    assert ev and ev[0]["detail"]["version_number"] == 1
