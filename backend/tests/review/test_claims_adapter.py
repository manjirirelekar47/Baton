"""Regression tests for Bug 1: PublicClaimsAdapter.edit_statement and reverify."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.modules.review.claims_adapter import PublicClaimsAdapter
from app.modules.review.errors import ReviewError


def test_edit_statement_passes_correct_args_and_preserves_metadata():
    adapter = PublicClaimsAdapter()

    sample_claim = {
        "claim_id": "c-123",
        "project_id": "proj-test",
        "type": "decision",
        "entity_key": "api_config",
        "attribute": "payment_gateway",
        "statement": "Original statement",
        "state": "verified",
        "acl_label": "L2",
        "owner": "Aarav",
        "proposed_owner": "Meera",
        "proposed_owner_id": "u-meera",
        "due_date": "2026-12-01",
        "blocked_by": ["task-1"],
        "attested_by": "u-approver",
        "conflict_with": ["c-999"],
        "suggested_claim_id": "c-999",
        "evidence": [
            {
                "chunk_id": "chk-1",
                "quote": "Quote text",
                "acl_label": "L2",
                "source_id": "src-1",
                "source_title": "Design Doc",
                "event_time": "2026-11-01",
            }
        ],
    }

    mock_get_claim = MagicMock(return_value=sample_claim)
    mock_reverify = MagicMock(side_effect=lambda pid, cdata: {**cdata, "state": "verified"})

    with patch("app.modules.review.claims_adapter._fn_or_none") as mock_fn:
        def fn_lookup(*names: str):
            if "reverify" in names:
                return mock_reverify
            if "get_claim" in names:
                return mock_get_claim
            return None

        mock_fn.side_effect = fn_lookup

        res = adapter.edit_statement("proj-test", "c-123", "New statement", edited_by="u-editor")

        # 1. Verify get_claim was called with project_id and claim_id
        mock_get_claim.assert_called_once_with("proj-test", "c-123")

        # 2. Verify reverify was called with exactly 2 positional arguments: project_id and updated_data
        mock_reverify.assert_called_once()
        args, kwargs = mock_reverify.call_args
        assert len(args) == 2
        assert args[0] == "proj-test"
        updated_payload = args[1]

        # 3. Verify edited_by is NOT passed in the verification public API args
        assert "edited_by" not in updated_payload

        # 4. Verify statement was updated
        assert updated_payload["statement"] == "New statement"

        # 5. Verify all other metadata and evidence are preserved
        assert updated_payload["claim_id"] == "c-123"
        assert updated_payload["type"] == "decision"
        assert updated_payload["entity_key"] == "api_config"
        assert updated_payload["attribute"] == "payment_gateway"
        assert updated_payload["acl_label"] == "L2"
        assert updated_payload["owner"] == "Aarav"
        assert updated_payload["proposed_owner"] == "Meera"
        assert updated_payload["due_date"] == "2026-12-01"
        assert updated_payload["blocked_by"] == ["task-1"]
        assert updated_payload["attested_by"] == "u-approver"
        assert updated_payload["conflict_with"] == ["c-999"]
        assert len(updated_payload["evidence"]) == 1
        assert updated_payload["evidence"][0]["quote"] == "Quote text"

        # 6. Verify returned Claim object
        assert res.id == "c-123"
        assert res.statement == "New statement"
        assert res.acl_label == "L2"
        assert res.owner == "Aarav"


def test_edit_statement_missing_claim_raises_404():
    adapter = PublicClaimsAdapter()

    mock_get_claim = MagicMock(return_value=None)
    mock_reverify = MagicMock()

    with patch("app.modules.review.claims_adapter._fn_or_none") as mock_fn:
        def fn_lookup(*names: str):
            if "reverify" in names:
                return mock_reverify
            if "get_claim" in names:
                return mock_get_claim
            return None

        mock_fn.side_effect = fn_lookup

        with pytest.raises(ReviewError) as exc_info:
            adapter.edit_statement("proj-test", "non-existent-claim", "Statement", "u-1")

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail["code"] == "claim_not_found"
        mock_reverify.assert_not_called()


def test_edit_statement_project_isolation():
    """Claims in proj-A must not be editable or found under proj-B."""
    adapter = PublicClaimsAdapter()

    def get_claim_mock(project_id: str, claim_id: str):
        if project_id == "proj-A" and claim_id == "c-only-in-A":
            return {"claim_id": "c-only-in-A", "project_id": "proj-A", "statement": "Stmt A"}
        return None

    mock_reverify = MagicMock()

    with patch("app.modules.review.claims_adapter._fn_or_none") as mock_fn:
        def fn_lookup(*names: str):
            if "reverify" in names:
                return mock_reverify
            if "get_claim" in names:
                return get_claim_mock
            return None

        mock_fn.side_effect = fn_lookup

        with pytest.raises(ReviewError) as exc_info:
            adapter.edit_statement("proj-B", "c-only-in-A", "Hacked statement", "u-hacker")

        assert exc_info.value.status_code == 404
        mock_reverify.assert_not_called()


def test_edit_statement_with_real_verification_public():
    """Verify live contract between PublicClaimsAdapter and verification.public."""
    adapter = PublicClaimsAdapter()

    # Create test claim in DB using verification public / service
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    from pathlib import Path
    schema_dir = Path(__file__).resolve().parents[3] / "db" / "schema"
    raw = eng.raw_connection()
    for sql_file in sorted(schema_dir.glob("*.sql")):
        raw.executescript(sql_file.read_text(encoding="utf-8"))
    raw.commit()

    with Session(eng) as session:
        from sqlalchemy import text
        session.execute(
            text("""
                insert into projects (id, name, created_at)
                values ('p-live', 'Live Project', '2026-11-19T00:00:00')
            """)
        )
        session.execute(
            text("""
                insert into sources (id, project_id, title, type, acl_label, consent, status, chunks, created_at)
                values ('src-test', 'p-live', 'test.md', 'document', 'L1', 1, 'parsed', 1, '2026-11-19T00:00:00')
            """)
        )
        session.execute(
            text("""
                insert into source_chunks (id, project_id, source_id, source_type, source_title, author, event_time, acl_label, content_hash, char_start, char_end, content)
                values ('chk-1', 'p-live', 'src-test', 'document', 'test.md', 'author', '2026-11-19T00:00:00', 'L1', 'hash1', 0, 34, 'Payments run in sandbox mode only')
            """)
        )
        session.execute(
            text("""
                insert into claims (id, project_id, type, entity_key, attribute, statement, state, acl_label, created_at, updated_at)
                values ('c-live-1', 'p-live', 'decision', 'payment', 'mode', 'Payments run in live mode', 'missing', 'L1', '2026-11-19T00:00:00', '2026-11-19T00:00:00')
            """)
        )
        session.execute(
            text("""
                insert into evidence (id, claim_id, chunk_id, quote, source_id, acl_label, created_at)
                values ('ev-1', 'c-live-1', 'chk-1', 'Payments run in sandbox mode only', 'src-test', 'L1', '2026-11-19T00:00:00')
            """)
        )
        session.commit()

        # Patch get_engine to use our seeded test engine
        with patch("app.modules.verification.public.get_engine", return_value=eng):
            edited_claim = adapter.edit_statement("p-live", "c-live-1", "Payments run in sandbox mode only", "u-approver")

            # Check that statement was updated and evidence verified
            assert edited_claim.id == "c-live-1"
            assert edited_claim.statement == "Payments run in sandbox mode only"
            assert edited_claim.state == "Verified"

            # Check database persistence
            row = session.execute(
                text("select statement, state from claims where id = 'c-live-1' and project_id = 'p-live'")
            ).mappings().one()
            assert row["statement"] == "Payments run in sandbox mode only"
            assert row["state"] == "verified"
