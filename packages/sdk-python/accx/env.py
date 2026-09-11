"""Server-side environment variable resolver and loader."""

import json
import re
import secrets
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .errors import AccxError

ACCX_URL_RE = re.compile(r"^accx://(?P<project>[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?)/(development|staging|production):(?P<key>[A-Za-z_][A-Za-z0-9_]{0,127})$")
RAW_KEY_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,127}$")


def _freshness_headers() -> dict[str, str]:
    return {
        "x-accx-request-timestamp": str(int(time.time() * 1000)),
        "x-accx-request-nonce": secrets.token_hex(24),
    }


class EnvLoader:
    """Resolves accx:// URLs over the PAT channel and merges them with local .env values."""

    def __init__(self, *, base_url: str, personal_token: str, timeout: float = 15.0, max_retries: int = 2, retry_base_seconds: float = 0.25) -> None:
        self._base_url = base_url.rstrip("/")
        self._personal_token = personal_token
        self._timeout = min(max(timeout, 1.0), 60.0)
        self._max_retries = min(max(max_retries, 0), 5)
        self._retry_base_seconds = min(max(retry_base_seconds, 0.05), 5.0)

    def parse_accx_url(self, value: str) -> dict[str, str] | None:
        match = ACCX_URL_RE.match(value)
        if not match:
            return None
        return {"project": match.group("project"), "environment": match.group(2), "key": match.group("key")}

    def resolve(self, project: str, environment: str, keys: list[str] | None = None) -> dict[str, str]:
        body: dict[str, Any] = {"command": "resolve", "operation": "resolve", "project": project, "environment": environment}
        if keys:
            body["keys"] = list(keys)
        request = Request(
            f"{self._base_url}/api/v1/app",
            data=json.dumps(body).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {self._personal_token}", **_freshness_headers()},
        )
        payload = self._perform(request)
        variables = payload.get("variables", []) if isinstance(payload, dict) else []
        return {item["key"]: item["value"] for item in variables if isinstance(item, dict) and "key" in item and "value" in item}

    def load(self, *, local: dict[str, str] | None = None, accx: str | None = None) -> dict[str, str]:
        result = dict(local or {})
        if not accx:
            return result
        by_ref: dict[str, list[tuple[str, dict[str, str]]]] = {}
        for line in accx.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            equals = line.find("=")
            if equals <= 0:
                continue
            env_key = line[:equals].strip()
            value = line[equals + 1:].strip()
            if not env_key:
                continue
            ref = self.parse_accx_url(value)
            if ref:
                bucket = f"{ref['project']}/{ref['environment']}"
                by_ref.setdefault(bucket, []).append((env_key, ref))
            elif env_key not in result:
                result[env_key] = value
        for bucket, entries in by_ref.items():
            project, environment = entries[0][1]["project"], entries[0][1]["environment"]
            keys = list({entry[1]["key"] for entry in entries if RAW_KEY_RE.match(entry[1]["key"])})
            resolved = self.resolve(project, environment, keys or None)
            for env_key, ref in entries:
                if env_key in result:
                    continue
                value = resolved.get(ref["key"])
                if value is None:
                    raise AccxError(f"ACCX key {ref['key']} was not found in {bucket}.", status=404)
                result[env_key] = value
        return result

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
            time.sleep(self._retry_base_seconds * (2 ** attempt))
        raise last_error or AccxError("ACCX network request failed.")
