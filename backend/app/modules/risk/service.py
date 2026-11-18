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


def _timeline_pr_metadata(content: str) -> dict[str, Any]:
    """Extract compact PR/issue metadata from Git export text without exposing raw JSON."""
    for field in ("pull_request", "pr", "issue"):
        match = re.search(rf"\b{field}\s*[:=]\s*(\{{[^}}]*\}})", content, re.IGNORECASE)
        if not match:
            continue
        try:
            value = json.loads(match.group(1))
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            return {"kind": "issue" if field == "issue" else "pull_request", **value}
    return {}


def _timeline_event_details(chunk: dict[str, Any]) -> dict[str, Any]:
    """Turn imported provider records into readable titles, modules and activity badges."""
    content = str(chunk.get("text", "")).strip()
    source_type = str(chunk.get("source_type") or "activity")
    author = str(chunk.get("author") or "Unknown").strip() or "Unknown"
    module = _module_from_chunk(chunk)

    payload: dict[str, Any] = {}
    if content.startswith("{"):
        try:
            parsed = json.loads(content)
            if isinstance(parsed, dict):
                payload = parsed
        except json.JSONDecodeError:
            pass

    metadata = _timeline_pr_metadata(content)
    nested_pr = payload.get("pull_request") or payload.get("pr")
    nested_issue = payload.get("issue")
    if isinstance(nested_pr, dict):
        metadata = {"kind": "pull_request", **nested_pr}
    elif isinstance(nested_issue, dict):
        metadata = {"kind": "issue", **nested_issue}

    module = (
        str(payload.get("module") or payload.get("directory") or payload.get("component") or "").strip()
        or module
    )
    module = module or "Unassigned module"

    number = metadata.get("number") or payload.get("number")
    state = str(metadata.get("state") or payload.get("state") or "").strip().lower()
    if metadata.get("merged_at") or payload.get("merged_at"):
        state = "merged"

    kind = str(metadata.get("kind") or "").lower()
    title = str(payload.get("message") or payload.get("title") or "").strip()

    pr_match = re.search(r"GitHub pull request #([0-9]+):\s*([^\n]+)", content, re.IGNORECASE)
    issue_match = re.search(r"GitHub issue #([0-9]+):\s*([^\n]+)", content, re.IGNORECASE)
    commit_match = re.search(r"GitHub commit [^\n:]+:\s*([^\n]+)", content, re.IGNORECASE)

    if pr_match:
        kind = "pull_request"
        number = number or pr_match.group(1)
        title = title or pr_match.group(2).strip()
        state_match = re.search(r"\bState:\s*([A-Za-z_-]+)", content, re.IGNORECASE)
        state = state or (state_match.group(1).lower() if state_match else "")
    elif issue_match:
        kind = "issue"
        number = number or issue_match.group(1)
        title = title or issue_match.group(2).strip()
        state_match = re.search(r"\bState:\s*([A-Za-z_-]+)", content, re.IGNORECASE)
        state = state or (state_match.group(1).lower() if state_match else "")
    elif commit_match:
        kind = kind or "commit"
        title = title or commit_match.group(1).strip()

    if not title and source_type == "git":
        parts = [part.strip() for part in content.split("|")]
        if len(parts) > 1 and re.match(r"commit\s+[A-Fa-f0-9]+", parts[0]):
            title = parts[1]
        elif parts:
            title = parts[0]
    if not title and payload:
        title = str(payload.get("summary") or payload.get("name") or "").strip()
    if not title:
        title = content.splitlines()[0].strip() if content else ""
    title = re.sub(r"\s+", " ", title).strip(" \t|")[:180]
    if not title or title.startswith("{") or title.startswith("["):
        title = str(chunk.get("source_title") or "Project activity")

    if not kind:
        if source_type == "git":
            kind = "commit"
        elif source_type == "task_csv":
            kind = "task"
        else:
            kind = "activity"

    status_label = None
    if number is not None and kind == "pull_request":
        if state == "merged":
            status_label = f"Merged PR #{number}"
        elif state in {"open", "draft", "pending"}:
            status_label = f"{'Draft' if state == 'draft' else 'Open'} PR #{number}"
        elif state == "closed":
            status_label = f"Closed PR #{number}"
        else:
            status_label = f"PR #{number}"
    elif number is not None and kind == "issue":
        if state in {"open", "closed"}:
            status_label = f"{state.title()} issue #{number}"
        else:
            status_label = f"Issue #{number}"

    return {
        "event_type": kind,
        "display_title": title,
        "module": module,
        "author": author,
        "status_label": status_label,
        "source_url": payload.get("html_url") or payload.get("url") or chunk.get("source_url"),
    }


