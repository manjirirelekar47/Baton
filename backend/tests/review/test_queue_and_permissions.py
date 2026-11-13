"""Queue ordering, label filtering, role matrix and project isolation."""
import pytest

from .conftest import H

ROLES_NO_ACCESS = ["incoming_maintainer", "incoming_contributor", "", "hacker"]
ENDPOINTS = [
    ("get", "/review/queue"), ("get", "/review/readiness"), ("post", "/review/confirm-verified"),
    ("post", "/review/approve"), ("get", "/audit"),
]


def test_queue_is_risk_sorted_conflicts_first(client):
    items = client.get("/review/queue", headers=H()).json()["items"]
    states = [i["state"] for i in items]
    assert states[:2] == ["Conflicting", "Conflicting"]
    assert items[0]["claim_id"] in {"c-pay-A", "c-pay-B"}
    ranks = [i["risk_rank"] for i in items]
    assert ranks == sorted(ranks)


def test_every_item_has_a_text_state_and_visible_reason(client):
    for i in client.get("/review/queue", headers=H()).json()["items"]:
        assert i["state"] in {"Verified", "Inferred", "Conflicting", "Missing", "Attested", "Stale"}
        assert i["risk_reason"]


def test_l4_secret_never_in_queue_or_anywhere(client):
    r = client.get("/review/queue", headers=H())
    assert "c-secret" not in r.text and "sk-ABCDEFGHIJKLMNOP" not in r.text


def test_label_filter_hides_l3_when_not_allowed(app, client, fake):
    from app.modules.review import deps
    app.dependency_overrides[deps.get_allowed_labels] = lambda: frozenset({"L1"})
    ids = {i["claim_id"] for i in client.get("/review/queue", headers=H()).json()["items"]}
    assert "c-lead" not in ids and "c-staging" not in ids and "c-test" in ids


def test_conflict_items_expose_both_sides_and_suggestion(client):
    by_id = {i["claim_id"]: i for i in client.get("/review/queue", headers=H()).json()["items"]}
    b = by_id["c-pay-B"]
    assert b["conflict_with"] == ["c-pay-A"] and b["suggested_claim_id"] == "c-pay-B"
    assert b["evidence"][0]["quote"] == "Rohan took payments over"


@pytest.mark.parametrize("role", ROLES_NO_ACCESS)
@pytest.mark.parametrize("method,path", ENDPOINTS)
def test_non_approver_roles_forbidden(client, role, method, path):
    kw = {"json": {}} if method == "post" else {}
    r = getattr(client, method)(path, headers=H(role), **kw)
    assert r.status_code == 403, (role, path, r.text)


@pytest.mark.parametrize("role", ["incoming_maintainer", "incoming_contributor", "leaver"])
def test_non_approver_cannot_act_on_claims(act, role):
    assert act("c-test", "confirm", role=role).status_code == 403


def test_leaver_cannot_read_queue_but_can_list_versions(client):
    assert client.get("/review/queue", headers=H("leaver")).status_code == 403
    assert client.get("/versions", headers=H("leaver")).status_code == 200
    assert client.get("/review/queue", headers=H("incoming_contributor")).status_code == 403


def test_cross_project_id_guessing_returns_404(act, client):
    # approver of a project with NO claims tries ids that exist in p1/p2
    assert act("c-test", "confirm", project="p-empty").status_code == 404
    assert client.get("/review/queue", headers=H(project="p-empty")).json()["items"] == []


def test_actions_only_touch_own_project(act, client):
    assert act("c-test", "confirm", project="p1").status_code == 200
    q2 = client.get("/review/queue", headers=H(project="p2")).json()["items"]
    assert next(i for i in q2 if i["claim_id"] == "c-test")["pending"] is True


def test_unknown_and_restricted_ids_are_404(act):
    assert act("nope", "confirm").status_code == 404
    assert act("c-secret", "confirm").status_code == 404   # L4: indistinguishable from absent
