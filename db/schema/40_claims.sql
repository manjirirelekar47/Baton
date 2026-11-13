-- Owner: Samiksha. claims, evidence, gaps, aliases, extraction_jobs.
-- Idempotent and portable (runs on SQLite and PostgreSQL).
-- core/db.py splits on semicolons, so keep semicolons out of string literals.

create table if not exists claims (
  id text primary key,
  project_id text not null references projects(id),
  type text not null check (type in ('decision', 'owner', 'dependency', 'blocker', 'risk', 'recurring_problem', 'open_question', 'contact', 'next_action', 'timeline_event')),
  entity_key text not null,
  attribute text not null,
  statement text not null,
  state text not null check (state in ('verified', 'inferred', 'conflicting', 'missing', 'attested')),
  acl_label text not null check (acl_label in ('L1', 'L2', 'L3')),
  owner text,
  proposed_owner text,
  proposed_owner_id text,
  due_date text,
  blocked_by_json text not null default '[]',
  attested_by text,
  conflict_with_json text not null default '[]',
  created_at text not null,
  updated_at text not null
);

create index if not exists idx_claims_project on claims (project_id);
create index if not exists idx_claims_state on claims (project_id, state);
create index if not exists idx_claims_type on claims (project_id, type);
create index if not exists idx_claims_entity on claims (project_id, entity_key, attribute);

create table if not exists evidence (
  id text primary key,
  claim_id text not null references claims(id) on delete cascade,
  chunk_id text not null,
  quote text not null,
  source_id text,
  source_title text,
  acl_label text check (acl_label in ('L1', 'L2', 'L3')),
  event_time text,
  created_at text not null
);

create index if not exists idx_evidence_claim on evidence (claim_id);
create index if not exists idx_evidence_chunk on evidence (chunk_id);

create table if not exists gaps (
  id text primary key,
  project_id text not null references projects(id),
  question text not null,
  reason text not null,
  asked_to text,
  claim_id text,
  acl_label text not null default 'L1' check (acl_label in ('L1', 'L2', 'L3')),
  created_at text not null
);

create index if not exists idx_gaps_project on gaps (project_id);

create table if not exists aliases (
  id text primary key,
  project_id text not null references projects(id),
  canonical text not null,
  alias text not null,
  created_at text not null
);

create index if not exists idx_aliases_project on aliases (project_id, alias);

create table if not exists extraction_jobs (
  id text primary key,
  project_id text not null references projects(id),
  status text not null check (status in ('pending', 'running', 'done', 'failed')),
  mode text not null check (mode in ('replay', 'llm')),
  progress integer not null default 0,
  note text,
  claims_count integer not null default 0,
  gaps_count integer not null default 0,
  error text,
  created_at text not null,
  updated_at text not null
);

create index if not exists idx_jobs_project on extraction_jobs (project_id, created_at);
