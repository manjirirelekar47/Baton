"""Tests for Extraction module (F3):
Schemas, provider adapter, tier partitioning, entity merging, and job worker.
"""
import time

import pytest
from pydantic import ValidationError

from app.modules.extraction import service
from app.modules.extraction.models import ExtractionBatch


def test_extraction_claim_schema_valid():
    valid_data = {
        "claims": [
            {
                "type": "owner",
                "entity_key": "module:payments",
                "attribute": "owner",
                "statement": "Rohan owns the payments module",
                "evidence": [{"chunk_id": "S4-212", "quote": "Rohan took payments over"}],
            }
        ]
    }
    batch = ExtractionBatch.model_validate(valid_data)
    assert len(batch.claims) == 1
    assert batch.claims[0].type == "owner"
    assert batch.claims[0].evidence[0].chunk_id == "S4-212"


def test_extraction_claim_schema_invalid():
    # Invalid claim type
    invalid_data = {
        "claims": [
            {
                "type": "invalid_type_not_in_enum",
                "entity_key": "module:payments",
                "attribute": "owner",
                "statement": "Statement",
            }
        ]
    }
    with pytest.raises(ValidationError):
        ExtractionBatch.model_validate(invalid_data)


def test_merge_entities():
    claims = [
        {
            "type": "owner",
            "entity_key": "module:payments",
            "attribute": "owner",
            "statement": "Rohan took payments over",
            "evidence": [{"chunk_id": "c1", "quote": "Rohan took over"}],
            "owner": "Rohan",
        },
        {
            "type": "owner",
            "entity_key": "module:payments",
            "attribute": "owner",
            "statement": "Rohan is payments lead",
            "evidence": [{"chunk_id": "c2", "quote": "ping me for payments"}],
            "owner": "Rohan",
        },
    ]
    merged = service.merge_entities(claims)
    assert len(merged) == 1
    assert len(merged[0]["evidence"]) == 2
    chunk_ids = {e["chunk_id"] for e in merged[0]["evidence"]}
    assert chunk_ids == {"c1", "c2"}


def test_replay_mode_job_execution(tmp_path, monkeypatch):
    """Test that start_reconstruct runs in background and completes with verified claims."""
    db_file = tmp_path / "test_job.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")

    from sqlalchemy import text
    from sqlalchemy.orm import Session

    from app.core.audit import now_iso
    from app.core.db import apply_schema, get_engine

    engine = get_engine()
    apply_schema(engine)

    # Seed demo project
    with Session(engine) as s:
        s.execute(text("insert into projects (id, name, created_at) values ('p-demo', 'Demo', :now)"), {"now": now_iso()})
        s.commit()

    # Start reconstruction in replay mode
    job_info = service.start_reconstruct("p-demo", mode="replay")
    job_id = job_info["job_id"]
    assert job_id.startswith("job-")
    assert job_info["status"] == "pending"

    # Wait for background worker to complete
    max_wait = 10.0
    start = time.time()
    completed = False
    while time.time() - start < max_wait:
        current = service.get_job(job_id)
        if current and current["status"] == "done":
            completed = True
            assert current["progress"] == 100
            assert current["claims_count"] > 0
            break
        time.sleep(0.2)

    assert completed is True, f"Job did not complete in time. Last status: {service.get_job(job_id)}"
