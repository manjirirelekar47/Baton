"""SQLAlchemy models for the review module (owner: Samruddhi).

Mirror db/schema/50_review.sql (the SQL file is the source of truth applied by
core/db.py). This module uses its OWN declarative base, so it never clashes
with another owner's metadata and needs nothing from core/db.py.

Append-only / immutable tables are guarded by ORM events: any UPDATE or
DELETE through the ORM raises ImmutableError.
"""
from __future__ import annotations

import json
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, event
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from .errors import ImmutableError


class ReviewBase(DeclarativeBase):
    pass


_lock = threading.Lock()
_last = 0


def new_id() -> str:
    """Strictly increasing, time-ordered id so ORDER BY id == chronological."""
    global _last
    with _lock:
        ts = time.time_ns()
        if ts <= _last:
            ts = _last + 1
        _last = ts
    return f"{ts:020d}{uuid.uuid4().hex[:8]}"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Review(ReviewBase):
    """One human decision. Append-only."""

    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    claim_id: Mapped[str] = mapped_column(String, nullable=False)
    reviewer_id: Mapped[str] = mapped_column(String, nullable=False)
    reviewer_role: Mapped[str] = mapped_column(String, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    before_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    after_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Version(ReviewBase):
    """Immutable approved snapshot."""

    __tablename__ = "versions"
    __table_args__ = (UniqueConstraint("project_id", "version_number"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    approved_by: Mapped[str] = mapped_column(String, nullable=False)
    snapshot_hash: Mapped[str] = mapped_column(String, nullable=False)
    claim_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    accepted_uncertainty_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    shared_to_roles: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    claims: Mapped[list["VersionClaim"]] = relationship(
        back_populates="version", order_by="VersionClaim.position"
    )

    @property
    def version_id(self) -> str:
        return self.id or f"v{self.version_number}"

    @property
    def status(self) -> str:
        return "approved"

    @property
    def approved_at(self) -> str:
        if hasattr(self.created_at, "strftime"):
            return self.created_at.strftime("%Y-%m-%dT%H:%M:%SZ")
        return str(self.created_at)

    @property
    def shared_roles(self) -> list[str]:
        return json.loads(self.shared_to_roles or "[]")

    @property
    def shared_with(self) -> list[str]:
        return self.shared_roles


class VersionClaim(ReviewBase):
    """Frozen copy of a claim inside an approved version."""

    __tablename__ = "version_claims"

    version_id: Mapped[str] = mapped_column(String, ForeignKey("versions.id"), primary_key=True)
    claim_id: Mapped[str] = mapped_column(String, primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    claim_type: Mapped[str] = mapped_column(String, nullable=False)
    state: Mapped[str] = mapped_column(String, nullable=False)
    acl_label: Mapped[str] = mapped_column(String, nullable=False)
    snapshot_json: Mapped[str] = mapped_column(Text, nullable=False)

    version: Mapped[Version] = relationship(back_populates="claims")

    @property
    def snapshot(self) -> dict[str, Any]:
        return json.loads(self.snapshot_json)


class GapAnswer(ReviewBase):
    __tablename__ = "gap_answers"
    __table_args__ = (UniqueConstraint("project_id", "gap_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(String, nullable=False)
    gap_id: Mapped[str] = mapped_column(String, nullable=False)
    leaver_id: Mapped[str] = mapped_column(String, nullable=False)
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_claim_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ReviewEvent(ReviewBase):
    """Audit trail entry. Append-only."""

    __tablename__ = "review_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    actor_id: Mapped[str] = mapped_column(String, nullable=False)
    actor_role: Mapped[str] = mapped_column(String, nullable=False)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    object_type: Mapped[str] = mapped_column(String, nullable=False)
    object_id: Mapped[str] = mapped_column(String, nullable=False)
    detail_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


def _block(mapper, connection, target):  # noqa: ARG001
    raise ImmutableError(
        f"{type(target).__name__} rows are append-only/immutable and cannot be changed or deleted."
    )


for _cls in (Review, Version, VersionClaim, ReviewEvent):
    event.listen(_cls, "before_update", _block)
    event.listen(_cls, "before_delete", _block)
