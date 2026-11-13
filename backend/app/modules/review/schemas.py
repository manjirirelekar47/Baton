"""Pydantic v2 request/response contracts for the review module."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .constants import (
    INCOMING_ROLES,
    MAX_GAP_ANSWER_LEN,
    MAX_NOTE_LEN,
    MAX_STATEMENT_LEN,
    ReviewAction,
)


class EvidenceOut(BaseModel):
    chunk_id: str
    quote: str
    acl_label: str = "L1"
    source_id: str | None = None
    source_title: str | None = None
    event_time: str | None = None


class ActionRequest(BaseModel):
    """POST /review/{claim_id}/action body."""

    model_config = ConfigDict(extra="forbid")

    action: ReviewAction
    note: str | None = Field(default=None, max_length=MAX_NOTE_LEN)
    edited_statement: str | None = Field(default=None, max_length=MAX_STATEMENT_LEN)
    chosen_claim_id: str | None = None   # resolve_conflict: the side the approver picked

    @field_validator("note", "edited_statement")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return v.strip() if isinstance(v, str) else v

    @model_validator(mode="after")
    def _check_required_fields(self) -> "ActionRequest":
        if self.action == ReviewAction.EDIT and not self.edited_statement:
            raise ValueError("edited_statement is required for action 'edit'")
        if self.action == ReviewAction.RESOLVE_CONFLICT and not self.chosen_claim_id:
            raise ValueError("chosen_claim_id is required for action 'resolve_conflict'")
        if self.action == ReviewAction.ACCEPT_UNCERTAINTY and not self.note:
            raise ValueError("a note is required to accept known uncertainty")
        return self


class ReviewRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    claim_id: str
    reviewer_id: str
    reviewer_role: str
    action: ReviewAction
    note: str | None = None
    created_at: datetime


class QueueItem(BaseModel):
    """One row of the risk-sorted review queue."""

    claim_id: str
    claim_type: str
    entity_key: str | None = None
    attribute: str | None = None
    statement: str
    state: str
    review_state: str
    acl_label: str
    risk_rank: int                  # lower = reviewed earlier
    risk_reason: str                # visible input, shown to the approver
    evidence: list[EvidenceOut] = []
    conflict_with: list[str] = []
    suggested_claim_id: str | None = None   # suggestion only, never applied
    pending: bool = True
    last_action: ReviewAction | None = None


class ReviewQueue(BaseModel):
    project_id: str
    total: int
    pending: int
    items: list[QueueItem]


class ReadinessReport(BaseModel):
    """What the approval gate checks. Approve stays disabled unless ready."""

    ready: bool
    unresolved_conflicts: list[str] = []
    unaccepted_inferred: list[str] = []
    pending_count: int = 0
    included_count: int = 0
    reasons: list[str] = []


class ActionResult(BaseModel):
    review: ReviewRecord
    claim: QueueItem
    readiness: ReadinessReport


class BulkConfirmResult(BaseModel):
    confirmed: int
    claim_ids: list[str]
    readiness: ReadinessReport


class ApproveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shared_to_roles: list[str] = Field(
        default_factory=lambda: sorted(INCOMING_ROLES),
        min_length=1,
    )
    note: str | None = Field(default=None, max_length=MAX_NOTE_LEN)

    @field_validator("shared_to_roles")
    @classmethod
    def _only_incoming_roles(cls, v: list[str]) -> list[str]:
        bad = [r for r in v if r not in INCOMING_ROLES]
        if bad:
            raise ValueError(f"unknown or non-shareable roles: {bad}")
        return sorted(set(v))


class VersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    version_id: str | None = None
    project_id: str
    version_number: int
    status: str = "approved"
    approved_by: str
    approved_at: str | datetime | None = None
    snapshot_hash: str
    claim_count: int
    accepted_uncertainty_count: int
    shared_roles: list[str] = Field(default_factory=list)
    shared_with: list[str] = Field(default_factory=list)
    created_at: str | datetime


class SnapshotClaim(BaseModel):
    model_config = ConfigDict(extra="ignore")

    claim_id: str
    type: str
    entity_key: str | None = None
    attribute: str | None = None
    statement: str
    state: str
    acl_label: str
    evidence: list[dict[str, Any]] = []
    decision: str
    note: str | None = None
    owner: str | None = None
    proposed_owner: str | None = None
    proposed_owner_id: str | None = None
    due_date: str | None = None
    blocked_by: list[str] = []
    attested_by: str | None = None
    unknown: bool = False


class VersionDetail(VersionOut):
    claims: list[SnapshotClaim]
    hash_valid: bool


class AuditEntry(BaseModel):
    id: str
    project_id: str
    actor_id: str
    actor_role: str
    event_type: str
    object_type: str
    object_id: str
    detail: dict[str, Any] = {}
    created_at: datetime


class GapItem(BaseModel):
    gap_id: str
    question: str
    entity_key: str | None = None
    acl_label: str
    source: str                     # "gap" (verifier) or "ask_leaver" (approver)
    answered: bool = False
    answer: str | None = None


class GapInterview(BaseModel):
    project_id: str
    total: int
    unanswered: int
    items: list[GapItem]


class GapAnswerRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    gap_id: str
    answer: str = Field(min_length=3, max_length=MAX_GAP_ANSWER_LEN)

    @field_validator("answer")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("answer is too short")
        return v


class GapAnswerOut(BaseModel):
    gap_id: str
    claim_id: str
    state: str
    redactions: int
