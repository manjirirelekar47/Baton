"""Review queue, actions and readiness gate (owner: Samruddhi).

Rules enforced here (all plain code, no model involved):
  * Only the Approver acts on claims.
  * Citation or silence: a claim with no verifiable evidence can never be confirmed.
  * A Conflicting claim cannot be confirmed; it must be resolved or accepted.
  * Suggestions are never applied; resolve_conflict is a human choice.
  * Every action is appended to `reviews` and the audit trail.
"""
from __future__ import annotations

import json
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from .actor import Actor, require_roles
from .claims_port import Claim, ClaimsPort
from .constants import (
    CONFLICT_SETTLED_ACTIONS,
    CRITICAL_TYPES,
    NEVER_VISIBLE_LABEL,
    RESOLVING_ACTIONS,
    STATE_PRIORITY,
    ClaimState,
    ReviewAction,
    ReviewState,
    Role,
)
from .errors import ReviewError
from .events import record_event
from .models import Review
from .schemas import (
    ActionRequest,
    ActionResult,
    BulkConfirmResult,
    EvidenceOut,
    QueueItem,
    ReadinessReport,
    ReviewQueue,
    ReviewRecord,
)


@dataclass
class Ctx:
    session: Session
    claims: ClaimsPort
    actor: Actor
    labels: frozenset[str]

    @property
    def project_id(self) -> str:
        return self.actor.project_id


# ---------------------------------------------------------------- helpers
def _is_visible(ctx: Ctx, claim: Claim) -> bool:
    label = (claim.acl_label or "").upper()
    return (
        claim.project_id == ctx.project_id
        and label != NEVER_VISIBLE_LABEL
        and label in ctx.labels
    )


def visible_claims(ctx: Ctx) -> list[Claim]:
    return [c for c in ctx.claims.list_claims(ctx.project_id) if _is_visible(ctx, c)]


def get_visible_claim(ctx: Ctx, claim_id: str) -> Claim:
    claim = ctx.claims.get_claim(ctx.project_id, claim_id)
    # 404 (not 403) so another project's / restricted ids are indistinguishable from absent ones.
    if claim is None or not _is_visible(ctx, claim):
        raise ReviewError(404, "claim_not_found", "Claim not found.")
    return claim


def latest_reviews(session: Session, project_id: str) -> dict[str, Review]:
    rows = session.scalars(
        select(Review).where(Review.project_id == project_id).order_by(Review.id)
    ).all()
    return {r.claim_id: r for r in rows}  # later rows overwrite earlier ones


def _is_stale(claim: Claim) -> bool:
    return ClaimState.STALE.value in (claim.state, claim.review_state)


def effective_decisions(
    session: Session, project_id: str, claims: list[Claim]
) -> dict[str, Review]:
    """Latest human decision per claim. A Stale claim loses its decision (re-review)."""
    latest = latest_reviews(session, project_id)
    return {c.id: latest[c.id] for c in claims if c.id in latest and not _is_stale(c)}


def _brief(c: Claim) -> dict:
    return {"statement": c.statement, "state": c.state, "review_state": c.review_state}


def _record(
    ctx: Ctx, claim_id: str, action: ReviewAction, note: str | None, before: dict, after: dict
) -> Review:
    row = Review(
        project_id=ctx.project_id,
        claim_id=claim_id,
        reviewer_id=ctx.actor.user_id,
        reviewer_role=ctx.actor.role,
        action=action.value,
        note=note,
        before_json=json.dumps(before, sort_keys=True),
        after_json=json.dumps(after, sort_keys=True),
    )
    ctx.session.add(row)
    ctx.session.flush()
    record_event(
        ctx.session,
        ctx.actor,
        f"review.{action.value}",
        "claim",
        claim_id,
        {"review_id": row.id, "note": note},
    )
    return row


# ------------------------------------------------------------------ queue
def _risk(claim: Claim) -> tuple[int, str]:
    base = STATE_PRIORITY.get(claim.state, 9) * 10 + (0 if claim.type in CRITICAL_TYPES else 5)
    s = claim.state
    if s == ClaimState.CONFLICTING:
        n = len(claim.conflict_with) + 1
        reason = f"Conflicting: {n} claims disagree on {claim.entity_key or 'this item'}"
    elif s == ClaimState.STALE:
        reason = "Stale: a source changed since this was reviewed"
    elif s == ClaimState.INFERRED:
        reason = "Inferred: single weak source or arithmetic, needs a human check"
        if claim.type in CRITICAL_TYPES:
            reason += f" ({claim.type} claims block approval until decided)"
    elif s == ClaimState.MISSING:
        reason = "Missing: no verified evidence; ask the leaver"
    elif s == ClaimState.ATTESTED:
        reason = "Attested: stated by a person, not source-corroborated"
    else:
        reason = "Verified: quote found in its source"
    return base, reason


