"""Consent-aware source ingestion, OAuth 2.0 per-connection authorization, and evidence access."""
import json
import os
import urllib.parse

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.responses import RedirectResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import acl
from app.core.auth import User, current_user
from app.core.db import get_session
from app.modules.ingestion import crypto, public, service
from app.modules.ingestion.models import (
    OAuthAuthorizeRequest,
    OAuthAuthorizeResponse,
    OAuthExchangeRequest,
    OAuthExchangeResponse,
    ReauthorizeResponse,
    SourceConnectionCreate,
    SourceConnectionOut,
)

router = APIRouter(tags=["ingestion"])


@router.get("/sources")
def sources(user: User = Depends(current_user), session: Session = Depends(get_session)):
    return public.list_sources(user.project_id, user.role, session)


@router.post("/sources", status_code=201)
async def upload_source(
    file: UploadFile = File(...),
    consent: bool = Form(...),
    acl_label: str = Form(...),
    project_id: str | None = Form(default=None),
    x_project_id: str | None = Header(default=None, alias="X-Project-Id"),
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    if not service.can_manage_sources(user.role):
        raise HTTPException(status_code=403, detail="Only the project approver can connect sources.")
    if consent is not True:
        raise HTTPException(status_code=422, detail="Confirm that you are authorised to connect this source.")
    if acl_label not in {"L1", "L2", "L3", "L4"}:
        raise HTTPException(status_code=422, detail="Access label must be L1, L2, L3 or L4.")
    if acl_label == "L4":
        raise HTTPException(status_code=422, detail="L4 secret sources are never accepted or stored.")
    target_project_id = (project_id or "").strip() or (x_project_id or "").strip() or user.project_id
    try:
        content = await file.read(service.MAX_UPLOAD_BYTES + 1)
        allow_chat = os.getenv("INGEST_ENABLE_CHAT", "false").lower() == "true"
        source_type, records = service.parse_upload(file.filename or "", content, allow_chat=allow_chat)
        persisted = service.persist_source(session, project_id=target_project_id, filename=file.filename or "upload", source_type=source_type,
                                      acl_label=acl_label, records=records)
        existing_claims = session.execute(
            text("select count(*) from claims where project_id = :p"),
            {"p": target_project_id},
        ).scalar() or 0
        if existing_claims == 0 and not (os.getenv("PYTEST_CURRENT_TEST") or os.getenv("TESTING")):
            try:
                from app.modules.extraction import public as extraction_public
                extraction_public.start_reconstruct(target_project_id)
            except Exception:
                pass
        return persisted
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        session.rollback()
        raise
    finally:
        await file.close()


@router.get("/chunks/{chunk_id}")
def chunk(chunk_id: str, user: User = Depends(current_user), session: Session = Depends(get_session)):
    found = public.get_chunk(user.project_id, chunk_id, user.role, session)
    if found is None:
        raise HTTPException(status_code=404, detail="Chunk not found.")
    return found


@router.get("/sources/connections", response_model=list[SourceConnectionOut])
def get_connections(user: User = Depends(current_user), session: Session = Depends(get_session)):
    connections = public.list_connections(user.project_id, session)
    return [connection for connection in connections if acl.can_read(user.role, connection.get("acl_label"))]


@router.post("/sources/connections", status_code=201, response_model=SourceConnectionOut)
def create_connection(
    body: SourceConnectionCreate,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    if not service.can_manage_sources(user.role):
        raise HTTPException(status_code=403, detail="Only the project approver can connect sources.")
    return public.create_connection(user.project_id, body.provider, body.target_name, body.acl_label, session)


@router.post("/sources/connections/{connection_id}/sync", response_model=SourceConnectionOut)
def sync_connection(
    connection_id: str,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    if not service.can_manage_sources(user.role):
        raise HTTPException(status_code=403, detail="Only the project approver can sync sources.")
    conn = service.get_connection(session, user.project_id, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Source connection not found.")
    result = public.sync_connection(user.project_id, connection_id, session)
    existing_claims = session.execute(
        text("select count(*) from claims where project_id = :p"),
        {"p": user.project_id},
    ).scalar() or 0
    if existing_claims == 0 and not (os.getenv("PYTEST_CURRENT_TEST") or os.getenv("TESTING")):
        try:
            from app.modules.extraction import public as extraction_public
            extraction_public.start_reconstruct(user.project_id)
        except Exception:
            pass
    return result


@router.delete("/sources/connections/{connection_id}")
def delete_connection(
    connection_id: str,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    if not service.can_manage_sources(user.role):
        raise HTTPException(status_code=403, detail="Only the project approver can manage sources.")
    success = public.delete_connection(user.project_id, connection_id, session)
    if not success:
        raise HTTPException(status_code=404, detail="Source connection not found.")
    return {"status": "deleted", "id": connection_id}


@router.post("/sources/connections/{connection_id}/disconnect")
def disconnect_connection(
    connection_id: str,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    if not service.can_manage_sources(user.role):
        raise HTTPException(status_code=403, detail="Only the project approver can disconnect sources.")
    success = public.delete_connection(user.project_id, connection_id, session)
    if not success:
        raise HTTPException(status_code=404, detail="Source connection not found.")
    return {"status": "deleted", "id": connection_id}


@router.post("/sources/connections/{connection_id}/revoke", response_model=SourceConnectionOut)
def revoke_connection(
    connection_id: str,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    if not service.can_manage_sources(user.role):
        raise HTTPException(status_code=403, detail="Only the project approver can revoke sources.")
    conn = service.get_connection(session, user.project_id, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Source connection not found.")
    return public.revoke_connection(user.project_id, connection_id, session)


def _resolve_callback_uri(request: Request, provider: str) -> str:
    """Resolve the OAuth callback redirect URI consistently for authorization and code exchange."""
    prov_key = f"OAUTH_CALLBACK_URL_{provider.upper()}"
    specific = os.environ.get(prov_key) or os.environ.get(f"{provider.upper()}_OAUTH_CALLBACK_URL")
    if specific:
        return specific

    env_callback = os.environ.get("OAUTH_CALLBACK_URL")
    if env_callback:
        if "{provider}" in env_callback:
            return env_callback.format(provider=provider)
        if env_callback.rstrip("/").endswith(f"/sources/oauth/{provider}/callback"):
            return env_callback
        if not env_callback.rstrip("/").endswith("/callback"):
            return f"{env_callback.rstrip('/')}/sources/oauth/{provider}/callback"
        return env_callback

    # Respect reverse-proxy forwarded headers (e.g. Render HTTPS reverse proxy)
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "http"
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or str(request.base_url.netloc)
    return f"{proto}://{host.rstrip('/')}/sources/oauth/{provider}/callback"


@router.post("/sources/connections/{connection_id}/reauthorize", response_model=ReauthorizeResponse)
def reauthorize_connection(
    connection_id: str,
    request: Request,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    if not service.can_manage_sources(user.role):
        raise HTTPException(status_code=403, detail="Only the project approver can reauthorize sources.")
    conn = service.get_connection(session, user.project_id, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Source connection not found.")
    provider = conn["provider"]
    callback_uri = _resolve_callback_uri(request, provider)
    result = public.reauthorize_connection(user.project_id, user.id, connection_id, session, redirect_uri=callback_uri)
    return ReauthorizeResponse(
        authorization_url=result["authorization_url"],
        state=result["state"],
        provider=result["provider"],
    )


@router.post("/sources/connections/{connection_id}/refresh", response_model=SourceConnectionOut)
def refresh_connection(
    connection_id: str,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    if not service.can_manage_sources(user.role):
        raise HTTPException(status_code=403, detail="Only the project approver can refresh source tokens.")
    conn = service.get_connection(session, user.project_id, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Source connection not found.")
    success = public.refresh_connection_token(user.project_id, connection_id, session)
    if not success:
        raise HTTPException(status_code=400, detail="Token refresh failed. Reauthorization required.")
    return service.get_connection(session, user.project_id, connection_id)


# =========================================================================
# OAUTH 2.0 ROUTES (GITHUB APP & JIRA CLOUD 3LO)
# =========================================================================


@router.post("/sources/oauth/{provider}/authorize", response_model=OAuthAuthorizeResponse)
def oauth_authorize(
    provider: str,
    body: OAuthAuthorizeRequest,
    request: Request,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    if provider not in ("github", "jira"):
        raise HTTPException(status_code=400, detail=f"Unsupported OAuth provider: {provider}")
    if body.provider != provider:
        raise HTTPException(
            status_code=422,
            detail=f"Provider mismatch: URL path specifies '{provider}' but request body specifies '{body.provider}'.",
        )
    if not service.can_manage_sources(user.role):
        raise HTTPException(status_code=403, detail="Only the project approver can connect sources.")

    callback_uri = _resolve_callback_uri(request, provider)

    state = crypto.generate_oauth_state(
        session,
        project_id=user.project_id,
        user_id=user.id,
        provider=provider,
        target_name=body.target_name,
        acl_label=body.acl_label,
        redirect_uri=body.redirect_uri or callback_uri,
    )

    if provider == "github":
        auth_url = crypto.build_github_authorize_url(state, callback_uri)
    else:
        auth_url = crypto.build_jira_authorize_url(state, callback_uri)

    return OAuthAuthorizeResponse(
        authorization_url=auth_url,
        state=state,
        provider=provider,
    )


@router.get("/sources/oauth/{provider}/callback")
def oauth_callback(
    provider: str,
    request: Request,
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
    error_description: str | None = Query(None),
    session: Session = Depends(get_session),
):
    if provider not in ("github", "jira"):
        raise HTTPException(status_code=400, detail=f"Unsupported OAuth provider: {provider}")

    frontend_base = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")

    if error:
        err_msg = error_description or error or "OAuth authorization was denied or canceled."
        redirect_url = f"{frontend_base}/sources?oauth=error&provider={provider}&message={urllib.parse.quote(err_msg)}"
        return RedirectResponse(url=redirect_url)

    if not code or not state:
        redirect_url = f"{frontend_base}/sources?oauth=error&provider={provider}&message=Missing%20authorization%20code%20or%20state"
        return RedirectResponse(url=redirect_url)

    callback_uri = _resolve_callback_uri(request, provider)

    try:
        result = public.complete_oauth_flow(
            provider=provider,
            code=code,
            state_token=state,
            session=session,
            redirect_uri=callback_uri,
        )
        conn_id = result["connection_id"]
        target_redirect = result.get("redirect_uri") or f"{frontend_base}/sources"
        if not target_redirect.startswith("http"):
            target_redirect = f"{frontend_base}/sources"
        sep = "&" if "?" in target_redirect else "?"
        success_url = f"{target_redirect}{sep}oauth=success&provider={provider}&connection_id={conn_id}"
        return RedirectResponse(url=success_url)
    except Exception as exc:
        err_msg = str(exc) or "OAuth token exchange failed."
        fail_url = f"{frontend_base}/sources?oauth=error&provider={provider}&message={urllib.parse.quote(err_msg)}"
        return RedirectResponse(url=fail_url)


@router.post("/sources/oauth/{provider}/exchange", response_model=OAuthExchangeResponse)
def oauth_exchange(
    provider: str,
    body: OAuthExchangeRequest,
    request: Request,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    if provider not in ("github", "jira"):
        raise HTTPException(status_code=400, detail=f"Unsupported OAuth provider: {provider}")
    if not service.can_manage_sources(user.role):
        raise HTTPException(status_code=403, detail="Only the project approver can exchange OAuth tokens.")

    callback_uri = _resolve_callback_uri(request, provider)

    try:
        result = public.complete_oauth_flow(
            provider=provider,
            code=body.code,
            state_token=body.state,
            session=session,
            redirect_uri=callback_uri,
        )
        return OAuthExchangeResponse(
            status=result["status"],
            connection_id=result["connection_id"],
            provider=result["provider"],
            target_name=result["target_name"],
            auth_status=result["auth_status"],
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
