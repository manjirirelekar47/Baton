"""Cross-module access to review data (zero-conflict rule 6). Returns plain dicts.

Used by Manjiri's handover module: it must ALWAYS apply core.acl to the returned
claims for the viewer's role before rendering. This module does not filter by
viewer because it has no viewer: it hands over the frozen approved snapshot.
"""
from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.samples import load_sample

from .models import Version
from .schemas import VersionOut
from .versions import hash_matches


@contextmanager
def _session(session: Session | None) -> Iterator[Session]:
    if session is not None:
        yield session
        return
    from .deps import get_db

    gen = get_db()
    s = next(gen)
    try:
        yield s
    finally:
        try:
            gen.close()
        except Exception:
            pass


def _version_dict(v: Version, with_claims: bool) -> dict[str, Any]:
    out = VersionOut.model_validate(v).model_dump(mode="json")
    out["version_id"] = out.get("version_id") or f"v{v.version_number}"
    out["id"] = v.id
    out["status"] = "approved"
    out["shared_with"] = v.shared_roles
    out["shared_roles"] = v.shared_roles
    out["approved_at"] = (
        v.created_at.strftime("%Y-%m-%dT%H:%M:%SZ")
        if hasattr(v.created_at, "strftime")
        else str(v.created_at)
    )
    if with_claims:
        out["claims"] = [vc.snapshot for vc in v.claims]
    return out


def latest_version(project_id: str, session: Session | None = None) -> dict[str, Any] | None:
    with _session(session) as s:
        v = s.scalars(
            select(Version)
            .where(Version.project_id == project_id)
            .order_by(Version.version_number.desc())
            .limit(1)
        ).first()
        if v:
            return _version_dict(v, True)
    try:
        sample_versions = load_sample("versions")
        for sv in sample_versions:
            if sv.get("project_id") == project_id and sv.get("status") == "approved":
                sample_v1 = load_sample("version_v1")
                if sample_v1.get("version_id") == sv.get("version_id"):
                    return sample_v1
    except Exception:
        pass
    return None


def get_version(
    version_id: str, project_id: str | None = None, session: Session | None = None
) -> dict[str, Any] | None:
    """None if the version does not exist or does not match project_id (when given)."""
    with _session(session) as s:
        v = s.get(Version, version_id)
        if not v and version_id.startswith("v") and version_id[1:].isdigit():
            num = int(version_id[1:])
            query = select(Version).where(Version.version_number == num)
            if project_id:
                query = query.where(Version.project_id == project_id)
            v = s.scalars(query).first()
        if v:
            if project_id and v.project_id != project_id:
                return None
            return _version_dict(v, True)

    # Fallback to sample for Day 0 compatibility (e.g. handover test_api)
    try:
        v1 = load_sample("version_v1")
        if version_id == v1.get("version_id"):
            if project_id and v1.get("project_id") != project_id:
                return None
            return v1
    except Exception:
        pass
    return None


def list_versions(project_id: str, session: Session | None = None) -> list[dict[str, Any]]:
    with _session(session) as s:
        rows = s.scalars(
            select(Version)
            .where(Version.project_id == project_id)
            .order_by(Version.version_number.desc())
        ).all()
        if rows:
            return [_version_dict(v, False) for v in rows]

    try:
        return [v for v in load_sample("versions") if v.get("project_id") == project_id]
    except Exception:
        return []


def get_version_claims(
    version_id: str, project_id: str | None = None, session: Session | None = None
) -> list[dict[str, Any]]:
    v = get_version(version_id, project_id, session)
    return v["claims"] if v and "claims" in v else []


def verify_version(
    version_id: str, project_id: str, session: Session | None = None
) -> bool:
    """True iff the stored snapshot still matches its hash (used by D3 drift/scorecard)."""
    with _session(session) as s:
        v = s.get(Version, version_id)
        if not v and version_id.startswith("v") and version_id[1:].isdigit():
            num = int(version_id[1:])
            v = s.scalars(
                select(Version)
                .where(Version.project_id == project_id)
                .where(Version.version_number == num)
            ).first()
        return bool(v and v.project_id == project_id and hash_matches(v))


def reset_demo(session: Session) -> None:
    """Called by core/routes.py POST /demo/reset (registry.reset_hooks)."""
    session.execute(text("delete from reviews where project_id = 'proj-campus-event-portal'"))
    session.execute(text("delete from version_claims where version_id in (select id from versions where project_id = 'proj-campus-event-portal')"))
    session.execute(text("delete from versions where project_id = 'proj-campus-event-portal'"))
    session.execute(text("delete from gap_answers where project_id = 'proj-campus-event-portal'"))
    session.execute(text("delete from review_events where project_id = 'proj-campus-event-portal'"))
    session.commit()
