"""Tests for Verification module (F4, F5):
Quote verification, fuzzy match, fabricated quotes, conflict detection,
state labelling, Gap generation, alias resolution, reverify, and ACL.
"""
import pytest
from app.modules.verification import service


def test_verify_quote_exact_and_normalized():
    chunk = "Rohan took payments over from Aarav last week, so ping me for anything on registration payments."
    # Exact match
    matched, score, m_type = service.verify_quote("Rohan took payments over", chunk)
    assert matched is True
    assert score == 100.0
    assert m_type == "exact"

    # Whitespace and punctuation normalized match
    quote_messy = "  Rohan   took   payments   over \n from Aarav  "
    matched, score, m_type = service.verify_quote(quote_messy, chunk)
    assert matched is True
    assert score == 100.0
    assert m_type in ("exact", "normalized")


def test_verify_quote_fuzzy_match():
    chunk = "Meeting note N-04 (10 Oct 2026). Decision: hold the v1.0 release until retry behaviour is tested."
    # Slight OCR or formatting deviation
    imperfect_quote = "hold the v1.0 release until retry behavior is tested"
    matched, score, m_type = service.verify_quote(imperfect_quote, chunk, fuzzy_threshold=80.0)
    assert matched is True
    assert score >= 80.0
    assert m_type in ("fuzzy", "normalized", "exact")


def test_fabricated_quote_becomes_gap():
    """A claim citing a quote that does not exist in the source must create a Gap."""
    chunk_lookup = {
        "chunk-1": {
            "chunk_id": "chunk-1",
            "source_id": "src-1",
            "source_title": "Notes",
            "acl_label": "L1",
            "text": "The project uses SQLite for local development.",
        }
    }
    claim = {
        "claim_id": "c-test-fab",
        "type": "decision",
        "entity_key": "db:main",
        "attribute": "type",
        "statement": "The project uses Oracle Cloud 24/7",
        "evidence": [
            {"chunk_id": "chunk-1", "quote": "We definitely use Oracle Cloud for everything"}
        ],
    }
    v_claim, gaps = service.verify_single_claim(claim, chunk_lookup, alias_map={})
    # Fabricated quote should not be retained in verified evidence
    assert len(v_claim["evidence"]) == 0
    # State should become missing or inferred (not verified)
    assert v_claim["state"] in ("missing", "inferred")
    # A Gap must be generated
    assert len(gaps) >= 1
    assert "was not found in source chunk" in gaps[0]["reason"]
    assert gaps[0]["claim_id"] == "c-test-fab"


def test_conflict_detection():
    """Two claims with same entity_key and attribute but contradictory statements are marked conflicting."""
    claims = [
        {
            "claim_id": "c-101",
            "type": "owner",
            "entity_key": "module:payments",
            "attribute": "owner",
            "statement": "Aarav is the active owner of payments",
            "owner": "Aarav",
            "state": "verified",
        },
        {
            "claim_id": "c-102",
            "type": "owner",
            "entity_key": "module:payments",
            "attribute": "owner",
            "statement": "Rohan took payments over from Aarav",
            "owner": "Rohan",
            "state": "verified",
        },
    ]
    resolved = service.detect_conflicts(claims)
    assert resolved[0]["state"] == "conflicting"
    assert resolved[1]["state"] == "conflicting"
    assert "c-102" in resolved[0]["conflict_with"]
    assert "c-101" in resolved[1]["conflict_with"]


