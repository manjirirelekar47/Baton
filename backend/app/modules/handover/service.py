"""Handover service: role-filtered view, plan, section receipts, owner accept or decline.

Reads approved versions only through app.modules.review.public (never review's tables).
Every read of claims goes through core.acl BEFORE anything is built."""
import json
import uuid

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import acl, audit
from app.core.auth import User
from app.modules.handover import builders
from app.modules.handover.models import TaskCreateRequest, TaskUpdateRequest
from app.modules.review import public as review

NOT_FOUND = "This handover version was not found or has not been shared with you."


def detect_cycle(graph: dict[str, list[str]]) -> list[str] | None:
    """Detect if a directed graph contains a cycle.
    Returns the cycle path as list of strings if a cycle exists, else None.
    graph: task_id -> list of task_ids it depends on (blocked_by).
    """
    for node, deps in graph.items():
        if node in deps:
            return [node, node]

    VISITING = 1
    VISITED = 2
    state: dict[str, int] = {}
    cycle: list[str] = []

    def dfs(curr: str, path: list[str]) -> bool:
        state[curr] = VISITING
        for nxt in graph.get(curr, []):
            if nxt == curr:
                cycle.extend([curr, curr])
                return True
            if state.get(nxt) == VISITING:
                idx = path.index(nxt) if nxt in path else 0
                cycle.extend(path[idx:] + [nxt])
                return True
            if nxt not in state:
                if dfs(nxt, path + [nxt]):
                    return True
        state[curr] = VISITED
        return False

    for n in list(graph.keys()):
        if n not in state:
            if dfs(n, [n]):
                return cycle
    return None


def record_activity(
    session: Session,
    user: User,
    version_id: str,
    task_id: str,
    action: str,
    field: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
) -> None:
    session.execute(
        text(
            "insert into activity_history "
            "(id, version_id, project_id, task_id, actor_id, actor_name, action, field, old_value, new_value, created_at) "
            "values (:id, :v, :p, :t, :aid, :aname, :action, :field, :old, :new, :at)"
        ),
        {
            "id": uuid.uuid4().hex,
            "v": version_id,
            "p": user.project_id,
            "t": task_id,
            "aid": user.id,
            "aname": user.name,
            "action": action,
            "field": field,
            "old": str(old_value) if old_value is not None else None,
            "new": str(new_value) if new_value is not None else None,
            "at": audit.now_iso(),
        },
    )


def is_task_assigned_to_user(task: dict, user: User) -> bool:
    owner = (task.get("owner") or "").strip().lower()
    prop_owner = (task.get("proposed_owner") or "").strip().lower()
    prop_owner_id = (task.get("proposed_owner_id") or "").strip()
    u_id = (user.id or "").strip().lower()
    u_name = (user.name or "").strip().lower()
    u_role = (user.role or "").strip().lower().replace("_", " ")

    if owner and (owner == u_name or owner == u_id or owner == u_role):
        return True
    if prop_owner_id and prop_owner_id == user.id:
        return True
    if prop_owner and (prop_owner == u_name or prop_owner == u_role):
        return True
    return False


def _get_version_tasks_graph(session: Session, user: User, version_id: str) -> dict[str, list[str]]:
    _, filtered = _load(user, version_id)

    deleted_ids = {
        r[0] for r in session.execute(
            text("select task_id from plan_deleted_tasks where version_id = :v"),
            {"v": version_id},
        ).fetchall()
    }

    dep_rows = session.execute(
        text("select task_id, blocked_by_id from task_dependencies where version_id = :v"),
        {"v": version_id},
    ).mappings().all()
    custom_deps: dict[str, list[str]] = {}
    for d in dep_rows:
        custom_deps.setdefault(d["task_id"], []).append(d["blocked_by_id"])

    graph: dict[str, list[str]] = {}
    for c in filtered.visible:
        cid = c.get("claim_id")
        if cid and cid not in deleted_ids:
            if cid in custom_deps:
                graph[cid] = list(custom_deps[cid])
            else:
                graph[cid] = list(c.get("blocked_by") or [])

    custom_tasks = session.execute(
        text("select id, blocked_by from handover_tasks where version_id = :v and id not in (select task_id from plan_deleted_tasks where version_id = :v)"),
        {"v": version_id},
    ).mappings().all()
    for ct in custom_tasks:
        cid = ct["id"]
        if cid in custom_deps:
            graph[cid] = list(custom_deps[cid])
        else:
            try:
                graph[cid] = json.loads(ct["blocked_by"]) if ct["blocked_by"] else []
            except Exception:
                graph[cid] = []

    return graph


