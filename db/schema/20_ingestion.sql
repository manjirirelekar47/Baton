-- Owner: Bhavesh. Idempotent. Stores consented source metadata and redacted immutable evidence.
create table if not exists sources (
  id text primary key,
  project_id text not null references projects(id),
  title text not null,
  type text not null check (type in ('document', 'git', 'task_csv', 'chat')),
  acl_label text not null check (acl_label in ('L1', 'L2', 'L3')),
  consent integer not null check (consent = 1),
  status text not null check (status in ('parsed', 'skipped', 'failed')),
  chunks integer not null default 0,
  note text,
  created_at text not null
);

create index if not exists idx_sources_project_created on sources (project_id, created_at);

create table if not exists source_chunks (
  id text primary key,
  project_id text not null references projects(id),
  source_id text not null references sources(id),
  source_type text not null,
  source_title text not null,
  author text not null,
  event_time text not null,
  acl_label text not null check (acl_label in ('L1', 'L2', 'L3')),
  content_hash text not null,
  char_start integer not null check (char_start >= 0),
  char_end integer not null check (char_end >= char_start),
  content text not null
);

create index if not exists idx_chunks_project_acl on source_chunks (project_id, acl_label);
create index if not exists idx_chunks_source on source_chunks (source_id);
create index if not exists idx_chunks_event_time on source_chunks (project_id, event_time);
