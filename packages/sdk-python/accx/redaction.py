from __future__ import annotations

from typing import Any


def redact(value: Any) -> Any:
    """Return a log-safe copy without preserving secret-shaped values."""
    if isinstance(value, str):
        return "[redacted]"
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, dict):
        return {
            key: "[redacted]" if any(word in key.lower() for word in ("password", "secret", "token", "credential", "authorization", "cookie", "key")) else redact(item)
            for key, item in value.items()
        }
    return value
