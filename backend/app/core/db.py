"""Database session and schema runner. FROZEN after Day 0."""
import re
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.core.config import get_settings


@lru_cache
def _engine_for(url: str) -> Engine:
    kwargs: dict = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    return create_engine(url, **kwargs)


def get_engine() -> Engine:
    return _engine_for(get_settings().database_url)


def get_session():
    with Session(get_engine()) as session:
        yield session


def _statements(sql: str) -> list[str]:
    no_comments = "\n".join(line for line in sql.splitlines() if not line.strip().startswith("--"))
    return [s.strip() for s in no_comments.split(";") if s.strip()]


def _preflight_check(conn) -> None:
    """Preflight check: verify no conflicting duplicate emails across distinct member identities."""
    sql = (
        "select lower(trim(email)) as em, count(distinct id) as cnt "
        "from members where email is not null and trim(email) != '' "
        "group by lower(trim(email)) having count(distinct id) > 1"
    )
    try:
        if hasattr(conn, "exec_driver_sql"):
            rows = conn.exec_driver_sql(sql).mappings().all()
            conflicts = [r["em"] for r in rows]
        else:
            cur = conn.cursor()
            cur.execute(sql)
            rows = cur.fetchall()
            conflicts = [r[0] if isinstance(r, (tuple, list)) else r["em"] for r in rows]

        if conflicts:
            raise RuntimeError(
                f"Multi-project migration aborted: duplicate email(s) across distinct user IDs: {conflicts}. "
                "Administrative resolution required. Identities will not be merged automatically."
            )
    except Exception as exc:
        if "no such table" in str(exc).lower() or "does not exist" in str(exc).lower():
            pass
        elif isinstance(exc, RuntimeError):
            raise
        else:
            pass


def _ensure_columns(conn) -> None:
    """Ensure required columns exist on legacy tables before scripts run."""
    def _exec(sql: str) -> None:
        if hasattr(conn, "exec_driver_sql"):
            conn.exec_driver_sql(sql)
        else:
            conn.execute(sql)

    try:
        _exec("alter table projects add column owner_id text")
    except Exception:
        pass
    try:
        _exec("alter table members add column email text")
    except Exception:
        pass
    try:
        _exec("alter table members add column is_demo integer not null default 0")
    except Exception:
        pass
    try:
        _exec("alter table invitations add column project_id text references projects(id)")
    except Exception:
        pass


def apply_schema(engine: Engine | None = None) -> list[str]:
    """Apply db/schema/*.sql in filename order. Every file is idempotent, so this is safe on every start."""
    engine = engine or get_engine()
    applied = []
    with engine.begin() as conn:
        _preflight_check(conn)
        _ensure_columns(conn)

    for path in sorted(get_settings().schema_dir.glob("*.sql")):
        with engine.begin() as conn:
            _ensure_columns(conn)
            for statement in _statements(path.read_text(encoding="utf-8")):
                conn.exec_driver_sql(statement)
        applied.append(path.name)
    # Ensure backward compatibility for existing databases where members already existed
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql("alter table members add column email text")
    except Exception:
        pass
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql("alter table members add column is_demo integer not null default 0")
    except Exception:
        pass
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql(
                "create table if not exists identity_mappings ("
                "  supabase_sub text primary key,"
                "  member_id text not null,"
                "  project_id text not null,"
                "  role text not null check (role in ('approver', 'leaver', 'incoming_maintainer', 'incoming_contributor')),"
                "  email text,"
                "  created_at text not null,"
                "  updated_at text not null"
                ")"
            )
    except Exception:
        pass
    return applied


def is_safe_identifier(name: str) -> bool:
    return re.fullmatch(r"[a-z_][a-z0-9_]*", name) is not None
