"""Adapter: ClaimsPort over Samiksha's modules/verification/public.py.

Connects to verification.public if functions exist, and falls back to
safe in-memory caching for stub methods (zero-conflict rule 7).
"""
from __future__ import annotations

import importlib
import uuid
from dataclasses import replace
from typing import Any, Sequence

from .claims_port import Claim, Evidence, Gap
from .errors import ReviewError


def _module():
    try:
        return importlib.import_module("app.modules.verification.public")
    except ImportError as exc:
        raise ReviewError(501, "claims_not_wired", f"verification.public is not importable: {exc}") from exc


def _fn(*names: str):
    mod = _module()
    for n in names:
        fn = getattr(mod, n, None)
        if callable(fn):
            return fn
    raise ReviewError(
        501, "claims_not_wired",
        f"None of {list(names)} exist in verification.public. Edit claims_adapter.py.",
    )


def _fn_or_none(*names: str):
    try:
        mod = _module()
        for n in names:
            fn = getattr(mod, n, None)
            if callable(fn):
                return fn
    except Exception:
        pass
    return None


def _get(d: Any, *names: str, default: Any = None) -> Any:
    for n in names:
        v = d.get(n) if isinstance(d, dict) else getattr(d, n, None)
        if v is not None:
            return v
    return default


def to_claim(d: Any, project_id: str) -> Claim:
    c_label = str(_get(d, "acl_label", "acl", default="L1")).upper()
    evidence = tuple(
        Evidence(
            chunk_id=str(_get(e, "chunk_id")),
            quote=str(_get(e, "quote", default="")),
            acl_label=str(_get(e, "acl_label", default=c_label)).upper(),
            source_id=_get(e, "source_id"),
            source_title=_get(e, "source_title"),
            event_time=_get(e, "event_time"),
        )
        for e in (_get(d, "evidence", default=[]) or [])
    )
    raw_state = str(_get(d, "state", default="Missing"))
    state = raw_state.capitalize() if raw_state else "Missing"

    return Claim(
        id=str(_get(d, "id", "claim_id")),
        project_id=str(_get(d, "project_id", default=project_id)),
        type=str(_get(d, "type", "claim_type", default="")),
        statement=str(_get(d, "statement", default="")),
        state=state,
        acl_label=c_label,
        entity_key=_get(d, "entity_key"),
        attribute=_get(d, "attribute"),
        review_state=str(_get(d, "review_state", default="Labelled")),
        owner=_get(d, "owner"),
        proposed_owner=_get(d, "proposed_owner"),
        proposed_owner_id=_get(d, "proposed_owner_id"),
        due_date=_get(d, "due_date"),
        blocked_by=tuple(str(x) for x in (_get(d, "blocked_by", default=[]) or [])),
        attested_by=_get(d, "attested_by"),
        evidence=evidence,
        conflict_with=tuple(str(x) for x in (_get(d, "conflict_with", "conflicts", default=[]) or [])),
        suggested_claim_id=_get(d, "suggested_claim_id", "suggested"),
    )


def to_gap(d: Any, project_id: str) -> Gap:
    return Gap(
        id=str(_get(d, "id", "gap_id")),
        project_id=str(_get(d, "project_id", default=project_id)),
        question=str(_get(d, "question", "statement", default="")),
        acl_label=str(_get(d, "acl_label", "acl", default="L1")).upper(),
        entity_key=_get(d, "entity_key"),
        related_claim_id=_get(d, "related_claim_id", "claim_id"),
    )


