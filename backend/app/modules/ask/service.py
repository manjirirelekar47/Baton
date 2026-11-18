"""Answer questions by retrieving evidence from the latest approved handover snapshot."""
import re
from typing import Any

from rapidfuzz import fuzz
from sqlalchemy.orm import Session

from app.core.acl import filter_for_role
from app.modules.review import public as review

MIN_MATCH_SCORE = 35
_WORD = re.compile(r"[a-z0-9]+", re.IGNORECASE)
_STOP_WORDS = {"a", "an", "and", "are", "be", "by", "do", "for", "from", "how", "i", "in", "is", "it", "me", "of", "on", "or", "our", "the", "to", "was", "what", "when", "where", "which", "who", "why", "with"}


def _score(question: str, claim: dict[str, Any]) -> int:
    query = " ".join(w.lower() for w in _WORD.findall(question) if w.lower() not in _STOP_WORDS)
    searchable = " ".join(str(claim.get(key) or "") for key in ("statement", "entity_key", "attribute", "owner", "type", "due_date"))
    return int(fuzz.token_set_ratio(query, searchable)) if query else 0


def answer_question(question: str, *, project_id: str, role: str, session: Session) -> dict[str, Any]:
    question = question.strip()
    version = review.latest_version(project_id, session=session)
    if not version or version.get("status") != "approved":
        return {"answer": "There is no approved handover snapshot to answer from yet. Approve a verified handover first.", "matches": [], "approved_version": None}

    shared_roles = version.get("shared_roles", version.get("shared_with", [])) or []
    if role != "approver" and role not in shared_roles:
        return {"answer": "No approved handover has been shared with your role yet.", "matches": [], "approved_version": None}

    claims = version.get("claims") or []
    visible = filter_for_role(role, claims).visible
    candidates = [claim for claim in visible if claim.get("state") == "verified"]
    ranked = sorted((( _score(question, claim), claim) for claim in candidates), key=lambda item: (-item[0], item[1].get("claim_id", "")))
    matches = []
    for score, claim in ranked:
        if score < MIN_MATCH_SCORE or len(matches) == 5:
            break
        evidence = [
            {"source_title": item.get("source_title"), "chunk_id": item.get("chunk_id"), "quote": item.get("quote")}
            for item in claim.get("evidence", [])
            if item.get("chunk_id") and item.get("quote")
        ]
        matches.append({
            "claim_id": str(claim.get("claim_id") or ""),
            "statement": str(claim.get("statement") or ""),
            "owner": claim.get("owner"),
            "due_date": claim.get("due_date"),
            "score": score,
            "evidence": evidence,
        })

    if not matches:
        answer = "I couldn't find a relevant verified claim in the approved handover snapshot. Try a project name, owner, or risk keyword."
    else:
        answer = "Based on the approved handover snapshot, these verified claims are the closest matches. Check the attached source quotes before acting."
    return {"answer": answer, "matches": matches, "approved_version": str(version.get("version_id") or version.get("id") or "approved")}
