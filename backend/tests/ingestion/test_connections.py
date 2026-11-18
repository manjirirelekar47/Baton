from datetime import UTC, datetime

from app.modules.ingestion import connectors
from app.modules.ingestion.service import ParsedRecord
from tests.conftest import login


def _record(text: str, external_id: str, external_url: str | None = None) -> ParsedRecord:
    return ParsedRecord(
        text=text,
        author="Baton Test User",
        event_time=datetime(2026, 11, 15, 10, 0, tzinfo=UTC),
        external_id=external_id,
        external_url=external_url,
    )


def test_source_connections_lifecycle(client, monkeypatch):
    # JiraConnector validates deployment configuration at construction time,
    # even when fetch_records is replaced with the deterministic test double.
    monkeypatch.setenv("JIRA_URL", "https://jira.example.test")
    monkeypatch.setenv("JIRA_USER_EMAIL", "baton-tests@example.test")
    monkeypatch.setenv("JIRA_API_TOKEN", "test-only-jira-token")

    approver = login(client, "approver")
    contributor = login(client, "incoming_contributor")

    # Consent is enforced by the API, not only by the browser checkbox.
    missing_consent = client.post(
        "/sources/connections",
        json={"provider": "github", "target_name": "manjirirelekar47/Baton", "acl_label": "L1"},
        headers=approver,
    )
    assert missing_consent.status_code == 422

    # Contributors cannot create provider connections, even with consent.
    res = client.post(
        "/sources/connections",
        json={
            "provider": "github",
            "target_name": "manjirirelekar47/Baton",
            "acl_label": "L1",
            "consent": True,
        },
        headers=contributor,
    )
    assert res.status_code == 403

    github_batches = [
        [_record("Initial commit summary", "commit:abc123", "https://github.com/manjirirelekar47/Baton/commit/abc123")],
        [_record("Initial commit summary", "commit:abc123", "https://github.com/manjirirelekar47/Baton/commit/abc123")],
        [_record("Updated commit summary", "commit:abc123", "https://github.com/manjirirelekar47/Baton/commit/abc123")],
    ]
    jira_batches = [[_record("CAMPUS-101: Transfer project ownership", "jira:CAMPUS-101", "https://example.atlassian.net/browse/CAMPUS-101")]]

    def fake_github_fetch(self, checkpoint_cursor=None):
        return github_batches.pop(0), "2026-11-16T10:00:00+00:00"

    def fake_jira_fetch(self, checkpoint_cursor=None):
        return jira_batches[0], "2026-11-16T10:00:00+00:00"

    monkeypatch.setattr(connectors.GitHubConnector, "fetch_records", fake_github_fetch)
    monkeypatch.setattr(connectors.JiraConnector, "fetch_records", fake_jira_fetch)

    # Approver connects a GitHub repository with an explicit authorization confirmation.
    res = client.post(
        "/sources/connections",
        json={
            "provider": "github",
            "target_name": "manjirirelekar47/Baton",
            "acl_label": "L2",
            "consent": True,
        },
        headers=approver,
    )
    assert res.status_code == 201
    conn_id = res.json()["id"]

    # Restricted connection metadata is not exposed to a lower-clearance contributor.
    approver_connections = client.get("/sources/connections", headers=approver)
    contributor_connections = client.get("/sources/connections", headers=contributor)
    assert approver_connections.status_code == contributor_connections.status_code == 200
    assert any(row["id"] == conn_id for row in approver_connections.json())
    assert all(row["id"] != conn_id for row in contributor_connections.json())

    # First sync imports one provider item.
    first = client.post(f"/sources/connections/{conn_id}/sync", headers=approver)
    assert first.status_code == 200
    assert first.json()["status"] == "succeeded"
    assert first.json()["records_added"] == 1
    assert first.json()["records_updated"] == 0

    # Repeated identical sync is skipped rather than inserting duplicate evidence.
    second = client.post(f"/sources/connections/{conn_id}/sync", headers=approver)
    assert second.status_code == 200
    assert second.json()["records_added"] == 1
    assert second.json()["records_updated"] == 0
    assert second.json()["records_skipped"] == 1

    # A changed provider item creates a new immutable snapshot and increments updates.
    third = client.post(f"/sources/connections/{conn_id}/sync", headers=approver)
    assert third.status_code == 200
    assert third.json()["records_added"] == 1
    assert third.json()["records_updated"] == 1
    assert third.json()["records_skipped"] == 1

    jira_res = client.post(
        "/sources/connections",
        json={
            "provider": "jira",
            "target_name": "CAMPUS",
            "acl_label": "L1",
            "consent": True,
        },
        headers=approver,
    )
    assert jira_res.status_code == 201
    jira_id = jira_res.json()["id"]

    jira_sync = client.post(f"/sources/connections/{jira_id}/sync", headers=approver)
    assert jira_sync.status_code == 200
    assert jira_sync.json()["status"] == "succeeded"
    assert jira_sync.json()["records_added"] == 1

    sources = client.get("/sources", headers=approver).json()
    titles = [source["title"] for source in sources]
    assert any("GitHub: manjirirelekar47/Baton" in title for title in titles)
    assert any("Jira: CAMPUS" in title for title in titles)
    github_source = next(source for source in sources if source["title"].startswith("GitHub:"))
    jira_source = next(source for source in sources if source["title"].startswith("Jira:"))
    assert github_source["external_id"] == "commit:abc123"
    assert github_source["source_url"] == "https://github.com/manjirirelekar47/Baton/commit/abc123"
    assert len(github_source["source_hash"]) == 64
    assert jira_source["source_url"] == "https://example.atlassian.net/browse/CAMPUS-101"

    contributor_sources = client.get("/sources", headers=contributor).json()
    contributor_titles = [source["title"] for source in contributor_sources]
    assert any("Jira: CAMPUS" in title for title in contributor_titles)
    assert not any("GitHub: manjirirelekar47/Baton" in title for title in contributor_titles)
    assert not any(
        source.get("source_url") == "https://github.com/manjirirelekar47/Baton/commit/abc123"
        for source in contributor_sources
    )

    deleted = client.delete(f"/sources/connections/{conn_id}", headers=approver)
    assert deleted.status_code == 200
    assert deleted.json()["status"] == "deleted"