def _get_task(session: Session, user: User, version_id: str, task_id: str) -> dict | None:
    is_deleted = session.execute(
        text("select 1 from plan_deleted_tasks where version_id = :v and task_id = :t"),
        {"v": version_id, "t": task_id},
    ).first()
    if is_deleted:
        return None

    custom_deps = [
        r[0] for r in session.execute(
            text("select blocked_by_id from task_dependencies where version_id = :v and task_id = :t"),
            {"v": version_id, "t": task_id},
        ).fetchall()
    ]

    ct = session.execute(
        text("select id, version_id, project_id, title, kind, status, owner, due_date, notes, blocked_by, created_by, created_at, updated_by, updated_at "
             "from handover_tasks where version_id = :v and id = :t"),
        {"v": version_id, "t": task_id},
    ).mappings().first()
    if ct:
        b_by = custom_deps if custom_deps else (json.loads(ct["blocked_by"]) if ct["blocked_by"] else [])
        return {
            "task_id": ct["id"],
            "claim_id": ct["id"],
            "title": ct["title"],
            "kind": ct["kind"],
            "status": ct["status"],
            "owner": ct["owner"],
            "due_date": ct["due_date"],
            "notes": ct["notes"],
            "blocked_by": b_by,
            "created_by": ct["created_by"],
            "created_at": ct["created_at"],
            "updated_by": ct["updated_by"],
            "updated_at": ct["updated_at"],
            "is_custom": True,
        }

    _, filtered = _load(user, version_id)
    claim = next((c for c in filtered.visible if c.get("claim_id") == task_id), None)
    if claim:
        status_row = session.execute(
            text("select status, owner, due_date, notes, updated_by, updated_at from plan_action_status where version_id = :v and claim_id = :t"),
            {"v": version_id, "t": task_id},
        ).mappings().first()

        b_by = custom_deps if custom_deps else list(claim.get("blocked_by") or [])
        status = status_row["status"] if status_row else "not_started"
        owner = status_row["owner"] if status_row and status_row["owner"] is not None else claim.get("owner")
        due_date = status_row["due_date"] if status_row and status_row["due_date"] is not None else claim.get("due_date")
        notes = status_row["notes"] if status_row else None
        updated_by = status_row["updated_by"] if status_row else None
        updated_at = status_row["updated_at"] if status_row else None

        return {
            "task_id": claim["claim_id"],
            "claim_id": claim["claim_id"],
            "title": claim.get("statement"),
            "kind": claim.get("type", "next_action"),
            "status": status,
            "owner": owner,
            "proposed_owner": claim.get("proposed_owner"),
            "proposed_owner_id": claim.get("proposed_owner_id"),
            "due_date": due_date,
            "notes": notes,
            "blocked_by": b_by,
            "updated_by": updated_by,
            "updated_at": updated_at,
            "is_custom": False,
        }

    return None


def _load(user: User, version_id: str) -> tuple[dict, acl.FilterResult]:
    if user.role not in builders.VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Your role cannot open the handover.")
    version = review.get_version(version_id)
    # One identical 404 for unknown, other-project, unapproved and not-shared: no ID guessing signal.
    if (
        version is None
        or version.get("project_id") != user.project_id
        or version.get("status") != "approved"
        or (user.role != "approver" and user.role not in version.get("shared_with", []))
    ):
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    return version, acl.filter_for_role(user.role, version.get("claims", []))


