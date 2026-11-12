"""Shared fixtures. HTTP-level tests run against a throwaway SQLite file, never your dev database."""
import pytest


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    monkeypatch.setenv("ENV", "test")
    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app()) as test_client:
        yield test_client


def login(client, role):
    data = client.post("/auth/demo-login", json={"role": role}).json()
    return {"Authorization": f"Bearer {data['token']}"}
