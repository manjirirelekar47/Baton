-- Owner: Bhavesh. Deterministic graph and risk output is derived from evidence records.
create table if not exists graph_edges (
  id text primary key,
  project_id text not null references projects(id),
  source_chunk_id text not null references source_chunks(id),
  from_type text not null,
  from_id text not null,
  relation text not null,
  to_type text not null,
  to_id text not null,
  created_at text not null
);

create index if not exists idx_graph_project_from on graph_edges (project_id, from_type, from_id);
create index if not exists idx_graph_project_to on graph_edges (project_id, to_type, to_id);

create table if not exists risk_flags (
  id text primary key,
  project_id text not null references projects(id),
  module text not null,
  person text not null,
  exclusivity real not null check (exclusivity >= 0 and exclusivity <= 1),
  dependents integer not null default 0,
  undocumented_decisions integer not null default 0,
  account_ties integer not null default 0,
  work_in_flight integer not null default 0,
  flagged integer not null default 0,
  reasons_json text not null,
  evidence_chunk_ids_json text not null,
  computed_at text not null
);

create index if not exists idx_risk_flags_project_flagged on risk_flags (project_id, flagged);
