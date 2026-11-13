"""Schema tests for db/schema/50_review.sql. Independent of core/db.py."""
import sqlite3
from pathlib import Path

import pytest

from app.modules.review.constants import ReviewAction

SCHEMA = Path(__file__).resolve().parents[3] / "db" / "schema" / "50_review.sql"


def _db() -> sqlite3.Connection:
    con = sqlite3.connect(":memory:")
    con.executescript(SCHEMA.read_text(encoding="utf-8"))
    return con


def _insert_review(con, action: str, rid: str = "r1"):
    con.execute(
        "insert into reviews (id, project_id, claim_id, reviewer_id, reviewer_role, action) "
        "values (?, 'p1', 'c1', 'u1', 'approver', ?)",
        (rid, action),
    )


def test_schema_is_idempotent():
    con = _db()
    con.executescript(SCHEMA.read_text(encoding="utf-8"))


def test_expected_tables_exist():
    con = _db()
    names = {r[0] for r in con.execute("select name from sqlite_master where type='table'")}
    assert {"reviews", "versions", "version_claims", "gap_answers", "review_events"} <= names


@pytest.mark.parametrize("action", list(ReviewAction))
def test_every_enum_action_is_accepted_by_db(action):
    _insert_review(_db(), action.value)


def test_unknown_action_rejected():
    with pytest.raises(sqlite3.IntegrityError):
        _insert_review(_db(), "delete_everything")


def test_duplicate_version_number_rejected():
    con = _db()
    sql = ("insert into versions (id, project_id, version_number, approved_by, snapshot_hash) "
           "values (?, 'p1', 1, 'u1', 'h')")
    con.execute(sql, ("v1",))
    with pytest.raises(sqlite3.IntegrityError):
        con.execute(sql, ("v2",))


def test_same_version_number_allowed_in_different_projects():
    con = _db()
    for pid, vid in (("p1", "v1"), ("p2", "v2")):
        con.execute(
            "insert into versions (id, project_id, version_number, approved_by, snapshot_hash) "
            "values (?, ?, 1, 'u1', 'h')", (vid, pid))


def test_gap_answered_only_once_per_project():
    con = _db()
    sql = ("insert into gap_answers (id, project_id, gap_id, leaver_id, answer_text) "
           "values (?, 'p1', 'g1', 'aarav', 'x')")
    con.execute(sql, ("a1",))
    with pytest.raises(sqlite3.IntegrityError):
        con.execute(sql, ("a2",))