def get_view(session: Session, user: User, version_id: str) -> dict:
    version, filtered = _load(user, version_id)
    acked = {
        r["section"]: r["acknowledged_at"]
        for r in session.execute(
            text("select section, acknowledged_at from acknowledgements where version_id = :v and user_id = :u"),
            {"v": version_id, "u": user.id},
        ).mappings()
    }
    responses = {
        r["claim_id"]: r["response"]
        for r in session.execute(
            text("select claim_id, response from ownership_responses where version_id = :v and user_id = :u"),
            {"v": version_id, "u": user.id},
        ).mappings()
    }
    audit.log(session, user, "handover.view", obj=version_id)
    return builders.build_view(version, user.role, user.id, filtered, acked, responses)


def _save_plan(session: Session, user: User, version_id: str, plan: dict) -> None:
    params = {"v": version_id, "r": user.role, "p": user.project_id}
    session.execute(text("delete from plan_items where version_id = :v and role = :r and project_id = :p"), params)
    for bucket, items in plan.items():
        for item in items:
            session.execute(
                text(
                    "insert into plan_items (id, version_id, project_id, role, bucket, position, claim_id, kind, title, payload) "
                    "values (:id, :v, :p, :r, :bucket, :pos, :cid, :kind, :title, :payload)"
                ),
                {**params, "id": uuid.uuid4().hex, "bucket": bucket, "pos": item["position"], "cid": item["claim_id"],
                 "kind": item["kind"], "title": item["title"], "payload": json.dumps(item)},
            )
    session.commit()


def get_plan(session: Session, user: User, version_id: str) -> dict:
    _, filtered = _load(user, version_id)

    deleted_ids = {
        r[0] for r in session.execute(
            text("select task_id from plan_deleted_tasks where version_id = :v"),
            {"v": version_id},
        ).fetchall()
    }

    dep_rows = session.execute(
        text("select task_id, blocked_by_id from task_dependencies where version_id = :v"),
        {"v": version_id},
    ).mappings().all()
    custom_deps: dict[str, list[str]] = {}
    for d in dep_rows:
        custom_deps.setdefault(d["task_id"], []).append(d["blocked_by_id"])

    status_rows = session.execute(
        text("select claim_id, status, owner, due_date, notes, updated_by, updated_at from plan_action_status where version_id = :v"),
        {"v": version_id},
    ).mappings().all()
    status_map = {r["claim_id"]: dict(r) for r in status_rows}

    # Clone visible claims that are not deleted
    visible_items = []
    for c in filtered.visible:
        cid = c.get("claim_id")
        if cid in deleted_ids:
            continue
        item = dict(c)
        if cid in custom_deps:
            item["blocked_by"] = list(custom_deps[cid])
        if cid in status_map:
            s = status_map[cid]
            if s.get("owner") is not None:
                item["owner"] = s["owner"]
            if s.get("due_date") is not None:
                item["due_date"] = s["due_date"]
        visible_items.append(item)

    # Add custom tasks
    custom_tasks = session.execute(
        text("select id, version_id, project_id, title, kind, status, owner, due_date, notes, blocked_by, created_by, created_at, updated_by, updated_at "
             "from handover_tasks where version_id = :v and id not in (select task_id from plan_deleted_tasks where version_id = :v)"),
        {"v": version_id},
    ).mappings().all()
    for ct in custom_tasks:
        cid = ct["id"]
        b_by = list(custom_deps[cid]) if cid in custom_deps else (json.loads(ct["blocked_by"]) if ct["blocked_by"] else [])
        visible_items.append({
            "claim_id": cid,
            "type": ct["kind"] or "next_action",
            "statement": ct["title"],
            "state": "verified",
            "acl_label": "L1",
            "owner": ct["owner"],
            "proposed_owner": None,
            "proposed_owner_id": None,
            "due_date": ct["due_date"],
            "blocked_by": b_by,
            "evidence": [],
            "notes": ct["notes"],
            "is_custom": True,
        })

    plan = builders.build_plan(visible_items, user.id)
    _save_plan(session, user, version_id, plan)

    # Attach live action status and notes to plan items
    for bucket_items in plan.values():
        for item in bucket_items:
            cid = item["claim_id"]
            ct = next((x for x in custom_tasks if x["id"] == cid), None)
            if ct:
                item["action_status"] = ct["status"]
                item["action_notes"] = ct["notes"]
                item["action_updated_at"] = ct["updated_at"]
                item["action_updated_by"] = ct["updated_by"]
                item["owner"] = ct["owner"]
                item["due_date"] = ct["due_date"]
                item["is_custom"] = True
            elif cid in status_map:
                s = status_map[cid]
                item["action_status"] = s["status"]
                item["action_notes"] = s["notes"]
                item["action_updated_at"] = s["updated_at"]
                item["action_updated_by"] = s["updated_by"]
                if s.get("owner"):
                    item["owner"] = s["owner"]
                if s.get("due_date"):
                    item["due_date"] = s["due_date"]
                item["is_custom"] = False
            else:
                item["action_status"] = "not_started"
                item["action_notes"] = None
                item["action_updated_at"] = None
                item["action_updated_by"] = None
                item["is_custom"] = False

    audit.log(session, user, "handover.plan", obj=version_id)
    return {"version_id": version_id, "role": user.role, "plan": plan, "note": builders.PLAN_NOTE}


