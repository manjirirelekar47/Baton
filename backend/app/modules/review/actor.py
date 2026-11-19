"""Who is calling. Built by deps.get_actor from Manjiri's auth user."""
from __future__ import annotations

from dataclasses import dataclass

from .constants import Role
from .errors import ReviewError


def normalize_role(raw: object) -> str:
    """'Incoming Contributor' / 'incoming-contributor' -> 'incoming_contributor'."""
    value = getattr(raw, "value", raw)
    return str(value or "").strip().lower().replace(" ", "_").replace("-", "_")


@dataclass(frozen=True)
class Actor:
    user_id: str
    role: str
    project_id: str
    name: str = ""


def require_roles(actor: Actor, *allowed: Role) -> None:
    allowed_roles = {r.value for r in allowed}
    if Role.CONTRIBUTOR in allowed or Role.INCOMING_CONTRIBUTOR in allowed:
        allowed_roles.add(Role.CONTRIBUTOR.value)
        allowed_roles.add(Role.INCOMING_CONTRIBUTOR.value)
    if actor.role not in allowed_roles:
        raise ReviewError(
            403, "forbidden", "Your role cannot perform this action."
        )
