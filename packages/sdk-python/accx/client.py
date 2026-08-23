"""Synchronous Python client for ACCX reference-based actions."""

import asyncio
import json
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .errors import AccxError
from .models import JobSubmission, SanitizedJobResult, SecretMetadata


class AccxClient:
    """Submits actions by secret reference and never resolves secret material."""

    def __init__(self, *, base_url: str, workload_token: str, timeout: float = 15.0, max_retries: int = 2, retry_base_seconds: float = 0.25) -> None:
        self._base_url = base_url.rstrip("/")
        self._workload_token = workload_token
        self._timeout = min(max(timeout, 1.0), 60.0)
        self._max_retries = min(max(max_retries, 0), 5)
        self._retry_base_seconds = min(max(retry_base_seconds, 0.05), 5.0)

    def submit_action(self, job: JobSubmission) -> SanitizedJobResult:
        return self._request("POST", "/api/v1/workloads", {"command": "submit_job", **job.as_wire()})

    def get_job_status(self, job_id: str) -> SanitizedJobResult:
        return self._request("GET", f"/api/v1/workloads?command=job_status&jobId={job_id}")

    def get_secret_metadata(self, reference: str) -> SecretMetadata:
        request = Request(
            f"{self._base_url}/api/v1/workloads?command=list_secret_metadata",
            method="GET",
            headers={"X-ACCX-Workload-Token": self._workload_token},
        )
        payload = self._perform(request)
        for item in payload.get("secrets", []):
            if item.get("reference") == reference:
                return SecretMetadata(
                    id=item["id"], provider=item["provider"], display_name=item["displayName"], reference=item["reference"], environment=item["environment"], status=item["status"], active_version=item["activeVersion"], rotation_state=item["rotationState"], expires_at=item.get("expiresAt"), last_used_at=item.get("lastUsedAt"), field_kind=item["fieldKind"], tags=item.get("tags", []), aliases=item.get("aliases", []), health_status=item["healthStatus"], last_rotated_at=item.get("lastRotatedAt"),
                )
        raise AccxError("ACCX secret metadata was not found.", status=404)

    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> SanitizedJobResult:
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = Request(
            f"{self._base_url}{path}",
            data=body,
            method=method,
            headers={"Content-Type": "application/json", "X-ACCX-Workload-Token": self._workload_token},
        )
        data = self._perform(request)
        return SanitizedJobResult(
            job_id=data["jobId"], status=data["status"], message=data["message"], completed_at=data.get("completedAt")
        )

    def _perform(self, request: Request) -> dict[str, Any]:
        last_error: AccxError | None = None
        for attempt in range(self._max_retries + 1):
            try:
                with urlopen(request, timeout=self._timeout) as response:
                    return json.loads(response.read().decode("utf-8"))
            except HTTPError as error:
                last_error = AccxError(status=error.code)
                if not last_error.retryable or attempt == self._max_retries:
                    raise last_error from error
            except (URLError, TimeoutError) as error:
                last_error = AccxError("ACCX network request failed.", status=0)
                if attempt == self._max_retries:
                    raise last_error from error
            time.sleep(self._retry_base_seconds * (2**attempt))
        raise last_error or AccxError("ACCX network request failed.")


class AsyncAccxClient:
    """Async wrapper with identical reference-only behavior and no plaintext cache."""

    def __init__(self, **options: Any) -> None:
        self._sync = AccxClient(**options)

    async def submit_action(self, job: JobSubmission) -> SanitizedJobResult:
        return await asyncio.to_thread(self._sync.submit_action, job)

    async def get_job_status(self, job_id: str) -> SanitizedJobResult:
        return await asyncio.to_thread(self._sync.get_job_status, job_id)

    async def get_secret_metadata(self, reference: str) -> SecretMetadata:
        return await asyncio.to_thread(self._sync.get_secret_metadata, reference)