def create_task(session: Session, user: User, version_id: str, body: TaskCreateRequest) -> dict:
    if user.role != "approver":
        raise HTTPException(status_code=403, detail="Only approvers can create handover tasks.")

    _load(user, version_id)

    task_id = f"task-{uuid.uuid4().hex[:8]}"

    if task_id in body.blocked_by:
        raise HTTPException(status_code=422, detail=f"Self-dependency is not allowed: task '{task_id}' cannot depend on itself.")

    graph = _get_version_tasks_graph(session, user, version_id)
    graph[task_id] = body.blocked_by
    cycle = detect_cycle(graph)
    if cycle:
        if len(cycle) == 2 and cycle[0] == cycle[1]:
            raise HTTPException(status_code=422, detail=f"Self-dependency is not allowed: task '{cycle[0]}' cannot depend on itself.")
        raise HTTPException(status_code=422, detail=f"Dependency cycle detected: {' -> '.join(cycle)}")

    now = audit.now_iso()
    session.execute(
        text("""
            insert into handover_tasks (id, version_id, project_id, title, kind, status, owner, due_date, notes, blocked_by, created_by, created_at, updated_by, updated_at)
            values (:id, :v, :p, :title, :kind, :status, :owner, :due_date, :notes, :blocked_by, :uid, :at, :uid, :at)
        """),
        {
            "id": task_id,
            "v": version_id,
            "p": user.project_id,
            "title": body.title,
            "kind": body.kind or "next_action",
            "status": body.status,
            "owner": body.owner,
            "due_date": body.due_date,
            "notes": body.notes,
            "blocked_by": json.dumps(body.blocked_by),
            "uid": user.id,
            "at": now,
        },
    )

    for dep_id in body.blocked_by:
        session.execute(
            text("""
                insert into task_dependencies (id, version_id, project_id, task_id, blocked_by_id, created_at)
                values (:id, :v, :p, :t, :b, :at)
            """),
            {
                "id": uuid.uuid4().hex,
                "v": version_id,
                "p": user.project_id,
                "t": task_id,
                "b": dep_id,
                "at": now,
            },
        )

    record_activity(session, user, version_id, task_id, "created", "task", None, body.title)
    session.commit()
    audit.log(session, user, "handover.task_create", obj=f"{version_id}:{task_id}")

    return {
        "version_id": version_id,
        "task_id": task_id,
        "claim_id": task_id,
        "title": body.title,
        "kind": body.kind,
        "status": body.status,
        "owner": body.owner,
        "due_date": body.due_date,
        "notes": body.notes,
        "blocked_by": body.blocked_by,
        "created_at": now,
        "created_by": user.id,
        "updated_at": now,
        "updated_by": user.id,
        "is_custom": True,
    }


