"""PUBLIC API of the extraction module."""
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.extraction import service


def start_reconstruct(project_id: str, mode: str | None = None) -> dict[str, Any]:
    return service.start_reconstruct(project_id, mode=mode)


def get_job(job_id: str, project_id: str | None = None) -> dict[str, Any] | None:
    return service.get_job(job_id, project_id=project_id)


def reset_demo(session: Session) -> None:
    session.execute(text("delete from extraction_jobs where project_id = 'proj-campus-event-portal'"))
    session.commit()
