import json
from datetime import UTC, datetime

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.modules.ingestion import service


def test_redacts_credentials_and_contact_information_before_chunking():
    value = "Deploy with api_key=supersecretvalue and contact bhavesh@example.com or +91 9876543210"
    safe = service.redact_text(value)
    assert "supersecretvalue" not in safe
    assert "bhavesh@example.com" not in safe
    assert "9876543210" not in safe
    assert "[REDACTED_SECRET]" in safe


def test_markdown_chunk_has_stable_id_hash_and_source_span():
    record = service.ParsedRecord("Decision: use a queue because retries must survive restarts", "Aarav", datetime(2026, 10, 1, tzinfo=UTC))
    kwargs = dict(project_id="p1", source_id="s1", source_type="document", source_title="notes.md", acl_label="L1")
    first = service.chunk_record(record, **kwargs)
    second = service.chunk_record(record, **kwargs)
    assert first == second
    assert first[0]["char_span"] == [0, len(record.text)]
    assert first[0]["content_hash"].startswith("sha256:")


def test_parse_task_csv_requires_task_identity():
    with pytest.raises(ValueError, match="title, task or name"):
        service.parse_task_csv(b"owner,status\nAarav,open\n")


def test_parse_task_csv_extracts_owner_and_blocker():
    records = service.parse_task_csv(b"task,owner,updated_by,status,due,blocked_by\nPublish v1,Aarav,Aarav,In progress,2026-11-20,T-49\n")
    assert len(records) == 1
    assert "blocked_by: T-49" in records[0].text
    assert records[0].author == "Aarav"


def test_git_json_accepts_commits_and_import_metadata():
    payload = {"commits": [{"sha": "abc123", "author": {"name": "Aarav"}, "date": "2026-10-02T10:00:00Z", "message": "payments: add retry worker", "imports": ["payments", "queue"]}]}
    records = service.parse_git_json(json.dumps(payload).encode())
    assert len(records) == 1
    assert records[0].author == "Aarav"
    assert "imports: [\"payments\", \"queue\"]" in records[0].text


def test_chat_parser_is_explicitly_gated():
    with pytest.raises(ValueError, match="disabled until Gate 1"):
        service.parse_upload("chat.json", b'{"messages": []}')
    source_type, records = service.parse_upload("chat.json", b'{"messages": [{"author":"Aarav","text":"hello"}]}', allow_chat=True)
    assert source_type == "chat" and records[0].text == "hello"


def test_upload_rejects_directory_traversal_and_oversized_files():
    with pytest.raises(ValueError, match="valid filename"):
        service.parse_upload("../notes.txt", b"safe")
    with pytest.raises(ValueError, match="no larger than"):
        service.parse_upload("notes.txt", b"x" * (service.MAX_UPLOAD_BYTES + 1))


def test_persist_source_is_project_scoped_and_chunk_can_be_loaded(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'ingestion.db'}")
    with engine.begin() as conn:
        conn.exec_driver_sql("create table projects (id text primary key, name text not null, created_at text not null)")
        conn.exec_driver_sql("insert into projects values ('p1','Project','2026-01-01T00:00:00Z')")
        conn.exec_driver_sql("""create table sources (id text primary key, project_id text, title text, type text, acl_label text, consent integer, status text, chunks integer, note text, created_at text)""")
        conn.exec_driver_sql("""create table source_chunks (id text primary key, project_id text, source_id text, source_type text, source_title text, author text, event_time text, acl_label text, content_hash text, char_start integer, char_end integer, content text)""")
    with Session(engine) as session:
        item = service.persist_source(session, project_id="p1", filename="readme.md", source_type="document", acl_label="L1",
                                      records=[service.ParsedRecord("Payments remain in test mode until finance approves.", "Aarav", datetime(2026,9,1,tzinfo=UTC))])
        assert item["consent"] is True
        assert item["chunks"] == 1
        found = service.get_chunk(session, "p1", session.execute(text("select id from source_chunks")).scalar_one())
        assert found and found["text"].startswith("Payments remain")
        assert service.get_chunk(session, "another-project", found["chunk_id"]) is None