def test_state_labelling_all_five_states():
    chunk_lookup = {
        "S-1": {"chunk_id": "S-1", "text": "Payments are handled by Rohan.", "acl_label": "L1"}
    }
    # 1. Verified
    c_verified = {
        "claim_id": "c-ver",
        "type": "owner",
        "entity_key": "module:payments",
        "attribute": "owner",
        "statement": "Payments are handled by Rohan.",
        "evidence": [{"chunk_id": "S-1", "quote": "Payments are handled by Rohan."}],
    }
    v1, _ = service.verify_single_claim(c_verified, chunk_lookup, {})
    assert v1["state"] == "verified"

    # 2. Missing
    c_missing = {
        "claim_id": "c-mis",
        "type": "open_question",
        "entity_key": "registrar",
        "attribute": "login",
        "statement": "Who holds the domain login?",
        "evidence": [],
    }
    v2, g2 = service.verify_single_claim(c_missing, chunk_lookup, {})
    assert v2["state"] == "missing"
    assert len(g2) >= 1

    # 3. Attested
    c_attested = {
        "claim_id": "c-att",
        "type": "recurring_problem",
        "entity_key": "deploy",
        "attribute": "failure",
        "statement": "Friday deploys fail without cache clear.",
        "attested_by": "Aarav",
        "evidence": [{"chunk_id": "S-1", "quote": "Payments are handled by Rohan."}],
    }
    v3, _ = service.verify_single_claim(c_attested, chunk_lookup, {})
    assert v3["state"] == "attested"

    # 4. Conflicting
    conf_claims = service.detect_conflicts([
        {"claim_id": "c-a", "entity_key": "mod:x", "attribute": "owner", "owner": "Alice", "statement": "Alice owns x"},
        {"claim_id": "c-b", "entity_key": "mod:x", "attribute": "owner", "owner": "Bob", "statement": "Bob owns x"},
    ])
    assert conf_claims[0]["state"] == "conflicting"

    # 5. Inferred (partial or unverified evidence)
    c_inferred = {
        "claim_id": "c-inf",
        "type": "risk",
        "entity_key": "server:staging",
        "attribute": "expiry",
        "statement": "Staging server likely expires around 30 Nov",
        "evidence": [
            {"chunk_id": "S-1", "quote": "Payments are handled by Rohan."},
            {"chunk_id": "S-1", "quote": "Fabricated text about 30 Nov"},
        ],
    }
    v5, _ = service.verify_single_claim(c_inferred, chunk_lookup, {})
    assert v5["state"] == "inferred"


def test_alias_resolution():
    alias_map = {"payments": "module:payments", "backend/payments": "module:payments"}
    assert service.resolve_canonical_entity("payments", alias_map) == "module:payments"
    assert service.resolve_canonical_entity("backend/payments", alias_map) == "module:payments"
    assert service.resolve_canonical_entity("unrelated", alias_map) == "unrelated"


def test_secret_redaction_in_claim():
    secret_text = "The api_key=super_secret_token_12345 should be protected"
    sanitized = service.sanitize_text(secret_text)
    assert "super_secret_token_12345" not in sanitized
    assert "[REDACTED_SECRET]" in sanitized


def test_reverify_and_persistence(tmp_path):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.core.db import apply_schema

    db_path = tmp_path / "test_ver.db"
    engine = create_engine(f"sqlite:///{db_path}")
    apply_schema(engine)

    with Session(engine) as session:
        # Seed a test project
        from app.core.audit import now_iso
        from sqlalchemy import text
        session.execute(text("insert into projects (id, name, created_at) values ('p-1', 'Test Project', :now)"), {"now": now_iso()})
        session.commit()

        # Add alias
        session.execute(text("insert into aliases (id, project_id, canonical, alias, created_at) values ('a-1', 'p-1', 'module:payments', 'payments', :now)"), {"now": now_iso()})
        session.commit()

        # Create claim with unverified quote
        claim_data = {
            "claim_id": "c-edit-1",
            "type": "owner",
            "entity_key": "payments",
            "attribute": "owner",
            "statement": "Rohan owns payments",
            "evidence": [],
        }
        res = service.reverify(session, "p-1", claim_data)
        assert res["entity_key"] == "module:payments"  # Alias resolved
        assert res["state"] == "missing"  # No evidence -> missing

        # Fetch from DB
        stored = service.get_claim(session, "p-1", "c-edit-1")
        assert stored is not None
        assert stored["claim_id"] == "c-edit-1"
        assert stored["entity_key"] == "module:payments"


