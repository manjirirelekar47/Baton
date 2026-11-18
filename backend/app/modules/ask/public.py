"""Public API for the grounded Ask Baton feature."""
from typing import Any

from sqlalchemy.orm import Session

from .service import answer_question


def answer(question: str, *, project_id: str, role: str, session: Session) -> dict[str, Any]:
    return answer_question(question, project_id=project_id, role=role, session=session)