def _to_item(claim: Claim, decision: Review | None) -> QueueItem:
    rank, reason = _risk(claim)
    pending = decision is None or decision.action not in RESOLVING_ACTIONS
    return QueueItem(
        claim_id=claim.id,
        claim_type=claim.type,
        entity_key=claim.entity_key,
        attribute=claim.attribute,
        statement=claim.statement,
        state=claim.state,
        review_state=claim.review_state,
        acl_label=claim.acl_label,
        risk_rank=rank,
        risk_reason=reason,
        evidence=[
            EvidenceOut(
                chunk_id=e.chunk_id,
                quote=e.quote,
                acl_label=e.acl_label or claim.acl_label or "L1",
                source_id=e.source_id,
                source_title=e.source_title,
                event_time=e.event_time,
            )
            for e in claim.evidence
        ],
        conflict_with=list(claim.conflict_with),
        suggested_claim_id=claim.suggested_claim_id,
        pending=pending,
        last_action=ReviewAction(decision.action) if decision else None,
    )


def build_queue(ctx: Ctx) -> ReviewQueue:
    require_roles(ctx.actor, Role.APPROVER)
    claims = visible_claims(ctx)
    decisions = effective_decisions(ctx.session, ctx.project_id, claims)
    items = [_to_item(c, decisions.get(c.id)) for c in claims]
    items.sort(key=lambda i: (not i.pending, i.risk_rank, i.claim_id))
    return ReviewQueue(
        project_id=ctx.project_id,
        total=len(items),
        pending=sum(1 for i in items if i.pending),
        items=items,
    )


# -------------------------------------------------------------- readiness
def compute_readiness(ctx: Ctx) -> ReadinessReport:
    require_roles(ctx.actor, Role.APPROVER)
    claims = visible_claims(ctx)
    decisions = effective_decisions(ctx.session, ctx.project_id, claims)

    conflicts: list[str] = []
    inferred: list[str] = []
    pending = 0
    included = 0
    from .constants import INCLUDE_ACTIONS

    for c in claims:
        d = decisions.get(c.id)
        action = d.action if d else None
        if action is None or action not in RESOLVING_ACTIONS:
            pending += 1
        if action in INCLUDE_ACTIONS:
            included += 1
        if c.state == ClaimState.CONFLICTING and action not in CONFLICT_SETTLED_ACTIONS:
            conflicts.append(c.id)
        if (
            c.state == ClaimState.INFERRED
            and c.type in CRITICAL_TYPES
            and action not in RESOLVING_ACTIONS
        ):
            inferred.append(c.id)

    reasons: list[str] = []
    if conflicts:
        reasons.append(
            f"{len(conflicts)} conflicting item(s) must be resolved or accepted as known uncertainty."
        )
    if inferred:
        reasons.append(f"{len(inferred)} critical Inferred item(s) need a decision.")
    if included == 0:
        reasons.append("No claims have been confirmed yet, so there is nothing to share.")

    return ReadinessReport(
        ready=not reasons,
        unresolved_conflicts=sorted(conflicts),
        unaccepted_inferred=sorted(inferred),
        pending_count=pending,
        included_count=included,
        reasons=reasons,
    )


# ---------------------------------------------------------------- actions
def _check_confirmable(claim: Claim) -> None:
    if claim.state == ClaimState.CONFLICTING:
        raise ReviewError(
            409, "conflict_unresolved",
            "A conflicting claim cannot be confirmed. Resolve the conflict or accept it as known uncertainty.",
        )
    if claim.state == ClaimState.STALE:
        raise ReviewError(
            409, "stale_claim", "A source changed. Re-verify or edit this claim before confirming."
        )
    if claim.state == ClaimState.MISSING or (
        not claim.evidence and claim.state != ClaimState.ATTESTED
    ):
        raise ReviewError(
            409, "citation_or_silence",
            "This claim has no verified quote, so it cannot be shown as fact. "
            "Mark it unknown or ask the leaver.",
        )


