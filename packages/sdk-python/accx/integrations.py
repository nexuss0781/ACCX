from __future__ import annotations

import os
from collections.abc import Callable

from .client import AccxClient


def client_from_environment() -> AccxClient:
    """Construct a server-only workload client from process configuration.

    This helper must be called inside a trusted backend process. Never invoke it
    from browser-delivered code or serialize the resulting client/token.
    """
    base_url = os.environ.get("ACCX_BASE_URL")
    workload_token = os.environ.get("ACCX_WORKLOAD_TOKEN")
    if not base_url or not workload_token:
        raise RuntimeError("ACCX_BASE_URL and ACCX_WORKLOAD_TOKEN are required in the server environment.")
    return AccxClient(base_url=base_url, workload_token=workload_token)


def fastapi_client_dependency(factory: Callable[[], AccxClient] = client_from_environment):
    """Return a FastAPI-compatible dependency callable without importing FastAPI."""
    async def dependency() -> AccxClient:
        return factory()

    return dependency
