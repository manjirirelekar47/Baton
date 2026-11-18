"""Public surface for source-change snapshots and alerts."""
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from .service import list_alerts, resolve_alert, scan


def scan_sources(project_id: str, role: str, session: Session) -> dict[str, int]:
    return scan(project_id, role, session)


def get_alerts(project_id: str, role: str, session: Session) -> list[dict[str, Any]]:
    return list_alerts(project_id, role, session)


def resolve(alert_id: str, project_id: str, session: Session) -> bool:
    return resolve_alert(alert_id, project_id, session)


def reset_demo(session: Session) -> None:
    """Clear source history when the seeded demonstration workspace is reset."""
    project_id = "proj-campus-event-portal"
    session.execute(text("delete from drift_alerts where project_id=:p"), {"p": project_id})
    session.execute(text("delete from drift_snapshots where project_id=:p"), {"p": project_id})
    session.commit()
