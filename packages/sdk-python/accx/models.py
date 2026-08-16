"""Reference-only data models for ACCX control-plane calls."""

from dataclasses import dataclass
from typing import Any, Literal

Scope = Literal["metadata.read", "secret.rotate", "provider.publish", "job.execute", "audit.read", "identity.manage"]
JobStatus = Literal["queued", "running", "succeeded", "failed", "cancelled"]


@dataclass(frozen=True)
class JobSubmission:
    action: str
    secret_references: list[str]
    required_scopes: list[Scope]
    input: dict[str, Any]
    idempotency_key: str

    def as_wire(self) -> dict[str, Any]:
        return {
            "action": self.action,
            "secretReferences": self.secret_references,
            "requiredScopes": self.required_scopes,
            "input": self.input,
            "idempotencyKey": self.idempotency_key,
        }


@dataclass(frozen=True)
class SanitizedJobResult:
    job_id: str
    status: JobStatus
    message: str
    completed_at: str | None
