from app.core.auth import DEMO_PROJECT_ID
from app.modules.ingestion.service import _demo_fixture_chunks, _demo_fixture_sources
from app.modules.risk.service import build_delivery_status, build_risk_radar


def test_seeded_demo_fixture_contains_120_git_records_and_five_modules(monkeypatch):
    monkeypatch.setenv("INGEST_ENABLE_CHAT", "false")
    chunks = _demo_fixture_chunks(DEMO_PROJECT_ID)
    git_chunks = [item for item in chunks if item["source_type"] == "git"]
    assert len(git_chunks) == 120
    assert {item["text"].split("module: ", 1)[1].split(" |", 1)[0] for item in git_chunks} == {
        "payments", "registration", "notifications", "check-in-kiosk", "admin"
    }


def test_seeded_demo_risk_flags_exactly_the_two_planted_sole_owner_modules(monkeypatch):
    monkeypatch.setenv("INGEST_ENABLE_CHAT", "false")
    rows = build_risk_radar(_demo_fixture_chunks(DEMO_PROJECT_ID))
    flagged = {row["module"] for row in rows if row["flagged"]}
    assert flagged == {"payments", "check-in-kiosk"}
    assert len(rows) == 5
    assert all(row["evidence_chunk_ids"] for row in rows)


def test_seeded_demo_delivery_status_exposes_blocked_chain(monkeypatch):
    monkeypatch.setenv("INGEST_ENABLE_CHAT", "false")
    rows = build_delivery_status(_demo_fixture_chunks(DEMO_PROJECT_ID))
    by_id = {row["task"]: row for row in rows}
    assert by_id["T-52"]["blocked_by"] == ["T-49"]
    assert by_id["T-52"]["holds_up"] == ["T-58"]
    assert by_id["T-58"]["blocked_by"] == ["T-52"]


def test_seeded_demo_chat_fixtures_follow_gate_one(monkeypatch):
    monkeypatch.setenv("INGEST_ENABLE_CHAT", "false")
    disabled = _demo_fixture_sources(DEMO_PROJECT_ID)
    assert all(row["status"] == "skipped" for row in disabled if row["type"] == "chat")

    monkeypatch.setenv("INGEST_ENABLE_CHAT", "true")
    enabled = _demo_fixture_sources(DEMO_PROJECT_ID)
    parsed_chats = [row for row in enabled if row["type"] == "chat"]
    assert len(parsed_chats) == 2
    assert all(row["status"] == "parsed" and row["chunks"] > 0 for row in parsed_chats)