def update_task(session: Session, user: User, version_id: str, task_id: str, body: TaskUpdateRequest) -> dict:
    if user.role not in builders.ACK_ROLES and user.role not in builders.VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Your role cannot modify handover tasks.")

    task = _get_task(session, user, version_id, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found in your handover plan.")

    is_approver = user.role == "approver"
    if not is_approver:
        if not is_task_assigned_to_user(task, user):
            raise HTTPException(status_code=403, detail="You can only update tasks explicitly assigned to you.")

        if body.owner is not None and body.owner != task.get("owner"):
            raise HTTPException(status_code=403, detail="Only approvers can assign or reassign task owners.")
        if body.due_date is not None and body.due_date != task.get("due_date"):
            raise HTTPException(status_code=403, detail="Only approvers can change due dates.")
        if body.blocked_by is not None and set(body.blocked_by) != set(task.get("blocked_by") or []):
            raise HTTPException(status_code=403, detail="Only approvers can change task dependencies.")
        if body.title is not None and body.title != task.get("title"):
            raise HTTPException(status_code=403, detail="Only approvers can change task title.")

    if body.blocked_by is not None:
        if task_id in body.blocked_by:
            raise HTTPException(status_code=422, detail=f"Self-dependency is not allowed: task '{task_id}' cannot depend on itself.")

        graph = _get_version_tasks_graph(session, user, version_id)
        graph[task_id] = body.blocked_by
        cycle = detect_cycle(graph)
        if cycle:
            if len(cycle) == 2 and cycle[0] == cycle[1]:
                raise HTTPException(status_code=422, detail=f"Self-dependency is not allowed: task '{cycle[0]}' cannot depend on itself.")
            raise HTTPException(status_code=422, detail=f"Dependency cycle detected: {' -> '.join(cycle)}")

    now = audit.now_iso()
    old_status = task.get("status") or "not_started"
    new_status = body.status if body.status is not None else old_status

    old_owner = task.get("owner")
    new_owner = body.owner if body.owner is not None else old_owner

    old_due_date = task.get("due_date")
    new_due_date = body.due_date if body.due_date is not None else old_due_date

    old_notes = task.get("notes")
    new_notes = body.notes if body.notes is not None else old_notes

    old_blocked_by = task.get("blocked_by") or []
    new_blocked_by = body.blocked_by if body.blocked_by is not None else old_blocked_by

    old_title = task.get("title")
    new_title = body.title if body.title is not None else old_title

    if new_status != old_status:
        record_activity(session, user, version_id, task_id, "status_changed", "status", old_status, new_status)
    if new_owner != old_owner:
        record_activity(session, user, version_id, task_id, "owner_changed", "owner", old_owner, new_owner)
    if new_due_date != old_due_date:
        record_activity(session, user, version_id, task_id, "due_date_changed", "due_date", old_due_date, new_due_date)
    if new_notes != old_notes:
        record_activity(session, user, version_id, task_id, "notes_changed", "notes", old_notes, new_notes)
    if body.blocked_by is not None and set(new_blocked_by) != set(old_blocked_by):
        record_activity(session, user, version_id, task_id, "dependencies_changed", "dependencies", json.dumps(old_blocked_by), json.dumps(new_blocked_by))
    if new_title != old_title:
        record_activity(session, user, version_id, task_id, "title_changed", "title", old_title, new_title)

    if task.get("is_custom"):
        session.execute(
            text("""
                update handover_tasks
                set title = :title, status = :status, owner = :owner, due_date = :due_date, notes = :notes,
                    blocked_by = :blocked_by, updated_by = :uid, updated_at = :at
                where id = :id and version_id = :v and project_id = :p
            """),
            {
                "title": new_title,
                "status": new_status,
                "owner": new_owner,
                "due_date": new_due_date,
                "notes": new_notes,
                "blocked_by": json.dumps(new_blocked_by),
                "uid": user.id,
                "at": now,
                "id": task_id,
                "v": version_id,
                "p": user.project_id,
            },
        )
    else:
        existing_status = session.execute(
            text("select id from plan_action_status where version_id = :v and claim_id = :c and project_id = :p"),
            {"v": version_id, "c": task_id, "p": user.project_id},
        ).first()
        if existing_status:
            session.execute(
                text("""
                    update plan_action_status
                    set status = :status, owner = :owner, due_date = :due_date, notes = :notes,
                        updated_by = :uid, updated_at = :at
                    where id = :id and project_id = :p
                """),
                {
                    "status": new_status,
                    "owner": new_owner,
                    "due_date": new_due_date,
                    "notes": new_notes,
                    "uid": user.id,
                    "at": now,
                    "id": existing_status[0],
                    "p": user.project_id,
                },
            )
        else:
            session.execute(
                text("""
                    insert into plan_action_status (id, version_id, project_id, claim_id, status, owner, due_date, notes, updated_by, updated_at)
                    values (:id, :v, :p, :c, :status, :owner, :due_date, :notes, :uid, :at)
                """),
                {
                    "id": uuid.uuid4().hex,
                    "v": version_id,
                    "p": user.project_id,
                    "c": task_id,
                    "status": new_status,
                    "owner": new_owner,
                    "due_date": new_due_date,
                    "notes": new_notes,
                    "uid": user.id,
                    "at": now,
                },
            )

    if body.blocked_by is not None:
        session.execute(
            text("delete from task_dependencies where version_id = :v and task_id = :t"),
            {"v": version_id, "t": task_id},
        )
        for dep_id in new_blocked_by:
            session.execute(
                text("""
                    insert into task_dependencies (id, version_id, project_id, task_id, blocked_by_id, created_at)
                    values (:id, :v, :p, :t, :b, :at)
                """),
                {
                    "id": uuid.uuid4().hex,
                    "v": version_id,
                    "p": user.project_id,
                    "t": task_id,
                    "b": dep_id,
                    "at": now,
                },
            )

    session.commit()
    audit.log(session, user, f"handover.task_update.{new_status}", obj=f"{version_id}:{task_id}")
    return {
        "version_id": version_id,
        "task_id": task_id,
        "claim_id": task_id,
        "title": new_title,
        "kind": task.get("kind", "next_action"),
        "status": new_status,
        "owner": new_owner,
        "due_date": new_due_date,
        "notes": new_notes,
        "blocked_by": new_blocked_by,
        "updated_at": now,
        "updated_by": user.id,
    }


def delete_task(session: Session, user: User, version_id: str, task_id: str) -> dict:
    if user.role != "approver":
        raise HTTPException(status_code=403, detail="Only approvers can delete handover tasks.")

    task = _get_task(session, user, version_id, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found in your handover plan.")

    now = audit.now_iso()
    if task.get("is_custom"):
        session.execute(
            text("delete from handover_tasks where id = :id and version_id = :v and project_id = :p"),
            {"id": task_id, "v": version_id, "p": user.project_id},
        )
    else:
        session.execute(
            text("""
                insert into plan_deleted_tasks (id, version_id, project_id, task_id, deleted_by, deleted_at)
                values (:id, :v, :p, :t, :uid, :at)
            """),
            {
                "id": uuid.uuid4().hex,
                "v": version_id,
                "p": user.project_id,
                "t": task_id,
                "uid": user.id,
                "at": now,
            },
        )

    session.execute(
        text("delete from task_dependencies where version_id = :v and (task_id = :t or blocked_by_id = :t)"),
        {"v": version_id, "t": task_id},
    )

    record_activity(session, user, version_id, task_id, "deleted", "task", task.get("title"), None)
    session.commit()
    audit.log(session, user, "handover.task_delete", obj=f"{version_id}:{task_id}")

    return {"status": "deleted", "version_id": version_id, "task_id": task_id}


def get_task(session: Session, user: User, version_id: str, task_id: str) -> dict:
    _load(user, version_id)
    task = _get_task(session, user, version_id, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found in your handover plan.")
    return task


def get_task_history(session: Session, user: User, version_id: str, task_id: str) -> dict:
    _load(user, version_id)
    rows = session.execute(
        text("""
            select id, version_id, project_id, task_id, actor_id, actor_name, action, field, old_value, new_value, created_at
            from activity_history
            where version_id = :v and task_id = :t and project_id = :p
            order by created_at asc
        """),
        {"v": version_id, "t": task_id, "p": user.project_id},
    ).mappings().all()

    return {
        "version_id": version_id,
        "task_id": task_id,
        "history": [dict(r) for r in rows],
    }


def update_action_status(
    session: Session,
    user: User,
    version_id: str,
    claim_id: str,
    status: str,
    owner: str | None = None,
    due_date: str | None = None,
    notes: str | None = None,
) -> dict:
    req = TaskUpdateRequest(
        version_id=version_id,
        status=status,
        owner=owner,
        due_date=due_date,
        notes=notes,
    )
    res = update_task(session, user, version_id, claim_id, req)
    return {
        "version_id": version_id,
        "claim_id": claim_id,
        "status": res["status"],
        "owner": res["owner"],
        "due_date": res["due_date"],
        "notes": res["notes"],
        "updated_at": res["updated_at"],
        "updated_by": res["updated_by"],
    }


def acknowledge(session: Session, user: User, version_id: str, section: str) -> dict:
    if user.role not in builders.ACK_ROLES:
        raise HTTPException(status_code=403, detail="Only the incoming person can acknowledge a section.")
    _, filtered = _load(user, version_id)
    if section not in builders.available_sections(filtered.visible):
        raise HTTPException(status_code=422, detail="That section does not exist in your view of this handover.")
    query = text("select acknowledged_at from acknowledgements where version_id = :v and section = :s and user_id = :u")
    params = {"v": version_id, "s": section, "u": user.id}
    row = session.execute(query, params).mappings().first()
    if row is None:
        when = audit.now_iso()
        try:
            session.execute(
                text(
                    "insert into acknowledgements (id, version_id, project_id, section, user_id, role, acknowledged_at) "
                    "values (:id, :v, :p, :s, :u, :r, :at)"
                ),
                {**params, "id": uuid.uuid4().hex, "p": user.project_id, "r": user.role, "at": when},
            )
            session.commit()
        except IntegrityError:  # double click or race: the receipt already exists
            session.rollback()
            when = session.execute(query, params).mappings().first()["acknowledged_at"]
        else:
            audit.log(session, user, "handover.ack", obj=f"{version_id}:{section}")
    else:
        when = row["acknowledged_at"]
    return {"version_id": version_id, "section": section, "acknowledged_at": when, "note": builders.RECEIPT_NOTE}


def respond_ownership(session: Session, user: User, version_id: str, claim_id: str, response: str, note: str | None) -> dict:
    if user.role not in builders.ACK_ROLES:
        raise HTTPException(status_code=403, detail="Only the incoming person can accept or decline ownership.")
    _, filtered = _load(user, version_id)
    claim = next((c for c in filtered.visible if c.get("claim_id") == claim_id and c.get("type") == "owner"), None)
    if claim is None:
        raise HTTPException(status_code=404, detail="Ownership item not found in your view.")
    if claim.get("proposed_owner_id") is None:
        raise HTTPException(
            status_code=422,
            detail="No owner has been proposed for this item, so there is nothing to accept or decline. The owner stays unknown.",
        )
    if claim["proposed_owner_id"] != user.id:
        raise HTTPException(status_code=403, detail="This ownership was proposed for someone else.")
    when = audit.now_iso()
    params = {"v": version_id, "c": claim_id, "u": user.id, "p": user.project_id}
    existing = session.execute(
        text("select id from ownership_responses where version_id = :v and claim_id = :c and user_id = :u and project_id = :p"), params
    ).first()
    if existing:
        session.execute(
            text("update ownership_responses set response = :resp, note = :note, responded_at = :at where id = :id and project_id = :p"),
            {"resp": response, "note": note, "at": when, "id": existing[0], "p": user.project_id},
        )
    else:
        session.execute(
            text(
                "insert into ownership_responses (id, version_id, project_id, claim_id, user_id, response, note, responded_at) "
                "values (:id, :v, :p, :c, :u, :resp, :note, :at)"
            ),
            {**params, "id": uuid.uuid4().hex, "p": user.project_id, "resp": response, "note": note, "at": when},
        )
    session.commit()
    audit.log(session, user, f"handover.ownership.{response}", obj=f"{version_id}:{claim_id}")
    # The approved snapshot is immutable: the response is recorded beside it, the owner field is never rewritten.
    return {"version_id": version_id, "claim_id": claim_id, "response": response, "responded_at": when, "owner": claim.get("owner")}
