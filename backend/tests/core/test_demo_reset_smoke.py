"""Smoke test regression suite: Verifies demo reset, conflict c-009 & c-018 resolution, and idempotency."""
import time


def test_demo_reset_restores_conflicts_and_resolve_is_idempotent(client):
    # 1. Demo reset
    reset_res = client.post("/demo/reset")
    assert reset_res.status_code == 200
    assert reset_res.json()["status"] == "reset"

    # 2. Approver login
    login_res = client.post("/auth/demo-login", json={"role": "approver"})
    assert login_res.status_code == 200
    approver_token = login_res.json()["token"]
    auth = {"Authorization": f"Bearer {approver_token}"}

    # Verify c-009 and c-018 are immediately conflicting after demo reset
    claims_res = client.get("/claims", headers=auth)
    assert claims_res.status_code == 200
    claims_by_id = {c["claim_id"]: c for c in claims_res.json()["claims"]}
    assert "c-009" in claims_by_id
    assert claims_by_id["c-009"]["state"] == "conflicting"
    assert "c-018" in claims_by_id
    assert claims_by_id["c-018"]["state"] == "conflicting"

    # 3. Trigger reconstruct (replay mode)
    recon_res = client.post("/reconstruct", json={"mode": "replay"}, headers=auth)
    assert recon_res.status_code == 200
    job_id = recon_res.json().get("job_id")
    if job_id:
        for _ in range(60):
            time.sleep(0.1)
            job_status = client.get(f"/jobs/{job_id}", headers=auth).json().get("status")
            if job_status in ("done", "failed"):
                assert job_status == "done"
                break

    # 4. Resolve conflict c-009
    res_c009 = client.post(
        "/review/c-009/action",
        json={"action": "resolve_conflict", "chosen_claim_id": "c-009", "note": "smoke test"},
        headers=auth,
    )
    assert res_c009.status_code == 200

    # 5. Resolve conflict c-009 second time (simulate re-running or idempotent call)
    res_c009_repeat = client.post(
        "/review/c-009/action",
        json={"action": "resolve_conflict", "chosen_claim_id": "c-009", "note": "smoke test"},
        headers=auth,
    )
    assert res_c009_repeat.status_code == 409
    assert res_c009_repeat.json()["detail"]["code"] == "already_resolved"

    # 6. Resolve conflict c-018
    res_c018 = client.post(
        "/review/c-018/action",
        json={"action": "resolve_conflict", "chosen_claim_id": "c-018", "note": "smoke test"},
        headers=auth,
    )
    assert res_c018.status_code == 200

    # 7. Resolve conflict c-018 second time
    res_c018_repeat = client.post(
        "/review/c-018/action",
        json={"action": "resolve_conflict", "chosen_claim_id": "c-018", "note": "smoke test"},
        headers=auth,
    )
    assert res_c018_repeat.status_code == 409
    assert res_c018_repeat.json()["detail"]["code"] == "already_resolved"

    # Settle remaining demo conflicts so approval readiness gate passes
    for cid in ("c-001", "c-002", "c-005", "c-006"):
        client.post(
            f"/review/{cid}/action",
            json={"action": "resolve_conflict", "chosen_claim_id": cid, "note": "smoke test"},
            headers=auth,
        )

    # 8. Confirm verified
    conf_res = client.post("/review/confirm-verified", json={}, headers=auth)
    assert conf_res.status_code == 200

    # 9. Approve
    appr_res = client.post("/review/approve", json={}, headers=auth)
    assert appr_res.status_code == 200

    # 10. Check version
    ver_res = client.get("/versions", headers=auth)
    assert ver_res.status_code == 200
    versions = ver_res.json()
    assert len(versions) > 0
    version_id = versions[-1]["version_id"]

    # 11. Contributor login and view
    contrib_login = client.post("/auth/demo-login", json={"role": "incoming_contributor"})
    assert contrib_login.status_code == 200
    contrib_auth = {"Authorization": f"Bearer {contrib_login.json()['token']}"}

    view_res = client.get(f"/handover/{version_id}/view", headers=contrib_auth)
    assert view_res.status_code == 200
    view_text = view_res.text
    for restricted in ["Sponsor funding", "S4-301", "c-010"]:
        assert restricted not in view_text
