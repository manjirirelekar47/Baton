"""Request models for the handover endpoints."""
from typing import Literal

from pydantic import BaseModel, Field


class AckRequest(BaseModel):
    version_id: str = Field(min_length=1, max_length=100)
    section: str = Field(min_length=1, max_length=100)


class OwnershipRequest(BaseModel):
    version_id: str = Field(min_length=1, max_length=100)
    claim_id: str = Field(min_length=1, max_length=100)
    response: Literal["accept", "decline"]
    note: str | None = Field(default=None, max_length=500)


class ActionStatusRequest(BaseModel):
    version_id: str = Field(min_length=1, max_length=100)
    claim_id: str = Field(min_length=1, max_length=100)
    status: Literal["not_started", "in_progress", "blocked", "completed"]
    owner: str | None = Field(default=None, max_length=100)
    due_date: str | None = Field(default=None, max_length=50)
    notes: str | None = Field(default=None, max_length=1000)


class TaskCreateRequest(BaseModel):
    version_id: str = Field(default="v1", min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=300)
    kind: str = Field(default="next_action", max_length=50)
    owner: str | None = Field(default=None, max_length=100)
    due_date: str | None = Field(default=None, max_length=50)
    status: Literal["not_started", "in_progress", "blocked", "completed"] = "not_started"
    notes: str | None = Field(default=None, max_length=1000)
    blocked_by: list[str] = Field(default_factory=list)


class TaskUpdateRequest(BaseModel):
    version_id: str = Field(default="v1", min_length=1, max_length=100)
    title: str | None = Field(default=None, max_length=300)
    kind: str | None = Field(default=None, max_length=50)
    owner: str | None = Field(default=None, max_length=100)
    due_date: str | None = Field(default=None, max_length=50)
    status: Literal["not_started", "in_progress", "blocked", "completed"] | None = None
    notes: str | None = Field(default=None, max_length=1000)
    blocked_by: list[str] | None = None


class ActivityHistoryItem(BaseModel):
    id: str
    version_id: str
    project_id: str
    task_id: str
    actor_id: str
    actor_name: str
    action: str
    field: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    created_at: str


class ActivityHistoryResponse(BaseModel):
    version_id: str
    task_id: str
    history: list[ActivityHistoryItem]
