from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import FastAPI, Header
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.modules.review import deps
from app.modules.review.actor import Actor
from app.modules.review.router import router

from .fakes import FakeClaims, seed

SCHEMA = Path(__file__).resolve().parents[3] / "db" / "schema" / "50_review.sql"


@pytest.fixture()
def engine():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    raw = eng.raw_connection()
    raw.executescript(SCHEMA.read_text(encoding="utf-8"))
    raw.commit()
    return eng


@pytest.fixture()
def Session(engine):
    return sessionmaker(engine, expire_on_commit=False)


@pytest.fixture()
def fake():
    f = FakeClaims()
    seed(f, "p1")
    seed(f, "p2")          # a second project with identical ids (cross-project tests)
    return f


@pytest.fixture()
def app(Session, fake):
    app = FastAPI()
    app.include_router(router)

    def _db():
        s = Session()
        try:
            yield s
        finally:
            s.close()

    def _actor(
        x_role: str = Header("approver"),
        x_project: str = Header("p1"),
        x_user: str = Header("meera-approver"),
    ):
        return Actor(user_id=x_user, role=x_role, project_id=x_project)

    app.dependency_overrides[deps.get_db] = _db
    app.dependency_overrides[deps.get_actor] = _actor
    app.dependency_overrides[deps.get_claims] = lambda: fake
    return app


@pytest.fixture()
def client(app):
    return TestClient(app)


def H(role="approver", project="p1", user=None):
    return {"x-role": role, "x-project": project, "x-user": user or f"{role}-u"}


@pytest.fixture()
def act(client):
    def _act(claim_id, action, role="approver", project="p1", **body):
        return client.post(
            f"/review/{claim_id}/action",
            json={"action": action, **body},
            headers=H(role, project),
        )
    return _act


@pytest.fixture()
def ready_project(client, act):
    """Drive p1 to the state where the approval gate is open."""
    assert act("c-pay-A", "resolve_conflict", chosen_claim_id="c-pay-B", note="newer + git").status_code == 200
    assert act("c-staging", "accept_uncertainty", note="known, will verify").status_code == 200
    assert client.post("/review/confirm-verified", headers=H()).status_code == 200
    return client
