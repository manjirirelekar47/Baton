"""Verification service (F4, F5).

Deterministic quote verification, fuzzy matching, conflict detection,
state labelling, Gap generation, entity alias resolution, and claim re-verification.
"""
from __future__ import annotations

import json
import re
import uuid
from typing import Any

from rapidfuzz import fuzz
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import acl
from app.core.audit import now_iso
from app.core.auth import DEMO_PROJECT_ID
from app.core.samples import load_sample
from app.modules.ingestion import public as ingestion_public

# Default fuzzy matching threshold (implementation decision, configurable)
DEFAULT_FUZZY_THRESHOLD = 85.0

# Secret patterns to prevent credential leakage
SECRET_PATTERNS = (
    re.compile(r"(?i)\b(api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*(?:\"[^\"]*\"|\'[^\']*\'|[^\s,;]+)"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
)


def normalize_text(val: str) -> str:
    """Normalize whitespace and lowercase for quote matching."""
    if not val:
        return ""
    # Replace newlines, tabs, multiple spaces with a single space
    s = re.sub(r"\s+", " ", val).strip().lower()
    # Normalize punctuation marks (curly quotes, dashes)
    s = s.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    s = s.replace("—", "-").replace("–", "-")
    return s


def verify_quote(quote: str, chunk_text: str, fuzzy_threshold: float = DEFAULT_FUZZY_THRESHOLD) -> tuple[bool, float, str]:
    """Deterministically check if a quote exists in the chunk text.

    Returns (matched, confidence_score, match_type).
    Match types: 'exact', 'normalized', 'fuzzy', 'not_found'.
    """
    if not quote or not chunk_text:
        return False, 0.0, "not_found"

    # 1. Exact verbatim match
    if quote in chunk_text:
        return True, 100.0, "exact"

    norm_quote = normalize_text(quote)
    norm_chunk = normalize_text(chunk_text)

    # 2. Whitespace-normalized match
    if norm_quote in norm_chunk:
        return True, 100.0, "normalized"

    # 3. RapidFuzz partial ratio (fuzzy matching for OCR / minor formatting deviations)
    score = fuzz.partial_ratio(norm_quote, norm_chunk)
    if score >= fuzzy_threshold:
        return True, float(score), "fuzzy"

    # Token set ratio for cases where word ordering or punctuation differed slightly
    set_score = fuzz.token_set_ratio(norm_quote, norm_chunk)
    if set_score >= fuzzy_threshold:
        return True, float(set_score), "fuzzy"

    return False, float(score), "not_found"


def sanitize_text(val: str) -> str:
    """Ensure secrets do not leak through claims or evidence statements."""
    sanitized = val
    for pattern in SECRET_PATTERNS:
        sanitized = pattern.sub("[REDACTED_SECRET]", sanitized)
    return sanitized


def get_aliases_map(session: Session, project_id: str) -> dict[str, str]:
    """Load canonical aliases map for a project."""
    rows = session.execute(
        text("select canonical, alias from aliases where project_id = :p"),
        {"p": project_id},
    ).mappings()
    mapping = {}
    for r in rows:
        mapping[r["alias"].strip().lower()] = r["canonical"].strip()
    return mapping


def resolve_canonical_entity(entity_key: str, alias_map: dict[str, str]) -> str:
    """Resolve an entity key to its canonical representation using the alias map."""
    cleaned = entity_key.strip().lower()
    return alias_map.get(cleaned, entity_key.strip())


def detect_conflicts(claims: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Detect conflicting claims on (entity_key, attribute).

    If two or more claims refer to the same entity_key and attribute but assert
    different values or statements, both are marked as conflicting.
    """
    # Group claims by (canonical entity_key, attribute)
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for claim in claims:
        key = (claim.get("entity_key", "").strip().lower(), claim.get("attribute", "").strip().lower())
        grouped.setdefault(key, []).append(claim)

    for (_ent, _attr), group in grouped.items():
        if len(group) < 2:
            continue

        # Check if values or statements differ significantly
        has_discrepancy = False
        owners = {c.get("owner") for c in group if c.get("owner")}
        due_dates = {c.get("due_date") for c in group if c.get("due_date")}
        statements = {normalize_text(c.get("statement", "")) for c in group}

        if len(owners) > 1 or len(statements) > 1 or len(due_dates) > 1:
            has_discrepancy = True

        if has_discrepancy:
            all_ids = [c["claim_id"] for c in group if c.get("claim_id")]
            for c in group:
                c["state"] = "conflicting"
                current_conflicts = set(c.get("conflict_with", []))
                for other_id in all_ids:
                    if other_id != c.get("claim_id"):
                        current_conflicts.add(other_id)
                c["conflict_with"] = sorted(list(current_conflicts))

    return claims


def verify_single_claim(
    claim: dict[str, Any],
    chunk_lookup: dict[str, dict[str, Any]],
    alias_map: dict[str, str],
    fuzzy_threshold: float = DEFAULT_FUZZY_THRESHOLD,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Verify evidence quotes for a single claim and generate Gaps for unverified quotes.

    Returns (updated_claim, generated_gaps).
    """
    updated = dict(claim)
    updated["statement"] = sanitize_text(updated.get("statement", ""))
    entity_key = updated.get("entity_key", "")
    updated["entity_key"] = resolve_canonical_entity(entity_key, alias_map)

    generated_gaps: list[dict[str, Any]] = []
    claim_id = updated.get("claim_id") or f"c-{uuid.uuid4().hex[:6]}"
    updated["claim_id"] = claim_id

    evidence_list = updated.get("evidence", [])
    all_quotes_verified = True
    any_quote_verified = False

    verified_evidence = []
    for ev in evidence_list:
        chunk_id = ev.get("chunk_id")
        quote = sanitize_text(ev.get("quote", ""))
        chunk = chunk_lookup.get(chunk_id)

        if not chunk:
            all_quotes_verified = False
            # Quote cites a non-existent chunk -> fabricated / orphaned citation
            gap_id = f"g-{uuid.uuid4().hex[:6]}"
            generated_gaps.append({
                "gap_id": gap_id,
                "question": f"Verify unconfirmed claim: {updated['statement']}",
                "reason": f"Evidence cites missing or unknown chunk '{chunk_id}'",
                "asked_to": updated.get("owner") or updated.get("proposed_owner_id"),
                "claim_id": claim_id,
            })
            continue

        chunk_text = chunk.get("text", "")
        matched, score, match_type = verify_quote(quote, chunk_text, fuzzy_threshold)

        if matched:
            any_quote_verified = True
            ev_copy = dict(ev)
            ev_copy["quote"] = quote
            ev_copy["source_id"] = ev.get("source_id") or chunk.get("source_id")
            ev_copy["source_title"] = ev.get("source_title") or chunk.get("source_title")
            ev_copy["acl_label"] = ev.get("acl_label") or chunk.get("acl_label", "L1")
            ev_copy["event_time"] = ev.get("event_time") or chunk.get("event_time")
            verified_evidence.append(ev_copy)
        else:
            all_quotes_verified = False
            # Quote not found in source chunk -> Fabricated quote becomes a Gap!
            gap_id = f"g-{uuid.uuid4().hex[:6]}"
            generated_gaps.append({
                "gap_id": gap_id,
                "question": f"Verify unconfirmed statement: {updated['statement']}",
                "reason": f"Quote '{quote}' was not found in source chunk '{chunk_id}'",
                "asked_to": updated.get("owner") or updated.get("proposed_owner_id"),
                "claim_id": claim_id,
            })

    updated["evidence"] = verified_evidence

    # If the claim is already attested by a person, retain attested state
    if updated.get("attested_by"):
        updated["state"] = "attested"
    elif updated.get("type") == "open_question" or not evidence_list:
        # No evidence or open question becomes missing / gap
        updated["state"] = "missing"
        if not any(g["claim_id"] == claim_id for g in generated_gaps):
            gap_id = f"g-{uuid.uuid4().hex[:6]}"
            generated_gaps.append({
                "gap_id": gap_id,
                "question": updated["statement"],
                "reason": "No verifying evidence exists in ingested sources",
                "asked_to": updated.get("owner") or updated.get("proposed_owner_id"),
                "claim_id": claim_id,
            })
    elif all_quotes_verified and evidence_list:
        updated["state"] = "verified"
    elif any_quote_verified:
        updated["state"] = "inferred"
    else:
        updated["state"] = "missing"

    # Effective ACL label calculation
    declared_label = updated.get("acl_label") or "L1"
    evidence_labels = [e.get("acl_label", "L1") for e in updated.get("evidence", [])]
    computed_label = acl.strictest([declared_label] + evidence_labels)
    # Claims stored in DB cannot be L4 (L4 secrets are never accepted or stored)
    updated["acl_label"] = "L3" if computed_label == "L4" else computed_label

    claim_acl = updated.get("acl_label") or "L1"
    for g in generated_gaps:
        g.setdefault("acl_label", claim_acl)

    return updated, generated_gaps


def verify_all_claims(
    session: Session,
    project_id: str,
    raw_claims: list[dict[str, Any]],
    fuzzy_threshold: float = DEFAULT_FUZZY_THRESHOLD,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Verify an entire collection of claims for a project."""
    alias_map = get_aliases_map(session, project_id)
    # Load all chunks for verification (using approver role to verify all tiers server-side)
    chunks = ingestion_public.list_chunks(project_id, "approver", session)
    chunk_lookup = {c["chunk_id"]: c for c in chunks}

    verified_claims = []
    all_gaps = []

    for rc in raw_claims:
        v_claim, gaps = verify_single_claim(rc, chunk_lookup, alias_map, fuzzy_threshold)
        verified_claims.append(v_claim)
        all_gaps.extend(gaps)

    # Detect conflicts across the set
    verified_claims = detect_conflicts(verified_claims)

    return verified_claims, all_gaps


def persist_claims_and_gaps(
    session: Session,
    project_id: str,
    claims: list[dict[str, Any]],
    gaps: list[dict[str, Any]],
) -> None:
    """Store verified claims, evidence, and gaps idempotently in the database."""
    now = now_iso()
    for c in claims:
        cid = c["claim_id"]
        # Delete existing evidence for this claim before reinserting
        session.execute(text("delete from evidence where claim_id = :cid"), {"cid": cid})
        session.execute(
            text("""
                insert into claims (id, project_id, type, entity_key, attribute, statement,
                    state, acl_label, owner, proposed_owner, proposed_owner_id, due_date,
                    blocked_by_json, attested_by, conflict_with_json, created_at, updated_at)
                values (:id, :project_id, :type, :entity_key, :attribute, :statement,
                    :state, :acl_label, :owner, :proposed_owner, :proposed_owner_id, :due_date,
                    :blocked_by_json, :attested_by, :conflict_with_json, :created_at, :updated_at)
                on conflict(id) do update set
                    type = excluded.type,
                    entity_key = excluded.entity_key,
                    attribute = excluded.attribute,
                    statement = excluded.statement,
                    state = excluded.state,
                    acl_label = excluded.acl_label,
                    owner = excluded.owner,
                    proposed_owner = excluded.proposed_owner,
                    proposed_owner_id = excluded.proposed_owner_id,
                    due_date = excluded.due_date,
                    blocked_by_json = excluded.blocked_by_json,
                    attested_by = excluded.attested_by,
                    conflict_with_json = excluded.conflict_with_json,
                    updated_at = excluded.updated_at
            """),
            {
                "id": cid,
                "project_id": project_id,
                "type": c.get("type", "decision"),
                "entity_key": c.get("entity_key", ""),
                "attribute": c.get("attribute", ""),
                "statement": c.get("statement", ""),
                "state": c.get("state", "inferred"),
                "acl_label": c.get("acl_label", "L1"),
                "owner": c.get("owner"),
                "proposed_owner": c.get("proposed_owner"),
                "proposed_owner_id": c.get("proposed_owner_id"),
                "due_date": c.get("due_date"),
                "blocked_by_json": json.dumps(c.get("blocked_by", [])),
                "attested_by": c.get("attested_by"),
                "conflict_with_json": json.dumps(c.get("conflict_with", [])),
                "created_at": c.get("created_at") or now,
                "updated_at": now,
            },
        )
        for ev in c.get("evidence", []):
            eid = ev.get("id") or f"ev-{uuid.uuid4().hex[:8]}"
            session.execute(
                text("""
                    insert into evidence (id, claim_id, chunk_id, quote, source_id, source_title, acl_label, event_time, created_at)
                    values (:id, :claim_id, :chunk_id, :quote, :source_id, :source_title, :acl_label, :event_time, :created_at)
                """),
                {
                    "id": eid,
                    "claim_id": cid,
                    "chunk_id": ev.get("chunk_id", ""),
                    "quote": ev.get("quote", ""),
                    "source_id": ev.get("source_id"),
                    "source_title": ev.get("source_title"),
                    "acl_label": ev.get("acl_label", "L1"),
                    "event_time": ev.get("event_time"),
                    "created_at": now,
                },
            )

    for g in gaps:
        gid = g["gap_id"]
        session.execute(
            text("""
                insert into gaps (id, project_id, question, reason, asked_to, claim_id, acl_label, created_at)
                values (:id, :project_id, :question, :reason, :asked_to, :claim_id, :acl_label, :created_at)
                on conflict(id) do update set
                    question = excluded.question,
                    reason = excluded.reason,
                    asked_to = excluded.asked_to,
                    claim_id = excluded.claim_id,
                    acl_label = excluded.acl_label
            """),
            {
                "id": gid,
                "project_id": project_id,
                "question": g.get("question", ""),
                "reason": g.get("reason", ""),
                "asked_to": g.get("asked_to"),
                "claim_id": g.get("claim_id"),
                "acl_label": g.get("acl_label", "L1"),
                "created_at": now,
            },
        )
    session.commit()


def list_claims(session: Session, project_id: str) -> list[dict[str, Any]]:
    """Retrieve all claims with their evidence for a project from the database."""
    rows = session.execute(
        text("""
            select id, project_id, type, entity_key, attribute, statement, state, acl_label,
                   owner, proposed_owner, proposed_owner_id, due_date, blocked_by_json,
                   attested_by, conflict_with_json, created_at, updated_at
            from claims where project_id = :p order by id
        """),
        {"p": project_id},
    ).mappings().all()

    if not rows:
        if project_id == DEMO_PROJECT_ID:
            # Fall back to sample claims if database has not been seeded / reconstructed yet
            return load_sample("claims")
        return []

    ev_rows = session.execute(
        text("""
            select id, claim_id, chunk_id, quote, source_id, source_title, acl_label, event_time
            from evidence where claim_id in (select id from claims where project_id = :p)
        """),
        {"p": project_id},
    ).mappings().all()

    ev_by_claim: dict[str, list[dict[str, Any]]] = {}
    for r in ev_rows:
        ev_by_claim.setdefault(r["claim_id"], []).append({
            "chunk_id": r["chunk_id"],
            "quote": r["quote"],
            "source_id": r["source_id"],
            "source_title": r["source_title"],
            "acl_label": r["acl_label"],
            "event_time": r["event_time"],
        })

    result = []
    for r in rows:
        cid = r["id"]
        c_dict = {
            "claim_id": cid,
            "type": r["type"],
            "entity_key": r["entity_key"],
            "attribute": r["attribute"],
            "statement": r["statement"],
            "state": r["state"],
            "acl_label": r["acl_label"],
            "owner": r["owner"],
            "proposed_owner": r["proposed_owner"],
            "proposed_owner_id": r["proposed_owner_id"],
            "due_date": r["due_date"],
            "blocked_by": json.loads(r["blocked_by_json"] or "[]"),
            "attested_by": r["attested_by"],
            "conflict_with": json.loads(r["conflict_with_json"] or "[]"),
            "evidence": ev_by_claim.get(cid, []),
        }
        result.append(c_dict)
    return result


def get_claim(session: Session, project_id: str, claim_id: str) -> dict[str, Any] | None:
    """Retrieve a single claim by claim_id."""
    claims = list_claims(session, project_id)
    return next((c for c in claims if c["claim_id"] == claim_id), None)


def list_gaps(session: Session, project_id: str) -> list[dict[str, Any]]:
    """Retrieve all gaps for a project."""
    rows = session.execute(
        text("select id, question, reason, asked_to, claim_id, acl_label from gaps where project_id = :p order by id"),
        {"p": project_id},
    ).mappings().all()

    if not rows:
        if project_id == DEMO_PROJECT_ID:
            return load_sample("gaps")
        return []

    return [
        {
            "gap_id": r["id"],
            "question": r["question"],
            "reason": r["reason"],
            "asked_to": r["asked_to"],
            "claim_id": r["claim_id"],
            "acl_label": r.get("acl_label", "L1"),
        }
        for r in rows
    ]


def reverify(session: Session, project_id: str, claim_data: dict[str, Any]) -> dict[str, Any]:
    """Re-verify an edited or updated claim deterministically and save it."""
    alias_map = get_aliases_map(session, project_id)
    chunks = ingestion_public.list_chunks(project_id, "approver", session)
    chunk_lookup = {c["chunk_id"]: c for c in chunks}

    v_claim, gaps = verify_single_claim(claim_data, chunk_lookup, alias_map)
    persist_claims_and_gaps(session, project_id, [v_claim], gaps)
    return v_claim
