-- db/schema/50_review.sql  (owner: Samruddhi)
-- Idempotent. Portable across SQLite and PostgreSQL.
-- No foreign keys to other modules' tables (zero-conflict rule 6).

-- Every human decision on a claim. Append-only: rows are never updated.
create table if not exists reviews (
    id            text primary key,
    project_id    text not null,
    claim_id      text not null,
    reviewer_id   text not null,
    reviewer_role text not null,
    action        text not null check (action in (
        'confirm', 'edit', 'reject', 'mark_unknown',
        'ask_leaver', 'resolve_conflict', 'accept_uncertainty'
    )),
    note          text,
    before_json   text,
    after_json    text,
    created_at    timestamp not null default current_timestamp
);
create index if not exists idx_reviews_project_claim
    on reviews (project_id, claim_id);

-- Immutable approved snapshots. Inserted once, never updated.
create table if not exists versions (
    id                         text primary key,
    project_id                 text not null,
    version_number             integer not null,
    approved_by                text not null,
    snapshot_hash              text not null,
    claim_count                integer not null default 0,
    accepted_uncertainty_count integer not null default 0,
    shared_to_roles            text not null default '[]',
    created_at                 timestamp not null default current_timestamp,
    unique (project_id, version_number)
);
create index if not exists idx_versions_project on versions (project_id);

-- Frozen copy of each claim as approved. Role views render from this.
create table if not exists version_claims (
    version_id    text not null references versions (id),
    claim_id      text not null,
    position      integer not null default 0,
    claim_type    text not null,
    state         text not null,
    acl_label     text not null,
    snapshot_json text not null,
    primary key (version_id, claim_id)
);
create index if not exists idx_version_claims_version on version_claims (version_id);

-- Leaver Gap Interview answers (also saved as Attested claims).
create table if not exists gap_answers (
    id               text primary key,
    project_id       text not null,
    gap_id           text not null,
    leaver_id        text not null,
    answer_text      text not null,
    created_claim_id text,
    created_at       timestamp not null default current_timestamp,
    unique (project_id, gap_id)
);

-- Audit trail for everything this module does. Append-only.
create table if not exists review_events (
    id          text primary key,
    project_id  text not null,
    actor_id    text not null,
    actor_role  text not null,
    event_type  text not null,
    object_type text not null,
    object_id   text not null,
    detail_json text not null default '{}',
    created_at  timestamp not null default current_timestamp
);
create index if not exists idx_review_events_project on review_events (project_id, id);
