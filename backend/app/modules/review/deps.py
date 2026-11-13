"""ALL wiring to Manjiri's core/ lives here (the only file besides
claims_adapter.py that touches other modules). Every guess is marked WIRE.

Tests override get_db / get_actor / get_claims with app.dependency_overrides.
"""
from __future__ import annotations

import importlib
import inspect
import logging
from typing import Any, Iterator

from fastapi import Depends, HTTPException

from .actor import Actor, normalize_role
from .claims_adapter import PublicClaimsAdapter
from .claims_port import ClaimsPort
from .constants import NEVER_VISIBLE_LABEL

log = logging.getLogger(__name__)

DEFAULT_PROJECT_ID = "demo"


# ---------------------------------------------------------------- database
def get_db() -> Iterator[Any]:
    """WIRE: yields a SQLAlchemy Session from core/db.py."""
    try:
        core_db = importlib.import_module("app.core.db")
    except ImportError as exc:
        raise HTTPException(500, f"WIRE deps.get_db: cannot import app.core.db ({exc})") from exc
    fn = next((getattr(core_db, n) for n in ("get_session", "get_db", "session_scope")
               if callable(getattr(core_db, n, None))), None)
    if fn is None:
        raise HTTPException(500, "WIRE deps.get_db: no get_session/get_db in app.core.db")
    res = fn()
    if inspect.isgenerator(res):
        yield from res
    else:
        with res as session:
            yield session


# -------------------------------------------------------------------- actor
def _attr(obj: Any, *names: str, default: Any = None) -> Any:
    for n in names:
        v = obj.get(n) if isinstance(obj, dict) else getattr(obj, n, None)
        if v is not None:
            return v
    return default


def actor_from_user(user: Any) -> Actor:
    return Actor(
        user_id=str(_attr(user, "id", "user_id", "sub", "username", default="")),
        role=normalize_role(_attr(user, "role", default="")),
        project_id=str(_attr(user, "project_id", "project", default=DEFAULT_PROJECT_ID)),
        name=str(_attr(user, "name", "display_name", default="")),
    )


def _find_core_user_dependency():
    try:
        mod = importlib.import_module("app.core.auth")
    except ImportError:
        return None
    for name in ("get_current_user", "current_user", "require_user", "get_user"):
        fn = getattr(mod, name, None)
        if callable(fn):
            return fn
    return None


_CORE_USER_DEP = _find_core_user_dependency()

if _CORE_USER_DEP is not None:

    def get_actor(user=Depends(_CORE_USER_DEP)) -> Actor:
        actor = actor_from_user(user)
        if not actor.user_id:
            raise HTTPException(401, "Not authenticated")
        return actor

else:

    def get_actor() -> Actor:
        raise HTTPException(500, "WIRE deps.get_actor: no current-user dependency in app.core.auth")


# -------------------------------------------------------------------- ACL
def get_allowed_labels(actor: Actor = Depends(get_actor)) -> frozenset[str]:
    """WIRE: must go through core/acl.py's single filter. L4 is removed regardless."""
    try:
        acl = importlib.import_module("app.core.acl")
        labels = acl.visible_labels(actor.role)
    except (ImportError, AttributeError):
        log.warning("core.acl.visible_labels unavailable; using local approver/leaver matrix")
        labels = {"L1", "L2", "L3"} if actor.role in {"approver", "leaver"} else set()
    return frozenset(str(x).upper() for x in labels) - {NEVER_VISIBLE_LABEL}


# ----------------------------------------------------------------- claims
_singleton_claims = PublicClaimsAdapter()


def get_claims() -> ClaimsPort:
    return _singleton_claims