def apply_action(ctx: Ctx, claim_id: str, req: ActionRequest) -> ActionResult:
    require_roles(ctx.actor, Role.APPROVER)
    claim = get_visible_claim(ctx, claim_id)
    before = _brief(claim)
    action = req.action

    if action == ReviewAction.CONFIRM:
        _check_confirmable(claim)
        primary = _record(ctx, claim.id, action, req.note, before, before)

    elif action == ReviewAction.EDIT:
        if req.edited_statement == claim.statement:
            raise ReviewError(422, "no_change", "The edited statement is identical to the current one.")
        updated = ctx.claims.edit_statement(
            ctx.project_id, claim.id, req.edited_statement or "", ctx.actor.user_id
        )
        primary = _record(ctx, claim.id, action, req.note, before, _brief(updated))

    elif action in (ReviewAction.REJECT, ReviewAction.MARK_UNKNOWN, ReviewAction.ASK_LEAVER):
        primary = _record(ctx, claim.id, action, req.note, before, before)

    elif action == ReviewAction.ACCEPT_UNCERTAINTY:
        if claim.state not in (ClaimState.CONFLICTING, ClaimState.INFERRED):
            raise ReviewError(
                409, "nothing_to_accept",
                "Only Conflicting or Inferred claims can be accepted as known uncertainty.",
            )
        primary = _record(ctx, claim.id, action, req.note, before, before)

    elif action == ReviewAction.RESOLVE_CONFLICT:
        if claim.state != ClaimState.CONFLICTING:
            raise ReviewError(409, "not_conflicting", "This claim is not in conflict.")
        group = {claim.id, *claim.conflict_with}
        chosen_id = req.chosen_claim_id or ""
        if chosen_id not in group:
            raise ReviewError(
                422, "bad_choice", "The chosen claim is not part of this conflict.",
                allowed=sorted(group),
            )
        sides = {}
        for cid in group:
            try:
                sides[cid] = get_visible_claim(ctx, cid)
            except ReviewError:
                raise ReviewError(
                    409, "conflict_side_unavailable",
                    "A side of this conflict is missing or not visible.",
                ) from None
        others = sorted(group - {chosen_id})
        chosen_after = ctx.claims.resolve_conflict(
            ctx.project_id, chosen_id, others, ctx.actor.user_id
        )
        rows: dict[str, Review] = {
            chosen_id: _record(
                ctx, chosen_id, ReviewAction.RESOLVE_CONFLICT, req.note,
                _brief(sides[chosen_id]), _brief(chosen_after),
            )
        }
        for oid in others:
            rows[oid] = _record(
                ctx, oid, ReviewAction.REJECT,
                f"Superseded: conflict resolved in favour of {chosen_id}. {req.note or ''}".strip(),
                _brief(sides[oid]), _brief(sides[oid]),
            )
        primary = rows[claim.id]
    else:  # pragma: no cover
        raise ReviewError(422, "unknown_action", "Unknown action.")

    ctx.session.commit()

    fresh = ctx.claims.get_claim(ctx.project_id, claim.id) or claim
    latest = latest_reviews(ctx.session, ctx.project_id).get(claim.id)
    decision = None if _is_stale(fresh) else latest
    return ActionResult(
        review=ReviewRecord.model_validate(primary),
        claim=_to_item(fresh, decision),
        readiness=compute_readiness(ctx),
    )


def confirm_all_verified(ctx: Ctx) -> BulkConfirmResult:
    """Convenience: confirm every undecided Verified claim that has a quote."""
    require_roles(ctx.actor, Role.APPROVER)
    claims = visible_claims(ctx)
    decisions = effective_decisions(ctx.session, ctx.project_id, claims)
    confirmed: list[str] = []
    for c in claims:
        if c.id in decisions or c.state != ClaimState.VERIFIED or not c.evidence:
            continue
        b = _brief(c)
        _record(ctx, c.id, ReviewAction.CONFIRM, "Bulk confirm of Verified claims", b, b)
        confirmed.append(c.id)
    record_event(
        ctx.session, ctx.actor, "review.bulk_confirm", "project", ctx.project_id,
        {"count": len(confirmed), "claim_ids": confirmed},
    )
    ctx.session.commit()
    return BulkConfirmResult(
        confirmed=len(confirmed), claim_ids=confirmed, readiness=compute_readiness(ctx)
    )


APPROVED_STATE = ReviewState.APPROVED.value
