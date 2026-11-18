"""PUBLIC API of the verification module. Other modules import only from here."""
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.audit import now_iso
from app.core.db import get_engine
from app.modules.verification import service


def _get_active_session(session: Session | None) -> tuple[Session, bool]:
    if session is not None:
        return session, False
    return Session(get_engine()), True


def list_claims(project_id: str, session: Session | None = None) -> list[dict[str, Any]]:
    sess, should_close = _get_active_session(session)
    try:
        return service.list_claims(sess, project_id)
    finally:
        if should_close:
            sess.close()


def get_claim(project_id: str, claim_id: str, session: Session | None = None) -> dict[str, Any] | None:
    sess, should_close = _get_active_session(session)
    try:
        return service.get_claim(sess, project_id, claim_id)
    finally:
        if should_close:
            sess.close()


def list_gaps(project_id: str, session: Session | None = None) -> list[dict[str, Any]]:
    sess, should_close = _get_active_session(session)
    try:
        return service.list_gaps(sess, project_id)
    finally:
        if should_close:
            sess.close()


def reverify(project_id: str, claim_data: dict[str, Any], session: Session | None = None) -> dict[str, Any]:
    sess, should_close = _get_active_session(session)
    try:
        return service.reverify(sess, project_id, claim_data)
    finally:
        if should_close:
            sess.close()


def verify_and_save_collection(
    project_id: str,
    raw_claims: list[dict[str, Any]],
    session: Session | None = None,
    fuzzy_threshold: float = service.DEFAULT_FUZZY_THRESHOLD,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    sess, should_close = _get_active_session(session)
    try:
        verified_claims, gaps = service.verify_all_claims(sess, project_id, raw_claims, fuzzy_threshold=fuzzy_threshold)
        service.persist_claims_and_gaps(sess, project_id, verified_claims, gaps)
        return verified_claims, gaps
    finally:
        if should_close:
            sess.close()


def resolve_conflict(
    project_id: str,
    chosen_claim_id: str,
    other_claim_ids: list[str],
    resolved_by: str,
    session: Session | None = None,
) -> dict[str, Any]:
    sess, should_close = _get_active_session(session)
    try:
        now = now_iso()
        sess.execute(
            text("""
                update claims
                set state = 'verified', conflict_with_json = '[]', updated_at = :now
                where id = :id and project_id = :p
            """),
            {"id": chosen_claim_id, "p": project_id, "now": now},
        )
        for oid in other_claim_ids:
            sess.execute(
                text("""
                    update claims
                    set conflict_with_json = '[]', updated_at = :now
                    where id = :id and project_id = :p
                """),
                {"id": oid, "p": project_id, "now": now},
            )
        sess.commit()
        return service.get_claim(sess, project_id, chosen_claim_id) or {}
    finally:
        if should_close:
            sess.close()


def reset_demo(session: Session) -> None:
    session.execute(text("delete from evidence where claim_id in (select id from claims where project_id = 'proj-campus-event-portal')"))
    session.execute(text("delete from gaps where project_id = 'proj-campus-event-portal'"))
    session.execute(text("delete from claims where project_id = 'proj-campus-event-portal'"))
    session.commit()
