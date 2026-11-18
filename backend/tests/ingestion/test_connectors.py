import json
from urllib.request import Request

import pytest

from app.modules.ingestion import connectors


def test_github_connector_imports_commits_pull_requests_and_issues(monkeypatch):
    monkeypatch.setenv("GITHUB_SYNC_TOKEN", "server-only-test-token")
    seen = []

    def fake_load_json(request: Request):
        seen.append(request)
        if "/commits?" in request.full_url:
            return [{
                "sha": "abc123",
                "html_url": "https://github.com/owner/repo/commit/abc123",
                "commit": {
                    "message": "Implement evidence source sync",
                    "author": {"name": "Bhavesh", "date": "2026-11-15T10:00:00Z"},
                },
            }]
        if "/pulls?" in request.full_url:
            return [{
                "number": 12,
                "title": "Add provider sync",
                "html_url": "https://github.com/owner/repo/pull/12",
                "body": "A reviewable integration.",
                "state": "closed",
                "updated_at": "2026-11-15T11:00:00Z",
                "user": {"login": "reviewer"},
            }]
        if "/issues?" in request.full_url:
            return [
                {
                    "number": 34,
                    "title": "Track source sync status",
                    "html_url": "https://github.com/owner/repo/issues/34",
                    "body": "Show provider failures.",
                    "state": "open",
                    "updated_at": "2026-11-15T12:00:00Z",
                    "user": {"login": "maintainer"},
                    "assignee": {"login": "bhavesh"},
                },
                {
                    "number": 35,
                    "title": "Pull request shaped issue",
                    "updated_at": "2026-11-15T12:30:00Z",
                    "pull_request": {"url": "https://api.github.com/pulls/35"},
                },
            ]
        raise AssertionError(f"Unexpected GitHub URL: {request.full_url}")

    monkeypatch.setattr(connectors, "_load_json", fake_load_json)
    records, cursor = connectors.GitHubConnector("owner/repo").fetch_records()

    assert {record.external_id for record in records} == {
        "commit:abc123",
        "pull:12",
        "issue:34",
    }
    assert cursor
    by_id = {record.external_id: record for record in records}
    assert by_id["commit:abc123"].external_url == "https://github.com/owner/repo/commit/abc123"
    assert by_id["pull:12"].external_url == "https://github.com/owner/repo/pull/12"
    assert by_id["issue:34"].external_url == "https://github.com/owner/repo/issues/34"
    assert len(seen) == 3
    assert all(request.get_header("Authorization") == "Bearer server-only-test-token" for request in seen)


def test_github_provider_errors_are_not_replaced_with_demo_records(monkeypatch):
    def fail(_request):
        raise connectors.ProviderSyncError("Provider authentication was rejected.")

    monkeypatch.setattr(connectors, "_load_json", fail)
    with pytest.raises(connectors.ProviderSyncError, match="authentication"):
        connectors.GitHubConnector("owner/repo").fetch_records()


def test_jira_cloud_uses_enhanced_jql_search_basic_auth_and_pagination(monkeypatch):
    monkeypatch.setenv("JIRA_URL", "https://example.atlassian.net")
    monkeypatch.setenv("JIRA_USER_EMAIL", "sync@example.com")
    monkeypatch.setenv("JIRA_API_TOKEN", "jira-test-token")
    requests = []

    def fake_load_json(request: Request):
        requests.append(request)
        payload = json.loads(request.data.decode("utf-8"))
        if "nextPageToken" not in payload:
            return {
                "issues": [{
                    "key": "CAMPUS-1",
                    "fields": {
                        "summary": "First task",
                        "description": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Task details"}]}]},
                        "assignee": {"displayName": "Meera"},
                        "status": {"name": "In Progress"},
                        "updated": "2026-11-15T10:00:00.000+0000",
                    },
                }],
                "nextPageToken": "page-two",
                "isLast": False,
            }
        return {
            "issues": [{
                "key": "CAMPUS-2",
                "fields": {
                    "summary": "Second task",
                    "assignee": None,
                    "status": {"name": "Open"},
                    "updated": "2026-11-15T11:00:00.000+0000",
                },
            }],
            "isLast": True,
        }

    monkeypatch.setattr(connectors, "_load_json", fake_load_json)
    records, cursor = connectors.JiraConnector("CAMPUS").fetch_records("2026-11-14T10:00:00+00:00")

    assert [record.external_id for record in records] == ["jira:CAMPUS-1", "jira:CAMPUS-2"]
    assert "Task details" in records[0].text
    assert records[0].external_url == "https://example.atlassian.net/browse/CAMPUS-1"
    assert records[1].external_url == "https://example.atlassian.net/browse/CAMPUS-2"
    assert cursor
    assert len(requests) == 2
    assert all(request.full_url.endswith("/rest/api/3/search/jql") for request in requests)
    assert all(request.get_header("Authorization").startswith("Basic ") for request in requests)

    first_payload = json.loads(requests[0].data.decode("utf-8"))
    assert first_payload["jql"] == """project = "CAMPUS" AND updated >= '2026-11-14 10:00' ORDER BY updated ASC"""
    second_payload = json.loads(requests[1].data.decode("utf-8"))
    assert second_payload["nextPageToken"] == "page-two"


def test_jira_requires_server_side_credentials(monkeypatch):
    monkeypatch.delenv("JIRA_URL", raising=False)
    monkeypatch.delenv("JIRA_USER_EMAIL", raising=False)
    monkeypatch.delenv("JIRA_API_TOKEN", raising=False)
    with pytest.raises(connectors.ProviderSyncError, match="JIRA_URL"):
        connectors.JiraConnector("CAMPUS")
