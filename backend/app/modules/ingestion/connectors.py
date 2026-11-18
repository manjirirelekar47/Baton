"""Live, read-only source connectors for GitHub and Jira Cloud.

Provider failures are surfaced to the caller; demo data is never substituted for a
failed live sync. Credentials are read only from the API server environment.
"""
from __future__ import annotations

import base64
import json
import logging
import os
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from typing import Any

from app.modules.ingestion.service import ParsedRecord

log = logging.getLogger(__name__)

PAGE_SIZE = 100
MAX_PAGES = 5


class ProviderSyncError(RuntimeError):
    """A provider request failed or the connector is not configured."""


def _parse_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    elif value:
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return datetime(1970, 1, 1, tzinfo=UTC)
    else:
        return datetime(1970, 1, 1, tzinfo=UTC)
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)


def _cursor_datetime(cursor: str | None) -> datetime | None:
    if not cursor:
        return None
    try:
        return _parse_datetime(cursor)
    except (TypeError, ValueError) as exc:
        raise ProviderSyncError("The saved sync checkpoint is invalid. Reconnect the source to reset it.") from exc


def _load_json(request: urllib.request.Request) -> Any:
    """Run one provider request and return JSON without leaking credentials in errors."""
    try:
        ctx = None
        try:
            import certifi
            ctx = ssl.create_default_context(cafile=certifi.where())
        except Exception:
            try:
                ctx = ssl.create_default_context()
            except Exception:
                ctx = None

        with urllib.request.urlopen(request, timeout=20, context=ctx) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403):
            message = "Provider authentication or read permission was rejected. Check the server-side credentials and project access."
        elif exc.code == 404:
            message = "The provider target was not found or is not accessible to the configured account."
        elif exc.code == 429:
            message = "The provider rate limit was reached. Try syncing again later."
        else:
            message = f"Provider request failed with HTTP {exc.code}."
        raise ProviderSyncError(message) from None
    except (urllib.error.URLError, TimeoutError) as exc:
        log.warning("Provider network request failed: %s", type(exc).__name__)
        raise ProviderSyncError("Could not reach the provider. Check the API service network and try again.") from None
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise ProviderSyncError("The provider returned an unreadable response.") from None


def _adf_to_text(value: Any) -> str:
    """Flatten Jira's Atlassian Document Format into readable source text."""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return " ".join(part for part in (_adf_to_text(item) for item in value) if part)
    if isinstance(value, dict):
        own_text = value.get("text") if isinstance(value.get("text"), str) else ""
        children = _adf_to_text(value.get("content", []))
        return " ".join(part for part in (own_text, children) if part)
    return ""


