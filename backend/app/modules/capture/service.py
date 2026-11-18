"""Manual project knowledge capture."""
from sqlalchemy.orm import Session

from app.modules.ingestion import public as ingestion


def capture_note(*, project_id: str, author: str, title: str, body: str, acl_label: str, session: Session) -> dict:
    return ingestion.create_captured_note(project_id, title, body, author, acl_label, session)
