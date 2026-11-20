"""Source parsing, redaction, immutable chunking and persistence."""
from __future__ import annotations

import csv
import hashlib
import io
import json
import logging
import os
import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
CHUNK_CHARS = 1200
CHUNK_OVERLAP = 120


def can_manage_sources(role: str) -> bool:
    """Source connection and management is allowed for approver and leaver roles."""
    return role in ("approver", "leaver")

# Redact high-confidence credentials before text reaches storage or extraction.
SECRET_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"(?i)\b(api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*(?:\"[^\"]*\"|\'[^\']*\'|[^\s,;]+)"), "[REDACTED_SECRET]"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "[REDACTED_AWS_KEY]"),
    (re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b"), "[REDACTED_GITHUB_TOKEN]"),
    (re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"), "[REDACTED_API_KEY]"),
)
PII_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b"), "[REDACTED_EMAIL]"),
)
PHONE_CANDIDATE = re.compile(r"(?<!\w)\+?\d[\d .()-]{8,}\d(?!\w)")


@dataclass(frozen=True)
class ParsedRecord:
    text: str
    author: str = "Unknown"
    event_time: datetime = datetime(1970, 1, 1, tzinfo=UTC)
    external_id: str | None = None
    title: str | None = None
    external_url: str | None = None


def redact_text(value: str) -> str:
    """Redact obvious secrets and contact PII before chunking or persistence."""
    result = value
    for pattern, replacement in (*SECRET_PATTERNS, *PII_PATTERNS):
        result = pattern.sub(replacement, result)

    def redact_phone(match: re.Match[str]) -> str:
        candidate = match.group(0)
        digits = sum(character.isdigit() for character in candidate)
        # Do not mistake common ISO dates (YYYY-MM-DD) or short identifiers for phone numbers.
        if re.fullmatch(r"\d{4}[-/.]\d{1,2}[-/.]\d{1,2}", candidate.strip()):
            return candidate
        return "[REDACTED_PHONE]" if 10 <= digits <= 15 else candidate

    return PHONE_CANDIDATE.sub(redact_phone, result)


def _parse_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            parsed = datetime.fromtimestamp(value, tz=UTC)
        except (OverflowError, OSError, ValueError):
            return datetime(1970, 1, 1, tzinfo=UTC)
    elif value:
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return datetime(1970, 1, 1, tzinfo=UTC)
    else:
        return datetime(1970, 1, 1, tzinfo=UTC)
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)


def _split_records(value: str, author: str = "Unknown", event_time: datetime | None = None) -> list[ParsedRecord]:
    """Split text into records; absent event metadata stays unknown, never the import time."""
    stamp = event_time or datetime(1970, 1, 1, tzinfo=UTC)
    blocks = [part.strip() for part in re.split(r"\n\s*\n", value) if part.strip()]
    return [ParsedRecord(part, author, stamp) for part in blocks] or ([ParsedRecord(value.strip(), author, stamp)] if value.strip() else [])


def parse_document(filename: str, content: bytes) -> list[ParsedRecord]:
    suffix = Path(filename).suffix.lower()
    if suffix in {".md", ".txt"}:
        decoded = content.decode("utf-8-sig")
        return _split_records(decoded)
    if suffix == ".pdf":
        if not content.startswith(b"%PDF-"):
            raise ValueError("The uploaded file is not a valid PDF document.")
        from pypdf import PdfReader

        try:
            reader = PdfReader(io.BytesIO(content), strict=False)
            if reader.is_encrypted:
                raise ValueError("Encrypted PDFs are not supported. Export an authorised, readable copy.")
            records: list[ParsedRecord] = []
            for page in reader.pages:
                page_text = page.extract_text() or ""
                records.extend(_split_records(page_text, author="Unknown"))
            return records
        except ValueError:
            raise
        except Exception as exc:
            raise ValueError("Could not parse this PDF. Export a readable, non-encrypted PDF and try again.") from exc
    if suffix == ".docx":
        import zipfile

        from docx import Document

        if not zipfile.is_zipfile(io.BytesIO(content)):
            raise ValueError("The uploaded file is not a valid DOCX document.")
        try:
            document = Document(io.BytesIO(content))
            paragraphs = [p.text.strip() for p in document.paragraphs if p.text.strip()]
            for table in document.tables:
                for row in table.rows:
                    cells = [cell.text.strip() for cell in row.cells]
                    if any(cells):
                        paragraphs.append(" | ".join(cells))
            return _split_records("\n\n".join(paragraphs))
        except Exception as exc:
            raise ValueError("Could not parse this DOCX. Export a valid Word document and try again.") from exc
    raise ValueError("Unsupported document format. Use MD, TXT, PDF or DOCX.")


