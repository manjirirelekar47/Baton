"""Test running migrations on a copy of existing baton_dev.db twice to verify safety, data preservation, and idempotence."""
import shutil
import sqlite3
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]
SCHEMA_DIR = ROOT_DIR / "db" / "schema"


def _create_representative_legacy_db(db_path: Path) -> None:
    """Create a representative pre-migration legacy database with demo accounts, users, invitations, and domain data."""
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA foreign_keys = OFF")

    conn.executescript("""
        create table projects (
            id text primary key,
            name text not null,
            created_at text not null
        );

        create table members (
            id text primary key,
            project_id text references projects(id),
            name text not null,
            role text not null check (role in ('approver', 'leaver', 'incoming_maintainer', 'incoming_contributor')),
            active integer not null default 1,
            email text,
            is_demo integer not null default 0
        );

        create table invitations (
            id text primary key,
            code text not null unique,
            role text not null,
            email text,
            status text not null,
            used_by text references members(id),
            used_at text,
            created_at text not null
        );

        create table claims (
            id text primary key,
            project_id text not null references projects(id),
            statement text not null,
            status text not null,
            created_at text not null
        );

        create table handover_tasks (
            id text primary key,
            project_id text not null references projects(id),
            title text not null,
            state text not null,
            created_at text not null
        );

        create table audit_log (
            id text primary key,
            project_id text,
            actor_id text,
            role text,
            action text not null,
            object text,
            detail text,
            created_at text not null
        );
    """)

    # Populate legacy project
    conn.execute(
        "insert into projects (id, name, created_at) values (?, ?, ?)",
        ("proj-campus-event-portal", "Campus Event Portal", "2026-01-01T00:00:00Z"),
    )

    # Populate legacy members (4 demo accounts + 1 registered user)
    members_data = [
        ("mem-approver-demo", "proj-campus-event-portal", "Sarah Chen (Approver)", "approver", 1, "approver@demo.local", 1),
        ("mem-leaver-demo", "proj-campus-event-portal", "Alex Rivera (Leaver)", "leaver", 1, "leaver@demo.local", 1),
        ("mem-maintainer-demo", "proj-campus-event-portal", "Priya Sharma (Maintainer)", "incoming_maintainer", 1, "maintainer@demo.local", 1),
        ("mem-contributor-demo", "proj-campus-event-portal", "Marcus Vance (Contributor)", "incoming_contributor", 1, "contributor@demo.local", 1),
        ("mem-real-user", "proj-campus-event-portal", "Samiksha Lead", "approver", 1, "samiksha@example.com", 0),
    ]
    conn.executemany(
        "insert into members (id, project_id, name, role, active, email, is_demo) values (?, ?, ?, ?, ?, ?, ?)",
        members_data,
    )

    # Populate legacy invitations (unredeemed active + redeemed used)
    invitations_data = [
        ("inv-legacy-active", "INV-APPROVER-12345678", "approver", "lead-invitee@test.com", "active", None, None, "2026-01-01T00:00:00Z"),
        ("inv-legacy-used", "INV-LEAVER-87654321", "leaver", "alex@demo.local", "used", "mem-leaver-demo", "2026-01-02T00:00:00Z", "2026-01-01T00:00:00Z"),
    ]
    conn.executemany(
        "insert into invitations (id, code, role, email, status, used_by, used_at, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
        invitations_data,
    )

    # Populate domain data (claims and handover tasks)
    claims_data = [
        ("c-001", "proj-campus-event-portal", "Authentication is handled via JWT tokens.", "verified", "2026-01-01T00:00:00Z"),
        ("c-002", "proj-campus-event-portal", "Payments module uses Stripe integration.", "verified", "2026-01-01T00:00:00Z"),
    ]
    conn.executemany(
        "insert into claims (id, project_id, statement, status, created_at) values (?, ?, ?, ?, ?)",
        claims_data,
    )

    tasks_data = [
        ("t-001", "proj-campus-event-portal", "Verify database credentials handover", "pending", "2026-01-01T00:00:00Z"),
    ]
    conn.executemany(
        "insert into handover_tasks (id, project_id, title, state, created_at) values (?, ?, ?, ?, ?)",
        tasks_data,
    )

    conn.commit()
    conn.close()


