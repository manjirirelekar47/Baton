from app.modules.review import public
from app.modules.review.redaction import redact_secrets

from .conftest import H


def test_public_api_returns_frozen_snapshot_scoped_to_project(ready_project, Session):
    v = ready_project.post("/review/approve", json={}, headers=H()).json()
    s = Session()
    assert public.latest_version("p1", s)["id"] == v["id"]
    assert public.latest_version("p2", s) is None
    assert public.get_version(v["id"], "p2", s) is None        # cross-project guessing
    assert len(public.get_version_claims(v["id"], "p1", s)) == v["claim_count"]
    assert public.verify_version(v["id"], "p1", s) is True
    assert public.verify_version(v["id"], "p2", s) is False


def test_redaction_patterns():
    text, n = redact_secrets("AKIAABCDEFGHIJKLMNOP and a@b.com and token=abc123")
    assert n == 3 and "AKIA" not in text and "a@b.com" not in text and "abc123" not in text


def test_redaction_leaves_normal_text_alone():
    assert redact_secrets("Rohan owns payments") == ("Rohan owns payments", 0)
