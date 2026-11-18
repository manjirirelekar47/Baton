"""Public response shapes for source-change monitoring."""
from typing import Literal

from pydantic import BaseModel


class DriftAlert(BaseModel):
    alert_id: str
    title: str
    source_type: str
    acl_label: Literal["L1", "L2", "L3"]
    previous_chunks: int
    current_chunks: int
    status: Literal["open", "resolved"]
    detected_at: str
