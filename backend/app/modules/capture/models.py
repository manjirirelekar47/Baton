"""Request and response shapes for manual knowledge capture."""
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class CaptureRequest(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    body: str = Field(min_length=10, max_length=8000)
    acl_label: Literal["L1", "L2", "L3"] = "L1"
    consent: bool

    @field_validator("title", "body")
    @classmethod
    def require_non_whitespace(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("This field cannot be blank.")
        return value.strip()

    @field_validator("consent")
    @classmethod
    def require_consent(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("Confirm that you are authorised to capture this project note.")
        return value
