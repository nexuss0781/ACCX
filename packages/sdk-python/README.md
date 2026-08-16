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
