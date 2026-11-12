"""PUBLIC API of the risk module. STUB: returns sample JSON."""
from app.core.samples import load_sample


def timeline(project_id: str) -> list[dict]:
    return load_sample("timeline")


def risk_radar(project_id: str) -> list[dict]:
    return load_sample("risk_radar")


def delivery_status(project_id: str) -> list[dict]:
    return load_sample("delivery_status")
