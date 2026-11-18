"""PUBLIC API of the handover module. Other modules import only from here."""
from sqlalchemy import text
from sqlalchemy.orm import Session


def reset_demo(session: Session) -> None:
    """Called by POST /demo/reset. Clears only this module's tables."""
    for table in (
        "acknowledgements",
        "ownership_responses",
        "plan_items",
        "plan_action_status",
        "handover_tasks",
        "task_dependencies",
        "plan_deleted_tasks",
        "activity_history",
    ):
        session.execute(text(f"delete from {table}"))
    session.commit()
