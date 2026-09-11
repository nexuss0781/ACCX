"""Personal-access-token control-plane client for projects and environments."""

import json
import re
import time
import uuid
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .errors import AccxError

_PROJECT_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)
_VALID_LABELS = ("development", "staging", "production")


class ControlPlaneClient:
    """Projects and environments CRUD over PAT auth + freshness-headers protocol."""

    def __init__(self, *, base_url: str, personal_access_token: str, timeout: float = 15.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._pat = personal_access_token
        self._timeout = min(max(timeout, 1.0), 60.0)

    def list_projects(self) -> list[dict[str, Any]]:
        payload = self._request("list_projects", {"operation": "list"})
        return payload.get("projects") if isinstance(payload.get("projects"), list) else []

    def create_project(self, name: str, *, slug: str | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {"operation": "create", "name": name}
        if slug is not None:
            body["slug"] = slug
        payload = self._request("create_project", body)
        if "project" not in payload:
            raise AccxError("ACCX create_project returned no project.", status=502)
        return payload["project"]

    def rename_project(self, project: str, name: str) -> None:
        self._request("rename_project", {"operation": "rename", "projectId": self.resolve_project_id(project), "name": name})

    def delete_project(self, project: str) -> None:
        self._request("delete_project", {"operation": "delete", "projectId": self.resolve_project_id(project)})

    def list_environments(self, project: str) -> dict[str, Any]:
        target = self.resolve_project(project)
        return {"project": target, "environments": target.get("environments", [])}

    def add_environment(self, project: str, label: str) -> None:
        self._validate_label(label)
        self._request("add_environment", {"operation": "add_environment", "projectId": self.resolve_project_id(project), "label": label})

    def remove_environment(self, project: str, label: str) -> None:
        self._validate_label(label)
        self._request("remove_environment", {"operation": "remove_environment", "projectId": self.resolve_project_id(project), "label": label})

    def list_variables(self) -> list[dict[str, Any]]:
        """All variables across the workspace (metadata only, no values)."""
        payload = self._request("list_environment_variables", {"operation": "list"})
        return payload.get("variables") if isinstance(payload.get("variables"), list) else []

    def search_variables(self, query: str = "") -> list[dict[str, Any]]:
        """Greps variables across every project by key or project name (case-insensitive substring)."""
        body: dict[str, Any] = {"operation": "list"}
        if query and query.strip():
            body["query"] = query.strip()
        payload = self._request("list_environment_variables", body)
        return payload.get("variables") if isinstance(payload.get("variables"), list) else []

    def resolve_project(self, selector: str) -> dict[str, Any]:
        projects = self.list_projects()
        for p in projects:
            if p.get("id") == selector or p.get("slug") == selector or p.get("name") == selector:
                return p
        raise AccxError(f'Project "{selector}" was not found.', status=404)

    def resolve_project_id(self, selector: str) -> str:
        if _PROJECT_UUID_RE.match(selector):
            return selector
        return self.resolve_project(selector).get("id", selector)

    # ── internals ──────────────────────────────────────────────────────────

    @staticmethod
    def _validate_label(label: str) -> None:
        if label not in _VALID_LABELS:
            raise AccxError(f'Invalid environment label "{label}". Must be one of: {", ".join(_VALID_LABELS)}', status=2)

    def _request(self, command: str, body: dict[str, Any]) -> dict[str, Any]:
        url = f"{self._base_url}/api/v1/app"
        data = json.dumps({**body, "command": command}).encode("utf-8")
        nonce = uuid.uuid4().hex
        request = Request(
            url,
            data=data,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self._pat}",
                "Origin": self._base_url,
                "X-ACCX-Request-Timestamp": str(int(time.time() * 1000)),
                "X-ACCX-Request-Nonce": nonce,
            },
        )
        return self._perform(request)

    def _perform(self, request: Request) -> dict[str, Any]:
        try:
            with urlopen(request, timeout=self._timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            try:
                payload = json.loads(error.read().decode("utf-8"))
                message = payload.get("error") or f"ACCX request failed with status {error.code}."
            except Exception:
                message = f"ACCX request failed with status {error.code}."
            raise AccxError(message, status=error.code) from error
        except (URLError, TimeoutError) as error:
            raise AccxError("ACCX network request failed.", status=0) from error