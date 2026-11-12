"""Pure view and plan builders (no database, no FastAPI), so they are easy to unit test.

Input is ALWAYS claims that already went through core.acl.filter_for_role.
Output is built from an explicit whitelist of fields rendered through fixed templates:
no free-text summariser, and nothing the viewer may not see can reach the response."""
from app.core import acl

VIEW_ROLES = {"approver", "incoming_maintainer", "incoming_contributor"}
ACK_ROLES = {"incoming_maintainer", "incoming_contributor"}

SECTIONS = [
    ("ownership", "Ownership"),
    ("blockers", "Blockers"),
    ("next_actions", "Next actions"),
    ("decisions", "Decisions"),
    ("risks", "Risks"),
    ("dependencies", "Dependencies"),
    ("recurring_problems", "Recurring problems"),
    ("open_questions", "Open questions"),
    ("contacts", "Contacts"),
    ("timeline", "Timeline"),
]
SECTION_TITLES = dict(SECTIONS)
SECTION_FOR_TYPE = {
    "owner": "ownership",
    "blocker": "blockers",
    "next_action": "next_actions",
    "decision": "decisions",
    "risk": "risks",
    "dependency": "dependencies",
    "recurring_problem": "recurring_problems",
    "open_question": "open_questions",
    "contact": "contacts",
    "timeline_event": "timeline",
}
PLAN_KIND = {"blocker": "unblock", "owner": "confirm_owner", "next_action": "next_action"}
_KIND_RANK = {"unblock": 0, "confirm_owner": 1, "next_action": 2}
BUCKETS = ("day_1", "week_1", "month_1")

RECEIPT_NOTE = "A receipt confirms you received this section. It does not confirm understanding or completed work."
PLAN_NOTE = "Dates come from the sources. Baton does not predict completion dates."


def project_evidence(evidence: dict) -> dict:
    return {
        "chunk_id": evidence.get("chunk_id"),
        "quote": evidence.get("quote"),
        "source_id": evidence.get("source_id"),
        "source_title": evidence.get("source_title"),
        "event_time": evidence.get("event_time"),
    }


def project_claim(claim: dict, viewer_id: str, visible_ids: set[str]) -> dict:
    proposed_id = claim.get("proposed_owner_id")
    return {
        "claim_id": claim.get("claim_id"),
        "type": claim.get("type"),
        "section": SECTION_FOR_TYPE.get(claim.get("type")),
        "statement": claim.get("statement"),
        "state": claim.get("state"),
        "access_label": acl.effective_label(claim),
        "owner": claim.get("owner"),
        "proposed_owner": claim.get("proposed_owner"),
        "proposed_for_me": proposed_id is not None and proposed_id == viewer_id,
        "due_date": claim.get("due_date"),
        "blocked_by": [b for b in claim.get("blocked_by", []) if b in visible_ids],
        "attested_by": claim.get("attested_by"),
        "evidence": [project_evidence(e) for e in claim.get("evidence", [])],
    }


def available_sections(visible_claims: list[dict]) -> set[str]:
    return {SECTION_FOR_TYPE[c["type"]] for c in visible_claims if c.get("type") in SECTION_FOR_TYPE}


def build_view(version: dict, role: str, viewer_id: str, filtered: acl.FilterResult,
               acked: dict[str, str], responses: dict[str, str]) -> dict:
    visible_ids = {c["claim_id"] for c in filtered.visible}
    by_section: dict[str, list[dict]] = {}
    for claim in filtered.visible:
        if claim.get("type") not in SECTION_FOR_TYPE:
            continue  # unknown claim types are never rendered
        projected = project_claim(claim, viewer_id, visible_ids)
        by_section.setdefault(projected["section"], []).append(projected)
    sections = [
        {"key": key, "title": title, "claims": by_section[key], "acknowledged_at": acked.get(key)}
        for key, title in SECTIONS
        if key in by_section
    ]
    return {
        "version": {k: version.get(k) for k in ("version_id", "status", "approved_by", "approved_at", "snapshot_hash")},
        "role": role,
        "sections": sections,
        "hidden": {"count": filtered.hidden_count},  # count only: no title, quote, type or source
        "ownership_responses": responses,
        "can_acknowledge": role in ACK_ROLES,
        "receipt_note": RECEIPT_NOTE,
    }


def build_plan(visible_claims: list[dict], viewer_id: str) -> dict[str, list[dict]]:
    """Day-1 / Week-1 / Month-1 in blocked-by order.

    level 0 (nothing blocks it) -> Day 1; level 1 -> Week 1; level 2 or more -> Month 1.
    Items in a circular blocked-by chain (or downstream of one) land in Day 1 flagged cycle=True:
    someone has to decide which goes first. Owners are never guessed: an unknown owner stays None."""
    items = {c["claim_id"]: c for c in visible_claims if c.get("type") in PLAN_KIND}
    deps = {cid: [b for b in c.get("blocked_by", []) if b in items and b != cid] for cid, c in items.items()}
    level: dict[str, int] = {}
    remaining = set(items)
    while remaining:
        ready = [cid for cid in remaining if all(b in level for b in deps[cid])]
        if not ready:
            break
        for cid in ready:
            level[cid] = 1 + max((level[b] for b in deps[cid]), default=-1)
        remaining -= set(ready)

    visible_ids = set(items)
    rows = []
    for cid, claim in items.items():
        in_cycle = cid in remaining
        lvl = 0 if in_cycle else level[cid]
        kind = PLAN_KIND[claim["type"]]
        projected = project_claim(claim, viewer_id, visible_ids)
        rows.append({
            "claim_id": cid,
            "kind": kind,
            "title": claim.get("statement"),
            "state": claim.get("state"),
            "owner": claim.get("owner"),
            "owner_known": claim.get("owner") is not None,
            "proposed_owner": claim.get("proposed_owner"),
            "proposed_for_me": projected["proposed_for_me"],
            "due_date": claim.get("due_date"),
            "blocked_by": deps[cid],
            "cycle": in_cycle,
            "level": lvl,
            "evidence": projected["evidence"],
        })
    rows.sort(key=lambda r: (r["level"], not r["cycle"], _KIND_RANK[r["kind"]], r["due_date"] or "9999-99-99", r["claim_id"]))

    plan: dict[str, list[dict]] = {b: [] for b in BUCKETS}
    for row in rows:
        bucket = BUCKETS[min(row["level"], 2)]
        row["position"] = len(plan[bucket]) + 1
        plan[bucket].append(row)
    return plan
