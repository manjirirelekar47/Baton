"""Server-side encryption and OAuth 2.0 grant management for GitHub and Jira Cloud.

All sensitive credentials (access tokens, refresh tokens) are encrypted at rest
using symmetric Fernet encryption with a server-side encryption key. Tokens are NEVER
returned in API responses or written to client logs.
OAuth states are signed with HMAC, bound to the authenticated project, strictly expiring,
and single-use.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime, timedelta
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import text
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)


class OAuthStateError(ValueError):
    """Raised when an OAuth state token is invalid, expired, or already used."""


class OAuthProviderError(RuntimeError):
    """Raised when an OAuth code exchange or token refresh request fails."""


def _get_encryption_key() -> bytes:
    """Return a 32-byte urlsafe base64-encoded key suitable for Fernet encryption.

    In production, this should be supplied via BATON_ENCRYPTION_KEY.
    In local development and test environments, it deterministically derives a key from
    the project secret key or JWT_SECRET so tests run out-of-the-box without extra setup.
    """
    raw_key = os.environ.get("BATON_ENCRYPTION_KEY")
    if raw_key:
        try:
            # Validate if it's already a valid Fernet key
            Fernet(raw_key.encode("ascii") if isinstance(raw_key, str) else raw_key)
            return raw_key.encode("ascii") if isinstance(raw_key, str) else raw_key
        except Exception:
            pass

    secret = (
        os.environ.get("BATON_SECRET_KEY")
        or os.environ.get("JWT_SECRET")
        or "baton-dev-symmetric-encryption-secret-key-32b"
    )
    derived = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(derived)


def get_fernet() -> Fernet:
    """Obtain a Fernet symmetric encryption cipher instance."""
    return Fernet(_get_encryption_key())


def _get_hmac_key() -> bytes:
    """Return the HMAC key for signing state tokens."""
    return _get_encryption_key()


def encrypt_token(raw_token: str) -> str:
    """Encrypt a plaintext token string into an encrypted ciphertext string."""
    if not raw_token:
        return ""
    fernet = get_fernet()
    return fernet.encrypt(raw_token.encode("utf-8")).decode("ascii")


def decrypt_token(encrypted_token: str) -> str:
    """Decrypt a ciphertext string back into the plaintext token string."""
    if not encrypted_token:
        return ""
    fernet = get_fernet()
    try:
        return fernet.decrypt(encrypted_token.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise OAuthProviderError("Failed to decrypt stored credentials. Encryption key may have changed.") from exc


def generate_oauth_state(
    session: Session,
    project_id: str,
    user_id: str,
    provider: str,
    target_name: str | None = None,
    acl_label: str = "L1",
    redirect_uri: str | None = None,
    ttl_seconds: int = 900,
) -> str:
    """Generate and store a signed, expiring, single-use OAuth state bound to the project."""
    nonce = secrets.token_hex(24)
    now = datetime.now(UTC)
    expires_at = now + timedelta(seconds=ttl_seconds)
    expires_str = expires_at.isoformat()

    # Sign the nonce and bound metadata with HMAC-SHA256
    sig_payload = f"{nonce}:{project_id}:{user_id}:{provider}:{expires_str}".encode("utf-8")
    sig = hmac.new(_get_hmac_key(), sig_payload, hashlib.sha256).hexdigest()[:16]
    state_token = f"baton_{nonce}_{sig}"

    now_str = now.isoformat()
    session.execute(
        text("""
            insert into oauth_states
            (state, project_id, user_id, provider, target_name, acl_label, redirect_uri, created_at, expires_at, used)
            values (:state, :p, :u, :prov, :target, :acl, :red, :now, :exp, 0)
        """),
        {
            "state": state_token,
            "p": project_id,
            "u": user_id,
            "prov": provider,
            "target": target_name,
            "acl": acl_label,
            "red": redirect_uri,
            "now": now_str,
            "exp": expires_str,
        },
    )
    session.commit()
    return state_token


def verify_and_consume_oauth_state(
    session: Session,
    state_token: str,
    expected_provider: str | None = None,
) -> dict[str, Any]:
    """Verify that an OAuth state is authentic, unexpired, and single-use, then mark it consumed."""
    if not state_token or not state_token.startswith("baton_"):
        raise OAuthStateError("OAuth state parameter is missing or malformed.")

    remainder = state_token[len("baton_"):]
    if "_" not in remainder:
        raise OAuthStateError("OAuth state format is invalid.")
    nonce, sig = remainder.rsplit("_", 1)
    if not nonce or not sig:
        raise OAuthStateError("OAuth state format is invalid.")

    row = session.execute(
        text("""
            select state, project_id, user_id, provider, target_name, acl_label, redirect_uri, created_at, expires_at, used
            from oauth_states where state = :state
        """),
        {"state": state_token},
    ).mappings().first()

    if not row:
        raise OAuthStateError("OAuth state was not found or was already purged.")

    if row["used"]:
        raise OAuthStateError("OAuth state has already been used. Please initiate authorization again.")

    expires_at_str = row["expires_at"]
    try:
        expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if datetime.now(UTC) > expires_at:
            raise OAuthStateError("OAuth state has expired. Please initiate authorization again.")
    except (ValueError, TypeError) as exc:
        raise OAuthStateError("OAuth state expiration is invalid.") from exc

    # Verify HMAC signature
    expected_payload = f"{nonce}:{row['project_id']}:{row['user_id']}:{row['provider']}:{expires_at_str}".encode("utf-8")
    expected_sig = hmac.new(_get_hmac_key(), expected_payload, hashlib.sha256).hexdigest()[:16]
    if not hmac.compare_digest(sig, expected_sig):
        raise OAuthStateError("OAuth state signature verification failed.")

    if expected_provider and row["provider"] != expected_provider:
        raise OAuthStateError(f"OAuth state was created for {row['provider']}, not {expected_provider}.")

    # Mark consumed atomically
    session.execute(
        text("update oauth_states set used = 1 where state = :state"),
        {"state": state_token},
    )
    session.commit()

    return dict(row)


def save_connection_credentials(
    session: Session,
    connection_id: str,
    project_id: str,
    access_token: str,
    refresh_token: str | None = None,
    token_expires_at: str | None = None,
    scopes: str | None = None,
    external_account: str | None = None,
) -> None:
    """Store encrypted OAuth tokens in the dedicated connection_credentials table."""
    encrypted_access = encrypt_token(access_token)
    encrypted_refresh = encrypt_token(refresh_token) if refresh_token else None
    now = datetime.now(UTC).isoformat()

    # Check if entry exists
    existing = session.execute(
        text("select connection_id from connection_credentials where connection_id = :id"),
        {"id": connection_id},
    ).first()

    if existing:
        session.execute(
            text("""
                update connection_credentials
                set encrypted_access_token = :access,
                    encrypted_refresh_token = coalesce(:refresh, encrypted_refresh_token),
                    token_expires_at = :exp,
                    scopes = coalesce(:scopes, scopes),
                    external_account = coalesce(:account, external_account),
                    updated_at = :now
                where connection_id = :id
            """),
            {
                "id": connection_id,
                "access": encrypted_access,
                "refresh": encrypted_refresh,
                "exp": token_expires_at,
                "scopes": scopes,
                "account": external_account,
                "now": now,
            },
        )
    else:
        session.execute(
            text("""
                insert into connection_credentials
                (connection_id, project_id, encrypted_access_token, encrypted_refresh_token,
                 token_expires_at, scopes, external_account, created_at, updated_at)
                values (:id, :p, :access, :refresh, :exp, :scopes, :account, :now, :now)
            """),
            {
                "id": connection_id,
                "p": project_id,
                "access": encrypted_access,
                "refresh": encrypted_refresh,
                "exp": token_expires_at,
                "scopes": scopes,
                "account": external_account,
                "now": now,
            },
        )
    session.commit()


def get_connection_credentials(session: Session, connection_id: str, project_id: str | None = None) -> dict[str, Any] | None:
    """Retrieve and decrypt credentials for a specific connection.

    Never pass the returned dictionary to API response serialization.
    """
    query = """
        select connection_id, project_id, encrypted_access_token, encrypted_refresh_token,
               token_expires_at, scopes, external_account
        from connection_credentials where connection_id = :id
    """
    params: dict[str, Any] = {"id": connection_id}
    if project_id:
        query += " and project_id = :p"
        params["p"] = project_id

    row = session.execute(text(query), params).mappings().first()

    if not row:
        return None

    try:
        access_token = decrypt_token(row["encrypted_access_token"])
        refresh_token = decrypt_token(row["encrypted_refresh_token"]) if row["encrypted_refresh_token"] else None
    except Exception as exc:
        log.error("Failed to decrypt credentials for connection %s: %s", connection_id, exc)
        return None

    return {
        "connection_id": row["connection_id"],
        "project_id": row["project_id"],
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_expires_at": row["token_expires_at"],
        "scopes": row["scopes"],
        "external_account": row["external_account"],
    }


def delete_connection_credentials(session: Session, connection_id: str, project_id: str | None = None) -> None:
    """Delete credentials associated with a connection."""
    query = "delete from connection_credentials where connection_id = :id"
    params: dict[str, Any] = {"id": connection_id}
    if project_id:
        query += " and project_id = :p"
        params["p"] = project_id
    session.execute(text(query), params)
    session.commit()


def revoke_connection_credentials(session: Session, project_id: str, connection_id: str) -> None:
    """Revoke credentials and mark connection auth_status as 'revoked'."""
    delete_connection_credentials(session, connection_id, project_id=project_id)
    now = datetime.now(UTC).isoformat()
    session.execute(
        text("""
            update source_connections
            set auth_status = 'revoked',
                status = 'failed',
                error_message = 'Connection revoked by project administrator.',
                updated_at = :now
            where id = :id and project_id = :p
        """),
        {"id": connection_id, "p": project_id, "now": now},
    )
    session.commit()


def build_github_authorize_url(state: str, redirect_uri: str) -> str:
    """Build the GitHub App installation or OAuth 2.0 authorization URL."""
    app_slug = os.environ.get("GITHUB_APP_SLUG") or os.environ.get("GITHUB_APP_NAME")
    if app_slug:
        return f"https://github.com/apps/{urllib.parse.quote(app_slug)}/installations/new?state={urllib.parse.quote(state)}"

    client_id = os.environ.get("GITHUB_CLIENT_ID") or "baton-github-client-id"
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "scope": "repo,read:org",
    }
    return f"https://github.com/login/oauth/authorize?{urllib.parse.urlencode(params)}"


def build_jira_authorize_url(state: str, redirect_uri: str) -> str:
    """Build the Jira Cloud (3LO) OAuth 2.0 authorization URL."""
    client_id = os.environ.get("JIRA_CLIENT_ID") or "baton-jira-client-id"
    params = {
        "audience": "api.atlassian.com",
        "client_id": client_id,
        "scope": "read:jira-work read:jira-user offline_access",
        "redirect_uri": redirect_uri,
        "state": state,
        "response_type": "code",
        "prompt": "consent",
    }
    return f"https://auth.atlassian.com/authorize?{urllib.parse.urlencode(params)}"


def exchange_github_code(code: str, redirect_uri: str) -> dict[str, Any]:
    """Exchange a GitHub OAuth authorization code for an access token."""
    client_id = os.environ.get("GITHUB_CLIENT_ID") or "baton-github-client-id"
    client_secret = os.environ.get("GITHUB_CLIENT_SECRET") or "baton-github-client-secret"

    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "redirect_uri": redirect_uri,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://github.com/login/oauth/access_token",
        data=data,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Baton-Ingestion/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise OAuthProviderError(f"GitHub authorization exchange failed with HTTP {exc.code}.") from exc
    except Exception as exc:
        raise OAuthProviderError("Could not reach GitHub OAuth server.") from exc

    if "error" in body:
        desc = body.get("error_description") or body.get("error")
        raise OAuthProviderError(f"GitHub authorization rejected: {desc}")

    access_token = body.get("access_token")
    if not access_token:
        raise OAuthProviderError("GitHub response did not contain an access token.")

    expires_in = body.get("expires_in")
    token_expires_at = None
    if expires_in and isinstance(expires_in, (int, float)):
        token_expires_at = (datetime.now(UTC) + timedelta(seconds=int(expires_in))).isoformat()

    return {
        "access_token": access_token,
        "refresh_token": body.get("refresh_token"),
        "token_expires_at": token_expires_at,
        "scopes": body.get("scope"),
    }


def exchange_jira_code(code: str, redirect_uri: str) -> dict[str, Any]:
    """Exchange an Atlassian 3LO authorization code for tokens and fetch accessible resource cloud_id."""
    client_id = os.environ.get("JIRA_CLIENT_ID") or "baton-jira-client-id"
    client_secret = os.environ.get("JIRA_CLIENT_SECRET") or "baton-jira-client-secret"

    payload = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "redirect_uri": redirect_uri,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://auth.atlassian.com/oauth/token",
        data=data,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Baton-Ingestion/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise OAuthProviderError(f"Jira authorization exchange failed with HTTP {exc.code}.") from exc
    except Exception as exc:
        raise OAuthProviderError("Could not reach Atlassian OAuth server.") from exc

    if "error" in body:
        desc = body.get("error_description") or body.get("error")
        raise OAuthProviderError(f"Jira authorization rejected: {desc}")

    access_token = body.get("access_token")
    if not access_token:
        raise OAuthProviderError("Jira response did not contain an access token.")

    expires_in = body.get("expires_in")
    token_expires_at = None
    if expires_in and isinstance(expires_in, (int, float)):
        token_expires_at = (datetime.now(UTC) + timedelta(seconds=int(expires_in))).isoformat()

    # Discover accessible cloud_id
    cloud_id = None
    try:
        res_req = urllib.request.Request(
            "https://api.atlassian.com/oauth/token/accessible-resources",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
                "User-Agent": "Baton-Ingestion/1.0",
            },
        )
        with urllib.request.urlopen(res_req, timeout=15) as res_resp:
            resources = json.loads(res_resp.read().decode("utf-8"))
            if isinstance(resources, list) and len(resources) > 0:
                cloud_id = resources[0].get("id")
    except Exception as exc:
        log.warning("Could not automatically retrieve Jira cloud_id from accessible resources: %s", exc)

    return {
        "access_token": access_token,
        "refresh_token": body.get("refresh_token"),
        "token_expires_at": token_expires_at,
        "scopes": body.get("scope"),
        "external_account": cloud_id,
    }


def refresh_connection_token(session: Session, project_id: str, connection_id: str) -> bool:
    """Attempt to refresh an expired token using its encrypted refresh token."""
    creds = get_connection_credentials(session, connection_id)
    if not creds or not creds.get("refresh_token"):
        return False

    refresh_token = creds["refresh_token"]

    conn = session.execute(
        text("select provider from source_connections where id = :id and project_id = :p"),
        {"id": connection_id, "p": project_id},
    ).mappings().first()

    if not conn:
        return False

    provider = conn["provider"]
    now = datetime.now(UTC).isoformat()

    try:
        if provider == "jira":
            client_id = os.environ.get("JIRA_CLIENT_ID") or "baton-jira-client-id"
            client_secret = os.environ.get("JIRA_CLIENT_SECRET") or "baton-jira-client-secret"
            payload = {
                "grant_type": "refresh_token",
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
            }
            req = urllib.request.Request(
                "https://auth.atlassian.com/oauth/token",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json", "User-Agent": "Baton-Ingestion/1.0"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                body = json.loads(resp.read().decode("utf-8"))

            new_access = body["access_token"]
            new_refresh = body.get("refresh_token") or refresh_token
            expires_in = body.get("expires_in")
            token_expires_at = None
            if expires_in:
                token_expires_at = (datetime.now(UTC) + timedelta(seconds=int(expires_in))).isoformat()

            save_connection_credentials(
                session,
                connection_id=connection_id,
                project_id=project_id,
                access_token=new_access,
                refresh_token=new_refresh,
                token_expires_at=token_expires_at,
                external_account=creds.get("external_account"),
            )
            session.execute(
                text("update source_connections set auth_status = 'connected', updated_at = :now where id = :id"),
                {"id": connection_id, "now": now},
            )
            session.commit()
            return True

        elif provider == "github":
            client_id = os.environ.get("GITHUB_CLIENT_ID") or "baton-github-client-id"
            client_secret = os.environ.get("GITHUB_CLIENT_SECRET") or "baton-github-client-secret"
            payload = {
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            }
            req = urllib.request.Request(
                "https://github.com/login/oauth/access_token",
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "User-Agent": "Baton-Ingestion/1.0",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                body = json.loads(resp.read().decode("utf-8"))

            if "error" in body or "access_token" not in body:
                raise OAuthProviderError(body.get("error_description") or "Refresh failed.")

            new_access = body["access_token"]
            new_refresh = body.get("refresh_token") or refresh_token
            expires_in = body.get("expires_in")
            token_expires_at = None
            if expires_in:
                token_expires_at = (datetime.now(UTC) + timedelta(seconds=int(expires_in))).isoformat()

            save_connection_credentials(
                session,
                connection_id=connection_id,
                project_id=project_id,
                access_token=new_access,
                refresh_token=new_refresh,
                token_expires_at=token_expires_at,
            )
            session.execute(
                text("update source_connections set auth_status = 'connected', updated_at = :now where id = :id"),
                {"id": connection_id, "now": now},
            )
            session.commit()
            return True

    except Exception as exc:
        log.warning("Token refresh failed for connection %s: %s", connection_id, exc)
        session.execute(
            text("""
                update source_connections
                set auth_status = 'needs_attention',
                    error_message = 'Reauthorization required: OAuth refresh token expired or was rejected.',
                    updated_at = :now
                where id = :id and project_id = :p
            """),
            {"id": connection_id, "p": project_id, "now": now},
        )
        session.commit()
        return False

    return False
