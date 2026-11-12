"""Deterministic, explainable risk radar, timeline and blocked-task analysis."""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import UTC, date, datetime
from typing import Any


def _parse_task(chunk: dict[str, Any]) -> dict[str, Any] | None:
    """Extract task fields from a normalised task-CSV evidence chunk."""
    raw = str(chunk.get("text", ""))
    fields: dict[str, str] = {}
    pieces = raw.split("|")

    for piece in pieces:
        piece = piece.strip()
        if ":" not in piece:
            continue
        key, value = piece.split(":", 1)
        fields[key.strip().lower()] = value.strip()

    task_match = re.search(r"\bTask\s+([A-Za-z0-9_-]+)", raw, re.IGNORECASE)
    task_id = task_match.group(1) if task_match else (fields.get("id") or fields.get("task_id"))
    title = fields.get("title") or fields.get("task") or fields.get("name")

    # Support the original handover sample format: "Task T-52 | Publish portal | Owner: ...".
    if not title and task_match and len(pieces) > 1:
        title = pieces[1].strip()
    if not title and task_match:
        title = raw.split("|", 1)[0].strip()
    if not task_id or not title:
        return None

    blocked_value = fields.get("blocked by")
    if blocked_value is None:
        blocked_match = re.search(r"\bblocked[_ ]by\s*:\s*([^|]+)", raw, re.IGNORECASE)
        blocked_value = blocked_match.group(1).strip() if blocked_match else ""

    blockers = sorted(set(re.findall(r"[A-Za-z][A-Za-z0-9_-]*", blocked_value)))
    return {
        "id": task_id,
        "title": title,
        "owner": fields.get("owner"),
        "status": fields.get("status", "unknown").lower(),
        "due": fields.get("due"),
        "blocked_by": blockers,
        "chunk": chunk,
    }


def _author_activity(chunk: dict[str, Any]) -> tuple[str, str] | None:
    """Return (module, author) for Git records only; non-Git prose must not affect bus-factor signals."""
    if chunk.get("source_type") != "git":
        return None
    module = _module_from_chunk(chunk)
    author = str(chunk.get("author") or "").strip()
    if not module or not author or author.lower() in {"unknown", "none", "null", "unassigned"}:
        return None
    return module, author


def _module_from_chunk(chunk: dict[str, Any]) -> str | None:
    """Find the explicit module label, with conservative fallbacks for older sample evidence."""
    content = str(chunk.get("text", ""))
    match = re.search(r"\b(?:module|directory|component)\s*[:|]\s*([A-Za-z0-9_./-]+)", content, re.IGNORECASE)
    if match:
        return match.group(1).strip("./")

    lower = content.lower()
    if "payments" in lower:
        return "payments"
    if "kiosk" in lower or "check-in" in lower:
        return "check-in-kiosk"
    return None


def _metadata_list(content: str, field: str) -> list[str]:
    """Read a JSON-array field from the normalised Git export text."""
    match = re.search(rf"\b{re.escape(field)}\s*[:=]\s*(\[[^\]]*\])", content, re.IGNORECASE)
    if not match:
        return []
    try:
        values = json.loads(match.group(1))
    except json.JSONDecodeError:
        return []
    if not isinstance(values, list):
        return []
    return sorted({str(value).strip() for value in values if str(value).strip()})


def _import_targets(chunk: dict[str, Any]) -> set[str]:
    """Read explicit module import/dependency targets from a Git export chunk."""
    content = str(chunk.get("text", ""))
    targets = set(_metadata_list(content, "imports"))
    for pattern in (
        r"\bdepends on\s*[:=]\s*([A-Za-z0-9_./-]+)",
        r"\brequires\s*[:=]\s*([A-Za-z0-9_./-]+)",
    ):
        targets.update(value.strip("./") for value in re.findall(pattern, content, re.IGNORECASE))
    return {target.strip("./") for target in targets if target.strip("./")}


def _reviewers(content: str) -> list[str]:
    """Read reviewer names from structured Git export metadata."""
    return _metadata_list(content, "reviewers") or _metadata_list(content, "reviewed_by")


def _has_open_pull_request(content: str) -> bool:
    """Treat open/draft PR metadata as work in flight even when its commit message is terse."""
    match = re.search(r"\bpull_request\s*[:=]\s*(\{[^}]*\})", content, re.IGNORECASE)
    if not match:
        return False
    try:
        value = json.loads(match.group(1))
    except json.JSONDecodeError:
        return False
    return isinstance(value, dict) and str(value.get("state", "")).lower() in {"open", "draft", "pending"}


