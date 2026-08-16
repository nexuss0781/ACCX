"""Reference-only data models for ACCX control-plane calls."""

from dataclasses import dataclass
from typing import Any, Literal

Scope = Literal["metadata.read", "secret.rotate", "provider.publish", "job.execute", "audit.read", "identity.manage"]
JobStatus = Literal["awaiting_approval", "queued", "running", "succeeded", "failed", "cancelled"]


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


@dataclass(frozen=True)
class SecretMetadata:
    id: str
    provider: str
    display_name: str
    reference: str
    environment: Literal["development", "staging", "production"]
    status: Literal["pending", "active", "revoked"]
    active_version: int
    rotation_state: Literal["stable", "rotation_required", "rotating"]
    expires_at: str | None
    last_used_at: str | None
    field_kind: str
    tags: list[str]
    aliases: list[str]
    health_status: Literal["unknown", "healthy", "attention", "failed"]
    last_rotated_at: str | None
