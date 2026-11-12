"""PUBLIC API of the review module. The handover module reads approved versions ONLY through here. STUB.

Contract (contracts/schemas/version.schema.json):
  get_version(version_id) -> full snapshot dict (with claims) or None
  list_versions(project_id) -> summaries (no claims)
The real implementation must return only immutable approved snapshots to the handover module."""
from app.core.samples import load_sample


def get_version(version_id: str) -> dict | None:
    v1 = load_sample("version_v1")
    return v1 if version_id == v1["version_id"] else None


def list_versions(project_id: str) -> list[dict]:
    return [v for v in load_sample("versions") if v["project_id"] == project_id]
