"""Approval gate -> immutable versions with a snapshot hash."""
from __future__ import annotations

import hashlib
import json
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .actor import require_roles
from .claims_port import Claim
from .constants import INCLUDE_ACTIONS, ClaimState, ReviewAction, Role
from .errors import ReviewError
from .events import record_event
from .models import Version, VersionClaim
from .schemas import (
    ApproveRequest,
    SnapshotClaim,
    VersionDetail,
    VersionOut,
)
from .service import APPROVED_STATE, Ctx, compute_readiness, effective_decisions, visible_claims


def canonical(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def compute_snapshot_hash(project_id: str, items: list[dict]) -> str:
    ordered = sorted(items, key=lambda i: i["claim_id"])
    payload = canonical({"project_id": project_id, "claims": ordered})
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _snapshot_item(claim: Claim, action: str, note: str | None) -> dict:
    if action == ReviewAction.MARK_UNKNOWN:
        # Never assert the value the approver said we do not know; drop its quote too.
        what = claim.attribute or "value"
        return {
            "claim_id": claim.id,
            "type": claim.type,
            "entity_key": claim.entity_key,
            "attribute": claim.attribute,
            "statement": f"Unknown: {what} for {claim.entity_key or 'this item'}",
            "state": ClaimState.MISSING.value,
            "acl_label": claim.acl_label,
            "evidence": [],
            "decision": action,
            "note": note,
            "owner": None,
            "proposed_owner": None,
            "proposed_owner_id": None,
            "due_date": None,
            "blocked_by": [],
            "attested_by": None,
            "unknown": True,
        }
    return {
        "claim_id": claim.id,
        "type": claim.type,
        "entity_key": claim.entity_key,
        "attribute": claim.attribute,
        "statement": claim.statement,
        "state": claim.state,
        "acl_label": claim.acl_label,
        "evidence": [
            {
                "chunk_id": e.chunk_id,
                "quote": e.quote,
                "acl_label": e.acl_label or claim.acl_label or "L1",
                "source_id": e.source_id,
                "source_title": e.source_title,
                "event_time": e.event_time,
            }
            for e in claim.evidence
        ],
        "decision": action,
        "note": note,
        "owner": claim.owner,
        "proposed_owner": claim.proposed_owner,
        "proposed_owner_id": claim.proposed_owner_id,
        "due_date": claim.due_date,
        "blocked_by": list(claim.blocked_by),
        "attested_by": claim.attested_by,
        "unknown": False,
    }


def build_snapshot(ctx: Ctx) -> list[dict]:
    claims = visible_claims(ctx)
    decisions = effective_decisions(ctx.session, ctx.project_id, claims)
    items: list[dict] = []
    for c in claims:
        d = decisions.get(c.id)
        if d is None or d.action not in INCLUDE_ACTIONS:
            continue
        item = _snapshot_item(c, d.action, d.note)
        # Defence in depth: citation or silence, re-checked at the last moment.
        if (
            not item["unknown"]
            and c.state != ClaimState.ATTESTED
            and (c.state == ClaimState.MISSING or not c.evidence)
        ):
            raise ReviewError(
                409, "citation_or_silence",
                "A claim without verified evidence cannot be shared as fact.",
                claim_id=c.id,
            )
        items.append(item)
    return sorted(items, key=lambda i: i["claim_id"])


def approve(ctx: Ctx, req: ApproveRequest) -> VersionOut:
    require_roles(ctx.actor, Role.APPROVER)
    readiness = compute_readiness(ctx)
    if not readiness.ready:
        raise ReviewError(
            409, "not_ready", "Approval is blocked until the readiness checks pass.",
            readiness=readiness.model_dump(),
        )
    items = build_snapshot(ctx)
    session = ctx.session
    last = session.scalar(
        select(func.max(Version.version_number)).where(Version.project_id == ctx.project_id)
    )
    number = (last or 0) + 1
    accepted = sum(1 for i in items if i["decision"] == ReviewAction.ACCEPT_UNCERTAINTY)
    version_id = f"v{number}"
    version = Version(
        id=version_id,
        project_id=ctx.project_id,
        version_number=number,
        approved_by=ctx.actor.user_id,
        snapshot_hash=compute_snapshot_hash(ctx.project_id, items),
        claim_count=len(items),
        accepted_uncertainty_count=accepted,
        shared_to_roles=json.dumps(req.shared_to_roles),
    )
    try:
        session.add(version)
        session.flush()
        for pos, item in enumerate(items):
            session.add(
                VersionClaim(
                    version_id=version.id,
                    claim_id=item["claim_id"],
                    position=pos,
                    claim_type=item["type"],
                    state=item["state"],
                    acl_label=item["acl_label"],
                    snapshot_json=canonical(item),
                )
            )
        session.flush()
    except IntegrityError:
        session.rollback()
        raise ReviewError(409, "version_conflict", "Another approval was just made. Reload and retry.") from None

    ctx.claims.mark_review_state(
        ctx.project_id, [i["claim_id"] for i in items if not i["unknown"]], APPROVED_STATE
    )
    record_event(
        session, ctx.actor, "version.approve", "version", version.id,
        {"version_number": number, "hash": version.snapshot_hash,
         "claims": len(items), "shared_to_roles": req.shared_to_roles, "note": req.note},
    )
    session.commit()
    session.refresh(version)
    return VersionOut.model_validate(version)


# ------------------------------------------------------------ read side
def _owned_version(session: Session, project_id: str, version_id: str) -> Version:
    v = session.get(Version, version_id)
    if not v and version_id.startswith("v") and version_id[1:].isdigit():
        num = int(version_id[1:])
        v = session.scalars(
            select(Version)
            .where(Version.project_id == project_id)
            .where(Version.version_number == num)
        ).first()
    if v is None or v.project_id != project_id:
        raise ReviewError(404, "version_not_found", "Version not found.")
    return v


def hash_matches(version: Version) -> bool:
    items = [vc.snapshot for vc in version.claims]
    return compute_snapshot_hash(version.project_id, items) == version.snapshot_hash


def list_versions(ctx: Ctx) -> list[VersionOut]:
    require_roles(
        ctx.actor,
        Role.APPROVER,
        Role.LEAVER,
        Role.INCOMING_MAINTAINER,
        Role.INCOMING_CONTRIBUTOR,
    )
    rows = ctx.session.scalars(
        select(Version)
        .where(Version.project_id == ctx.project_id)
        .order_by(Version.version_number.desc())
    ).all()
    results = [VersionOut.model_validate(v) for v in rows]
    if ctx.actor.role in (Role.INCOMING_MAINTAINER.value, Role.INCOMING_CONTRIBUTOR.value):
        results = [v for v in results if ctx.actor.role in v.shared_roles]
    return results


def get_version_detail(ctx: Ctx, version_id: str) -> VersionDetail:
    require_roles(ctx.actor, Role.APPROVER)
    v = _owned_version(ctx.session, ctx.project_id, version_id)
    base = VersionOut.model_validate(v).model_dump()
    return VersionDetail(
        **base,
        claims=[SnapshotClaim(**vc.snapshot) for vc in v.claims],
        hash_valid=hash_matches(v),
    )
