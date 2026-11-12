# Baton

Evidence-linked, permission-aware knowledge handover. Team Modak_v21, Round 2 prototype.

Every claim has a verified quote, an honesty label (Verified, Inferred, Conflicting, Missing, Attested) and an access level (L1 to L4). A human approves it, and the incoming person sees a role-filtered view with a Day-1 / Week-1 / Month-1 plan.

## Run locally (two commands each)

```bash
# API (SQLite by default, no setup needed)
cd backend && pip install -r requirements.txt -r requirements/dev.txt && uvicorn app.main:app --reload

# Web
cd frontend && npm install && npm run dev
```

Or everything at once: `docker compose up --build` (API on :8000, Postgres on :5432). Then start the web app as above.

Open http://localhost:5173. The first visit signs you in as the Approver automatically; use the role switcher in the header to become Meera, the Incoming Contributor, and so on. **Reset demo** restores the Campus Event Portal project.

## Where things live (one owner per folder, see .github/CODEOWNERS)

| Owner | Slice |
|---|---|
| Manjiri | `backend/app/core`, `backend/app/main.py`, `contracts/`, `infra/`, CI, `modules/handover`, `features/handover` |
| Bhavesh | `modules/ingestion`, `modules/risk`, `features/sources`, `features/risk`, `fixtures/sources` |
| Samiksha | `modules/extraction`, `modules/verification`, `features/ledger`, `fixtures/expected`, `fixtures/replay` |
| Samruddhi | `modules/review`, `features/review`, `tests/e2e` |

Read `CONTRIBUTING.md` for the zero-conflict rules. Short version: edit only your folders, talk to other modules only through `public.py` / `public.ts`, changes to frozen files go through a `contract-change` issue.

## Stubs

Every `public.py` and `public.ts` ships as a stub that returns the sample JSON in `contracts/samples/`. Build against the stubs; when an owner finishes the real version, consumers get real data with no code change.

## AI assistance and libraries

Disclose in the submission: the model ID used for extraction (`LLM_MODEL`), AI assistance used for coding, and the libraries in `backend/requirements/*.txt` and `frontend/package.json`.
