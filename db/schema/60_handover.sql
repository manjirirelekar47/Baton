-- Owner: Manjiri. Receipts, owner accept or decline, continuation plan. Idempotent and portable.
create table if not exists acknowledgements (
  id text primary key,
  version_id text not null,
  project_id text not null,
  section text not null,
  user_id text not null,
  role text not null,
  acknowledged_at text not null,
  unique (version_id, section, user_id)
);

create table if not exists ownership_responses (
  id text primary key,
  version_id text not null,
  project_id text not null,
  claim_id text not null,
  user_id text not null,
  response text not null check (response in ('accept', 'decline')),
  note text,
  responded_at text not null,
  unique (version_id, claim_id, user_id)
);

-- Materialised per (version, role): only items that role may see are ever stored here.
create table if not exists plan_items (
  id text primary key,
  version_id text not null,
  project_id text not null,
  role text not null,
  bucket text not null check (bucket in ('day_1', 'week_1', 'month_1')),
  position integer not null,
  claim_id text not null,
  kind text not null,
  title text not null,
  payload text not null
);

create index if not exists idx_plan_items_version_role on plan_items (version_id, role);
