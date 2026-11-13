"""The ONLY surface this module needs from the claims/verification modules.

Review logic depends on this Protocol, never on another module's internals
(zero-conflict rule 6). claims_adapter.py implements it over Samiksha's
public.py; tests implement it in memory.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, Sequence


@dataclass(frozen=True)
class Evidence:
    chunk_id: str
    quote: str
    acl_label: str = "L1"
    source_id: str | None = None
    source_title: str | None = None
    event_time: str | None = None


@dataclass(frozen=True)
class Claim:
    id: str
    project_id: str
    type: str
    statement: str
    state: str                       # Verified/Inferred/Conflicting/Missing/Attested/Stale
    acl_label: str                   # L1..L4 (strictest label among evidence)
    entity_key: str | None = None
    attribute: str | None = None
    review_state: str = "Labelled"
    owner: str | None = None
    proposed_owner: str | None = None
    proposed_owner_id: str | None = None
    due_date: str | None = None
    blocked_by: tuple[str, ...] = ()
    attested_by: str | None = None
    evidence: tuple[Evidence, ...] = ()
    conflict_with: tuple[str, ...] = ()
    suggested_claim_id: str | None = None   # a suggestion only, never applied


@dataclass(frozen=True)
class Gap:
    id: str
    project_id: str
    question: str
    acl_label: str = "L1"
    entity_key: str | None = None
    related_claim_id: str | None = None


class ClaimsPort(Protocol):
    def list_claims(self, project_id: str) -> Sequence[Claim]: ...

    def get_claim(self, project_id: str, claim_id: str) -> Claim | None:
        """None when the claim does not exist IN THAT PROJECT."""

    def edit_statement(
        self, project_id: str, claim_id: str, statement: str, edited_by: str
    ) -> Claim:
        """Store the new statement, run verification.reverify(), return the result."""

    def resolve_conflict(
        self,
        project_id: str,
        chosen_claim_id: str,
        other_claim_ids: Sequence[str],
        resolved_by: str,
    ) -> Claim:
        """Apply a HUMAN-chosen resolution; return the chosen claim afterwards."""

    def mark_review_state(
        self, project_id: str, claim_ids: Sequence[str], review_state: str
    ) -> None: ...

    def list_gaps(self, project_id: str) -> Sequence[Gap]: ...

    def get_gap(self, project_id: str, gap_id: str) -> Gap | None: ...

    def create_attested_claim(
        self,
        project_id: str,
        gap_id: str,
        statement: str,
        author_id: str,
        acl_label: str,
        entity_key: str | None = None,
        related_claim_id: str | None = None,
    ) -> Claim:
        """Create a human-attested claim ('not source-corroborated')."""
