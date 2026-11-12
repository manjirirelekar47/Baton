"""Source parsing, redaction, immutable chunking and persistence."""
from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
CHUNK_CHARS = 1200
CHUNK_OVERLAP = 120


def can_manage_sources(role: str) -> bool:
    """Source connection is a project-owner action; the approver is the seeded owner role."""
    return role == "approver"

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
    source_id = f"src-{uuid.uuid4().hex[:12]}"
    created_at = datetime.now(UTC).isoformat()
    chunks: list[dict[str, Any]] = []
    for record in records:
        chunks.extend(chunk_record(record, project_id=project_id, source_id=source_id, source_type=source_type, source_title=filename, acl_label=acl_label))
    if not chunks:
        raise ValueError("No readable text was found in this file. Check the export and try again.")
    # The source-level ACL is stored on the source and copied to every chunk; IDs remain immutable.
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
    rows = session.execute(text("""select id as source_id, project_id, title, type, acl_label, consent, status, chunks, note, created_at
        from sources where project_id = :project_id order by created_at desc, id"""), {"project_id": project_id}).mappings()
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
    row = session.execute(text("""select id as chunk_id, project_id, source_id, source_type, source_title, author, event_time,
        acl_label, content_hash, char_start, char_end, content from source_chunks
        where id = :chunk_id and project_id = :project_id"""), {"chunk_id": chunk_id, "project_id": project_id}).mappings().first()
    if row is None:
        demo_chunks = _demo_sample_chunks(project_id) + _demo_fixture_chunks(project_id)
        return next((chunk for chunk in demo_chunks if chunk.get("chunk_id") == chunk_id), None)
    chunk = dict(row)
    chunk["char_span"] = [chunk.pop("char_start"), chunk.pop("char_end")]
    chunk["text"] = chunk.pop("content")
    return chunk


def list_chunks(session: Session, project_id: str) -> list[dict[str, Any]]:
    rows = session.execute(text("""select id as chunk_id, project_id, source_id, source_type, source_title, author, event_time,
        acl_label, content_hash, char_start, char_end, content from source_chunks where project_id = :project_id"""), {"project_id": project_id}).mappings()
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
