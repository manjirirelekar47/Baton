"""Pydantic models for the verification module (F4, F5)."""
from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field

ClaimType = Literal[
    "decision",
    "owner",
    "dependency",
    "blocker",
    "risk",
    "recurring_problem",
    "open_question",
    "contact",
    "next_action",
    "timeline_event",
]

ClaimState = Literal["verified", "inferred", "conflicting", "missing", "attested"]
AclLabel = Literal["L1", "L2", "L3", "L4"]


class EvidenceIn(BaseModel):
    chunk_id: str
    quote: str
    source_id: str | None = None
    source_title: str | None = None
    acl_label: str | None = "L1"
    event_time: str | None = None


class EvidenceOut(EvidenceIn):
    id: str | None = None
    claim_id: str | None = None


class ClaimIn(BaseModel):
    type: ClaimType
    entity_key: str
    attribute: str
    statement: str
    state: ClaimState = "inferred"
    acl_label: AclLabel = "L1"
    owner: str | None = None
    proposed_owner: str | None = None
    proposed_owner_id: str | None = None
    due_date: str | None = None
    blocked_by: list[str] = Field(default_factory=list)
    attested_by: str | None = None
    evidence: list[EvidenceIn] = Field(default_factory=list)


class ClaimOut(BaseModel):
    claim_id: str
    type: ClaimType
    entity_key: str
    attribute: str
    statement: str
    state: ClaimState
    acl_label: AclLabel
    owner: str | None = None
    proposed_owner: str | None = None
    proposed_owner_id: str | None = None
    due_date: str | None = None
    blocked_by: list[str] = Field(default_factory=list)
    attested_by: str | None = None
    conflict_with: list[str] = Field(default_factory=list)
    evidence: list[EvidenceOut] = Field(default_factory=list)


class ClaimsListResponse(BaseModel):
    claims: list[dict[str, Any]]
    hidden_count: int = 0


class GapOut(BaseModel):
    gap_id: str
    question: str
    reason: str
    asked_to: str | None = None
    claim_id: str | None = None


class AliasRecord(BaseModel):
    canonical: str
    alias: str
