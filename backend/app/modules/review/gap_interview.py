"""Leaver Gap Interview: ask only what the evidence cannot answer.
Answers become Attested claims ('not source-corroborated')."""
from __future__ import annotations

from sqlalchemy import select

from .actor import require_roles
from .constants import ReviewAction, Role
from .errors import ReviewError
from .events import record_event
from .models import GapAnswer
from .redaction import redact_secrets
from .schemas import GapAnswerOut, GapAnswerRequest, GapInterview, GapItem
from .service import Ctx, effective_decisions, get_visible_claim, visible_claims

ASK_PREFIX = "ask:"


def _answers(ctx: Ctx) -> dict[str, GapAnswer]:
    rows = ctx.session.scalars(
        select(GapAnswer).where(GapAnswer.project_id == ctx.project_id)
    ).all()
    return {r.gap_id: r for r in rows}


def _ask_leaver_claim_ids(ctx: Ctx) -> list[str]:
    claims = visible_claims(ctx)
    decisions = effective_decisions(ctx.session, ctx.project_id, claims)
    return [
        c.id for c in claims
        if c.id in decisions and decisions[c.id].action == ReviewAction.ASK_LEAVER.value
    ]


def build_interview(ctx: Ctx) -> GapInterview:
    require_roles(ctx.actor, Role.LEAVER, Role.APPROVER)
    answers = _answers(ctx)
    items: list[GapItem] = []

    for gap in ctx.claims.list_gaps(ctx.project_id):
        if gap.project_id != ctx.project_id or (gap.acl_label or "").upper() not in ctx.labels:
            continue
        a = answers.get(gap.id)
        items.append(GapItem(
            gap_id=gap.id, question=gap.question, entity_key=gap.entity_key,
            acl_label=gap.acl_label, source="gap",
            answered=a is not None, answer=a.answer_text if a else None,
        ))

    for cid in _ask_leaver_claim_ids(ctx):
        claim = get_visible_claim(ctx, cid)
        gid = f"{ASK_PREFIX}{cid}"
        a = answers.get(gid)
        items.append(GapItem(
            gap_id=gid,
            question=f"The approver asks you to clarify: {claim.statement}",
            entity_key=claim.entity_key, acl_label=claim.acl_label, source="ask_leaver",
            answered=a is not None, answer=a.answer_text if a else None,
        ))

    items.sort(key=lambda i: (i.answered, i.gap_id))
    return GapInterview(
        project_id=ctx.project_id,
        total=len(items),
        unanswered=sum(1 for i in items if not i.answered),
        items=items,
    )


def answer_gap(ctx: Ctx, req: GapAnswerRequest) -> GapAnswerOut:
    require_roles(ctx.actor, Role.LEAVER)
    gap_id = req.gap_id

    if gap_id.startswith(ASK_PREFIX):
        claim_id = gap_id[len(ASK_PREFIX):]
        if claim_id not in _ask_leaver_claim_ids(ctx):
            raise ReviewError(404, "gap_not_found", "Question not found.")
        claim = get_visible_claim(ctx, claim_id)
        acl, entity_key, related = claim.acl_label, claim.entity_key, claim.id
    else:
        gap = ctx.claims.get_gap(ctx.project_id, gap_id)
        if gap is None or gap.project_id != ctx.project_id or (gap.acl_label or "").upper() not in ctx.labels:
            raise ReviewError(404, "gap_not_found", "Question not found.")
        acl, entity_key, related = gap.acl_label, gap.entity_key, gap.related_claim_id

    if gap_id in _answers(ctx):
        raise ReviewError(409, "already_answered", "This question has already been answered.")

    clean, redactions = redact_secrets(req.answer)   # stored text is data, never instructions
    claim_new = ctx.claims.create_attested_claim(
        ctx.project_id, gap_id, clean, ctx.actor.user_id, acl,
        entity_key=entity_key, related_claim_id=related,
    )
    ctx.session.add(GapAnswer(
        project_id=ctx.project_id, gap_id=gap_id, leaver_id=ctx.actor.user_id,
        answer_text=clean, created_claim_id=claim_new.id,
    ))
    record_event(
        ctx.session, ctx.actor, "gap.answer", "gap", gap_id,
        {"claim_id": claim_new.id, "redactions": redactions},
    )
    ctx.session.commit()
    return GapAnswerOut(
        gap_id=gap_id, claim_id=claim_new.id, state=claim_new.state, redactions=redactions
    )
