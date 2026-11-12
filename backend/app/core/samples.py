"""Stub data: public.py stubs return the sample JSON in contracts/samples/."""
import copy
import json
from functools import lru_cache

from app.core.config import get_settings


@lru_cache
def _load(name: str):
    path = get_settings().contracts_dir / "samples" / f"{name}.json"
    return json.loads(path.read_text(encoding="utf-8"))


def load_sample(name: str):
    """Return a fresh deep copy so callers can never mutate the cached sample."""
    return copy.deepcopy(_load(name))
