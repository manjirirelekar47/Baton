#!/usr/bin/env python3
"""Evaluation script for Citation Validity, Recall, Conflict Detection, and Leakage (Round 2).

Evaluates:
1. Primary Demo Dataset (Campus Event Portal)
2. Separate Unseen Test Pack (Autonomous Rover Navigation System)
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Add backend to sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.modules.verification.service import (
    verify_quote,
    detect_conflicts,
    normalize_text,
    SECRET_PATTERNS,
    verify_single_claim,
)


def evaluate_dataset(claims: list[dict], chunk_lookup: dict, expected_metrics: dict) -> dict:
    total_citations = 0
    valid_citations = 0
    exact_citations = 0
    fuzzy_citations = 0
    unverified_citations = 0

    generated_gaps = []
    # Verify quotes and detect ungrounded/fabricated citations
    verified_claims = []
    for c in claims:
        v_claim, gaps = verify_single_claim(c, chunk_lookup, alias_map={})
        verified_claims.append(v_claim)
        generated_gaps.extend(gaps)

        for ev in c.get("evidence", []):
            total_citations += 1
            chunk_id = ev.get("chunk_id")
            quote = ev.get("quote", "")

            chunk = chunk_lookup.get(chunk_id)
            if not chunk:
                unverified_citations += 1
                continue

            chunk_text = chunk.get("text", "")
            matched, score, m_type = verify_quote(quote, chunk_text)
            if matched:
                valid_citations += 1
                if m_type in ("exact", "normalized"):
                    exact_citations += 1
                else:
                    fuzzy_citations += 1
            else:
                unverified_citations += 1

    citation_validity_rate = (valid_citations / total_citations * 100.0) if total_citations else 0.0

    # Conflict detection
    conflicted_claims = detect_conflicts([dict(c) for c in verified_claims])
    conflicts_flagged = [c for c in conflicted_claims if c.get("state") == "conflicting"]

    expected_conflicts = expected_metrics.get("conflicting_pairs", expected_metrics.get("planted_conflicts", []))
    conflicts_detected = 0
    for pc in expected_conflicts:
        matching = [
            c for c in conflicts_flagged
            if c.get("entity_key") == pc["entity_key"] and c.get("attribute") == pc["attribute"]
        ]
        if len(matching) >= 2:
            conflicts_detected += 1

    conflict_recall = (conflicts_detected / len(expected_conflicts) * 100.0) if expected_conflicts else 100.0

    expected_count = expected_metrics.get("expected_claims_count", expected_metrics.get("total_claims", len(claims)))
    claim_recall_rate = min(100.0, (len(claims) / expected_count * 100.0)) if expected_count else 0.0

    # Secret / PII leakage check
    leak_count = 0
    for claim in claims:
        stmt = claim.get("statement", "")
        for pattern in SECRET_PATTERNS:
            if pattern.search(stmt):
                leak_count += 1
        for ev in claim.get("evidence", []):
            q = ev.get("quote", "")
            for pattern in SECRET_PATTERNS:
                if pattern.search(q):
                    leak_count += 1

    return {
        "total_claims": len(claims),
        "expected_claims": expected_count,
        "claim_recall_rate": round(claim_recall_rate, 2),
        "total_citations": total_citations,
        "valid_citations": valid_citations,
        "exact_citations": exact_citations,
        "fuzzy_citations": fuzzy_citations,
        "unverified_citations": unverified_citations,
        "citation_validity_rate": round(citation_validity_rate, 2),
        "planted_conflicts_total": len(expected_conflicts),
        "planted_conflicts_detected": conflicts_detected,
        "conflict_recall_rate": round(conflict_recall, 2),
        "generated_gaps_count": len(generated_gaps),
        "secret_leak_count": leak_count,
    }


def run_evaluation() -> dict:
    # 1. Primary Demo Project
    replay_path = REPO_ROOT / "fixtures" / "replay" / "demo_extraction.json"
    expected_path = REPO_ROOT / "fixtures" / "expected" / "ground_truth.json"
    chunks_path = REPO_ROOT / "contracts" / "samples" / "chunks.json"
    replay_chunks_path = REPO_ROOT / "fixtures" / "replay" / "demo_chunks.json"

    claims_demo = json.loads(replay_path.read_text(encoding="utf-8"))
    gt_demo = json.loads(expected_path.read_text(encoding="utf-8"))
    chunks_demo_map: dict = {}

    if chunks_path.exists():
        chunks_demo = json.loads(chunks_path.read_text(encoding="utf-8"))
        if isinstance(chunks_demo, list):
            chunks_demo_map.update({c["chunk_id"]: c for c in chunks_demo})
        elif isinstance(chunks_demo, dict):
            chunks_demo_map.update(chunks_demo)

    if replay_chunks_path.exists():
        replay_chunks = json.loads(replay_chunks_path.read_text(encoding="utf-8"))
        if isinstance(replay_chunks, list):
            chunks_demo_map.update({c["chunk_id"]: c for c in replay_chunks})
        elif isinstance(replay_chunks, dict):
            chunks_demo_map.update(replay_chunks)

    # Augment with live database chunks if available
    try:
        from app.core.db import get_session
        from app.modules.ingestion import public as ing
        session = next(get_session())
        db_chunks = ing.list_chunks("proj-campus-event-portal", "approver", session)
        for c in db_chunks:
            chunks_demo_map[c["chunk_id"]] = c
    except Exception:
        pass

    demo_results = evaluate_dataset(claims_demo, chunks_demo_map, gt_demo)

    # 2. Separate Unseen Test Pack
    unseen_path = REPO_ROOT / "fixtures" / "expected" / "unseen_test_pack.json"
    unseen_data = json.loads(unseen_path.read_text(encoding="utf-8"))
    unseen_results = evaluate_dataset(
        unseen_data["unseen_claims"],
        unseen_data["unseen_chunks"],
        unseen_data["expected_unseen_metrics"],
    )

    return {
        "demo_dataset": demo_results,
        "unseen_test_pack": unseen_results,
    }


run_full_evaluation = run_evaluation


def print_report(res: dict):
    print("=" * 68)
    print("       BATON ROUND 2 EVALUATION & TRUST SCORECARD")
    print("=" * 68)

    for name, r in [("1. Campus Event Portal (Demo Replay Dataset)", res["demo_dataset"]),
                    ("2. Autonomous Rover System (Separate Unseen Test Pack)", res["unseen_test_pack"])]:
        print(f"\n--- {name} ---")
        print(f"Total Claims Evaluated:        {r['total_claims']} / {r['expected_claims']} (Recall: {r['claim_recall_rate']}%)")
        print(f"Total Evidence Citations:      {r['total_citations']}")
        print(f"  - Verified Citations:        {r['valid_citations']} (Exact: {r['exact_citations']}, Fuzzy: {r['fuzzy_citations']})")
        print(f"  - Unverified / Fabricated:   {r['unverified_citations']}")
        print(f"Citation Validity Rate:        {r['citation_validity_rate']}%")
        print(f"Planted Conflicts Detected:    {r['planted_conflicts_detected']} / {r['planted_conflicts_total']} ({r['conflict_recall_rate']}%)")
        print(f"Generated Knowledge Gaps:      {r['generated_gaps_count']}")
        print(f"Secret & PII Leakage Count:    {r['secret_leak_count']} (target: 0)")

    print("\n" + "=" * 68)


if __name__ == "__main__":
    results = run_full_evaluation()
    print_report(results)
