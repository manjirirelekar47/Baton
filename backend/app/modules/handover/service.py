"""Handover service: role-filtered view, plan, section receipts, owner accept or decline.

Reads approved versions only through app.modules.review.public (never review's tables).
Every read of claims goes through core.acl BEFORE anything is built."""
import json
import uuid

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import acl, audit
from app.core.auth import User
from app.modules.handover import builders
from app.modules.review import public as review

NOT_FOUND = "This handover version was not found or has not been shared with you."


def _load(user: User, version_id: str) -> tuple[dict, acl.FilterResult]:
    if user.role not in builders.VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Your role cannot open the handover.")
    version = review.get_version(version_id)
    # One identical 404 for unknown, other-project, unapproved and not-shared: no ID guessing signal.
    if (
        version is None
        or version.get("project_id") != user.project_id
        or version.get("status") != "approved"
        or (user.role != "approver" and user.role not in version.get("shared_with", []))
    ):
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    return version, acl.filter_for_role(user.role, version.get("claims", []))


def get_view(session: Session, user: User, version_id: str) -> dict:
    version, filtered = _load(user, version_id)
    acked = {
        r["section"]: r["acknowledged_at"]
        for r in session.execute(
            text("select section, acknowledged_at from acknowledgements where version_id = :v and user_id = :u"),
            {"v": version_id, "u": user.id},
        ).mappings()
    }
    responses = {
        r["claim_id"]: r["response"]
        for r in session.execute(
            text("select claim_id, response from ownership_responses where version_id = :v and user_id = :u"),
            {"v": version_id, "u": user.id},
        ).mappings()
    }
    audit.log(session, user, "handover.view", obj=version_id)
    return builders.build_view(version, user.role, user.id, filtered, acked, responses)


def _save_plan(session: Session, user: User, version_id: str, plan: dict) -> None:
    params = {"v": version_id, "r": user.role, "p": user.project_id}
    session.execute(text("delete from plan_items where version_id = :v and role = :r and project_id = :p"), params)
    for bucket, items in plan.items():
        for item in items:
            session.execute(
                text(
                    "insert into plan_items (id, version_id, project_id, role, bucket, position, claim_id, kind, title, payload) "
                    "values (:id, :v, :p, :r, :bucket, :pos, :cid, :kind, :title, :payload)"
                ),
                {**params, "id": uuid.uuid4().hex, "bucket": bucket, "pos": item["position"], "cid": item["claim_id"],
                 "kind": item["kind"], "title": item["title"], "payload": json.dumps(item)},
            )
    session.commit()


def get_plan(session: Session, user: User, version_id: str) -> dict:
    _, filtered = _load(user, version_id)
    plan = builders.build_plan(filtered.visible, user.id)
    _save_plan(session, user, version_id, plan)
    audit.log(session, user, "handover.plan", obj=version_id)
    return {"version_id": version_id, "role": user.role, "plan": plan, "note": builders.PLAN_NOTE}


def acknowledge(session: Session, user: User, version_id: str, section: str) -> dict:
    if user.role not in builders.ACK_ROLES:
        raise HTTPException(status_code=403, detail="Only the incoming person can acknowledge a section.")
    _, filtered = _load(user, version_id)
    if section not in builders.available_sections(filtered.visible):
        raise HTTPException(status_code=422, detail="That section does not exist in your view of this handover.")
    query = text("select acknowledged_at from acknowledgements where version_id = :v and section = :s and user_id = :u")
    params = {"v": version_id, "s": section, "u": user.id}
    row = session.execute(query, params).mappings().first()
    if row is None:
        when = audit.now_iso()
        try:
            session.execute(
                text(
                    "insert into acknowledgements (id, version_id, project_id, section, user_id, role, acknowledged_at) "
                    "values (:id, :v, :p, :s, :u, :r, :at)"
                ),
                {**params, "id": uuid.uuid4().hex, "p": user.project_id, "r": user.role, "at": when},
            )
            session.commit()
        except IntegrityError:  # double click or race: the receipt already exists
            session.rollback()
            when = session.execute(query, params).mappings().first()["acknowledged_at"]
        else:
            audit.log(session, user, "handover.ack", obj=f"{version_id}:{section}")
    else:
        when = row["acknowledged_at"]
    return {"version_id": version_id, "section": section, "acknowledged_at": when, "note": builders.RECEIPT_NOTE}


def respond_ownership(session: Session, user: User, version_id: str, claim_id: str, response: str, note: str | None) -> dict:
    if user.role not in builders.ACK_ROLES:
        raise HTTPException(status_code=403, detail="Only the incoming person can accept or decline ownership.")
    _, filtered = _load(user, version_id)
    claim = next((c for c in filtered.visible if c.get("claim_id") == claim_id and c.get("type") == "owner"), None)
    if claim is None:
        raise HTTPException(status_code=404, detail="Ownership item not found in your view.")
    if claim.get("proposed_owner_id") is None:
        raise HTTPException(
            status_code=422,
            detail="No owner has been proposed for this item, so there is nothing to accept or decline. The owner stays unknown.",
        )
    if claim["proposed_owner_id"] != user.id:
        raise HTTPException(status_code=403, detail="This ownership was proposed for someone else.")
    when = audit.now_iso()
    params = {"v": version_id, "c": claim_id, "u": user.id}
    existing = session.execute(
        text("select id from ownership_responses where version_id = :v and claim_id = :c and user_id = :u"), params
    ).first()
    if existing:
        session.execute(
            text("update ownership_responses set response = :resp, note = :note, responded_at = :at where id = :id"),
            {"resp": response, "note": note, "at": when, "id": existing[0]},
        )
    else:
        session.execute(
            text(
                "insert into ownership_responses (id, version_id, project_id, claim_id, user_id, response, note, responded_at) "
                "values (:id, :v, :p, :c, :u, :resp, :note, :at)"
            ),
            {**params, "id": uuid.uuid4().hex, "p": user.project_id, "resp": response, "note": note, "at": when},
        )
    session.commit()
    audit.log(session, user, f"handover.ownership.{response}", obj=f"{version_id}:{claim_id}")
    # The approved snapshot is immutable: the response is recorded beside it, the owner field is never rewritten.
    return {"version_id": version_id, "claim_id": claim_id, "response": response, "responded_at": when, "owner": claim.get("owner")}
