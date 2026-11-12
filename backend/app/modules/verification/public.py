"""PUBLIC API of the verification module. STUB: returns sample JSON."""
from app.core.samples import load_sample


def list_claims(project_id: str) -> list[dict]:
    return load_sample("claims")


def get_claim(project_id: str, claim_id: str) -> dict | None:
    return next((c for c in load_sample("claims") if c["claim_id"] == claim_id), None)


def list_gaps(project_id: str) -> list[dict]:
    return load_sample("gaps")
