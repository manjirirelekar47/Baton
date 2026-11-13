"""PUBLIC API of the extraction module."""
from typing import Any

from app.modules.extraction import service


def start_reconstruct(project_id: str, mode: str | None = None) -> dict[str, Any]:
    return service.start_reconstruct(project_id, mode=mode)


def get_job(job_id: str) -> dict[str, Any] | None:
    return service.get_job(job_id)
