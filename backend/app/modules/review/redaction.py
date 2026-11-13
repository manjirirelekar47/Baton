"""Defence-in-depth secret/PII redaction for free text typed into Baton
(leaver answers). Bhavesh's ingestion redactor covers uploaded files; this
covers text that never passes through ingestion.
"""
from __future__ import annotations

import re

_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"AKIA[0-9A-Z]{16}"), "[REDACTED:key]"),
    (re.compile(r"\bsk-[A-Za-z0-9_\-]{12,}"), "[REDACTED:key]"),
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}"), "[REDACTED:key]"),
    (
        re.compile(r"(?i)\b(password|passwd|pwd|secret|token|api[_\- ]?key)\b(\s*[:=]\s*)(\S+)"),
        r"\1\2[REDACTED:secret]",
    ),
    (re.compile(r"\b[A-Fa-f0-9]{32,}\b"), "[REDACTED:token]"),
    (re.compile(r"[\w.+\-]+@[\w\-]+\.[\w.\-]+"), "[REDACTED:email]"),
    (re.compile(r"(?<!\d)(?:\+91[\- ]?)?[6-9]\d{9}(?!\d)"), "[REDACTED:phone]"),
]


def redact_secrets(text: str) -> tuple[str, int]:
    """Return (clean_text, number_of_redactions)."""
    total = 0
    for pattern, repl in _PATTERNS:
        text, n = pattern.subn(repl, text)
        total += n
    return text, total
