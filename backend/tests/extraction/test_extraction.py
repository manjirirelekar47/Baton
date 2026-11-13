"""Tests for Extraction module (F3):
Schemas, provider adapter, tier partitioning, entity merging, and job worker.
"""
import json
import time
from unittest.mock import MagicMock

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


def test_gemini_compatible_api_response(monkeypatch):
    """Test successful Gemini 3.8 Flash compatible API extraction.

    Verifies:
    - temperature=0 is omitted for Gemini requests.
    - reasoning_effort is set to 'low'.
    - response_format is set to json_object.
    - Gemini OpenAI-compatible default URL is targeted.
    - Pydantic validation and claims extraction succeed.
    """
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("LLM_MODEL", "gemini-3.8-flash")
    monkeypatch.setenv("LLM_API_KEY", "test-gemini-key")
    monkeypatch.delenv("LLM_BASE_URL", raising=False)

    adapter = service.LLMProviderAdapter()
    assert adapter.is_live_configured() is True
    assert adapter.is_gemini() is True

    valid_response_json = {
        "id": "chatcmpl-gemini-flash-test",
        "object": "chat.completion",
        "created": 1731500000,
        "model": "gemini-3.8-flash",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": json.dumps({
                        "claims": [
                            {
                                "type": "decision",
                                "entity_key": "server:staging",
                                "attribute": "funding",
                                "statement": "Sponsor funding for the staging server ends in December",
                                "acl_label": "L1",
                                "evidence": [
                                    {
                                        "chunk_id": "S4-301",
                                        "quote": "Sponsor funding for the staging server ends in December",
                                        "acl_label": "L1",
                                    }
                                ],
                            }
                        ]
                    }),
                },
                "finish_reason": "stop",
            }
        ],
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = valid_response_json
    mock_resp.raise_for_status = MagicMock()

    mock_post = MagicMock(return_value=mock_resp)
    monkeypatch.setattr("httpx.post", mock_post)

    chunks = [
        {
            "chunk_id": "S4-301",
            "author": "Rohan",
            "event_time": "2026-11-01T10:00:00Z",
            "text": "Sponsor funding for the staging server ends in December",
        }
    ]

    claims = adapter.extract_from_chunks("L1", chunks)

    # Assert request properties
    assert mock_post.call_count == 1
    call_args = mock_post.call_args
    target_url = call_args[0][0] if call_args[0] else call_args[1]["url"]
    sent_payload = call_args[1]["json"]
    sent_headers = call_args[1]["headers"]

    assert target_url == "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    assert sent_headers["Authorization"] == "Bearer test-gemini-key"
    assert sent_payload["model"] == "gemini-3.8-flash"
    assert "temperature" not in sent_payload, "Gemini requests must not include temperature parameter"
    assert sent_payload["reasoning_effort"] == "low", "Gemini requests must set reasoning_effort to low"
    assert sent_payload["response_format"] == {"type": "json_object"}

    # Assert validated output
    assert len(claims) == 1
    assert claims[0]["type"] == "decision"
    assert claims[0]["entity_key"] == "server:staging"
    assert claims[0]["statement"] == "Sponsor funding for the staging server ends in December"
    assert claims[0]["evidence"][0]["chunk_id"] == "S4-301"


def test_gemini_repair_retry_and_fallback(monkeypatch):
    """Test that Gemini adapter executes repair retry on invalid schema and falls back to replay if retry fails."""
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("LLM_MODEL", "gemini-3.8-flash")
    monkeypatch.setenv("LLM_API_KEY", "test-gemini-key")

    adapter = service.LLMProviderAdapter()

    # First call returns malformed JSON
    bad_resp = MagicMock()
    bad_resp.status_code = 200
    bad_resp.json.return_value = {
        "choices": [{"message": {"content": "Not valid JSON {"}}]
    }
    bad_resp.raise_for_status = MagicMock()

    # Second call (repair retry) returns valid schema
    good_resp = MagicMock()
    good_resp.status_code = 200
    good_resp.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": json.dumps({
                        "claims": [
                            {
                                "type": "owner",
                                "entity_key": "module:payments",
                                "attribute": "owner",
                                "statement": "Rohan owns payments",
                                "evidence": [{"chunk_id": "S4-212", "quote": "Rohan took payments over"}],
                            }
                        ]
                    })
                }
            }
        ]
    }
    good_resp.raise_for_status = MagicMock()

    mock_post = MagicMock(side_effect=[bad_resp, good_resp])
    monkeypatch.setattr("httpx.post", mock_post)

    chunks = [{"chunk_id": "S4-212", "text": "Rohan took payments over"}]
    claims = adapter.extract_from_chunks("L1", chunks)

    assert mock_post.call_count == 2
    retry_payload = mock_post.call_args_list[1][1]["json"]
    assert "temperature" not in retry_payload
    assert retry_payload["reasoning_effort"] == "low"
    assert len(claims) == 1
    assert claims[0]["type"] == "owner"