def test_pdf_without_embedded_event_metadata_does_not_use_import_time(monkeypatch):
    import sys
    from types import SimpleNamespace

    fake_reader = SimpleNamespace(is_encrypted=False, pages=[SimpleNamespace(extract_text=lambda: "Release notes without a timestamp")])
    monkeypatch.setitem(sys.modules, "pypdf", SimpleNamespace(PdfReader=lambda *_args, **_kwargs: fake_reader))
    records = service.parse_document("notes.pdf", b"%PDF-1.7 fake")
    assert len(records) == 1
    assert records[0].event_time == datetime(1970, 1, 1, tzinfo=UTC)


def test_pdf_and_docx_reject_invalid_container_bytes():
    with pytest.raises(ValueError, match="valid PDF"):
        service.parse_document("notes.pdf", b"not a pdf")
    with pytest.raises(ValueError, match="valid DOCX"):
        service.parse_document("notes.docx", b"not a zip archive")


def test_parse_upload_rejects_malformed_git_json():
    with pytest.raises(json.JSONDecodeError):
        service.parse_upload("git-export.json", b"{bad json")


def test_source_inventory_and_chunk_access_fail_closed_for_restricted_labels(monkeypatch):
    from app.modules.ingestion import public

    monkeypatch.setattr(service, "list_sources", lambda session, project_id: [
        {"source_id": "public", "acl_label": "L1"},
        {"source_id": "leadership", "acl_label": "L3"},
    ])
    assert [row["source_id"] for row in public.list_sources("p1", "incoming_contributor", object())] == ["public"]

    monkeypatch.setattr(service, "get_chunk", lambda session, project_id, chunk_id: {
        "chunk_id": chunk_id, "project_id": project_id, "acl_label": "L3", "text": "private",
    })
    assert public.get_chunk("p1", "restricted", "incoming_contributor", object()) is None
    assert public.get_chunk("p1", "restricted", "approver", object())["text"] == "private"


def test_redacts_quoted_secret_values_including_spaces():
    safe = service.redact_text('password="two words secret"')
    assert "two words secret" not in safe
    assert "[REDACTED_SECRET]" in safe


def test_redaction_preserves_iso_dates_and_redacts_phone_numbers():
    safe = service.redact_text("Due 2026-11-20; call +91 9876543210")
    assert "2026-11-20" in safe
    assert "9876543210" not in safe
    assert "[REDACTED_PHONE]" in safe


def test_documents_without_event_metadata_do_not_fabricate_timeline_dates():
    records = service.parse_document("notes.md", b"A decision was recorded here.")
    assert len(records) == 1
    assert records[0].event_time == datetime(1970, 1, 1, tzinfo=UTC)


def test_git_parser_accepts_unix_event_timestamps():
    records = service.parse_git_json(json.dumps({"commits": [{"message": "change", "timestamp": 1794000000}]}).encode())
    assert records[0].event_time == datetime.fromtimestamp(1794000000, tz=UTC)


def test_list_chunks_filters_restricted_evidence_before_other_modules_consume_it(monkeypatch):
    from app.modules.ingestion import public

    data = [
        {"chunk_id": "team", "acl_label": "L1"},
        {"chunk_id": "maintainers", "acl_label": "L2"},
        {"chunk_id": "leadership", "acl_label": "L3"},
    ]
    monkeypatch.setattr(service, "list_chunks", lambda session, project_id: data)
    visible = public.list_chunks("p1", "incoming_contributor", object())
    approver = public.list_chunks("p1", "approver", object())
    assert [item["chunk_id"] for item in visible] == ["team"]
    assert [item["chunk_id"] for item in approver] == ["team", "maintainers", "leadership"]


def test_only_project_approver_can_connect_source_files():
    assert service.can_manage_sources("approver") is True
    assert service.can_manage_sources("leaver") is False
    assert service.can_manage_sources("incoming_maintainer") is False
    assert service.can_manage_sources("incoming_contributor") is False
