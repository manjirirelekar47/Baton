-- Owner: Manjiri. Idempotent. Portable SQL (runs on Postgres and SQLite). Timestamps are ISO-8601 UTC text.
-- core/db.py splits on semicolons, so keep semicolons out of string literals.
create table if not exists projects (
  id text primary key,
  name text not null,
  created_at text not null
);

create table if not exists members (
  id text primary key,
  project_id text not null references projects(id),
  name text not null,
  role text not null check (role in ('approver', 'leaver', 'incoming_maintainer', 'incoming_contributor')),
  active integer not null default 1
);

create table if not exists audit_log (
  id text primary key,
  project_id text,
  actor_id text,
  role text,
  action text not null,
  object text,
  detail text,
  created_at text not null
);

create index if not exists idx_audit_project_time on audit_log (project_id, created_at);
