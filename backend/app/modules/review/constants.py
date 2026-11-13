"""Shared constants for the review module (owner: Samruddhi)."""
from __future__ import annotations

from enum import StrEnum


class Role(StrEnum):
    APPROVER = "approver"
    LEAVER = "leaver"
    INCOMING_MAINTAINER = "incoming_maintainer"
    INCOMING_CONTRIBUTOR = "incoming_contributor"


INCOMING_ROLES: frozenset[str] = frozenset(
    {Role.INCOMING_MAINTAINER.value, Role.INCOMING_CONTRIBUTOR.value}
)


class ReviewAction(StrEnum):
    """Human actions on a claim. Must match the CHECK list in 50_review.sql."""

    CONFIRM = "confirm"
    EDIT = "edit"
    REJECT = "reject"
    MARK_UNKNOWN = "mark_unknown"
    ASK_LEAVER = "ask_leaver"
    RESOLVE_CONFLICT = "resolve_conflict"
    ACCEPT_UNCERTAINTY = "accept_uncertainty"


class ClaimState(StrEnum):
    """Honesty labels (text, never colour alone)."""

    VERIFIED = "Verified"
    INFERRED = "Inferred"
    CONFLICTING = "Conflicting"
    MISSING = "Missing"
    ATTESTED = "Attested"
    STALE = "Stale"


class ReviewState(StrEnum):
    """Lifecycle: Draft > Labelled > Reviewed > Approved > Shared > Acknowledged."""

    DRAFT = "Draft"
    LABELLED = "Labelled"
    REVIEWED = "Reviewed"
    APPROVED = "Approved"
    SHARED = "Shared"
    ACKNOWLEDGED = "Acknowledged"
    STALE = "Stale"


# Lower = reviewed earlier. Conflicts first, then stale, unproven, gaps, rest.
STATE_PRIORITY: dict[str, int] = {
    ClaimState.CONFLICTING.value: 0,
    ClaimState.STALE.value: 1,
    ClaimState.INFERRED.value: 2,
    ClaimState.MISSING.value: 3,
    ClaimState.ATTESTED.value: 4,
    ClaimState.VERIFIED.value: 5,
}

# Claim types where a wrong/unproven value hurts most -> reviewed first and
# an Inferred one blocks approval until a human decides.
CRITICAL_TYPES: frozenset[str] = frozenset({"owner", "blocker", "risk"})

# "A human has dealt with this claim" (ask_leaver is NOT resolving: it waits).
RESOLVING_ACTIONS: frozenset[str] = frozenset(
    a.value
    for a in (
        ReviewAction.CONFIRM,
        ReviewAction.EDIT,
        ReviewAction.REJECT,
        ReviewAction.MARK_UNKNOWN,
        ReviewAction.RESOLVE_CONFLICT,
        ReviewAction.ACCEPT_UNCERTAINTY,
    )
)

# Decisions that settle a Conflicting claim. (confirm is refused outright.)
CONFLICT_SETTLED_ACTIONS: frozenset[str] = frozenset(
    a.value
    for a in (
        ReviewAction.RESOLVE_CONFLICT,
        ReviewAction.ACCEPT_UNCERTAINTY,
        ReviewAction.REJECT,
        ReviewAction.MARK_UNKNOWN,
    )
)

# Decisions whose claims go into an approved version.
INCLUDE_ACTIONS: frozenset[str] = frozenset(
    a.value
    for a in (
        ReviewAction.CONFIRM,
        ReviewAction.EDIT,
        ReviewAction.RESOLVE_CONFLICT,
        ReviewAction.ACCEPT_UNCERTAINTY,
        ReviewAction.MARK_UNKNOWN,
    )
)

# Restricted secrets label: never read, never rendered, never snapshotted.
NEVER_VISIBLE_LABEL = "L4"

MAX_NOTE_LEN = 1000
MAX_STATEMENT_LEN = 1000
MAX_GAP_ANSWER_LEN = 2000