def test_migration_on_copy_of_baton_dev_db(tmp_path):
    # Locate existing baton_dev.db or create a representative temporary legacy database fixture
    src_db = ROOT_DIR / "baton_dev.db"
    if not src_db.exists():
        src_db = ROOT_DIR / "backend" / "baton_dev.db"

    if not src_db.exists():
        src_db = tmp_path / "legacy_baton_dev.db"
        _create_representative_legacy_db(src_db)

    assert src_db.exists(), f"Could not find or create legacy database at {src_db}"

    # 1. Create a temporary copy (NEVER mutate the source database)
    test_db = tmp_path / "baton_dev_test_copy.db"
    shutil.copy2(src_db, test_db)
    assert test_db.exists()

    conn = sqlite3.connect(str(test_db))
    conn.row_factory = sqlite3.Row

    # 2. Inspect initial pre-migration state
    initial_tables = [r[0] for r in conn.execute("select name from sqlite_master where type='table'").fetchall()]

    pre_members = conn.execute("select * from members").fetchall() if "members" in initial_tables else []
    pre_claims = conn.execute("select count(*) from claims").fetchone()[0] if "claims" in initial_tables else 0
    pre_tasks = conn.execute("select count(*) from handover_tasks").fetchone()[0] if "handover_tasks" in initial_tables else 0

    assert len(pre_members) > 0, "legacy database should contain members"
    conn.close()

    # Read migration scripts
    script_10 = (SCHEMA_DIR / "10_core.sql").read_text(encoding="utf-8")
    script_15 = (SCHEMA_DIR / "15_multiproject.sql").read_text(encoding="utf-8")

    def run_migration_pass(db_path):
        from app.core.db import _ensure_columns, _preflight_check

        c = sqlite3.connect(str(db_path))
        c.row_factory = sqlite3.Row
        _preflight_check(c)
        _ensure_columns(c)
        c.executescript(script_10)
        c.executescript(script_15)
        c.commit()
        c.close()

    # 3. FIRST MIGRATION PASS
    run_migration_pass(test_db)

    # Verify first pass
    conn = sqlite3.connect(str(test_db))
    conn.row_factory = sqlite3.Row

    users_pass1 = conn.execute("select * from users").fetchall()
    memberships_pass1 = conn.execute("select * from project_memberships").fetchall()
    invitations_pass1 = conn.execute("select * from invitations").fetchall()
    claims_pass1 = conn.execute("select count(*) from claims").fetchone()[0] if "claims" in initial_tables else 0
    tasks_pass1 = conn.execute("select count(*) from handover_tasks").fetchone()[0] if "handover_tasks" in initial_tables else 0

    # Ensure all original members are migrated to users and project_memberships
    assert len(users_pass1) >= len(pre_members)
    assert len(memberships_pass1) >= len(pre_members)
    assert claims_pass1 == pre_claims
    assert tasks_pass1 == pre_tasks

    # Verify demo accounts are preserved
    demo_roles = {r["role"] for r in memberships_pass1 if r["project_id"] == "proj-campus-event-portal"}
    assert {"approver", "leaver", "incoming_maintainer", "incoming_contributor"}.issubset(demo_roles)

    # Verify invitations are preserved and have project_id assigned
    for inv in invitations_pass1:
        assert inv["project_id"] is not None

    conn.close()

    # 4. SECOND MIGRATION PASS (Verifies idempotence)
    run_migration_pass(test_db)

    # Verify second pass produces identical results without duplication
    conn = sqlite3.connect(str(test_db))
    conn.row_factory = sqlite3.Row

    users_pass2 = conn.execute("select * from users").fetchall()
    memberships_pass2 = conn.execute("select * from project_memberships").fetchall()
    claims_pass2 = conn.execute("select count(*) from claims").fetchone()[0] if "claims" in initial_tables else 0
    tasks_pass2 = conn.execute("select count(*) from handover_tasks").fetchone()[0] if "handover_tasks" in initial_tables else 0

    assert len(users_pass2) == len(users_pass1)
    assert len(memberships_pass2) == len(memberships_pass1)
    assert claims_pass2 == pre_claims
    assert tasks_pass2 == pre_tasks

    conn.close()


def test_migration_on_representative_legacy_fixture(tmp_path):
    """Explicitly verify that a fresh representative legacy fixture is safely evolved and idempotent across two passes."""
    fixture_db = tmp_path / "fixture_legacy.db"
    _create_representative_legacy_db(fixture_db)

    test_db = tmp_path / "fixture_test_copy.db"
    shutil.copy2(fixture_db, test_db)

    script_10 = (SCHEMA_DIR / "10_core.sql").read_text(encoding="utf-8")
    script_15 = (SCHEMA_DIR / "15_multiproject.sql").read_text(encoding="utf-8")

    def run_pass(db_path):
        from app.core.db import _ensure_columns, _preflight_check

        c = sqlite3.connect(str(db_path))
        c.row_factory = sqlite3.Row
        _preflight_check(c)
        _ensure_columns(c)
        c.executescript(script_10)
        c.executescript(script_15)
        c.commit()
        c.close()

    # Pass 1
    run_pass(test_db)
    conn = sqlite3.connect(str(test_db))
    conn.row_factory = sqlite3.Row
    users1 = conn.execute("select * from users").fetchall()
    memberships1 = conn.execute("select * from project_memberships").fetchall()
    invitations1 = conn.execute("select * from invitations").fetchall()
    assert len(users1) >= 5
    assert len(memberships1) >= 5
    for inv in invitations1:
        assert inv["project_id"] is not None
    conn.close()

    # Pass 2
    run_pass(test_db)
    conn = sqlite3.connect(str(test_db))
    conn.row_factory = sqlite3.Row
    users2 = conn.execute("select * from users").fetchall()
    memberships2 = conn.execute("select * from project_memberships").fetchall()
    assert len(users2) == len(users1)
    assert len(memberships2) == len(memberships1)
    conn.close()
