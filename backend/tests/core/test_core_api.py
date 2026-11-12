"""Core endpoints: health, demo login for every seeded role, /me, bad tokens."""
import pytest

from tests.conftest import login


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


@pytest.mark.parametrize("role", ["approver", "leaver", "incoming_maintainer", "incoming_contributor"])
def test_demo_login_for_every_role(client, role):
    assert client.get("/me", headers=login(client, role)).json()["role"] == role


def test_unknown_role_and_bad_token(client):
    assert client.post("/auth/demo-login", json={"role": "admin"}).status_code == 404
    assert client.get("/me", headers={"Authorization": "Bearer nonsense"}).status_code == 401
    assert client.get("/me").status_code == 401


def test_stub_chunk_endpoint_enforces_acl(client):
    assert client.get("/chunks/S4-301", headers=login(client, "incoming_contributor")).status_code == 404
    assert client.get("/chunks/S4-301", headers=login(client, "approver")).status_code == 200
    assert client.get("/chunks/S4-212", headers=login(client, "incoming_contributor")).status_code == 200
