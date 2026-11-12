# Zero-conflict protocol (Master Guide section 10.4)

1. **One owner per folder.** `.github/CODEOWNERS` maps every path to exactly one person. Nobody edits another member's folder. Need a change there? Open an issue; the owner makes it.
2. **Frozen files:** `contracts/`, `backend/app/core/`, `backend/app/main.py`, `frontend/src/app/`, `frontend/src/shared/`, `.env.example`, `.gitignore`. Change only through a `contract-change` issue. Additive only. Manjiri merges within the day.
3. **Auto-registration.** The backend discovers `app/modules/*/router.py`. The frontend collects `features/*/routes.tsx` and its `nav` entries. Adding a page never touches a shared file.
4. **Dependencies.** Python: `backend/requirements/<module>.txt`. Frontend: only Manjiri edits `package.json` and the lockfile; open a `deps` issue, same-day PR.
5. **Database by file.** No Alembic. Edit only your `db/schema/NN_*.sql`, written idempotently (`create table if not exists`). `core/db.py` applies them in filename order.
6. **Cross-module access only through `public.py` / `public.ts`.** Never read or write another module's tables, never import its internals.
7. **Stubs from Day 0.** Build and test against the stubs.
8. **Env prefixes:** `INGEST_*`, `LLM_*`, `REVIEW_*`, `HANDOVER_*`, declared in `.env.example`.
9. **Own tests, own docs.** Tests in your test folder. Write `docs/sections/<name>.md` for the submission PDF.

## Git workflow

- `main` is protected and always deployable. No direct or force pushes.
- Branch `feat/<name>/<topic>` from latest `main`. Run `git pull --rebase origin main` each day.
- Small PRs (under about 400 changed lines), squash-merged, CI green, one approval from a non-author (the folder owner via CODEOWNERS). Reviewers comment; they never push to the author's branch.
- Commit prefix `[module]`, for example `[verification] add conflict detector`.
- Formatters (ruff, prettier) run only on staged files.
- Cross-review pairs: Manjiri with Samiksha, Bhavesh with Samruddhi.
