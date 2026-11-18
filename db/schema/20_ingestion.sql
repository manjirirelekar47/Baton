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

create table if not exists source_connections (
  id text primary key,
  project_id text not null references projects(id),
  provider text not null check (provider in ('github', 'jira')),
  target_name text not null,
  acl_label text not null check (acl_label in ('L1', 'L2', 'L3')),
  status text not null check (status in ('connected', 'needs_attention', 'revoked', 'syncing', 'succeeded', 'partial', 'failed')),
  auth_status text not null default 'connected' check (auth_status in ('connected', 'needs_attention', 'revoked')),
  last_synced_at text,
  checkpoint_cursor text,
  records_added integer not null default 0,
  records_updated integer not null default 0,
  records_skipped integer not null default 0,
  error_message text,
  created_at text not null,
  updated_at text not null
);

create index if not exists idx_connections_project on source_connections (project_id);

create table if not exists connection_credentials (
  connection_id text primary key references source_connections(id) on delete cascade,
  project_id text not null references projects(id),
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  token_expires_at text,
  scopes text,
  external_account text,
  created_at text not null,
  updated_at text not null
);

create index if not exists idx_connection_creds_project on connection_credentials (project_id);

create table if not exists oauth_states (
  state text primary key,
  project_id text not null references projects(id),
  user_id text not null,
  provider text not null check (provider in ('github', 'jira')),
  target_name text,
  acl_label text not null default 'L1',
  redirect_uri text,
  created_at text not null,
  expires_at text not null,
  used integer not null default 0
);

create index if not exists idx_oauth_states_expires on oauth_states (expires_at);


-- Maps provider items to their latest immutable evidence snapshots for idempotent sync.
create table if not exists source_sync_records (
  id text primary key,
  project_id text not null references projects(id),
  connection_id text not null references source_connections(id),
  external_id text not null,
  source_id text not null references sources(id),
  content_fingerprint text not null,
  unique (connection_id, external_id)
);

create index if not exists idx_source_sync_records_project on source_sync_records (project_id);


-- Original provider provenance for each immutable imported source snapshot.
create table if not exists source_provenance (
  source_id text primary key references sources(id),
  provider text not null check (provider in ('github', 'jira')),
  external_id text not null,
  external_url text,
  source_hash text not null,
  provider_updated_at text
);

create index if not exists idx_source_provenance_external_id on source_provenance (provider, external_id);
