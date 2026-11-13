"""Pydantic models for the extraction module (F3)."""
from __future__ import annotations

from typing import Literal

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


class ExtractionEvidence(BaseModel):
    chunk_id: str
    quote: str


class ExtractionClaim(BaseModel):
    type: ClaimType
    entity_key: str
    attribute: str
    statement: str
    evidence: list[ExtractionEvidence] = Field(default_factory=list)
    owner: str | None = None
    proposed_owner: str | None = None
    proposed_owner_id: str | None = None
    due_date: str | None = None
    blocked_by: list[str] = Field(default_factory=list)


class ExtractionBatch(BaseModel):
    claims: list[ExtractionClaim] = Field(default_factory=list)


class ReconstructJobOut(BaseModel):
    job_id: str
    status: Literal["pending", "running", "done", "failed"]
    mode: Literal["replay", "llm"]
    progress: int = 0
    note: str | None = None
    claims_count: int = 0
    gaps_count: int = 0
    error: str | None = None