def build_timeline(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return readable, ACL-filtered activity events with stable source traceability."""
    events = []
    for chunk in chunks:
        event_time = chunk.get("event_time")
        if not event_time or str(event_time).startswith("1970-01-01"):
            continue
        details = _timeline_event_details(chunk)
        events.append(
            {
                "event_time": event_time,
                # Keep the legacy field, but never send raw JSON/provider payloads to the UI.
                "text": details["display_title"],
                **details,
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


def build_knowledge_graph(
    chunks: list[dict[str, Any]],
    claims: list[dict[str, Any]] | None = None,
    sources: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Assemble a typed, evidence-backed knowledge graph for visualization.

    Connects People, Modules, Tasks, Claims, and Sources using clear relations:
    OWNS, AUTHORED, REVIEWED, IMPORTS, BLOCKS, and SUPPORTED BY.
    """
    nodes: dict[str, dict[str, Any]] = {}
    edge_map: dict[tuple[str, str, str], dict[str, Any]] = {}

    def add_node(nid: str, label: str, ntype: str, metadata: dict[str, Any] | None = None) -> None:
        if nid not in nodes:
            nodes[nid] = {"id": nid, "label": label, "type": ntype, "metadata": metadata or {}}

    def add_edge(
        src: str,
        tgt: str,
        rel: str,
        chunk_id: str | None = None,
        source_id: str | None = None,
        quote: str | None = None,
        source_title: str | None = None,
    ) -> None:
        if not src or not tgt:
            return
        key = (src, tgt, rel)
        if key not in edge_map:
            edge_map[key] = {
                "id": f"e_{src}_{rel}_{tgt}".replace(":", "_").replace("-", "_"),
                "source": src,
                "target": tgt,
                "relation": rel,
                "count": 0,
                "evidence": [],
            }
        edge_map[key]["count"] += 1
        if chunk_id or quote:
            edge_map[key]["evidence"].append({
                "chunk_id": chunk_id,
                "quote": quote,
                "source_id": source_id,
                "source_title": source_title,
            })

    # Sources
    for s in (sources or []):
        sid = str(s.get("source_id") or s.get("id") or "")
        if sid:
            add_node(f"source:{sid}", s.get("title") or sid, "source", {"source_type": s.get("type")})

    # Chunks (git and tasks)
    for c in chunks:
        cid = str(c.get("chunk_id", ""))
        text = str(c.get("text", ""))
        stype = c.get("source_type")
        stitle = str(c.get("source_title") or "Repository")
        if stype == "git":
            mod = _module_from_chunk(c)
            author = str(c.get("author") or "").strip()
            if mod:
                add_node(f"module:{mod}", mod.capitalize(), "module")
            if author and author.lower() != "unknown":
                add_node(f"person:{author}", author, "person")
                if mod:
                    add_edge(f"person:{author}", f"module:{mod}", "AUTHORED", chunk_id=cid, quote=text[:140], source_title=stitle)
            for rev in _reviewers(text):
                if rev and rev.lower() != "unknown":
                    add_node(f"person:{rev}", rev, "person")
                    if mod:
                        add_edge(f"person:{rev}", f"module:{mod}", "REVIEWED", chunk_id=cid, quote=text[:140], source_title=stitle)
            if mod:
                for target in sorted(_import_targets(c)):
                    if target.lower() != mod.lower():
                        add_node(f"module:{target.lower()}", target.capitalize(), "module")
                        add_edge(f"module:{mod}", f"module:{target.lower()}", "IMPORTS", chunk_id=cid, quote=text[:140], source_title=stitle)

        elif stype == "task_csv":
            task = _parse_task(c)
            if task:
                tid = task["id"]
                title = task.get("title", tid)
                owner = task.get("owner")
                add_node(f"task:{tid}", f"{tid}: {title}", "task", {"status": task.get("status")})
                if owner and owner.lower() not in {"unassigned", "unknown", "none"}:
                    add_node(f"person:{owner}", owner, "person")
                    add_edge(f"person:{owner}", f"task:{tid}", "OWNS", chunk_id=cid, quote=text[:140], source_title=stitle)
                for blk in task.get("blocked_by", []):
                    if blk:
                        add_node(f"task:{blk}", blk, "task")
                        add_edge(f"task:{blk}", f"task:{tid}", "BLOCKS", chunk_id=cid, quote=text[:140], source_title=stitle)

    # Claims
    for clm in (claims or []):
        cid = str(clm.get("claim_id") or clm.get("id") or "")
        if not cid:
            continue
        ent = str(clm.get("entity_key") or "").replace("module:", "").strip()
        attr = str(clm.get("attribute") or "").strip()
        stmt = str(clm.get("statement") or f"{ent} {attr}").strip()
        owner = str(clm.get("owner") or "").strip()
        add_node(f"claim:{cid}", f"{ent}: {attr}" if (ent and attr) else stmt, "claim", {
            "state": clm.get("state"),
            "confidence": clm.get("confidence_grade"),
            "statement": stmt,
            "entity_key": ent,
            "attribute": attr,
        })
        if ent:
            add_node(f"module:{ent.lower()}", ent.capitalize(), "module")
            add_edge(f"claim:{cid}", f"module:{ent.lower()}", "IMPORTS" if attr == "dependency" else "OWNS", quote=stmt)
        if owner and owner.lower() not in {"unassigned", "unknown", "none"}:
            add_node(f"person:{owner}", owner, "person")
            if ent and attr == "owner":
                add_edge(f"person:{owner}", f"module:{ent.lower()}", "OWNS", quote=stmt)
        for ev in clm.get("evidence", []):
            sid = str(ev.get("source_id") or "")
            ev_cid = str(ev.get("chunk_id") or "")
            quote = str(ev.get("quote") or "")
            stitle = str(ev.get("source_title") or sid)
            target_source_id = sid or ev_cid
            if target_source_id:
                add_node(f"source:{target_source_id}", stitle, "source")
                add_edge(f"claim:{cid}", f"source:{target_source_id}", "SUPPORTED BY", chunk_id=ev_cid, quote=quote, source_id=sid, source_title=stitle)

    valid_edges = [
        e for e in edge_map.values()
        if e["source"] in nodes and e["target"] in nodes
    ]

    for e in valid_edges:
        if e["evidence"]:
            e["evidence_chunk_id"] = e["evidence"][0].get("chunk_id")
            e["evidence_quote"] = e["evidence"][0].get("quote")
            e["source_title"] = e["evidence"][0].get("source_title")
            e["source_id"] = e["evidence"][0].get("source_id")

    node_list = list(nodes.values())
    people_count = sum(1 for n in node_list if n["type"] == "person")

    return {
        "nodes": node_list,
        "edges": valid_edges,
        "summary": {
            "total_nodes": len(node_list),
            "connections": len(valid_edges),
            "people": people_count,
        },
    }

