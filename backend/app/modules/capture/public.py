"""Public surface for captured knowledge records."""
from typing import Any

from sqlalchemy.orm import Session

from .service import capture_note


def create_note(*, project_id: str, author: str, title: str, body: str, acl_label: str, session: Session) -> dict[str, Any]:
    return capture_note(project_id=project_id, author=author, title=title, body=body, acl_label=acl_label, session=session)
