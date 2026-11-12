# Deployment runbook (Manjiri)

Order: Supabase, then Render (API), then Vercel (web), then CORS.

## 1. Supabase (managed Postgres only)
1. Create a project. Settings, Database, copy the **connection pooling** URI (port 6543 or 5432).
2. Keep it for Render as `DATABASE_URL`. `core/db.py` rewrites `postgres://` and `postgresql://` to the psycopg driver automatically.
3. Free tier pauses idle projects. Open the dashboard before judging to wake it.

## 2. Render (API)
1. New, Blueprint, pick the repo (it reads `infra/render.yaml`), or New Web Service, Docker, Dockerfile path `infra/Dockerfile`, **Docker context `.`** (repo root).
2. Environment: `ENV=production`, `DATABASE_URL`, `JWT_SECRET` (long random), `CORS_ORIGINS` (set after step 3), `LLM_PROVIDER=replay`.
3. Health check path `/health`. Enable auto-deploy from `main`.
4. On start the API applies `db/schema/*.sql` in filename order and seeds the demo project. Nothing else to run.

## 3. Vercel (web)
1. Import the repo. **Root Directory: `frontend`**. Framework: Vite.
2. Copy `frontend_vercel.json` to `frontend/vercel.json` (it is the SPA rewrite; kept here only so the guide's `infra/` layout stays whole).
3. Environment variable `VITE_API_URL` = the Render URL (no trailing slash).
4. Deploy, then set Render `CORS_ORIGINS` to the exact Vercel URL (CORS for the Vercel domain only) and redeploy the API.

## 4. Keep it warm
- GitHub, Settings, Variables, Actions: add `API_URL` = Render URL. `.github/workflows/uptime.yml` pings `/health` every 5 minutes.
- Before judging: open the Supabase dashboard, hit `/health`, run **Reset demo** in the app, then `python infra/smoke_test.py <API_URL>`.

## 5. Release smoke test
`python infra/smoke_test.py https://your-api.onrender.com` runs demo login, Reconstruct (replay mode), open a citation, approve, then the contributor view with a leakage check. `.github/workflows/smoke.yml` runs it after every merge to `main`.

## 6. Fallback if hosting fails
Local run: `docker compose up --build` plus `cd frontend && npm install && npm run dev`. Also keep a recorded walkthrough.

## Secrets
Only in the Render and Vercel dashboards. Never in the repo.
