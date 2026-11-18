-- Owner: Architecture Team. Portable SQL (Postgres & SQLite).
-- Idempotent schema evolution from single-project to multi-project.

-- 1. Canonical users table
create table if not exists users (
  id text primary key,
  email text,
  name text not null,
  is_demo integer not null default 0,
  created_at text not null
);

create unique index if not exists idx_users_email_unique on users (lower(email)) where email is not null;
create index if not exists idx_users_demo on users (is_demo);

-- 2. Backfill users table from legacy members (preserving existing users)
insert into users (id, email, name, is_demo, created_at)
select 
  m.id,
  m.email,
  m.name,
  coalesce(m.is_demo, 0),
  coalesce(p.created_at, '2026-01-01T00:00:00Z')
from members m
left join projects p on p.id = m.project_id
where not exists (
  select 1 from users u where u.id = m.id
);

-- 3. Project memberships with composite primary key (user_id, project_id)
create table if not exists project_memberships (
  user_id text not null references users(id),
  project_id text not null references projects(id),
  role text not null check (role in ('approver', 'leaver', 'incoming_maintainer', 'incoming_contributor')),
  active integer not null default 1,
  created_at text not null,
  primary key (user_id, project_id)
);

create index if not exists idx_memberships_project on project_memberships (project_id);
create index if not exists idx_memberships_active_role on project_memberships (project_id, role, active);
create index if not exists idx_memberships_user on project_memberships (user_id);

-- 4. Backfill project_memberships from legacy members
insert into project_memberships (user_id, project_id, role, active, created_at)
select 
  m.id as user_id,
  m.project_id as project_id,
  m.role as role,
  coalesce(m.active, 1) as active,
  coalesce(p.created_at, '2026-01-01T00:00:00Z') as created_at
from members m
join projects p on p.id = m.project_id
where not exists (
  select 1 from project_memberships pm 
  where pm.user_id = m.id and pm.project_id = m.project_id
);

-- 5. Multi-stage correlation of legacy invitations
-- 5a. If invitation was redeemed, bind to the redeemer's recorded project
update invitations
set project_id = (
  select m.project_id 
  from members m 
  where m.id = invitations.used_by
)
where project_id is null and used_by is not null;

-- 5b. Recover project_id from audit log where action = 'auth.create_invitation'
update invitations
set project_id = (
  select a.project_id 
  from audit_log a 
  where a.action = 'auth.create_invitation' 
    and a.object = invitations.id 
    and a.project_id is not null
  limit 1
)
where project_id is null;

-- 5c. For unredeemed legacy invitations created when only the default demo project existed
update invitations
set project_id = 'proj-campus-event-portal'
where project_id is null 
  and status = 'active'
  and (select count(*) from projects) = 1
  and exists (select 1 from projects where id = 'proj-campus-event-portal');

-- 5d. Mark ambiguous invitations for review rather than blindly revoking
update invitations
set status = 'pending_migration_review'
where project_id is null;

create index if not exists idx_invitations_project_code on invitations (project_id, code);