def build_graph_edges(chunks: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Build typed, evidence-linked relationships from Git and task exports.

    The shape matches `db/schema/30_risk.sql`; callers can persist it when a source
    chunk is database-backed, while demo fixtures can use the same graph in memory.
    """
    edges: list[dict[str, str]] = []

    def add_edge(chunk_id: str, from_type: str, from_id: str, relation: str, to_type: str, to_id: str) -> None:
        if not chunk_id or not from_id or not to_id:
            return
        edges.append(
            {
                "source_chunk_id": chunk_id,
                "from_type": from_type,
                "from_id": from_id,
                "relation": relation,
                "to_type": to_type,
                "to_id": to_id,
            }
        )

    for chunk in chunks:
        chunk_id = str(chunk.get("chunk_id", ""))
        module = _module_from_chunk(chunk)
        if chunk.get("source_type") == "git" and module:
            author = str(chunk.get("author") or "Unknown").strip()
            if author and author.lower() != "unknown":
                add_edge(chunk_id, "person", author, "authored", "module", module)
            for reviewer in _reviewers(str(chunk.get("text", ""))):
                add_edge(chunk_id, "person", reviewer, "reviewed", "module", module)
            for target in sorted(_import_targets(chunk)):
                if target.lower() != module.lower():
                    add_edge(chunk_id, "module", module, "imports", "module", target)

        if chunk.get("source_type") == "task_csv":
            task = _parse_task(chunk)
            if not task:
                continue
            owner = str(task.get("owner") or "").strip()
            if owner and owner.lower() not in {"unknown", "unassigned", "none", "null"}:
                add_edge(chunk_id, "person", owner, "owns", "task", task["id"])
            for blocker in task["blocked_by"]:
                add_edge(chunk_id, "task", blocker, "blocks", "task", task["id"])

    return edges


def build_risk_radar(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Calculate explainable departure-risk signals and attach the evidence that produced them."""
    activity: dict[str, Counter[str]] = defaultdict(Counter)
    total_by_module: Counter[str] = Counter()
    author_evidence: dict[tuple[str, str], list[str]] = defaultdict(list)
    undocumented: dict[str, list[str]] = defaultdict(list)
    account_ties: dict[str, list[str]] = defaultdict(list)
    in_flight: dict[str, list[str]] = defaultdict(list)
    review_activity: dict[str, Counter[str]] = defaultdict(Counter)
    review_evidence: dict[tuple[str, str], list[str]] = defaultdict(list)
    dependent_modules: dict[str, set[str]] = defaultdict(set)
    dependent_evidence: dict[str, list[str]] = defaultdict(list)

    for chunk in chunks:
        chunk_id = str(chunk.get("chunk_id", ""))
        content = str(chunk.get("text", ""))
        lower = content.lower()
        module = _module_from_chunk(chunk)

        author_pair = _author_activity(chunk)
        if author_pair:
            author_module, author = author_pair
            activity[author_module][author] += 1
            total_by_module[author_module] += 1
            author_evidence[(author_module, author)].append(chunk_id)

        if not module:
            continue

        has_decision = any(word in lower for word in ("decision", "decided", "adopted", "chosen"))
        has_rationale = any(word in lower for word in ("because", "reason", "rationale"))
        if has_decision and not has_rationale:
            undocumented[module].append(chunk_id)

        if any(word in lower for word in ("personal account", "domain owner", "account is under", "billing account")):
            account_ties[module].append(chunk_id)

        has_open_work = any(word in lower for word in ("in progress", "open pr", "work in flight", "not merged"))
        if has_open_work or _has_open_pull_request(content):
            in_flight[module].append(chunk_id)

    for edge in build_graph_edges(chunks):
        if edge["relation"] == "reviewed":
            module = edge["to_id"]
            reviewer = edge["from_id"]
            review_activity[module][reviewer] += 1
            review_evidence[(module, reviewer)].append(edge["source_chunk_id"])
        elif edge["relation"] == "imports":
            dependent = edge["from_id"]
            dependency = edge["to_id"]
            dependent_modules[dependency.lower()].add(dependent)
            dependent_evidence[dependency.lower()].append(edge["source_chunk_id"])

    modules = (
        set(total_by_module)
        | set(undocumented)
        | set(account_ties)
        | set(in_flight)
        | set(review_activity)
        | set(dependent_modules)
    )
    rows: list[dict[str, Any]] = []

    for module in sorted(modules):
        author_counts = activity[module]
        total_authored = total_by_module[module]
        if not author_counts or total_authored == 0:
            continue

        max_activity = max(author_counts.values())
        top_people = sorted(name for name, count in author_counts.items() if count == max_activity)
        person = ", ".join(top_people)
        exclusivity = max_activity / total_authored

        reviewers = review_activity[module]
        total_reviews = sum(reviewers.values())
        top_reviewers = sorted(
            name for name, count in reviewers.items() if count == max(reviewers.values(), default=0)
        )
        top_review_count = max(reviewers.values(), default=0)

        reasons: list[str] = []
        if exclusivity >= 0.7:
            reasons.append(f"{person} authored {max_activity}/{total_authored} observed Git records ({exclusivity:.0%})")

        module_dependents = dependent_modules.get(module.lower(), set())
        if module_dependents:
            reasons.append(f"{len(module_dependents)} distinct module(s) depend on this module")
        if undocumented[module]:
            reasons.append(f"{len(set(undocumented[module]))} decision record(s) have no visible rationale")
        if account_ties[module]:
            reasons.append(f"{len(set(account_ties[module]))} account-ownership signal(s) found")
        if in_flight[module]:
            reasons.append(f"{len(set(in_flight[module]))} in-flight work signal(s) found")
        if total_reviews and top_reviewers and top_review_count / total_reviews >= 0.7:
            reviewer_names = ", ".join(top_reviewers)
            reasons.append(
                f"PR review activity is concentrated with {reviewer_names} "
                f"({top_review_count}/{total_reviews} observed reviews)"
            )

        relevant_evidence = [
            chunk_id
            for top_person in top_people
            for chunk_id in author_evidence[(module, top_person)]
        ]
        relevant_evidence.extend(
            chunk_id
            for reviewer in top_reviewers
            for chunk_id in review_evidence[(module, reviewer)]
        )
        relevant_evidence.extend(dependent_evidence.get(module.lower(), []))
        relevant_evidence.extend(undocumented[module])
        relevant_evidence.extend(account_ties[module])
        relevant_evidence.extend(in_flight[module])

        flagged = exclusivity >= 0.7 or bool(account_ties[module]) or bool(undocumented[module])
        rows.append(
            {
                "module": module,
                "person": person,
                "exclusivity": round(exclusivity, 2),
                "dependents": len(module_dependents),
                "undocumented_decisions": len(set(undocumented[module])),
                "account_ties": len(set(account_ties[module])),
                "work_in_flight": len(set(in_flight[module])),
                "flagged": flagged,
                "reasons": reasons,
                "evidence_chunk_ids": sorted(set(relevant_evidence)),
            }
        )

    return sorted(rows, key=lambda row: (not row["flagged"], -row["exclusivity"], row["module"]))


def build_timeline(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return only events with an actual source event-time, sorted chronologically."""
    events = []
    for chunk in chunks:
        event_time = chunk.get("event_time")
        if not event_time or str(event_time).startswith("1970-01-01"):
            continue
        events.append(
            {
                "event_time": event_time,
                "text": str(chunk.get("text", ""))[:240],
                "chunk_id": chunk["chunk_id"],
                "source_title": chunk.get("source_title", "Source"),
                "acl_label": chunk.get("acl_label", "L4"),
            }
        )
    return sorted(events, key=lambda event: (event["event_time"], event["chunk_id"]))


def build_delivery_status(chunks: list[dict[str, Any]], *, today: date | None = None) -> list[dict[str, Any]]:
    """Find active overdue/blocked tasks and preserve the downstream blocked-by chain."""
    tasks = [
        task
        for chunk in chunks
        if chunk.get("source_type") == "task_csv"
        for task in [_parse_task(chunk)]
        if task
    ]
    downstream: dict[str, list[str]] = defaultdict(list)
    for edge in build_graph_edges(chunks):
        if edge["relation"] == "blocks":
            downstream[edge["from_id"]].append(edge["to_id"])

    as_of = today or datetime.now(UTC).date()
    results = []
    for task in tasks:
        due_value = task["due"]
        try:
            due_date = date.fromisoformat(due_value) if due_value else None
        except ValueError:
            due_date = None

        is_complete = task["status"] in {"done", "closed", "complete", "completed"}
        blocked = bool(task["blocked_by"]) and not is_complete
        overdue = bool(due_date and due_date < as_of and not is_complete)
        if not blocked and not overdue:
            continue

        chunk = task["chunk"]
        results.append(
            {
                "task": task["id"],
                "title": task["title"],
                "due": due_value,
                "status": "blocked" if blocked else "overdue",
                "blocked_by": task["blocked_by"],
                "holds_up": sorted(set(downstream.get(task["id"], []))),
                "chunk_id": chunk["chunk_id"],
                "quote": chunk["text"],
                "label": "At risk (Inferred)",
            }
        )

    return sorted(results, key=lambda item: (item["due"] or "9999-99-99", item["task"]))