def parse_task_csv(content: bytes) -> list[ParsedRecord]:
    decoded = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(decoded))
    if not reader.fieldnames:
        raise ValueError("Task CSV must include a header row.")
    rows = []
    for row in reader:
        cleaned = {str(k).strip(): (v or "").strip() for k, v in row.items() if k}
        if not any(cleaned.values()):
            continue
        title = cleaned.get("title") or cleaned.get("task") or cleaned.get("name")
        if not title:
            raise ValueError("Each task row must include a title, task or name column.")
        rendered = " | ".join(f"{key}: {value}" for key, value in cleaned.items() if value)
        rows.append(ParsedRecord(rendered, cleaned.get("author") or cleaned.get("updated_by") or "Unknown", _parse_datetime(cleaned.get("updated_at") or cleaned.get("event_time"))))
    return rows


def parse_git_json(content: bytes) -> list[ParsedRecord]:
    payload = json.loads(content.decode("utf-8-sig"))
    entries = payload if isinstance(payload, list) else payload.get("commits", payload.get("items", [])) if isinstance(payload, dict) else None
    if not isinstance(entries, list):
        raise ValueError("Git export JSON must be a list or an object containing a commits/items list.")
    records = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        message = str(entry.get("message") or entry.get("title") or "").strip()
        if not message:
            continue
        author = entry.get("author")
        if isinstance(author, dict):
            author = author.get("name") or author.get("login") or "Unknown"
        rendered = [f"commit {entry.get('sha', entry.get('id', 'unknown'))}", message]
        for key in ("module", "directory", "component", "branch", "files", "imports", "reviewers", "reviewed_by", "pull_request", "pr", "url"):
            value = entry.get(key)
            if value:
                rendered.append(f"{key}: {json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else value}")
        records.append(ParsedRecord(" | ".join(rendered), str(author or "Unknown"), _parse_datetime(entry.get("event_time") or entry.get("date") or entry.get("timestamp"))))
    return records


def parse_chat_export(content: bytes) -> list[ParsedRecord]:
    decoded = content.decode("utf-8-sig")
    try:
        payload = json.loads(decoded)
    except json.JSONDecodeError:
        payload = None
    if isinstance(payload, list) or isinstance(payload, dict):
        entries = payload if isinstance(payload, list) else payload.get("messages", payload.get("items", []))
        if not isinstance(entries, list):
            raise ValueError("Chat JSON must contain a messages/items list.")
        records = []
        for item in entries:
            if not isinstance(item, dict):
                continue
            message = str(item.get("text") or item.get("message") or item.get("content") or "").strip()
            if message:
                records.append(ParsedRecord(message, str(item.get("author") or item.get("user") or "Unknown"), _parse_datetime(item.get("event_time") or item.get("timestamp") or item.get("date"))))
        return records
    return _split_records(decoded)


def chunk_record(record: ParsedRecord, *, project_id: str, source_id: str, source_type: str, source_title: str, acl_label: str) -> list[dict[str, Any]]:
    """Create deterministic, content-addressed chunks with offsets into the redacted record."""
    safe_text = redact_text(record.text).strip()
    if not safe_text:
        return []
    output: list[dict[str, Any]] = []
    start = 0
    while start < len(safe_text):
        end = min(len(safe_text), start + CHUNK_CHARS)
        fragment = safe_text[start:end].strip()
        if fragment:
            # IDs are stable for identical source records, text and offsets.
            digest = hashlib.sha256(f"{project_id}\0{source_id}\0{source_type}\0{start}\0{fragment}".encode()).hexdigest()
            output.append({
                "chunk_id": f"{source_id}-{digest[:12]}", "project_id": project_id,
                "source_id": source_id, "source_type": source_type, "source_title": source_title,
                "author": record.author or "Unknown", "event_time": _parse_datetime(record.event_time).isoformat(),
                "acl_label": acl_label, "content_hash": f"sha256:{hashlib.sha256(fragment.encode()).hexdigest()}",
                "char_span": [start, end], "text": fragment,
            })
        if end >= len(safe_text):
            break
        start = max(end - CHUNK_OVERLAP, start + 1)
    return output


