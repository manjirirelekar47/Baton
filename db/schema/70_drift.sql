-- Source version baselines and alerts. Portable and safe to reapply at startup.
create table if not exists drift_snapshots (
  project_id text not null references projects(id),
  source_key text not null,
  source_id text not null,
  title text not null,
  source_type text not null,
  acl_label text not null check (acl_label in ('L1', 'L2', 'L3')),
  content_hash text not null,
  chunk_count integer not null default 0,
  observed_at text not null,
  primary key (project_id, source_key)
);

create table if not exists drift_alerts (
  id text primary key,
  project_id text not null references projects(id),
  source_key text not null,
  title text not null,
  source_type text not null,
  acl_label text not null check (acl_label in ('L1', 'L2', 'L3')),
  previous_source_id text not null,
  current_source_id text not null,
  previous_hash text not null,
  current_hash text not null,
  previous_chunks integer not null,
  current_chunks integer not null,
  status text not null check (status in ('open', 'resolved')),
  detected_at text not null
);

create index if not exists idx_drift_alerts_project_status on drift_alerts (project_id, status, detected_at);