class PublicClaimsAdapter:
    def __init__(self):
        self._local_overrides: dict[tuple[str, str], Claim] = {}
        self._local_gaps: dict[tuple[str, str], Gap] = {}

    def list_claims(self, project_id: str) -> Sequence[Claim]:
        fn = _fn_or_none("list_claims", "get_claims")
        raw = fn(project_id) if fn else []
        claims = [to_claim(d, project_id) for d in raw]
        # Overlay any local modifications / created claims
        result = []
        seen = set()
        for c in claims:
            k = (project_id, c.id)
            if k in self._local_overrides:
                result.append(self._local_overrides[k])
            else:
                result.append(c)
            seen.add(c.id)
        for (p, cid), c in self._local_overrides.items():
            if p == project_id and cid not in seen:
                result.append(c)
        return result

    def get_claim(self, project_id: str, claim_id: str) -> Claim | None:
        k = (project_id, claim_id)
        if k in self._local_overrides:
            return self._local_overrides[k]
        fn = _fn_or_none("get_claim")
        if fn:
            d = fn(project_id, claim_id)
            if d:
                return to_claim(d, project_id)
        # Search in list_claims
        for c in self.list_claims(project_id):
            if c.id == claim_id:
                return c
        return None

    def edit_statement(self, project_id: str, claim_id: str, statement: str, edited_by: str) -> Claim:
        fn = _fn_or_none("reverify", "edit_claim", "update_claim")
        if fn:
            return to_claim(fn(project_id, claim_id, statement, edited_by), project_id)
        claim = self.get_claim(project_id, claim_id)
        if claim:
            updated = replace(claim, statement=statement, review_state="Reviewed")
            self._local_overrides[(project_id, claim_id)] = updated
            return updated
        raise ReviewError(404, "claim_not_found", "Claim not found.")

    def resolve_conflict(self, project_id: str, chosen_claim_id: str, other_claim_ids: Sequence[str], resolved_by: str) -> Claim:
        fn = _fn_or_none("resolve_conflict")
        if fn:
            return to_claim(fn(project_id, chosen_claim_id, list(other_claim_ids), resolved_by), project_id)
        chosen = self.get_claim(project_id, chosen_claim_id)
        if chosen:
            updated = replace(chosen, state="Verified", conflict_with=(), suggested_claim_id=None)
            self._local_overrides[(project_id, chosen_claim_id)] = updated
            for oid in other_claim_ids:
                other = self.get_claim(project_id, oid)
                if other:
                    self._local_overrides[(project_id, oid)] = replace(other, review_state="Rejected")
            return updated
        raise ReviewError(404, "claim_not_found", "Claim not found.")

    def mark_review_state(self, project_id: str, claim_ids: Sequence[str], review_state: str) -> None:
        fn = _fn_or_none("mark_review_state", "set_review_state")
        if fn:
            fn(project_id, list(claim_ids), review_state)
            return
        for cid in claim_ids:
            c = self.get_claim(project_id, cid)
            if c:
                self._local_overrides[(project_id, cid)] = replace(c, review_state=review_state)

    def list_gaps(self, project_id: str) -> Sequence[Gap]:
        fn = _fn_or_none("list_gaps", "get_gaps")
        raw = fn(project_id) if fn else []
        gaps = [to_gap(d, project_id) for d in raw]
        for (p, gid), g in self._local_gaps.items():
            if p == project_id and not any(x.id == gid for x in gaps):
                gaps.append(g)
        return gaps

    def get_gap(self, project_id: str, gap_id: str) -> Gap | None:
        k = (project_id, gap_id)
        if k in self._local_gaps:
            return self._local_gaps[k]
        fn = _fn_or_none("get_gap")
        if fn:
            d = fn(project_id, gap_id)
            if d:
                return to_gap(d, project_id)
        for g in self.list_gaps(project_id):
            if g.id == gap_id:
                return g
        return None

    def create_attested_claim(
        self, project_id: str, gap_id: str, statement: str, author_id: str, acl_label: str,
        entity_key: str | None = None, related_claim_id: str | None = None,
    ) -> Claim:
        fn = _fn_or_none("create_attested_claim", "add_attested_claim")
        if fn:
            return to_claim(
                fn(project_id, gap_id, statement, author_id, acl_label, entity_key, related_claim_id),
                project_id,
            )
        cid = f"att-{uuid.uuid4().hex[:8]}"
        c = Claim(
            id=cid,
            project_id=project_id,
            type="next_action",
            statement=statement,
            state="Attested",
            acl_label=acl_label,
            entity_key=entity_key,
            attested_by=author_id,
        )
        self._local_overrides[(project_id, cid)] = c
        return c
