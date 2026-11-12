"""PUBLIC API of the ingestion module. Other modules import only from here. STUB: returns sample JSON."""
from app.core import acl
from app.core.samples import load_sample


def list_sources(project_id: str) -> list[dict]:
    return load_sample("sources")


def get_chunk(project_id: str, chunk_id: str, role: str) -> dict | None:
    """Returns the chunk only if the role may read its ACL label, otherwise None (the router answers 404)."""
    chunk = load_sample("chunks").get(chunk_id)
    if chunk is None or chunk.get("project_id") != project_id or not acl.can_read(role, chunk.get("acl_label")):
        return None
    return chunk
