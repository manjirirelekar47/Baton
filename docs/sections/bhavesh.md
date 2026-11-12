# Bhavesh — Sources and Risk implementation

Owned modules: ingestion (F1/F2), risk (F6), Sources and Risk frontend features, ingestion/risk tests, source fixtures, and SQL migrations `20_ingestion.sql` / `30_risk.sql`.

## Implemented in this slice

- Approver-only, consent-required source upload for MD, TXT, PDF, DOCX, Git JSON and task CSV; chat JSON remains disabled by default and requires `INGEST_ENABLE_CHAT=true` after Gate 1 passes.
- Upload size and filename validation; L4 is rejected before parsing or storing the uploaded file.
- Secret and contact-information redaction before source chunk persistence.
- Stable chunk identifiers, content hashes, source offsets, author, event time and per-source access labels.
- Project-scoped source inventory and evidence lookup; the ingestion public API applies the existing central ACL before returning chunks.
- Risk uses the ingestion `public.py` contract (never ingestion internals), so ACL filtering happens before any timeline, concentration or task-chain calculation.
- Deterministic timeline, explainable ownership-concentration signals and blocked/overdue task chains, including evidence chunk identifiers. Typed graph relationships cover authorship, PR reviews, imports, task ownership and blocking.
- Sources and Risk pages with upload consent/access controls, loading/error/empty states, signal explanations and evidence references.

## Deliberate scope boundaries

- No edits to frozen contracts, `backend/app/core`, app entrypoint, shared frontend shell or dependency manifests.
- No raw OAuth connector or live GitHub fetch; Git is consumed from an authorised export.
- No arbitrary LLM risk score; risk flags expose their input signals.
- No L4 data is persisted or rendered.

## Validation

- 30 focused backend tests passed on three consecutive runs in an isolated patch harness.
- Python compilation passed.
- SQLite schema validation passed for `10_core.sql`, `20_ingestion.sql` and `30_risk.sql`, including foreign-key inserts and L4 rejection.
- TypeScript/TSX syntax transpilation passed for the Sources and Risk pages and the Risk public type module.

The isolated harness used temporary test shims for frozen `app.core` files; those shims are excluded from the contribution. Full repository CI, a frontend type-check/build and live PostgreSQL/deployed-API testing remain to be run on the actual clone.
