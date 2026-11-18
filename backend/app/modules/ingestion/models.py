"""Pydantic contracts for consented source ingestion and immutable evidence chunks."""
from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ACLLabel = Literal["L1", "L2", "L3", "L4"]
SourceType = Literal["document", "git", "task_csv", "chat"]


class SourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source_id: str
    project_id: str
    title: str
    type: SourceType
    acl_label: ACLLabel
    consent: bool
    status: Literal["parsed", "skipped", "failed"]
    chunks: int
    note: str | None = None
    created_at: datetime | None = None
    provider: str | None = None
    external_id: str | None = None
    source_url: str | None = None
    source_hash: str | None = None
    provider_updated_at: datetime | None = None


class ChunkOut(BaseModel):
    chunk_id: str
    project_id: str
    source_id: str
    source_type: SourceType
    source_title: str
    author: str
    event_time: datetime
    acl_label: ACLLabel
    content_hash: str
    char_span: tuple[int, int]
    text: str
    provider: str | None = None
    external_id: str | None = None
    source_url: str | None = None
    source_hash: str | None = None
    provider_updated_at: datetime | None = None


class SourceCreateMetadata(BaseModel):
    """Metadata used by multipart endpoints and tests; consent is explicit."""
    acl_label: ACLLabel
    consent: bool

    @field_validator("consent")
    @classmethod
    def require_consent(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("You must confirm that you are authorised to connect this source.")
        return value


class SourceConnectionCreate(BaseModel):
    provider: Literal["github", "jira"]
    target_name: str = Field(min_length=1, max_length=255)
    acl_label: ACLLabel = "L1"
    consent: bool

    @field_validator("target_name")
    @classmethod
    def normalize_target(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("A GitHub repository or Jira project key is required.")
        return value

    @field_validator("consent")
    @classmethod
    def require_connection_consent(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("Confirm that you are authorised to connect and sync this project source.")
        return value

    @model_validator(mode="after")
    def validate_target_for_provider(self):
        if self.provider == "github" and not re.fullmatch(
            r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", self.target_name
        ):
            raise ValueError("GitHub target must use the owner/repository format.")
        if self.provider == "jira" and not re.fullmatch(r"[A-Z][A-Z0-9_]{1,19}", self.target_name):
            raise ValueError("Jira target must be a project key such as CAMPUS.")
        return self

    @field_validator("acl_label")
    @classmethod
    def validate_acl(cls, value: str) -> str:
        if value == "L4":
            raise ValueError("L4 secret sources are never accepted or stored.")
        return value


class SourceConnectionOut(BaseModel):
    id: str
    project_id: str
    provider: Literal["github", "jira"]
    target_name: str
    acl_label: ACLLabel
    status: Literal["connected", "needs_attention", "revoked", "syncing", "succeeded", "partial", "failed"]
    auth_status: Literal["connected", "needs_attention", "revoked"] = "connected"
    last_synced_at: str | None = None
    records_added: int = 0
    records_updated: int = 0
    records_skipped: int = 0
    error_message: str | None = None
    created_at: str
    updated_at: str


class OAuthAuthorizeRequest(BaseModel):
    provider: Literal["github", "jira"]
    target_name: str = Field(min_length=1, max_length=255)
    acl_label: ACLLabel = "L1"
    consent: bool
    redirect_uri: str | None = None

    @field_validator("target_name")
    @classmethod
    def normalize_target(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Target repository or project key is required.")
        return value

    @field_validator("consent")
    @classmethod
    def require_consent(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("Confirm that you are authorised to connect this source.")
        return value

    @model_validator(mode="after")
    def validate_target_for_provider(self):
        if self.provider == "github" and not re.fullmatch(
            r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", self.target_name
        ):
            raise ValueError("GitHub target must use the owner/repository format.")
        if self.provider == "jira" and not re.fullmatch(r"[A-Z][A-Z0-9_]{1,19}", self.target_name):
            raise ValueError("Jira target must be a project key such as CAMPUS.")
        return self

    @field_validator("acl_label")
    @classmethod
    def validate_acl(cls, value: str) -> str:
        if value == "L4":
            raise ValueError("L4 secret sources are never accepted or stored.")
        return value


class OAuthAuthorizeResponse(BaseModel):
    authorization_url: str
    state: str
    provider: Literal["github", "jira"]


class OAuthExchangeRequest(BaseModel):
    code: str = Field(min_length=1)
    state: str = Field(min_length=1)


class OAuthExchangeResponse(BaseModel):
    status: str
    connection_id: str
    provider: str
    target_name: str
    auth_status: str


class ReauthorizeResponse(BaseModel):
    authorization_url: str
    state: str
    provider: str
