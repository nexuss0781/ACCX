"""Synchronous Python client for ACCX reference-based actions."""

import json
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from .models import JobSubmission, SanitizedJobResult


class AccxClient:
    """Submits actions by secret reference and never resolves secret material."""

    def __init__(self, *, base_url: str, workload_token: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._workload_token = workload_token

    def submit_action(self, job: JobSubmission) -> SanitizedJobResult:
        return self._request("POST", "/api/v1/jobs", job.as_wire())

    def get_job_status(self, job_id: str) -> SanitizedJobResult:
        return self._request("GET", f"/api/v1/jobs/status?jobId={job_id}")

    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> SanitizedJobResult:
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = Request(
            f"{self._base_url}{path}",
            data=body,
            method=method,
            headers={"Content-Type": "application/json", "X-ACCX-Workload-Token": self._workload_token},
        )
        try:
            with urlopen(request, timeout=30) as response:
                data = json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            raise RuntimeError("ACCX request was rejected.") from error
        return SanitizedJobResult(
            job_id=data["jobId"], status=data["status"], message=data["message"], completed_at=data.get("completedAt")
        )
