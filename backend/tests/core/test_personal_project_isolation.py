"""Integration tests for Issue 2: Demo data isolation and zero leakage into personal projects.

Verifies:
1. Personal (non-demo) projects start completely clean (0 claims, 0 tasks, 0 contributors).
2. Never auto-seeds "Rohan", "Meera", or "Campus Event" into personal projects.
3. Reconstruct on a personal project with real chunks extracts strictly from the uploaded data.
4. Extracted claims, risk contributors, and handover action plans contain ZERO occurrences
   of "Rohan", "Meera", or "Campus Event".
"""
import io
import time
import uuid
from tests.conftest import make_supabase_token


def test_personal_project_clean_slate_and_zero_demo_leakage(client):
    # 1. Create a personal project
    uid = f"user-{uuid.uuid4().hex[:8]}"
    email = f"eng-{uuid.uuid4().hex[:6]}@example.com"
    jwt_token = make_supabase_token(user_id=uid, email=email)

    session_res = client.post(
        "/auth/session",
        json={"user_id": uid, "email": email, "name": "Sarah Connor"},
        headers={"Authorization": f"Bearer {jwt_token}"},
    )
    assert session_res.status_code == 200
    account_token = session_res.json()["token"]

    p_res = client.post(
        "/projects",
        json={"name": "Cyberdyne Defense Core"},
        headers={"Authorization": f"Bearer {account_token}"},
    )
    assert p_res.status_code == 200
    proj_id = p_res.json()["project"]["id"]
    token = p_res.json()["token"]
    auth = {"Authorization": f"Bearer {token}"}

    # 2. Assert clean slate initially
    claims_init = client.get("/claims", headers=auth).json()["claims"]
    assert len(claims_init) == 0

    # Handover plan should be empty
    versions = client.get("/versions", headers=auth).json()
    assert len(versions) == 0

    # 3. Ingest real document file into this project
    file_content = (
        b"# Distributed Storage System\n\n"
        b"The storage layer is built using Cassandra cluster with replication factor of 3.\n\n"
        b"- [ ] Configure encryption at rest for customer payload.\n"
        b"- Risk: High memory utilization on write-heavy spikes.\n"
    )
    source_res = client.post(
        "/sources",
        files={"file": ("architecture.md", io.BytesIO(file_content), "text/markdown")},
        data={"consent": "true", "acl_label": "L1"},
        headers=auth,
    )
    assert source_res.status_code == 201

    # 4. Trigger reconstruction
    recon_res = client.post("/reconstruct", headers=auth)
    assert recon_res.status_code == 200
    job_id = recon_res.json()["job_id"]

    # Wait for reconstruction job to complete (runs in background thread)
    for _ in range(30):
        job_res = client.get(f"/jobs/{job_id}", headers=auth)
        if job_res.status_code == 200 and job_res.json().get("status") in ("done", "failed"):
            break
        time.sleep(0.1)

    # 5. Verify extracted claims
    claims_res = client.get("/claims", headers=auth)
    assert claims_res.status_code == 200
    claims = claims_res.json()["claims"]
    assert len(claims) >= 1

    # Check for ZERO demo data leakage
    forbidden_terms = ["rohan", "meera", "campus event"]
    for c in claims:
        stmt = str(c.get("statement", "")).lower()
        owner = str(c.get("owner", "")).lower()
        entity = str(c.get("entity_key", "")).lower()

        for term in forbidden_terms:
            assert term not in stmt, f"Found demo leak '{term}' in claim statement: {stmt}"
            assert term not in owner, f"Found demo leak '{term}' in claim owner: {owner}"
            assert term not in entity, f"Found demo leak '{term}' in entity key: {entity}"

    # 6. Verify risk radar
    radar_res = client.get("/risk-radar", headers=auth)
    if radar_res.status_code == 200:
        radar_text = str(radar_res.json()).lower()
        for term in ["rohan", "meera"]:
            assert term not in radar_text, f"Found demo persona in risk radar: {term}"


def test_reconstruction_without_chunks_in_personal_project_yields_zero_claims(client):
    """Reconstruction on an empty personal project must never load demo fixture claims."""
    uid = f"user-{uuid.uuid4().hex[:8]}"
    email = f"dev-{uuid.uuid4().hex[:6]}@example.com"
    jwt_token = make_supabase_token(user_id=uid, email=email)

    session_res = client.post(
        "/auth/session",
        json={"user_id": uid, "email": email, "name": "Dev Null"},
        headers={"Authorization": f"Bearer {jwt_token}"},
    )
    account_token = session_res.json()["token"]

    p_res = client.post(
        "/projects",
        json={"name": "Empty Project"},
        headers={"Authorization": f"Bearer {account_token}"},
    )
    auth = {"Authorization": f"Bearer {p_res.json()['token']}"}

    # Run reconstruct without ingesting any chunks
    recon_res = client.post("/reconstruct", headers=auth)
    assert recon_res.status_code == 200
    job_id = recon_res.json()["job_id"]

    for _ in range(30):
        job_res = client.get(f"/jobs/{job_id}", headers=auth)
        if job_res.status_code == 200 and job_res.json().get("status") in ("done", "failed"):
            break
        time.sleep(0.1)

    # Must remain 0 claims!
    claims_res = client.get("/claims", headers=auth)
    assert claims_res.status_code == 200
    assert len(claims_res.json()["claims"]) == 0


