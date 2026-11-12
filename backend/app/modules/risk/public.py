"""PUBLIC API of risk. Cross-module reads go through ingestion.public (ACL first)."""
from sqlalchemy.orm import Session

from app.modules.ingestion import public as ingestion_public
from app.modules.risk import service


def _visible_chunks(project_id: str, session: Session, role: str) -> list[dict]:
    """Fetch only chunks already authorised for this role before deriving any summaries."""
    return ingestion_public.list_chunks(project_id, role, session)


def timeline(project_id: str, session: Session, role: str) -> list[dict]:
    return service.build_timeline(_visible_chunks(project_id, session, role))


def risk_radar(project_id: str, session: Session, role: str) -> list[dict]:
    return service.build_risk_radar(_visible_chunks(project_id, session, role))


def delivery_status(project_id: str, session: Session, role: str) -> list[dict]:
    return service.build_delivery_status(_visible_chunks(project_id, session, role))
