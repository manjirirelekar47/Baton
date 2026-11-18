import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.modules.capture.models import CaptureRequest
from app.modules.capture.public import create_note
from tests.conftest import login


def test_capture_requires_explicit_consent_and_nonblank_text():
    with pytest.raises(ValidationError):
        CaptureRequest(title="Decision", body="Use the existing deploy workflow", consent=False)
    with pytest.raises(ValidationError):
        CaptureRequest(title="  ", body="Use the existing deploy workflow", consent=True)


def test_capture_requires_approver_role(client):
    payload = {"title": "Release decision", "body": "Use the existing deploy workflow.", "acl_label": "L1", "consent": True}
    assert client.post("/capture", json=payload).status_code == 401
    assert client.post("/capture", headers=login(client, "incoming_contributor"), json=payload).status_code == 403


def test_approver_capture_is_listed_as_a_connected_source(client):
    response = client.post("/capture", headers=login(client, "approver"), json={
        "title": "Retry worker decision",
        "body": "The retry worker will use exponential backoff before the next release.",
        "acl_label": "L1",
        "consent": True,
    })
    assert response.status_code == 201
    captured = response.json()
    assert captured["chunks"] == 1
    sources = client.get("/sources", headers=login(client, "approver"))
    assert sources.status_code == 200
    assert any(item["source_id"] == captured["source_id"] for item in sources.json())


def test_captured_note_uses_redaction_and_source_storage(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'capture.db'}")
    with engine.begin() as conn:
        conn.exec_driver_sql("create table projects (id text primary key, name text not null, created_at text not null)")
        conn.exec_driver_sql("insert into projects values ('p1','Project','2026-01-01T00:00:00Z')")
        conn.exec_driver_sql("create table sources (id text primary key, project_id text, title text, type text, acl_label text, consent integer, status text, chunks integer, note text, created_at text)")
        conn.exec_driver_sql("create table source_chunks (id text primary key, project_id text, source_id text, source_type text, source_title text, author text, event_time text, acl_label text, content_hash text, char_start integer, char_end integer, content text)")
    with Session(engine) as session:
        item = create_note(project_id="p1", author="Approver", title="Release decision", body="Use api_key=supersecretvalue for deploy", acl_label="L1", session=session)
        chunk = session.execute(text("select content, author from source_chunks where source_id=:id"), {"id": item["source_id"]}).one()
        assert item["consent"] is True
        assert chunk.author == "Approver"
        assert "supersecretvalue" not in chunk.content
