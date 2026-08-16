# ACCX Python SDK

Install with `pip install accx` after publishing this package.

```python
from accx import AccxClient, JobSubmission

client = AccxClient(base_url=os.environ["ACCX_BASE_URL"], workload_token=os.environ["ACCX_WORKLOAD_TOKEN"])
result = client.submit_action(JobSubmission(
    action="provider.publish",
    secret_references=[os.environ["SOCIAL_TWITTER_REF"]],
    required_scopes=["job.execute", "provider.publish"],
    input={"contentId": "post-123"},
    idempotency_key=str(uuid.uuid4()),
))
```

Only stable references and sanitized job results cross the SDK boundary.

## Metadata, async, and error handling

`get_secret_metadata(reference)` returns rotation and health metadata only. It never returns a credential value. `AsyncAccxClient` provides the same reference-only methods for async services, and `AccxError` exposes a safe status code plus a `retryable` flag for transient failures.

```python
from accx import AsyncAccxClient, redact

client = AsyncAccxClient(
    base_url=os.environ["ACCX_BASE_URL"],
    workload_token=os.environ["ACCX_WORKLOAD_TOKEN"],
)
metadata = await client.get_secret_metadata(os.environ["SOCIAL_TWITTER_REF"])
safe_context = redact({"reference": metadata.reference, "token": "never log this"})
```

For a FastAPI service, `fastapi_client_dependency()` returns a dependency callable without importing FastAPI or adding a browser-facing integration. It constructs the client only from server process variables `ACCX_BASE_URL` and `ACCX_WORKLOAD_TOKEN`.