class GitHubConnector:
    """Read-only GitHub repository connector for commits, pull requests and issues."""

    def __init__(self, target_repo: str, token: str | None = None):
        self.target_repo = target_repo.strip()
        self.token = token or os.environ.get("GITHUB_SYNC_TOKEN") or os.environ.get("GITHUB_TOKEN")
        if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", self.target_repo):
            raise ProviderSyncError("GitHub repository must use the owner/repository format.")

    def _get_json(self, url: str) -> Any:
        headers = {
            "User-Agent": "Baton-Ingestion/1.0",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return _load_json(urllib.request.Request(url, headers=headers))

    def _list_records(
        self,
        endpoint: str,
        base_params: dict[str, str],
        checkpoint: datetime | None,
        convert,
        *,
        stop_when_older: bool = True,
    ) -> list[ParsedRecord]:
        records: list[ParsedRecord] = []
        for page in range(1, MAX_PAGES + 1):
            params = {**base_params, "per_page": str(PAGE_SIZE), "page": str(page)}
            url = f"{endpoint}?{urllib.parse.urlencode(params)}"
            payload = self._get_json(url)
            if not isinstance(payload, list):
                raise ProviderSyncError("GitHub returned an unexpected list response.")

            page_has_older = False
            for item in payload:
                record = convert(item)
                if record is None:
                    continue
                if checkpoint and record.event_time <= checkpoint:
                    page_has_older = True
                    continue
                records.append(record)

            if len(payload) < PAGE_SIZE or (checkpoint and stop_when_older and page_has_older):
                break
        else:
            log.warning("GitHub sync reached the %s-page safety limit for %s", MAX_PAGES, endpoint)
        return records

    def fetch_records(self, checkpoint_cursor: str | None = None) -> tuple[list[ParsedRecord], str]:
        """Fetch changed commits, pull requests and issues since the last sync."""
        owner, repo = self.target_repo.split("/", 1)
        checkpoint = _cursor_datetime(checkpoint_cursor)
        since = checkpoint.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ") if checkpoint else None
        root = f"https://api.github.com/repos/{urllib.parse.quote(owner)}/{urllib.parse.quote(repo)}"

        def commit_record(item: dict[str, Any]) -> ParsedRecord | None:
            commit = item.get("commit") or {}
            author = commit.get("author") or {}
            committer = commit.get("committer") or {}
            stamp = author.get("date") or committer.get("date")
            message = str(commit.get("message") or "").strip()
            sha = str(item.get("sha") or "")
            if not sha or not message:
                return None
            name = str(author.get("name") or "Unknown")
            event_time = _parse_datetime(stamp)
            first_line = message.splitlines()[0].strip()
            body = f"GitHub commit {sha[:12]} by {name}:\n{message}"
            return ParsedRecord(body, name, event_time, f"commit:{sha}", title=first_line)

        def pull_record(item: dict[str, Any]) -> ParsedRecord | None:
            number = item.get("number")
            title = str(item.get("title") or "").strip()
            if number is None or not title:
                return None
            user = item.get("user") or {}
            author = str(user.get("login") or "Unknown")
            event_time = _parse_datetime(item.get("updated_at") or item.get("created_at"))
            body_text = str(item.get("body") or "").strip()
            text = (
                f"GitHub pull request #{number}: {title}\n"
                f"State: {item.get('state', 'unknown')} | Author: {author} | Updated: {event_time.isoformat()}"
            )
            if body_text:
                text += f"\nDescription:\n{body_text}"
            return ParsedRecord(text, author, event_time, f"pull:{number}", title=title)

        def issue_record(item: dict[str, Any]) -> ParsedRecord | None:
            # The issues endpoint also returns PR-shaped issues; those are imported by /pulls.
            if item.get("pull_request"):
                return None
            number = item.get("number")
            title = str(item.get("title") or "").strip()
            if number is None or not title:
                return None
            user = item.get("user") or {}
            assignee = item.get("assignee") or {}
            author = str(user.get("login") or "Unknown")
            event_time = _parse_datetime(item.get("updated_at") or item.get("created_at"))
            body_text = str(item.get("body") or "").strip()
            text = (
                f"GitHub issue #{number}: {title}\n"
                f"State: {item.get('state', 'unknown')} | Author: {author} | "
                f"Assignee: {assignee.get('login') or 'Unassigned'} | Updated: {event_time.isoformat()}"
            )
            if body_text:
                text += f"\nDescription:\n{body_text}"
            return ParsedRecord(text, author, event_time, f"issue:{number}", title=title)

        commits_params = {"since": since} if since else {}
        pull_params = {"state": "all", "sort": "updated", "direction": "desc"}
        issue_params = {"state": "all", "sort": "updated", "direction": "desc"}
        if since:
            issue_params["since"] = since

        records = []
        records.extend(self._list_records(f"{root}/commits", commits_params, checkpoint, commit_record))
        records.extend(self._list_records(f"{root}/pulls", pull_params, checkpoint, pull_record))
        records.extend(self._list_records(f"{root}/issues", issue_params, checkpoint, issue_record))
        return records, datetime.now(UTC).isoformat()


class JiraConnector:
    """Read-only Jira Cloud connector using the current enhanced JQL search endpoint."""

    def __init__(
        self,
        target_project: str,
        base_url: str | None = None,
        token: str | None = None,
        email: str | None = None,
        is_oauth: bool = False,
        cloud_id: str | None = None,
    ):
        self.target_project = target_project.strip().upper()
        self.is_oauth = is_oauth
        self.cloud_id = cloud_id

        if not re.fullmatch(r"[A-Z][A-Z0-9_]{1,19}", self.target_project):
            raise ProviderSyncError("Jira project must be a valid project key, such as CAMPUS.")

        if is_oauth and token:
            self.token = token
            self.email = ""
            if cloud_id:
                self.base_url = f"https://api.atlassian.com/ex/jira/{cloud_id}"
            else:
                self.base_url = (base_url or os.environ.get("JIRA_URL", "")).rstrip("/")
        else:
            self.base_url = (base_url or os.environ.get("JIRA_URL", "")).rstrip("/")
            self.email = (email or os.environ.get("JIRA_USER_EMAIL", "")).strip()
            self.token = token or os.environ.get("JIRA_API_TOKEN", "")

        if not self.base_url or (not self.is_oauth and not self.email) or not self.token:
            raise ProviderSyncError(
                "Jira sync is not configured. Set JIRA_URL, JIRA_USER_EMAIL and JIRA_API_TOKEN on the API server, or connect via OAuth."
            )
        parsed = urllib.parse.urlsplit(self.base_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ProviderSyncError("JIRA_URL must be an absolute HTTP(S) URL.")

    def _search_page(self, jql: str, page_token: str | None) -> dict[str, Any]:
        if self.is_oauth:
            headers = {
                "Authorization": f"Bearer {self.token}",
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "Baton-Ingestion/1.0",
            }
        else:
            credentials = base64.b64encode(f"{self.email}:{self.token}".encode("utf-8")).decode("ascii")
            headers = {
                "Authorization": f"Basic {credentials}",
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "Baton-Ingestion/1.0",
            }
        payload: dict[str, Any] = {
            "jql": jql,
            "maxResults": PAGE_SIZE,
            "fields": ["summary", "description", "assignee", "status", "updated"],
        }
        if page_token:
            payload["nextPageToken"] = page_token
        request = urllib.request.Request(
            f"{self.base_url}/rest/api/3/search/jql",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        response = _load_json(request)
        if not isinstance(response, dict):
            raise ProviderSyncError("Jira returned an unexpected search response.")
        return response

    def fetch_records(self, checkpoint_cursor: str | None = None) -> tuple[list[ParsedRecord], str]:
        """Fetch changed Jira issues using enhanced JQL search and nextPageToken pagination."""
        conditions = [f'project = "{self.target_project}"']
        checkpoint = _cursor_datetime(checkpoint_cursor)
        if checkpoint:
            updated_after = checkpoint.astimezone(UTC).strftime("%Y-%m-%d %H:%M")
            conditions.append(f"updated >= '{updated_after}'")
        # JQL clauses must appear before ORDER BY.
        jql = " AND ".join(conditions) + " ORDER BY updated ASC"

        records: list[ParsedRecord] = []
        page_token: str | None = None
        for _page_number in range(MAX_PAGES):
            response = self._search_page(jql, page_token)
            issues = response.get("issues", [])
            if not isinstance(issues, list):
                raise ProviderSyncError("Jira returned an invalid issue list.")

            for issue in issues:
                fields = issue.get("fields") or {}
                key = str(issue.get("key") or "").strip()
                summary = str(fields.get("summary") or "").strip()
                if not key or not summary:
                    continue
                assignee = fields.get("assignee") or {}
                status = fields.get("status") or {}
                author = str(assignee.get("displayName") or "Unassigned")
                event_time = _parse_datetime(fields.get("updated"))
                description = _adf_to_text(fields.get("description"))
                text = (
                    f"Jira issue {key}: {summary}\n"
                    f"Status: {status.get('name') or 'Unknown'} | Assignee: {author} | "
                    f"Updated: {event_time.isoformat()}"
                )
                if description:
                    text += f"\nDescription:\n{description}"
                records.append(ParsedRecord(text, author, event_time, f"jira:{key}", title=summary))

            next_token = response.get("nextPageToken")
            if response.get("isLast") is True or not next_token:
                page_token = None
                break
            page_token = str(next_token)
        else:
            raise ProviderSyncError(
                "Jira returned more than the per-sync page limit. Narrow the update window and sync again."
            )

        return records, datetime.now(UTC).isoformat()
