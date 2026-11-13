"""In-memory ClaimsPort used by every review test (stands in for Samiksha's module)."""
from __future__ import annotations

from dataclasses import replace

from app.modules.review.claims_port import Claim, Evidence, Gap


class FakeClaims:
    def __init__(self):
        self.claims: dict[tuple[str, str], Claim] = {}
        self.gaps: dict[tuple[str, str], Gap] = {}
        self.calls: list[tuple] = []

    # seeding
    def add(self, c: Claim):
        self.claims[(c.project_id, c.id)] = c

    def add_gap(self, g: Gap):
        self.gaps[(g.project_id, g.id)] = g

    def set_state(self, project_id, claim_id, state):
        k = (project_id, claim_id)
        self.claims[k] = replace(self.claims[k], state=state)

    # ClaimsPort
    def list_claims(self, project_id):
        return [c for (p, _), c in self.claims.items() if p == project_id]

    def get_claim(self, project_id, claim_id):
        return self.claims.get((project_id, claim_id))

    def edit_statement(self, project_id, claim_id, statement, edited_by):
        self.calls.append(("edit", claim_id))
        k = (project_id, claim_id)
        self.claims[k] = replace(self.claims[k], statement=statement, review_state="Reviewed")
        return self.claims[k]

    def resolve_conflict(self, project_id, chosen_claim_id, other_claim_ids, resolved_by):
        self.calls.append(("resolve", chosen_claim_id, tuple(other_claim_ids)))
        k = (project_id, chosen_claim_id)
        self.claims[k] = replace(self.claims[k], state="Verified", conflict_with=(), suggested_claim_id=None)
        return self.claims[k]

    def mark_review_state(self, project_id, claim_ids, review_state):
        self.calls.append(("mark", tuple(claim_ids), review_state))
        for cid in claim_ids:
            k = (project_id, cid)
            if k in self.claims:
                self.claims[k] = replace(self.claims[k], review_state=review_state)

    def list_gaps(self, project_id):
        return [g for (p, _), g in self.gaps.items() if p == project_id]

    def get_gap(self, project_id, gap_id):
        return self.gaps.get((project_id, gap_id))

    def create_attested_claim(
        self, project_id, gap_id, statement, author_id, acl_label,
        entity_key=None, related_claim_id=None,
    ):
        cid = f"att-{len(self.claims)+1}"
        c = Claim(
            id=cid, project_id=project_id, type="next_action", statement=statement,
            state="Attested", acl_label=acl_label, entity_key=entity_key,
        )
        self.add(c)
        return c


def ev(chunk, quote, acl="L1"):
    return (Evidence(chunk, quote, acl_label=acl),)


def seed(fake: FakeClaims, p: str = "p1") -> None:
    """Planted items from the demo dataset."""
    fake.add(Claim(
        "c-pay-A", p, "owner", "Payments owner is Aarav", "Conflicting", "L1",
        "module:payments", "owner", evidence=ev("S3-T41", "Owner: Aarav"),
        conflict_with=("c-pay-B",),
    ))
    fake.add(Claim(
        "c-pay-B", p, "owner", "Rohan owns the payments module", "Conflicting", "L1",
        "module:payments", "owner", evidence=ev("S4-212", "Rohan took payments over"),
        conflict_with=("c-pay-A",), suggested_claim_id="c-pay-B",
    ))
    fake.add(Claim(
        "c-test", p, "decision", "Payments run in test mode", "Verified", "L1",
        evidence=ev("S4-14", "we stay in test mode till finance approves"),
    ))
    fake.add(Claim(
        "c-readme", p, "decision", "Use Postgres", "Verified", "L1",
        evidence=ev("S1-2", "We chose Postgres"),
    ))
    fake.add(Claim(
        "c-staging", p, "risk", "Staging server likely expires about 30 Nov", "Inferred", "L2",
        evidence=ev("S2-9", "free tier, 90 days", acl="L2"),
    ))
    fake.add(Claim(
        "c-domain", p, "open_question", "Who holds the domain-registrar login?", "Missing", "L1",
    ))
    fake.add(Claim(
        "c-friday", p, "recurring_problem", "Deploys fail on Fridays unless cache cleared",
        "Attested", "L1",
    ))
    fake.add(Claim(
        "c-lead", p, "decision", "Leadership-only stipend decision", "Verified", "L3",
        evidence=ev("S4-300", "stipend approved", acl="L3"),
    ))
    fake.add(Claim(
        "c-secret", p, "contact", "Key is sk-ABCDEFGHIJKLMNOP", "Verified", "L4",
        evidence=ev("S2-1", "sk-ABCDEFGHIJKLMNOP", acl="L4"),
    ))
    fake.add_gap(Gap("g-queue", p, "Why was the job queue adopted?", "L1", "decision:job-queue"))
    fake.add_gap(Gap("g-lead", p, "Leadership-only question", "L3"))
