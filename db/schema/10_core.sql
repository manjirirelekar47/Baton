-- Owner: Manjiri. Idempotent. Portable SQL (runs on Postgres and SQLite). Timestamps are ISO-8601 UTC text.
-- core/db.py splits on semicolons, so keep semicolons out of string literals.
create table if not exists projects (
  id text primary key,
  name text not null,
  owner_id text,
  created_at text not null
);

create table if not exists members (
  id text primary key,
  project_id text not null references projects(id),
  name text not null,
  role text not null check (role in ('approver', 'leaver', 'incoming_maintainer', 'incoming_contributor')),
  active integer not null default 1,
  email text,
  is_demo integer not null default 0
);

create table if not exists invitations (
  id text primary key,
  project_id text references projects(id),
  code text unique not null,
  role text not null check (role in ('approver', 'leaver', 'incoming_maintainer', 'incoming_contributor')),
  email text,
  status text not null default 'active',
  created_at text not null,
  used_by text,
  used_at text
);

create index if not exists idx_invitations_code on invitations (code);

create table if not exists identity_mappings (
  supabase_sub text primary key,
  member_id text not null,
  project_id text not null,
  role text not null check (role in ('approver', 'leaver', 'incoming_maintainer', 'incoming_contributor')),
  email text,
  created_at text not null,
  updated_at text not null
);

create index if not exists idx_identity_mappings_member on identity_mappings (member_id);
create index if not exists idx_identity_mappings_project on identity_mappings (project_id);

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
