# Bhavesh Sources + Risk patch

Branch target: `feat/bhavesh/sources-risk-core` in `manjirirelekar47/Baton`.

This patch implements Bhavesh's assigned Sources + Risk slice (F1, F2 and F6) and touches only the corresponding owned paths:

- `backend/app/modules/ingestion/**`
- `backend/app/modules/risk/**`
- `backend/tests/ingestion/**`
- `backend/tests/risk/**`
- `db/schema/20_ingestion.sql`
- `db/schema/30_risk.sql`
- `frontend/src/features/sources/pages/**`
- `frontend/src/features/risk/pages/**`
- `frontend/src/features/risk/public.ts`
- `fixtures/sources/**`
- `docs/sections/bhavesh.md`

It does not modify frozen contracts, `backend/app/core`, the application entrypoint, shared frontend shell, package manifests, or another member's folders.

## Integration notes

The existing demo seed (`backend/app/core/demo.py`) creates the project and demo users but does not persist source rows. This patch keeps the existing contract sample evidence available for citations in the seeded Campus Event Portal and adds read-only synthetic fixtures from `fixtures/sources/` for that demo project only. Newly uploaded files are stored in `sources` and `source_chunks` and appear alongside the synthetic fixtures. Other projects never receive demo fixture data.

Chat fixtures remain visible as `skipped` until `INGEST_ENABLE_CHAT=true`, matching the Gate 1 rule. The frontend upload uses multipart `FormData` and intentionally does not set `Content-Type` manually; the browser supplies the boundary.

Source connection is approver-only. Incoming roles can inspect only the source records and chunks allowed by the existing ACL. Risk calls the Ingestion module through `ingestion.public` (not its internal service), so ACL filtering occurs before timeline, concentration, reviewer, or task-chain calculations. The graph builder emits typed `authored`, `reviewed`, `imports`, `owns`, and `blocks` relationships in the shape of the risk migration.

L4 uploads are rejected before parsing, and the database schema independently disallows L4 source/chunk rows. Secret and contact-PII redaction runs before chunks are stored.

## Validation performed

- Focused backend suite: **30 passed**, repeated three consecutive times in an isolated patch harness, including a PDF timestamp regression test.
- Python compilation: passed.
- SQLite schema check: `10_core.sql`, `20_ingestion.sql`, and `30_risk.sql` applied in order; sample source/chunk/graph/risk rows inserted; L4 constraint rejected an insert.
- TypeScript/TSX syntax transpilation: passed for `SourcesPage.tsx`, `RiskPage.tsx`, and `risk/public.ts`.

The patch-only test harness used temporary local shims for frozen `app.core` modules because the full repository checkout was not available in this container. Those shims are not included in the patch. A full repository CI run, frontend type-check/build, and live PostgreSQL/deployed-API test still need to be run after applying the patch to the real clone. Ruff was not available in the environment.

## Apply on your clone

From the repository root, update `main`, create the feature branch, then unzip this patch into the repository root:

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/bhavesh/sources-risk-core
unzip -o /path/to/Baton_Bhavesh_Sources_Risk.zip -d .
git status --short
```

Then run the backend tests and frontend build before committing/pushing.

```bash
cd backend
PYTHONPATH=. pytest -q
cd ../frontend
npm run build
```

Chat JSON remains disabled by default. Enable it only after Gate 1 passes by setting `INGEST_ENABLE_CHAT=true` in the local/runtime environment.
