"""Typed response models for deterministic project risk and delivery signals."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class RiskSignal(BaseModel):
    module: str
    person: str
    exclusivity: float = Field(ge=0, le=1)
    dependents: int = Field(ge=0)
    undocumented_decisions: int = Field(ge=0)
    account_ties: int = Field(ge=0)
    work_in_flight: int = Field(ge=0)
    flagged: bool
    reasons: list[str]
    evidence_chunk_ids: list[str]


class TimelineEvent(BaseModel):
    event_time: datetime
    text: str
    chunk_id: str
    source_title: str
    acl_label: Literal["L1", "L2", "L3"]


class DeliveryItem(BaseModel):
    task: str
    title: str
    due: str | None = None
    status: str
    blocked_by: list[str]
    holds_up: list[str]
    chunk_id: str
    quote: str
    label: str
