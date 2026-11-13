"""HTTP-aware errors. Subclassing HTTPException lets FastAPI render them."""
from __future__ import annotations

from typing import Any

from fastapi import HTTPException


class ReviewError(HTTPException):
    def __init__(self, status_code: int, code: str, message: str, **extra: Any):
        super().__init__(
            status_code=status_code,
            detail={"code": code, "message": message, **extra},
        )


class ImmutableError(RuntimeError):
    """Raised when code tries to modify an append-only or immutable row."""
