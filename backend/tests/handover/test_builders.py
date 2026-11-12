"""Unit tests for the pure view and plan builders. No database or web framework needed."""
import json

from app.core import acl
from app.core.samples import load_sample
from app.modules.handover import builders

RESTRICTED_MARKERS = ["Sponsor funding", "S4-301", "c-010"]
L2_MARKERS = ["free tier, 90 days", "S2-CFG-7", "c-009", "staging server likely expires"]


def _view(role, viewer="u-x"):
    version = load_sample("version_v1")
    filtered = acl.filter_for_role(role, version["claims"])
    return builders.build_view(version, role, viewer, filtered, {}, {}), filtered


def test_contributor_view_contains_no_restricted_text():
    view, _ = _view("incoming_contributor")
    body = json.dumps(view)
    for marker in RESTRICTED_MARKERS + L2_MARKERS:
        assert marker not in body, marker
    assert view["hidden"] == {"count": 2}


def test_maintainer_sees_l2_but_not_leadership_only():
    view, _ = _view("incoming_maintainer")
    body = json.dumps(view)
    assert "c-009" in body
    for marker in RESTRICTED_MARKERS:
        assert marker not in body, marker
    assert view["hidden"]["count"] == 1


def test_approver_sees_everything_and_cannot_acknowledge():
    view, _ = _view("approver")
    body = json.dumps(view)
    assert "c-010" in body and view["hidden"]["count"] == 0
    assert view["can_acknowledge"] is False


def test_hidden_placeholder_is_a_bare_count():
    view, _ = _view("incoming_contributor")
    assert set(view["hidden"].keys()) == {"count"}


def test_unknown_owner_stays_unknown():
    _, filtered = _view("incoming_contributor")
    plan = builders.build_plan(filtered.visible, "u-contrib")
    notifications = next(i for b in plan.values() for i in b if i["claim_id"] == "c-003")
    assert notifications["owner"] is None and notifications["owner_known"] is False
    assert notifications["proposed_owner"] is None


def test_proposed_for_me_matches_only_the_named_member():
    _, filtered = _view("incoming_contributor")
    mine = builders.build_plan(filtered.visible, "u-contrib")
    theirs = builders.build_plan(filtered.visible, "u-meera")
    kiosk_mine = next(i for b in mine.values() for i in b if i["claim_id"] == "c-002")
    kiosk_theirs = next(i for b in theirs.values() for i in b if i["claim_id"] == "c-002")
    assert kiosk_mine["proposed_for_me"] is True and kiosk_theirs["proposed_for_me"] is False


def test_plan_follows_blocked_by_order():
    _, filtered = _view("incoming_contributor")
    plan = builders.build_plan(filtered.visible, "u-contrib")
    ids = {b: [i["claim_id"] for i in items] for b, items in plan.items()}
    assert "c-004" in ids["day_1"] and "c-005" in ids["day_1"]
    assert ids["week_1"] == ["c-006"]
    assert ids["month_1"] == ["c-007"]
    assert ids["day_1"].index("c-004") < ids["day_1"].index("c-005")  # blocker (unblock) before next action


def test_plan_never_contains_hidden_claims_or_their_ids():
    _, filtered = _view("incoming_contributor")
    body = json.dumps(builders.build_plan(filtered.visible, "u-contrib"))
    for marker in RESTRICTED_MARKERS + L2_MARKERS:
        assert marker not in body, marker


def test_blocked_by_hidden_claim_is_dropped_silently():
    claims = [
        {"claim_id": "a", "type": "next_action", "statement": "A", "state": "verified", "acl_label": "L1",
         "blocked_by": ["secret-id"], "evidence": []},
    ]
    plan = builders.build_plan(claims, "u")
    assert plan["day_1"][0]["blocked_by"] == []
    assert "secret-id" not in json.dumps(plan)


def test_circular_blocked_by_chain_is_flagged_not_dropped():
    claims = [
        {"claim_id": "a", "type": "next_action", "statement": "A", "state": "verified", "acl_label": "L1", "blocked_by": ["b"], "evidence": []},
        {"claim_id": "b", "type": "next_action", "statement": "B", "state": "verified", "acl_label": "L1", "blocked_by": ["a"], "evidence": []},
        {"claim_id": "c", "type": "next_action", "statement": "C", "state": "verified", "acl_label": "L1", "blocked_by": [], "evidence": []},
    ]
    plan = builders.build_plan(claims, "u")
    flat = [i for b in plan.values() for i in b]
    assert {i["claim_id"] for i in flat} == {"a", "b", "c"}
    assert {i["claim_id"] for i in flat if i["cycle"]} == {"a", "b"}


def test_unknown_claim_types_are_never_rendered():
    version = {"version_id": "v", "claims": []}
    claims = [{"claim_id": "x", "type": "gossip", "statement": "S", "state": "verified", "acl_label": "L1", "evidence": []}]
    filtered = acl.filter_for_role("approver", claims)
    assert builders.build_view(version, "approver", "u", filtered, {}, {})["sections"] == []
