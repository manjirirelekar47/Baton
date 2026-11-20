"""Detect changed versions of re-imported sources using redacted chunk hashes."""
import hashlib
import re
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.acl import can_read
from app.modules.ingestion import public as ingestion

_LABEL_ORDER = {"L1": 1, "L2": 2, "L3": 3}


def _source_key(source: dict[str, Any]) -> str:
    normalized_title = re.sub(r"\s+", " ", str(source.get("title") or "").strip()).casefold()
    return hashlib.sha256(f"{source.get('type', '')}\0{normalized_title}".encode()).hexdigest()


def _current_versions(project_id: str, role: str, session: Session) -> dict[str, dict[str, Any]]:
    sources = ingestion.list_sources(project_id, role, session)
    chunks = ingestion.list_chunks(project_id, role, session)
    chunks_by_source: dict[str, list[dict[str, Any]]] = {}
    for chunk in chunks:
        chunks_by_source.setdefault(chunk.get("source_id", ""), []).append(chunk)
    grouped: dict[str, list[dict[str, Any]]] = {}
    for source in sources:
        grouped.setdefault(_source_key(source), []).append(source)
    current: dict[str, dict[str, Any]] = {}
    for key, versions in grouped.items():
        latest = max(versions, key=lambda item: str(item.get("created_at") or ""))
        source_chunks = sorted(
            chunks_by_source.get(latest.get("source_id", ""), []),
            key=lambda item: (item.get("event_time") or "", item.get("char_start", 0), item.get("chunk_id", "")),
        )
        content_hash = hashlib.sha256("\n".join(str(item.get("content_hash") or "") for item in source_chunks).encode()).hexdigest()
        current[key] = {
            "source_id": latest.get("source_id", ""),
            "title": latest.get("title", ""),
            "source_type": latest.get("type", "document"),
            "acl_label": latest.get("acl_label", "L3"),
            "content_hash": content_hash,
            "chunk_count": len(source_chunks),
        }
    return current


def scan(project_id: str, role: str, session: Session) -> dict[str, int]:
    """Record first-seen baselines; emit one persistent alert each time a source changes."""
    current = _current_versions(project_id, role, session)
    now = datetime.now(UTC).isoformat()
    changed = 0
    baselined = 0
    for key, source in current.items():
        previous = session.execute(
            text("select content_hash, source_id, acl_label, chunk_count from drift_snapshots where project_id=:p and source_key=:k"),
            {"p": project_id, "k": key},
        ).mappings().first()
        if previous is None:
            session.execute(text("""insert into drift_snapshots
                (project_id, source_key, source_id, title, source_type, acl_label, content_hash, chunk_count, observed_at)
                values (:p, :k, :sid, :title, :type, :acl, :hash, :count, :now)"""),
                {"p": project_id, "k": key, "sid": source["source_id"], "title": source["title"], "type": source["source_type"], "acl": source["acl_label"], "hash": source["content_hash"], "count": source["chunk_count"], "now": now})
            baselined += 1
            continue
        if previous["content_hash"] == source["content_hash"]:
            session.execute(text("update drift_snapshots set source_id=:sid, title=:title, observed_at=:now where project_id=:p and source_key=:k"),
                {"sid": source["source_id"], "title": source["title"], "now": now, "p": project_id, "k": key})
            continue
        acl_label = max((previous["acl_label"], source["acl_label"]), key=lambda label: _LABEL_ORDER.get(label, 99))
        if not can_read(role, acl_label):
            continue
        session.execute(text("""insert into drift_alerts
            (id, project_id, source_key, title, source_type, acl_label, previous_source_id, current_source_id,
             previous_hash, current_hash, previous_chunks, current_chunks, status, detected_at)
            values (:id, :p, :k, :title, :type, :acl, :previous_id, :current_id, :previous_hash, :current_hash,
                    :previous_chunks, :current_chunks, 'open', :now)"""),
            {"id": f"drift-{uuid.uuid4().hex[:12]}", "p": project_id, "k": key, "title": source["title"], "type": source["source_type"],
             "acl": acl_label, "previous_id": previous["source_id"], "current_id": source["source_id"],
             "previous_hash": previous["content_hash"], "current_hash": source["content_hash"],
             "previous_chunks": previous["chunk_count"], "current_chunks": source["chunk_count"], "now": now})
        session.execute(text("""update drift_snapshots set source_id=:sid, title=:title, source_type=:type, acl_label=:acl,
            content_hash=:hash, chunk_count=:count, observed_at=:now where project_id=:p and source_key=:k"""),
            {"sid": source["source_id"], "title": source["title"], "type": source["source_type"], "acl": source["acl_label"],
             "hash": source["content_hash"], "count": source["chunk_count"], "now": now, "p": project_id, "k": key})
        changed += 1
    session.commit()
    return {"baselined": baselined, "changed": changed}


def list_alerts(project_id: str, role: str, session: Session, *, include_resolved: bool = False) -> list[dict[str, Any]]:
    status_clause = "" if include_resolved else "and status='open'"
    rows = session.execute(text(f"""select id, title, source_type, acl_label, previous_chunks, current_chunks, status, detected_at
        from drift_alerts where project_id=:p {status_clause} order by detected_at desc"""), {"p": project_id}).mappings()
    return [
        {"alert_id": row["id"], "title": row["title"], "source_type": row["source_type"], "acl_label": row["acl_label"],
         "previous_chunks": row["previous_chunks"], "current_chunks": row["current_chunks"], "status": row["status"], "detected_at": row["detected_at"]}
        for row in rows if can_read(role, row["acl_label"])
    ]


def resolve_alert(alert_id: str, project_id: str, session: Session) -> bool:
    result = session.execute(text("update drift_alerts set status='resolved' where id=:id and project_id=:p and status='open'"), {"id": alert_id, "p": project_id})
    session.commit()
    return result.rowcount == 1