def _source_type(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix in {".md", ".txt", ".pdf", ".docx"}:
        return "document"
    if suffix == ".csv":
        return "task_csv"
    if suffix == ".json":
        return "git"
    raise ValueError("Unsupported source format.")


def parse_upload(filename: str, content: bytes, *, allow_chat: bool = False) -> tuple[str, list[ParsedRecord]]:
    if not filename or Path(filename).name != filename or filename in {".", ".."}:
        raise ValueError("Provide a valid filename without directory paths.")
    if not content:
        raise ValueError("The uploaded file is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise ValueError(f"Files must be no larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.")
    suffix = Path(filename).suffix.lower()
    if suffix in {".md", ".txt", ".pdf", ".docx"}:
        return "document", parse_document(filename, content)
    if suffix == ".csv":
        return "task_csv", parse_task_csv(content)
    if suffix == ".json":
        if "chat" in Path(filename).stem.lower():
            if not allow_chat:
                raise ValueError("Chat export ingestion is disabled until Gate 1 passes.")
            return "chat", parse_chat_export(content)
        return "git", parse_git_json(content)
    raise ValueError("Unsupported file. Upload MD, TXT, PDF, DOCX, Git JSON or task CSV.")


def persist_source(session: Session, *, project_id: str, filename: str, source_type: str, acl_label: str, records: list[ParsedRecord]) -> dict[str, Any]:
    # Check for existing source with same filename in this project
    existing = session.execute(
        text("select id, title, type, acl_label, chunks, created_at from sources where project_id = :p and title = :t"),
        {"p": project_id, "t": filename},
    ).mappings().first()

    chunks: list[dict[str, Any]] = []
    if existing:
        temp_id = existing["id"]
        for record in records:
            chunks.extend(chunk_record(record, project_id=project_id, source_id=temp_id, source_type=source_type, source_title=filename, acl_label=acl_label))
        if not chunks:
            raise ValueError("No readable text was found in this file. Check the export and try again.")

        existing_chunks = session.execute(
            text("select content_hash from source_chunks where project_id = :p and source_id = :sid order by char_start asc"),
            {"p": project_id, "sid": temp_id},
        ).scalars().all()
        new_hashes = [c["content_hash"] for c in sorted(chunks, key=lambda c: c["char_span"][0])]

        if list(existing_chunks) == new_hashes and len(existing_chunks) == len(chunks):
            # Identical content: update acl if needed, avoid duplicate rows/alerts
            session.execute(
                text("update sources set acl_label = :acl, status = 'parsed' where id = :sid and project_id = :p"),
                {"acl": acl_label, "sid": temp_id, "p": project_id},
            )
            session.commit()
            return {
                "source_id": temp_id, "project_id": project_id, "title": filename, "type": source_type,
                "acl_label": acl_label, "consent": True, "status": "parsed", "chunks": len(chunks), "note": None,
                "created_at": existing["created_at"],
            }

        # Content changed: reset chunks to generate with new source_id
        chunks = []

    source_id = f"src-{uuid.uuid4().hex[:12]}"
    created_at = datetime.now(UTC).isoformat()
    for record in records:
        chunks.extend(chunk_record(record, project_id=project_id, source_id=source_id, source_type=source_type, source_title=filename, acl_label=acl_label))
    if not chunks:
        raise ValueError("No readable text was found in this file. Check the export and try again.")

    session.execute(text("""insert into sources (id, project_id, title, type, acl_label, consent, status, chunks, note, created_at)
        values (:id, :project_id, :title, :type, :acl_label, 1, 'parsed', :chunks, null, :created_at)"""), {
        "id": source_id, "project_id": project_id, "title": filename, "type": source_type,
        "acl_label": acl_label, "chunks": len(chunks), "created_at": created_at,
    })

    for chunk in chunks:
        session.execute(text("""insert into source_chunks
            (id, project_id, source_id, source_type, source_title, author, event_time, acl_label, content_hash, char_start, char_end, content)
            values (:id, :project_id, :source_id, :source_type, :source_title, :author, :event_time, :acl_label, :content_hash, :char_start, :char_end, :content)"""), {
            "id": chunk["chunk_id"], "project_id": project_id, "source_id": source_id,
            "source_type": source_type, "source_title": filename, "author": chunk["author"],
            "event_time": chunk["event_time"], "acl_label": acl_label, "content_hash": chunk["content_hash"],
            "char_start": chunk["char_span"][0], "char_end": chunk["char_span"][1], "content": chunk["text"],
        })
    session.commit()
    return {"source_id": source_id, "project_id": project_id, "title": filename, "type": source_type,
            "acl_label": acl_label, "consent": True, "status": "parsed", "chunks": len(chunks), "note": None,
            "created_at": created_at}


def _demo_sample_sources(project_id: str) -> list[dict[str, Any]]:
    """Read the checked-in demo inventory for the seeded Campus Event Portal only."""
    from app.core.auth import DEMO_PROJECT_ID

    if project_id != DEMO_PROJECT_ID:
        return []
    from app.core.samples import load_sample

    samples = load_sample("sources")
    return [{**source, "project_id": project_id, "consent": True, "created_at": None}
            for source in samples if source.get("source_id")]


def _demo_sample_chunks(project_id: str) -> list[dict[str, Any]]:
    """Return the existing contract evidence for demo claims; never mix it into another project."""
    from app.core.auth import DEMO_PROJECT_ID

    if project_id != DEMO_PROJECT_ID:
        return []
    from app.core.samples import load_sample

    samples = load_sample("chunks")
    values = samples.values() if isinstance(samples, dict) else samples
    return [dict(chunk) for chunk in values if chunk.get("project_id") == project_id]


def _demo_fixture_files() -> list[tuple[str, str, str]]:
    """Filename, ACL and source status for the reproducible Campus Event Portal dataset."""
    chat_enabled = os.getenv("INGEST_ENABLE_CHAT", "false").lower() == "true"
    return [
        ("campus_event_portal.md", "L1", "parsed"),
        ("git_export.json", "L2", "parsed"),
        ("task_board.csv", "L1", "parsed"),
        ("team_chat_export.json", "L1", "parsed" if chat_enabled else "skipped"),
        ("leadership_chat_export.json", "L3", "parsed" if chat_enabled else "skipped"),
    ]


def _demo_fixture_chunks(project_id: str) -> list[dict[str, Any]]:
    """Build deterministic chunks from checked-in synthetic fixtures for the demo project only."""
    from app.core.auth import DEMO_PROJECT_ID
    from app.core.config import get_settings

    if project_id != DEMO_PROJECT_ID:
        return []
    fixture_dir = get_settings().schema_dir.parent.parent / "fixtures" / "sources"
    output: list[dict[str, Any]] = []
    for filename, acl_label, status in _demo_fixture_files():
        if status != "parsed":
            continue
        path = fixture_dir / filename
        if not path.is_file():
            continue
        content = path.read_bytes()
        source_type, records = parse_upload(filename, content, allow_chat=True)
        source_id = f"demo-{Path(filename).stem}"
        for record in records:
            output.extend(chunk_record(record, project_id=project_id, source_id=source_id, source_type=source_type,
                                        source_title=filename, acl_label=acl_label))
    return output


def _demo_fixture_sources(project_id: str) -> list[dict[str, Any]]:
    from app.core.auth import DEMO_PROJECT_ID
    from app.core.config import get_settings

    if project_id != DEMO_PROJECT_ID:
        return []
    fixture_dir = get_settings().schema_dir.parent.parent / "fixtures" / "sources"
    rows = []
    for filename, acl_label, status in _demo_fixture_files():
        if status == "skipped":
            rows.append({"source_id": f"demo-{Path(filename).stem}", "project_id": project_id,
                         "title": filename, "type": "chat", "acl_label": acl_label, "consent": True,
                         "status": "skipped", "chunks": 0, "note": "Chat parser is disabled until Gate 1 passes.", "created_at": None})
            continue
        if not (fixture_dir / filename).is_file():
            continue
        source_type, records = parse_upload(filename, (fixture_dir / filename).read_bytes(), allow_chat=True)
        chunks = sum(len(chunk_record(record, project_id=project_id, source_id=f"demo-{Path(filename).stem}",
                                      source_type=source_type, source_title=filename, acl_label=acl_label)) for record in records)
        rows.append({"source_id": f"demo-{Path(filename).stem}", "project_id": project_id, "title": filename,
                     "type": source_type, "acl_label": acl_label, "consent": True, "status": "parsed",
                     "chunks": chunks, "note": "Seeded synthetic demo fixture.", "created_at": None})
    return rows


def list_sources(session: Session, project_id: str) -> list[dict[str, Any]]:
    rows = session.execute(text("""select s.id as source_id, s.project_id, s.title, s.type, s.acl_label, s.consent,
        s.status, s.chunks, s.note, s.created_at, p.provider, p.external_id, p.external_url as source_url,
        p.source_hash, p.provider_updated_at
        from sources s left join source_provenance p on p.source_id = s.id
        where s.project_id = :project_id order by s.created_at desc, s.id"""), {"project_id": project_id}).mappings()
    persisted = [dict(row) for row in rows]
    # The demo's original handover claims cite these preloaded source IDs. Keep them visible
    # alongside uploads until the project owner imports an equivalent persistent fixture set.
    known_ids = {source["source_id"] for source in persisted}
    samples = [source for source in _demo_sample_sources(project_id) if source["source_id"] not in known_ids]
    fixture_rows = [source for source in _demo_fixture_sources(project_id) if source["source_id"] not in known_ids]
    known_ids.update(source["source_id"] for source in samples)
    fixture_rows = [source for source in fixture_rows if source["source_id"] not in known_ids]
    return samples + fixture_rows + persisted


def get_chunk(session: Session, project_id: str, chunk_id: str) -> dict[str, Any] | None:
    row = session.execute(text("""select c.id as chunk_id, c.project_id, c.source_id, c.source_type, c.source_title, c.author,
        c.event_time, c.acl_label, c.content_hash, c.char_start, c.char_end, c.content,
        p.provider, p.external_id, p.external_url as source_url, p.source_hash, p.provider_updated_at
        from source_chunks c left join source_provenance p on p.source_id = c.source_id
        where c.id = :chunk_id and c.project_id = :project_id"""),
        {"chunk_id": chunk_id, "project_id": project_id}).mappings().first()
    if row is None:
        demo_chunks = _demo_sample_chunks(project_id) + _demo_fixture_chunks(project_id)
        return next((chunk for chunk in demo_chunks if chunk.get("chunk_id") == chunk_id), None)
    chunk = dict(row)
    chunk["char_span"] = [chunk.pop("char_start"), chunk.pop("char_end")]
    chunk["text"] = chunk.pop("content")
    return chunk


def list_chunks(session: Session, project_id: str) -> list[dict[str, Any]]:
    rows = session.execute(text("""select c.id as chunk_id, c.project_id, c.source_id, c.source_type, c.source_title,
        c.author, c.event_time, c.acl_label, c.content_hash, c.char_start, c.char_end, c.content,
        p.provider, p.external_id, p.external_url as source_url, p.source_hash, p.provider_updated_at
        from source_chunks c left join source_provenance p on p.source_id = c.source_id
        where c.project_id = :project_id"""), {"project_id": project_id}).mappings()
    output=[]
    for row in rows:
        chunk = dict(row)
        chunk["char_span"] = [chunk.pop("char_start"), chunk.pop("char_end")]
        chunk["text"] = chunk.pop("content")
        output.append(chunk)
    known_ids = {chunk["chunk_id"] for chunk in output}
    demo_chunks = _demo_sample_chunks(project_id) + _demo_fixture_chunks(project_id)
    output.extend(chunk for chunk in demo_chunks if chunk.get("chunk_id") not in known_ids)
    return output


def _ensure_connection_schema(session: Session) -> None:
    try:
        session.execute(text("alter table source_connections add column auth_status text not null default 'connected'"))
        session.commit()
    except Exception:
        session.rollback()


def list_connections(session: Session, project_id: str) -> list[dict[str, Any]]:
    _ensure_connection_schema(session)
    rows = session.execute(
        text("""
            select id, project_id, provider, target_name, acl_label, status,
                   coalesce(auth_status, 'connected') as auth_status,
                   last_synced_at, checkpoint_cursor, records_added, records_updated,
                   records_skipped, error_message, created_at, updated_at
            from source_connections where project_id = :p order by created_at desc
        """),
        {"p": project_id},
    ).mappings().all()
    return [dict(r) for r in rows]


def get_connection(session: Session, project_id: str, connection_id: str) -> dict[str, Any] | None:
    _ensure_connection_schema(session)
    row = session.execute(
        text("""
            select id, project_id, provider, target_name, acl_label, status,
                   coalesce(auth_status, 'connected') as auth_status,
                   last_synced_at, checkpoint_cursor, records_added, records_updated,
                   records_skipped, error_message, created_at, updated_at
            from source_connections where id = :id and project_id = :p
        """),
        {"id": connection_id, "p": project_id},
    ).mappings().first()
    return dict(row) if row else None


def create_connection(
    session: Session,
    project_id: str,
    provider: str,
    target_name: str,
    acl_label: str,
    auth_status: str = "connected",
) -> dict[str, Any]:
    _ensure_connection_schema(session)
    conn_id = f"conn-{uuid.uuid4().hex[:10]}"
    now = datetime.now(UTC).isoformat()
    session.execute(
        text("""
            insert into source_connections
            (id, project_id, provider, target_name, acl_label, status, auth_status, last_synced_at,
             checkpoint_cursor, records_added, records_updated, records_skipped,
             error_message, created_at, updated_at)
            values (:id, :p, :prov, :target, :acl, :status, :auth_status, null, null, 0, 0, 0, null, :now, :now)
        """),
        {
            "id": conn_id,
            "p": project_id,
            "prov": provider,
            "target": target_name,
            "acl": acl_label,
            "status": "connected" if auth_status == "connected" else auth_status,
            "auth_status": auth_status,
            "now": now,
        },
    )
    session.commit()
    return get_connection(session, project_id, conn_id)  # type: ignore


def delete_connection(session: Session, project_id: str, connection_id: str) -> bool:
    # Keep already-ingested evidence immutable, but remove credentials and records
    session.execute(
        text("delete from connection_credentials where connection_id = :id and project_id = :p"),
        {"id": connection_id, "p": project_id},
    )
    session.execute(
        text("delete from source_sync_records where connection_id = :id and project_id = :p"),
        {"id": connection_id, "p": project_id},
    )
    res = session.execute(
        text("delete from source_connections where id = :id and project_id = :p"),
        {"id": connection_id, "p": project_id},
    )
    session.commit()
    return res.rowcount > 0


def revoke_connection(session: Session, project_id: str, connection_id: str) -> dict[str, Any]:
    """Revoke credentials for a connection and set auth_status to 'revoked'."""
    _ensure_connection_schema(session)
    from app.modules.ingestion import crypto
    crypto.revoke_connection_credentials(session, project_id, connection_id)
    conn = get_connection(session, project_id, connection_id)
    if not conn:
        raise ValueError("Source connection not found.")
    return conn


def reauthorize_connection(
    session: Session,
    project_id: str,
    user_id: str,
    connection_id: str,
    redirect_uri: str | None = None,
) -> dict[str, Any]:
    """Generate a signed OAuth state and authorization URL to reauthorize an existing connection."""
    _ensure_connection_schema(session)
    conn = get_connection(session, project_id, connection_id)
    if not conn:
        raise ValueError("Source connection not found.")

    from app.modules.ingestion import crypto
    provider = conn["provider"]
    target_name = conn["target_name"]
    acl_label = conn["acl_label"]

    state = crypto.generate_oauth_state(
        session,
        project_id=project_id,
        user_id=user_id,
        provider=provider,
        target_name=target_name,
        acl_label=acl_label,
        redirect_uri=redirect_uri,
    )
    if provider == "github":
        auth_url = crypto.build_github_authorize_url(state, redirect_uri or "")
    elif provider == "jira":
        auth_url = crypto.build_jira_authorize_url(state, redirect_uri or "")
    else:
        raise ValueError(f"Unsupported provider: {provider}")

    return {
        "authorization_url": auth_url,
        "state": state,
        "provider": provider,
    }


def complete_oauth_flow(
    session: Session,
    provider: str,
    code: str,
    state_token: str,
    callback_redirect_uri: str | None = None,
) -> dict[str, Any]:
    """Verify signed state, exchange code for tokens, encrypt at rest, and create/update connection."""
    _ensure_connection_schema(session)
    from app.modules.ingestion import crypto

    state_data = crypto.verify_and_consume_oauth_state(session, state_token, expected_provider=provider)
    project_id = state_data["project_id"]
    user_id = state_data.get("user_id")
    if user_id:
        has_pm = session.execute(
            text("select 1 from project_memberships where user_id = :uid limit 1"),
            {"uid": user_id},
        ).scalar() is not None

        if has_pm:
            approver_check = session.execute(
                text("""
                    select 1 from project_memberships
                    where user_id = :uid and project_id = :pid and role = 'approver' and active = 1
                """),
                {"uid": user_id, "pid": project_id},
            ).first()
        else:
            approver_check = session.execute(
                text("""
                    select 1 from members
                    where id = :uid and project_id = :pid and role = 'approver' and active = 1
                """),
                {"uid": user_id, "pid": project_id},
            ).first()
        if not approver_check:
            raise crypto.OAuthStateError("The user who initiated this OAuth connection is no longer an active Approver.")

    target_name = state_data.get("target_name") or f"{provider}-connected"
    acl_label = state_data.get("acl_label") or "L1"

    effective_redirect_uri = callback_redirect_uri or state_data.get("redirect_uri") or ""

    if provider == "github":
        token_data = crypto.exchange_github_code(code, effective_redirect_uri)
    elif provider == "jira":
        token_data = crypto.exchange_jira_code(code, effective_redirect_uri)
    else:
        raise ValueError(f"Unsupported provider: {provider}")

    existing = session.execute(
        text("""
            select id from source_connections
            where project_id = :p and provider = :prov and target_name = :target
        """),
        {"p": project_id, "prov": provider, "target": target_name},
    ).mappings().first()

    now = datetime.now(UTC).isoformat()
    if existing:
        conn_id = existing["id"]
        session.execute(
            text("""
                update source_connections
                set status = 'connected',
                    auth_status = 'connected',
                    error_message = null,
                    updated_at = :now
                where id = :id and project_id = :p
            """),
            {"id": conn_id, "p": project_id, "now": now},
        )
        session.commit()
    else:
        conn_id = f"conn-{uuid.uuid4().hex[:10]}"
        session.execute(
            text("""
                insert into source_connections
                (id, project_id, provider, target_name, acl_label, status, auth_status,
                 last_synced_at, checkpoint_cursor, records_added, records_updated,
                 records_skipped, error_message, created_at, updated_at)
                values (:id, :p, :prov, :target, :acl, 'connected', 'connected',
                        null, null, 0, 0, 0, null, :now, :now)
            """),
            {
                "id": conn_id,
                "p": project_id,
                "prov": provider,
                "target": target_name,
                "acl": acl_label,
                "now": now,
            },
        )
        session.commit()

    crypto.save_connection_credentials(
        session,
        connection_id=conn_id,
        project_id=project_id,
        access_token=token_data["access_token"],
        refresh_token=token_data.get("refresh_token"),
        token_expires_at=token_data.get("token_expires_at"),
        scopes=token_data.get("scopes"),
        external_account=token_data.get("external_account"),
    )

    conn = get_connection(session, project_id, conn_id)
    return {
        "status": "connected",
        "connection_id": conn_id,
        "provider": provider,
        "target_name": target_name,
        "auth_status": "connected",
        "redirect_uri": state_data.get("redirect_uri"),
        "connection": conn,
    }


def _format_provider_display(provider: str) -> str:
    p = provider.strip()
    mapping = {
        "github": "GitHub",
        "jira": "Jira",
        "slack": "Slack",
        "confluence": "Confluence",
        "notion": "Notion",
    }
    return mapping.get(p.lower(), p.title())


def persist_provider_records(
    session: Session,
    *,
    project_id: str,
    connection_id: str,
    provider: str,
    target_name: str,
    source_type: str,
    acl_label: str,
    records: list[ParsedRecord],
) -> tuple[int, int, int]:
    """Persist provider records as immutable versions and deduplicate by provider identity.

    A changed provider item creates a new source/chunk snapshot; the sync index points
    to the latest snapshot. Previous evidence remains available for audit and citations.
    Returns (added, updated, skipped).
    """
    added = updated = skipped = 0
    provider_display = "GitHub" if provider.lower() == "github" else ("Jira" if provider.lower() == "jira" else provider.title())
    source_prefix = f"{provider_display}: {target_name}"

    for record in records:
        safe_text = redact_text(record.text).strip()
        if not safe_text:
            skipped += 1
            continue

        external_id = str(record.external_id or "").strip()
        if not external_id:
            external_id = "content:" + hashlib.sha256(safe_text.encode("utf-8")).hexdigest()
        external_id = external_id[:255]
        event_time = _parse_datetime(record.event_time)
        author = (record.author or "Unknown").strip() or "Unknown"
        fingerprint_payload = json.dumps(
            [safe_text, author, event_time.isoformat(), source_type, acl_label, record.external_url],
            ensure_ascii=False,
            separators=(",", ":"),
        )
        fingerprint = hashlib.sha256(fingerprint_payload.encode("utf-8")).hexdigest()

        current = session.execute(
            text(
                "select source_id, content_fingerprint from source_sync_records "
                "where connection_id = :connection_id and external_id = :external_id"
            ),
            {"connection_id": connection_id, "external_id": external_id},
        ).mappings().first()
        if current and current["content_fingerprint"] == fingerprint:
            skipped += 1
            continue

        source_id = f"src-{uuid.uuid4().hex[:12]}"
        orig_title = (
            getattr(record, "title", None)
            or (safe_text.splitlines()[0].strip() if safe_text else "")
            or external_id
        )
        if orig_title.lower().startswith(source_prefix.lower()):
            source_title = f"{source_prefix}{orig_title[len(source_prefix):]}"
        elif orig_title:
            source_title = f"{source_prefix} - {orig_title}"
        else:
            source_title = source_prefix

        snapshot = ParsedRecord(safe_text, author, event_time, external_id, title=orig_title, external_url=record.external_url)
        chunks = chunk_record(
            snapshot,
            project_id=project_id,
            source_id=source_id,
            source_type=source_type,
            source_title=source_title,
            acl_label=acl_label,
        )
        if not chunks:
            skipped += 1
            continue

        created_at = datetime.now(UTC).isoformat()
        note = "New immutable provider snapshot; an earlier version is retained." if current else None
        session.execute(
            text(
                "insert into sources "
                "(id, project_id, title, type, acl_label, consent, status, chunks, note, created_at) "
                "values (:id, :project_id, :title, :type, :acl_label, 1, 'parsed', :chunks, :note, :created_at)"
            ),
            {
                "id": source_id,
                "project_id": project_id,
                "title": source_title,
                "type": source_type,
                "acl_label": acl_label,
                "chunks": len(chunks),
                "note": note,
                "created_at": created_at,
            },
        )
        source_hash = hashlib.sha256(safe_text.encode("utf-8")).hexdigest()
        session.execute(
            text(
                "insert into source_provenance "
                "(source_id, provider, external_id, external_url, source_hash, provider_updated_at) "
                "values (:source_id, :provider, :external_id, :external_url, :source_hash, :provider_updated_at)"
            ),
            {
                "source_id": source_id,
                "provider": provider,
                "external_id": external_id,
                "external_url": record.external_url,
                "source_hash": source_hash,
                "provider_updated_at": event_time.isoformat(),
            },
        )

        for chunk in chunks:
            session.execute(
                text(
                    "insert into source_chunks "
                    "(id, project_id, source_id, source_type, source_title, author, event_time, acl_label, "
                    "content_hash, char_start, char_end, content) "
                    "values (:id, :project_id, :source_id, :source_type, :source_title, :author, :event_time, "
                    ":acl_label, :content_hash, :char_start, :char_end, :content)"
                ),
                {
                    "id": chunk["chunk_id"],
                    "project_id": project_id,
                    "source_id": source_id,
                    "source_type": source_type,
                    "source_title": source_title,
                    "author": chunk["author"],
                    "event_time": chunk["event_time"],
                    "acl_label": acl_label,
                    "content_hash": chunk["content_hash"],
                    "char_start": chunk["char_span"][0],
                    "char_end": chunk["char_span"][1],
                    "content": chunk["text"],
                },
            )

        if current:
            session.execute(
                text(
                    "update source_sync_records set source_id = :source_id, "
                    "content_fingerprint = :fingerprint "
                    "where connection_id = :connection_id and external_id = :external_id"
                ),
                {
                    "source_id": source_id,
                    "fingerprint": fingerprint,
                    "connection_id": connection_id,
                    "external_id": external_id,
                },
            )
            updated += 1
        else:
            session.execute(
                text(
                    "insert into source_sync_records "
                    "(id, project_id, connection_id, external_id, source_id, content_fingerprint) "
                    "values (:id, :project_id, :connection_id, :external_id, :source_id, :fingerprint)"
                ),
                {
                    "id": uuid.uuid4().hex,
                    "project_id": project_id,
                    "connection_id": connection_id,
                    "external_id": external_id,
                    "source_id": source_id,
                    "fingerprint": fingerprint,
                },
            )
            added += 1

    return added, updated, skipped


def sync_connection(session: Session, project_id: str, connection_id: str) -> dict[str, Any]:
    _ensure_connection_schema(session)
    conn = get_connection(session, project_id, connection_id)
    if not conn:
        raise ValueError("Source connection not found.")

    if conn.get("auth_status") == "revoked":
        err_msg = "This connection has been revoked. Reauthorize the connection to resume syncing."
        now = datetime.now(UTC).isoformat()
        session.execute(
            text("""
                update source_connections
                set status = 'failed',
                    error_message = :err,
                    updated_at = :now
                where id = :id
            """),
            {"id": connection_id, "err": err_msg, "now": now},
        )
        session.commit()
        return get_connection(session, project_id, connection_id)  # type: ignore

    from app.modules.ingestion import crypto
    from app.modules.ingestion.connectors import GitHubConnector, JiraConnector

    provider = conn["provider"]
    target = conn["target_name"]
    cursor = conn.get("checkpoint_cursor")
    acl_label = conn["acl_label"]

    # Retrieve per-connection decrypted credentials if available
    token = None
    cloud_id = None
    creds = crypto.get_connection_credentials(session, connection_id)
    if creds:
        # Check token expiration and attempt refresh if within 5 minutes of expiry
        expires_at_str = creds.get("token_expires_at")
        if expires_at_str and creds.get("refresh_token"):
            try:
                expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=UTC)
                if datetime.now(UTC) >= expires_at - timedelta(minutes=5):
                    refreshed = crypto.refresh_connection_token(session, project_id, connection_id)
                    if refreshed:
                        creds = crypto.get_connection_credentials(session, connection_id)
            except Exception as e:
                log.warning("Token auto-refresh check failed: %s", e)

        if creds:
            token = creds.get("access_token")
            cloud_id = creds.get("external_account")

    now = datetime.now(UTC).isoformat()
    session.execute(
        text("update source_connections set status = 'syncing', updated_at = :now where id = :id and project_id = :p"),
        {"id": connection_id, "p": project_id, "now": now},
    )
    session.commit()

    try:
        if provider == "github":
            connector = GitHubConnector(target, token=token)
            source_type = "git"
        elif provider == "jira":
            is_oauth = bool(token and (cloud_id or not os.environ.get("JIRA_USER_EMAIL")))
            connector = JiraConnector(target, token=token, is_oauth=is_oauth, cloud_id=cloud_id)
            source_type = "task_csv"
        else:
            raise ValueError(f"Unsupported provider: {provider}")

        records, new_cursor = connector.fetch_records(checkpoint_cursor=cursor)
        added, updated, skipped = persist_provider_records(
            session,
            project_id=project_id,
            connection_id=connection_id,
            provider=provider,
            target_name=target,
            source_type=source_type,
            acl_label=acl_label,
            records=records,
        )

        session.execute(
            text("""
                update source_connections
                set status = 'succeeded',
                    auth_status = 'connected',
                    last_synced_at = :now,
                    checkpoint_cursor = :cursor,
                    records_added = records_added + :added,
                    records_updated = records_updated + :updated,
                    records_skipped = records_skipped + :skipped,
                    error_message = null,
                    updated_at = :now
                where id = :id
            """),
            {
                "id": connection_id,
                "now": now,
                "cursor": new_cursor,
                "added": added,
                "updated": updated,
                "skipped": skipped,
            },
        )
        session.commit()
    except Exception as exc:
        session.rollback()
        err_msg = str(exc) or "Provider sync failed."
        for secret_name in (
            "GITHUB_SYNC_TOKEN",
            "GITHUB_TOKEN",
            "JIRA_API_TOKEN",
            "GITHUB_CLIENT_SECRET",
            "JIRA_CLIENT_SECRET",
        ):
            secret = os.environ.get(secret_name)
            if secret:
                err_msg = err_msg.replace(secret, "[REDACTED]")
        if token:
            err_msg = err_msg.replace(token, "[REDACTED]")
        err_msg = err_msg[:300]

        err_lower = err_msg.lower()
        if any(w in err_lower for w in ("authentication", "permission", "rejected", "401", "403", "unauthorized", "token")):
            new_auth = "needs_attention"
        else:
            new_auth = conn.get("auth_status") or "connected"

        session.execute(
            text("""
                update source_connections
                set status = 'failed',
                    auth_status = :auth_status,
                    error_message = :err,
                    updated_at = :now
                where id = :id
            """),
            {"id": connection_id, "auth_status": new_auth, "err": err_msg, "now": datetime.now(UTC).isoformat()},
        )
        session.commit()

    return get_connection(session, project_id, connection_id)  # type: ignore
