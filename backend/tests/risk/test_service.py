from datetime import date

from app.modules.risk.service import build_delivery_status, build_risk_radar, build_timeline


def chunk(chunk_id, text, *, source_type="git", author="Aarav", event="2026-10-01T00:00:00+00:00", acl="L1"):
    return {"chunk_id": chunk_id, "text": text, "source_type": source_type, "author": author,
            "event_time": event, "source_title": "fixture", "acl_label": acl}


def test_risk_radar_flags_single_owner_and_exposes_inputs():
    data = [
        chunk("g1", "module: payments | commit: add webhook"),
        chunk("g2", "module: payments | commit: retry handler"),
        chunk("g3", "module: payments | commit: settlement fix"),
        chunk("g4", "module: payments | decision: adopt queue"),
        chunk("g5", "module: payments | account is under personal account"),
    ]
    result = build_risk_radar(data)
    assert len(result) == 1
    assert result[0]["module"] == "payments"
    assert result[0]["exclusivity"] == 1.0
    assert result[0]["flagged"] is True
    assert result[0]["undocumented_decisions"] == 1
    assert result[0]["account_ties"] == 1
    assert result[0]["evidence_chunk_ids"]
    assert result[0]["reasons"]


def test_timeline_is_sorted_by_event_time_and_keeps_source_traceability():
    result = build_timeline([
        chunk("later", "release hold", event="2026-10-10T00:00:00+00:00"),
        chunk("earlier", "staging deploy", event="2026-09-01T00:00:00+00:00", source_type="document"),
    ])
    assert [event["chunk_id"] for event in result] == ["earlier", "later"]
    assert result[0]["source_title"] == "fixture"


def test_delivery_status_preserves_blocked_by_chain_and_downstream_tasks():
    data = [
        chunk("t1", "Task T-49 | title: Write retry test | owner: unassigned | status: open", source_type="task_csv"),
        chunk("t2", "Task T-52 | title: Publish portal | owner: Meera | status: open | due: 2026-11-20 | blocked_by: T-49", source_type="task_csv"),
        chunk("t3", "Task T-58 | title: Announce launch | status: open | blocked_by: T-52", source_type="task_csv"),
    ]
    result = build_delivery_status(data, today=date(2026, 11, 12))
    t52 = next(item for item in result if item["task"] == "T-52")
    assert t52["status"] == "blocked"
    assert t52["blocked_by"] == ["T-49"]
    assert t52["holds_up"] == ["T-58"]
    assert t52["chunk_id"] == "t2"




def test_risk_radar_counts_git_activity_only():
    data = [
        chunk("g1", "module: payments | change one", source_type="git", author="Aarav"),
        chunk("g2", "module: payments | change two", source_type="git", author="Aarav"),
        chunk("d1", "module: payments | project notes", source_type="document", author="Meera"),
    ]
    result = build_risk_radar(data)
    assert result[0]["person"] == "Aarav"
    assert result[0]["exclusivity"] == 1.0


def test_risk_radar_counts_unique_dependent_modules_from_git_imports():
    data = [
        chunk("p1", 'module: payments | imports: ["queue"]', author="Aarav"),
        chunk("q1", 'module: queue | imports: ["payments"]', author="Meera"),
        chunk("q2", 'module: queue | imports: ["payments"]', author="Meera"),
    ]
    result = build_risk_radar(data)
    payments = next(row for row in result if row["module"] == "payments")
    assert payments["dependents"] == 1
    assert "1 distinct module(s) depend on this module" in payments["reasons"]



def test_risk_public_uses_acl_filtered_ingestion_contract_before_calculation(monkeypatch):
    from app.modules.ingestion import public as ingestion_public
    from app.modules.risk import public as risk_public

    chunks = [
        chunk("public", "module: payments | commit: retry worker", author="Aarav", acl="L1"),
        chunk("maintainers", "module: payments | commit: migration", author="Meera", acl="L2"),
    ]
    calls = []

    def visible_chunks(project_id, role, session):
        calls.append((project_id, role, session))
        from app.core import acl
        return [item for item in chunks if acl.can_read(role, item["acl_label"])]

    monkeypatch.setattr(ingestion_public, "list_chunks", visible_chunks)
    visible = risk_public.risk_radar("p1", object(), "incoming_contributor")
    approver = risk_public.risk_radar("p1", object(), "approver")

    assert visible[0]["evidence_chunk_ids"] == ["public"]
    assert approver[0]["evidence_chunk_ids"] == ["maintainers", "public"]
    assert [call[1] for call in calls] == ["incoming_contributor", "approver"]


def test_risk_radar_uses_reviewer_and_pull_request_metadata():
    data = [
        chunk("pr1", 'module: payments | reviewers: ["Meera"] | pull_request: {"number": 1, "state": "open"}'),
        chunk("pr2", 'module: payments | reviewers: ["Meera"] | pull_request: {"number": 2, "state": "merged"}'),
        chunk("pr3", 'module: payments | reviewers: ["Meera"] | pull_request: {"number": 3, "state": "open"}'),
    ]
    row = build_risk_radar(data)[0]
    assert row["work_in_flight"] == 2
    assert "PR review activity is concentrated with Meera (3/3 observed reviews)" in row["reasons"]
    assert {"pr1", "pr2", "pr3"}.issubset(set(row["evidence_chunk_ids"]))


def test_graph_edges_cover_authorship_reviews_imports_ownership_and_blockers():
    from app.modules.risk.service import build_graph_edges

    data = [
        chunk(
            "git-1",
            'module: payments | imports: ["queue"] | reviewers: ["Meera"]',
            author="Aarav",
        ),
        chunk(
            "task-1",
            "id: T-52 | task: Publish portal | owner: Meera | status: open | blocked_by: T-49",
            source_type="task_csv",
        ),
    ]
    relations = {(edge["relation"], edge["from_id"], edge["to_id"]) for edge in build_graph_edges(data)}
    assert ("authored", "Aarav", "payments") in relations
    assert ("reviewed", "Meera", "payments") in relations
    assert ("imports", "payments", "queue") in relations
    assert ("owns", "Meera", "T-52") in relations
    assert ("blocks", "T-49", "T-52") in relations
