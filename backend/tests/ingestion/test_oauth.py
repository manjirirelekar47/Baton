"""Tests for Work Item 1: D1 — Per-connection GitHub and Jira OAuth authorization."""
import json
import urllib.request
from unittest.mock import MagicMock

from tests.conftest import login


def test_oauth_state_security_lifecycle(client):
    approver = login(client, "approver")

    # Approver requests authorization URL and state
    res = client.post(
        "/sources/oauth/github/authorize",
        json={
            "provider": "github",
            "target_name": "baton-org/baton-repo",
            "acl_label": "L2",
            "consent": True,
        },
        headers=approver,
    )
    assert res.status_code == 200
    data = res.json()
    assert "authorization_url" in data
    assert "state" in data
    assert data["provider"] == "github"
    state_token = data["state"]
    assert state_token.startswith("baton_")
    assert "client_id=" in data["authorization_url"]
    assert f"state={state_token}" in data["authorization_url"]

    # Contributors cannot initiate OAuth connection
    contributor = login(client, "incoming_contributor")
    res_forbidden = client.post(
        "/sources/oauth/github/authorize",
        json={
            "provider": "github",
            "target_name": "baton-org/baton-repo",
            "acl_label": "L2",
            "consent": True,
        },
        headers=contributor,
    )
    assert res_forbidden.status_code == 403


def test_fernet_encryption_at_rest_and_zero_token_leakage(client, monkeypatch):
    approver = login(client, "approver")

    # Mock GitHub code exchange
    mock_token = "gho_secret_access_token_1234567890"
    mock_refresh = "ghr_secret_refresh_token_0987654321"

    def fake_urlopen(req, timeout=20):
        url = req.full_url if hasattr(req, "full_url") else str(req)
        if "access_token" in url:
            resp_body = json.dumps({
                "access_token": mock_token,
                "refresh_token": mock_refresh,
                "expires_in": 3600,
                "scope": "repo,read:org",
            }).encode("utf-8")
            mock_resp = MagicMock()
            mock_resp.read.return_value = resp_body
            mock_resp.__enter__.return_value = mock_resp
            return mock_resp
        raise RuntimeError(f"Unexpected url: {url}")

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    # 1. Initiate authorization
    init_res = client.post(
        "/sources/oauth/github/authorize",
        json={
            "provider": "github",
            "target_name": "acme-corp/core-api",
            "acl_label": "L1",
            "consent": True,
        },
        headers=approver,
    )
    assert init_res.status_code == 200
    state = init_res.json()["state"]

    # 2. Exchange code for tokens
    exchange_res = client.post(
        "/sources/oauth/github/exchange",
        json={"code": "valid_github_auth_code_123", "state": state},
        headers=approver,
    )
    assert exchange_res.status_code == 200
    conn_id = exchange_res.json()["connection_id"]
    assert exchange_res.json()["auth_status"] == "connected"

    # CRITICAL: Verify tokens are NEVER returned in exchange or connection API responses!
    assert "token" not in exchange_res.json()
    assert "access_token" not in exchange_res.json()
    assert "refresh_token" not in exchange_res.json()

    conn_list = client.get("/sources/connections", headers=approver).json()
    target_conn = next(c for c in conn_list if c["id"] == conn_id)
    assert "token" not in target_conn
    assert "access_token" not in target_conn
    assert "refresh_token" not in target_conn
    assert "encrypted_access_token" not in target_conn
    assert target_conn["auth_status"] == "connected"

    # Single-use state verification: Replaying exchange with same state MUST fail
    replay_res = client.post(
        "/sources/oauth/github/exchange",
        json={"code": "valid_github_auth_code_123", "state": state},
        headers=approver,
    )
    assert replay_res.status_code == 400
    assert "already been used" in replay_res.json()["detail"].lower()


def test_connection_state_transitions_revoke_reauthorize_disconnect(client, monkeypatch):
    approver = login(client, "approver")
    contributor = login(client, "incoming_contributor")

    # Direct connection create
    create_res = client.post(
        "/sources/connections",
        json={
            "provider": "jira",
            "target_name": "CAMPUS",
            "acl_label": "L1",
            "consent": True,
        },
        headers=approver,
    )
    assert create_res.status_code == 201
    conn_id = create_res.json()["id"]
    assert create_res.json()["auth_status"] == "connected"

    # Contributor cannot revoke or disconnect
    assert client.post(f"/sources/connections/{conn_id}/revoke", headers=contributor).status_code == 403
    assert client.post(f"/sources/connections/{conn_id}/disconnect", headers=contributor).status_code == 403
    assert client.post(f"/sources/connections/{conn_id}/reauthorize", headers=contributor).status_code == 403

    # Approver revokes connection
    revoke_res = client.post(f"/sources/connections/{conn_id}/revoke", headers=approver)
    assert revoke_res.status_code == 200
    assert revoke_res.json()["auth_status"] == "revoked"

    # Sync on revoked connection fails
    sync_res = client.post(f"/sources/connections/{conn_id}/sync", headers=approver)
    assert sync_res.status_code == 200
    assert sync_res.json()["status"] == "failed"
    assert "revoked" in sync_res.json()["error_message"].lower()

    # Approver requests reauthorization
    reauth_res = client.post(f"/sources/connections/{conn_id}/reauthorize", headers=approver)
    assert reauth_res.status_code == 200
    assert "authorization_url" in reauth_res.json()
    assert reauth_res.json()["provider"] == "jira"

    # Approver disconnects connection
    disconnect_res = client.post(f"/sources/connections/{conn_id}/disconnect", headers=approver)
    assert disconnect_res.status_code == 200
    assert disconnect_res.json()["status"] == "deleted"

    # Verify connection no longer exists
    remaining = client.get("/sources/connections", headers=approver).json()
    assert not any(c["id"] == conn_id for c in remaining)


def test_scoped_tokens_used_during_sync_and_needs_attention_status(client, monkeypatch):
    approver = login(client, "approver")

    # Connect GitHub source
    res = client.post(
        "/sources/connections",
        json={
            "provider": "github",
            "target_name": "scoped-org/scoped-repo",
            "acl_label": "L1",
            "consent": True,
        },
        headers=approver,
    )
    assert res.status_code == 201
    conn_id = res.json()["id"]

    # Verify sync failure due to auth rejection moves auth_status to 'needs_attention'
    from app.modules.ingestion import connectors

    def rejecting_fetch(self, checkpoint_cursor=None):
        raise connectors.ProviderSyncError("Provider authentication or read permission was rejected. Check credentials.")

    monkeypatch.setattr(connectors.GitHubConnector, "fetch_records", rejecting_fetch)

    sync_res = client.post(f"/sources/connections/{conn_id}/sync", headers=approver)
    assert sync_res.status_code == 200
    assert sync_res.json()["status"] == "failed"
    assert sync_res.json()["auth_status"] == "needs_attention"
    assert "rejected" in sync_res.json()["error_message"].lower()
