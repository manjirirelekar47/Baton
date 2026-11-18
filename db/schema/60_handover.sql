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

create table if not exists plan_action_status (
  id text primary key,
  version_id text not null,
  project_id text not null,
  claim_id text not null,
  status text not null check (status in ('not_started', 'in_progress', 'blocked', 'completed')),
  owner text,
  due_date text,
  notes text,
  updated_by text not null,
  updated_at text not null,
  unique (version_id, claim_id)
);

create index if not exists idx_plan_action_status_version on plan_action_status (version_id, claim_id);

create table if not exists handover_tasks (
  id text primary key,
  version_id text not null,
  project_id text not null,
  title text not null,
  kind text not null default 'next_action',
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'blocked', 'completed')),
  owner text,
  due_date text,
  notes text,
  blocked_by text,
  created_by text not null,
  created_at text not null,
  updated_by text not null,
  updated_at text not null
);

create index if not exists idx_handover_tasks on handover_tasks (version_id, project_id);

create table if not exists task_dependencies (
  id text primary key,
  version_id text not null,
  project_id text not null,
  task_id text not null,
  blocked_by_id text not null,
  created_at text not null,
  unique (version_id, task_id, blocked_by_id)
);

create index if not exists idx_task_dependencies on task_dependencies (version_id, task_id);

create table if not exists plan_deleted_tasks (
  id text primary key,
  version_id text not null,
  project_id text not null,
  task_id text not null,
  deleted_by text not null,
  deleted_at text not null,
  unique (version_id, task_id)
);

create table if not exists activity_history (
  id text primary key,
  version_id text not null,
  project_id text not null,
  task_id text not null,
  actor_id text not null,
  actor_name text not null,
  action text not null,
  field text,
  old_value text,
  new_value text,
  created_at text not null
);

create index if not exists idx_activity_history on activity_history (version_id, task_id, created_at);