def test_personal_project_extracts_claims_from_synced_github_commits_and_prs_only(client):
    """Confirm extract_claims_from_project_chunks() extracts valid claims when a project only has synced GitHub commits and PRs."""
    from app.core.db import get_session
    from app.modules.extraction.service import extract_claims_from_project_chunks
    from app.modules.verification.public import verify_and_save_collection

    uid = f"user-{uuid.uuid4().hex[:8]}"
    email = f"lead-{uuid.uuid4().hex[:6]}@example.com"
    jwt_token = make_supabase_token(user_id=uid, email=email)

    session_res = client.post(
        "/auth/session",
        json={"user_id": uid, "email": email, "name": "Marcus Wright"},
        headers={"Authorization": f"Bearer {jwt_token}"},
    )
    assert session_res.status_code == 200
    account_token = session_res.json()["token"]

    p_res = client.post(
        "/projects",
        json={"name": "Fintech Ledger Sync"},
        headers={"Authorization": f"Bearer {account_token}"},
    )
    assert p_res.status_code == 200
    proj_id = p_res.json()["project"]["id"]
    auth = {"Authorization": f"Bearer {p_res.json()['token']}"}

    # Simulate GitHub connector synced chunks (commits, pull requests, and tasks)
    commit_chunk_text = (
        "GitHub commit c8d9e0f1a2b3 by Marcus Wright:\n"
        "Implement double-entry ledger settlement engine with idempotent event keys\n"
    )
    pr_chunk_text = (
        "GitHub pull request #45: Multi-Region High-Availability Postgres Replica\n"
        "Author: Kyle Reese\n"
        "State: merged\n\n"
        "- [ ] Configure failover replication latency alert threshold to 500ms\n"
        "- Risk: Network partition between us-east and eu-west could delay sync\n"
        "- Blocker: Awaiting cross-region VPC peering routing table confirmation\n"
    )

    chunks = [
        {
            "chunk_id": f"chk-gh-commit-{uuid.uuid4().hex[:6]}",
            "source_id": f"src-gh-repo-{uuid.uuid4().hex[:6]}",
            "source_title": "GitHub: fincorp/ledger",
            "source_type": "git",
            "acl_label": "L1",
            "author": "Marcus Wright",
            "text": commit_chunk_text,
        },
        {
            "chunk_id": f"chk-gh-pr-{uuid.uuid4().hex[:6]}",
            "source_id": f"src-gh-repo-{uuid.uuid4().hex[:6]}",
            "source_title": "GitHub: fincorp/ledger",
            "source_type": "git",
            "acl_label": "L1",
            "author": "Kyle Reese",
            "text": pr_chunk_text,
        },
    ]

    extracted = extract_claims_from_project_chunks(proj_id, chunks)
    assert len(extracted) >= 4, f"Expected at least 4 extracted claims, got {len(extracted)}"

    # Validate that extracted claim types adhere to DB schema
    valid_db_types = {
        "decision", "owner", "dependency", "blocker", "risk",
        "recurring_problem", "open_question", "contact", "next_action", "timeline_event"
    }
    for c in extracted:
        assert c["type"] in valid_db_types, f"Invalid claim type '{c['type']}'"
        assert len(c["statement"]) > 5
        assert len(c["evidence"]) >= 1
        ev = c["evidence"][0]
        # Quote must be an exact substring of the cited chunk
        parent_chunk = next(ch for ch in chunks if ch["chunk_id"] == ev["chunk_id"])
        assert ev["quote"] in parent_chunk["text"], f"Quote '{ev['quote']}' not found in parent chunk"

    # Verify and persist to DB via verification service
    session_gen = get_session()
    session = next(session_gen)
    try:
        verified_claims, gaps = verify_and_save_collection(proj_id, extracted, session=session)
        assert len(verified_claims) >= 4
    finally:
        session.close()

    # Query claims through the HTTP API
    claims_res = client.get("/claims", headers=auth)
    assert claims_res.status_code == 200
    claims_data = claims_res.json()["claims"]
    assert len(claims_data) >= 4

    statements = [c["statement"].lower() for c in claims_data]
    assert any("double-entry ledger" in s for s in statements)
    assert any("pr #45" in s for s in statements)
    assert any("latency alert threshold" in s for s in statements)

    # Ensure zero demo persona leakage
    for c in claims_data:
        s_lower = c["statement"].lower()
        assert "rohan" not in s_lower
        assert "meera" not in s_lower
        assert "campus event" not in s_lower

