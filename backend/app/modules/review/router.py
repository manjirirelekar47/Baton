"""HTTP surface of the review module. Auto-discovered by app/main.py.

Contract endpoints (guide section 8): GET /review/queue, POST /review/{claim_id}/action,
POST /review/approve, GET /versions, GET /audit.
ADDITIVE (needs a contract-change issue): GET /review/readiness,
POST /review/confirm-verified, GET /versions/{id}, GET /review/gap-interview,
POST /review/gap-answers.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from . import events, gap_interview, service, versions
from .actor import Actor, require_roles
from .claims_port import ClaimsPort
from .constants import Role
from .deps import get_actor, get_allowed_labels, get_claims, get_db
from .schemas import (
    ActionRequest,
    ActionResult,
    ApproveRequest,
    AuditEntry,
    BulkConfirmResult,
    GapAnswerOut,
    GapAnswerRequest,
    GapInterview,
    ReadinessReport,
    ReviewQueue,
    VersionDetail,
    VersionOut,
)
from .service import Ctx

router = APIRouter(tags=["review"])


def get_ctx(
    session: Annotated[Session, Depends(get_db)],
    claims: Annotated[ClaimsPort, Depends(get_claims)],
    actor: Annotated[Actor, Depends(get_actor)],
    labels: Annotated[frozenset, Depends(get_allowed_labels)],
) -> Ctx:
    return Ctx(session=session, claims=claims, actor=actor, labels=labels)


CtxDep = Annotated[Ctx, Depends(get_ctx)]


@router.get("/review/queue", response_model=ReviewQueue)
def get_queue(ctx: CtxDep):
    return service.build_queue(ctx)


@router.get("/review/readiness", response_model=ReadinessReport)
def get_readiness(ctx: CtxDep):
    return service.compute_readiness(ctx)


@router.post("/review/confirm-verified", response_model=BulkConfirmResult)
def confirm_verified(ctx: CtxDep):
    return service.confirm_all_verified(ctx)


@router.post("/review/approve", response_model=VersionOut)
def approve(body: ApproveRequest, ctx: CtxDep):
    return versions.approve(ctx, body)


@router.get("/review/gap-interview", response_model=GapInterview)
def get_gap_interview(ctx: CtxDep):
    return gap_interview.build_interview(ctx)


@router.post("/review/gap-answers", response_model=GapAnswerOut)
def post_gap_answer(body: GapAnswerRequest, ctx: CtxDep):
    return gap_interview.answer_gap(ctx, body)


# NOTE: declared after the fixed /review/* routes so "/review/{claim_id}/action" never shadows them.
@router.post("/review/{claim_id}/action", response_model=ActionResult)
def post_action(claim_id: str, body: ActionRequest, ctx: CtxDep):
    return service.apply_action(ctx, claim_id, body)


@router.get("/versions", response_model=list[VersionOut])
def get_versions(ctx: CtxDep):
    return versions.list_versions(ctx)


@router.get("/versions/{version_id}", response_model=VersionDetail)
def get_version(version_id: str, ctx: CtxDep):
    return versions.get_version_detail(ctx, version_id)


@router.get("/audit", response_model=list[AuditEntry])
def get_audit(
    ctx: CtxDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    require_roles(ctx.actor, Role.APPROVER)
    return events.list_events(ctx.session, ctx.project_id, limit, offset)
