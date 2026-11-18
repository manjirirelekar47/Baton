"""Grounded question answering contracts."""
from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)


class AskEvidence(BaseModel):
    source_title: str | None = None
    chunk_id: str | None = None
    quote: str | None = None


class AskMatch(BaseModel):
    claim_id: str
    statement: str
    owner: str | None = None
    due_date: str | None = None
    score: int
    evidence: list[AskEvidence]


class AskResponse(BaseModel):
    answer: str
    matches: list[AskMatch]
    approved_version: str | None = None