def test_all_six_planted_conflicts():
    """Verify that all six planted conflict categories are detected."""
    conflicts_input = [
        # Conflict 1: (module:payments, owner)
        {"claim_id": "c-01a", "type": "owner", "entity_key": "module:payments", "attribute": "owner", "owner": "Aarav", "statement": "Aarav owns payments"},
        {"claim_id": "c-01b", "type": "owner", "entity_key": "module:payments", "attribute": "owner", "owner": "Rohan", "statement": "Rohan took payments over"},
        # Conflict 2: (server:staging, funding)
        {"claim_id": "c-02a", "type": "decision", "entity_key": "server:staging", "attribute": "funding", "statement": "Sponsor funding for the staging server ends in December"},
        {"claim_id": "c-02b", "type": "risk", "entity_key": "server:staging", "attribute": "funding", "statement": "Staging server operates on a 90-day free tier expiring around 30 Nov"},
        # Conflict 3: (account:provider-billing, transfer_owner)
        {"claim_id": "c-03a", "type": "owner", "entity_key": "account:provider-billing", "attribute": "transfer_owner", "owner": "Rohan", "statement": "Transfer payment provider billing account ownership is assigned to Rohan"},
        {"claim_id": "c-03b", "type": "decision", "entity_key": "account:provider-billing", "attribute": "transfer_owner", "owner": "Project Administrator", "statement": "The project administrator must transfer billing ownership before handover is complete"},
        # Conflict 4: (test:retry, schedule)
        {"claim_id": "c-04a", "type": "next_action", "entity_key": "test:retry", "attribute": "schedule", "due_date": "2026-11-14", "statement": "Write payment retry test is scheduled open with due date 2026-11-14"},
        {"claim_id": "c-04b", "type": "next_action", "entity_key": "test:retry", "attribute": "schedule", "due_date": None, "statement": "Nobody has been assigned to write the retry test yet"},
        # Conflict 5: (module:check-in-kiosk, owner)
        {"claim_id": "c-05a", "type": "owner", "entity_key": "module:check-in-kiosk", "attribute": "owner", "owner": "Aarav", "statement": "Verify kiosk offline recovery is assigned to Aarav"},
        {"claim_id": "c-05b", "type": "owner", "entity_key": "module:check-in-kiosk", "attribute": "owner", "owner": None, "statement": "The check-in kiosk module has no recorded owner or successor"},
        # Conflict 6: (release:v1.0, publish_owner)
        {"claim_id": "c-06a", "type": "next_action", "entity_key": "release:v1.0", "attribute": "publish_owner", "owner": "unassigned", "statement": "Publish v1.0 to the club website has owner unassigned"},
        {"claim_id": "c-06b", "type": "next_action", "entity_key": "release:v1.0", "attribute": "publish_owner", "owner": "Meera", "statement": "Publish v1.0 to the club website is assigned to Meera"},
    ]

    flagged = service.detect_conflicts(conflicts_input)
    assert len(flagged) == 12
    for c in flagged:
        assert c["state"] == "conflicting", f"Claim {c['claim_id']} failed to be marked conflicting"
        assert len(c["conflict_with"]) >= 1


def test_gaps_server_side_acl_filtering():
    """Verify that gaps with L2/L3 labels are filtered server-side so lower roles never see them."""
    from app.core import acl
    gaps = [
        {"gap_id": "g-01", "question": "Public L1 gap", "acl_label": "L1"},
        {"gap_id": "g-02", "question": "Maintainer L2 gap", "acl_label": "L2"},
        {"gap_id": "g-03", "question": "Leadership L3 secret gap", "acl_label": "L3"},
    ]

    # Incoming contributor: only sees L1
    contrib_visible = [g for g in gaps if acl.can_read("incoming_contributor", g["acl_label"])]
    assert len(contrib_visible) == 1
    assert contrib_visible[0]["gap_id"] == "g-01"

    # Incoming maintainer: sees L1 and L2, but NOT L3
    maint_visible = [g for g in gaps if acl.can_read("incoming_maintainer", g["acl_label"])]
    assert len(maint_visible) == 2
    assert {g["gap_id"] for g in maint_visible} == {"g-01", "g-02"}

    # Approver: sees L1, L2, L3
    appr_visible = [g for g in gaps if acl.can_read("approver", g["acl_label"])]
    assert len(appr_visible) == 3
