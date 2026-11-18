# Bhavesh — Sources and Risk implementation
- Risk timeline events are normalized into readable commit/PR/issue activity with module and author labels, searchable filters and 10-item pagination in both themes.

Owned modules: ingestion (F1/F2), risk (F6), Sources and Risk frontend features, ingestion/risk tests, source fixtures, and SQL migrations `20_ingestion.sql` / `30_risk.sql`.

## Implemented in this slice

- Approver-only, consent-required source upload for MD, TXT, PDF, DOCX, Git JSON and task CSV; chat JSON remains disabled by default and requires `INGEST_ENABLE_CHAT=true` after Gate 1 passes.
- Upload size and filename validation; L4 is rejected before parsing or storing the uploaded file.
- Secret and contact-information redaction before source chunk persistence.
- Stable chunk identifiers, content hashes, source offsets, author, event time and per-source access labels.
- Live-provider provenance is retained per immutable imported snapshot: provider name, stable external object ID, original GitHub/Jira URL, redacted content SHA-256 and provider update timestamp. Source inventory and chunk APIs expose these fields after ACL filtering.
- Project-scoped source inventory and evidence lookup; the ingestion public API applies the existing central ACL before returning chunks.
- Risk uses the ingestion `public.py` contract (never ingestion internals), so ACL filtering happens before any timeline, concentration or task-chain calculation.
- Deterministic timeline, explainable ownership-concentration signals and blocked/overdue task chains, including evidence chunk identifiers. Typed graph relationships cover authorship, PR reviews, imports, task ownership and blocking.
- Sources and Risk pages with upload consent/access controls, loading/error/empty states, signal explanations and evidence references.
- Round 3 Live Source Syncing (GitHub & Jira): read-only provider connectors for commits, pull requests and issues; Jira Cloud enhanced JQL search; server-side provider credentials; API-enforced consent; bounded incremental imports; immutable per-record snapshots; idempotent updates; and ACL-filtered connection status in `/sources`.
- Deterministic Evidence Verification Confidence Grades: Assigns Strong, Partial, or Weak grades based on verbatim citation match quality, provenance, and contradiction detection.
- Trackable Handover Action Plans: Interactive task progress tracking (`not_started`, `in_progress`, `blocked`, `completed`), notes, and dependency resolution.

## Deliberate scope boundaries

- No edits to frozen contracts, `backend/app/core`, app entrypoint, shared frontend shell or dependency manifests.
- Provider credentials are deployment-managed server-side secrets, not entered into the browser. GitHub public repositories can be read without a token; private repositories use a least-privilege `GITHUB_SYNC_TOKEN`. Jira Cloud uses `JIRA_URL`, `JIRA_USER_EMAIL` and `JIRA_API_TOKEN` (Basic authentication). Per-user OAuth installation flows are outside this iteration.
- No arbitrary LLM risk score; risk flags expose their input signals.
- No L4 data is persisted or rendered.

## Validation

- Focused connector tests cover GitHub commit/PR/issue imports, no-fallback failure handling, Jira Cloud enhanced JQL pagination, Basic authentication, authorization consent, ACL filtering and idempotent immutable snapshots. CI results should be recorded from the pull request run before submission.
- Python compilation passed.
- SQLite schema validation passed for `10_core.sql`, `20_ingestion.sql` and `30_risk.sql`, including foreign-key inserts and L4 rejection.
- Round 3 provenance regression coverage verifies GitHub commit/PR/issue URLs, Jira browse URLs, immutable redacted content hashes, and ACL-filtered source metadata.
- TypeScript/TSX syntax transpilation passed for the Sources and Risk pages and the Risk public type module.

The isolated harness used temporary test shims for frozen `app.core` files; those shims are excluded from the contribution. Full repository CI, a frontend type-check/build and live PostgreSQL/deployed-API testing remain to be run on the actual clone.
