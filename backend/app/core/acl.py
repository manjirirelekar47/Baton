"""THE access filter. Every read of claims or chunks goes through this file. FROZEN after Day 0.

Rules (Master Guide sections 5 and 7):
- A claim's label is the strictest label among the claim and its evidence.
- Restricted items reach lower roles as a COUNT only (no title, quote or source).
- L4 (secrets) is never rendered and never counted.
- Fail closed: unknown role sees nothing, unknown label is treated as L4.
"""
from dataclasses import dataclass, field

LABELS = ("L1", "L2", "L3", "L4")
ROLES = ("approver", "leaver", "incoming_maintainer", "incoming_contributor")
_RANK = {label: i for i, label in enumerate(LABELS, start=1)}

# Master Guide table. The Leaver column is not in the guide: ASSUMPTION, mirrors the maintainer. Confirm as a team.
_READ = {
    "approver": {"L1", "L2", "L3"},
    "leaver": {"L1", "L2"},
    "incoming_maintainer": {"L1", "L2"},
    "incoming_contributor": {"L1"},
}
_COUNT_ONLY = {
    "approver": set(),
    "leaver": {"L3"},
    "incoming_maintainer": {"L3"},
    "incoming_contributor": {"L2", "L3"},
}


def visible_labels(role: str) -> set[str]:
    return set(_READ.get(role, set()))


def placeholder_labels(role: str) -> set[str]:
    return set(_COUNT_ONLY.get(role, set()))


def can_read(role: str, label: str | None) -> bool:
    return label in _READ.get(role, set())


def strictest(labels) -> str:
    """Strictest (highest) label. Unknown or missing labels count as L4. No labels at all is also L4."""
    ranks = [_RANK.get(label, _RANK["L4"]) for label in labels]
    return LABELS[max(ranks) - 1] if ranks else "L4"


def effective_label(claim: dict) -> str:
    labels = [claim.get("acl_label")] + [e.get("acl_label") for e in claim.get("evidence", [])]
    return strictest(labels)


@dataclass
class FilterResult:
    visible: list[dict] = field(default_factory=list)
    hidden_count: int = 0


def filter_for_role(role: str, claims: list[dict]) -> FilterResult:
    """The single filter function. Returns copies of visible claims plus a count of restricted ones."""
    result = FilterResult()
    if role not in _READ:
        return result
    for claim in claims:
        label = effective_label(claim)
        if label in _READ[role]:
            result.visible.append(dict(claim))
        elif label in _COUNT_ONLY[role]:
            result.hidden_count += 1
    return result
