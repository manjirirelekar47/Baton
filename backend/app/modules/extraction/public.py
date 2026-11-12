"""PUBLIC API of the extraction module. STUB: returns sample JSON."""
from app.core.samples import load_sample


def start_reconstruct(project_id: str) -> dict:
    return load_sample("jobs")


def get_job(job_id: str) -> dict:
    return load_sample("jobs")
