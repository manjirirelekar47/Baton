from app.modules.ask import service
from tests.conftest import login


def test_ask_requires_signed_in_user(client):
    assert client.post("/ask", json={"question": "Who owns payments?"}).status_code == 401
    assert client.post("/ask", headers=login(client, "approver"), json={"question": "?"}).status_code == 422


def test_ask_endpoint_answers_from_seeded_approved_snapshot(client):
    response = client.post("/ask", headers=login(client, "approver"), json={"question": "Who owns payments?"})
    assert response.status_code == 200
    assert "answer" in response.json()
    assert isinstance(response.json()["matches"], list)


def test_ask_uses_verified_matches_and_excludes_inaccessible_claims(monkeypatch):
    version = {
        "status": "approved",
        "version_id": "v2",
        "shared_with": ["incoming_contributor"],
        "claims": [
            {"claim_id": "visible", "statement": "Payments owner is Aarav", "entity_key": "payments", "attribute": "owner", "owner": "Aarav", "state": "verified", "acl_label": "L1", "evidence": [{"chunk_id": "c1", "source_title": "handover.md", "quote": "Payments owner: Aarav", "acl_label": "L1"}]},
            {"claim_id": "secret", "statement": "Payments key is stored by Rohan", "entity_key": "payments", "attribute": "key", "owner": "Rohan", "state": "verified", "acl_label": "L3", "evidence": [{"chunk_id": "c2", "source_title": "private.md", "quote": "key stored by Rohan", "acl_label": "L3"}]},
            {"claim_id": "unverified", "statement": "Payments owner may be Meera", "entity_key": "payments", "attribute": "owner", "owner": "Meera", "state": "inferred", "acl_label": "L1", "evidence": []},
        ],
    }
    monkeypatch.setattr(service.review, "latest_version", lambda *_args, **_kwargs: version)
    response = service.answer_question("Who owns payments?", project_id="p1", role="incoming_contributor", session=object())
    assert response["approved_version"] == "v2"
    assert [match["claim_id"] for match in response["matches"]] == ["visible"]
    assert response["matches"][0]["evidence"][0]["chunk_id"] == "c1"


def test_ask_abstains_when_no_approved_snapshot(monkeypatch):
    monkeypatch.setattr(service.review, "latest_version", lambda *_args, **_kwargs: None)
    response = service.answer_question("Who owns payments?", project_id="p1", role="approver", session=object())
    assert not response["matches"]
    assert "no approved" in response["answer"].lower()


def test_ask_does_not_expose_unshared_snapshot_to_role(monkeypatch):
    monkeypatch.setattr(service.review, "latest_version", lambda *_args, **_kwargs: {"status": "approved", "version_id": "v2", "shared_roles": ["incoming_maintainer"], "claims": []})
    response = service.answer_question("Who owns payments?", project_id="p1", role="incoming_contributor", session=object())
    assert response["approved_version"] is None
    assert response["matches"] == []
    assert "shared with your role" in response["answer"]
