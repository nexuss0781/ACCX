# ACCX SDK Reference for AI Consumers

## Purpose

Use the ACCX SDK from a trusted backend service to read sanitized secret metadata, submit an intended action using stable secret references, and read sanitized job status. The SDK is not a credential-value retrieval library. The secure design is to let ACCX keep and use the value while the AI receives only metadata or a sanitized result.

| Ecosystem | Package | Published package |
|---|---|---|
| JavaScript/TypeScript | `@nexuss0781/accx` | [NPM package](https://www.npmjs.com/package/@nexuss0781/accx) |
| Python | `accx` | [PyPI package](https://pypi.org/project/accx/) |

## JavaScript/TypeScript

### Install and import

```bash
npm install @nexuss0781/accx
```

```ts
import { AccxClient, AccxError, redactAccxValue } from "@nexuss0781/accx";
```

### Construct the client

```ts
const accx = new AccxClient({
  baseUrl: process.env.ACCX_BASE_URL!,
  workloadToken: process.env.ACCX_WORKLOAD_TOKEN!,
});
```

Keep the workload token in the trusted backend’s protected environment. The AI may call the SDK through the application, but must not reveal the token in output, prompts, URLs, logs, telemetry, or frontend code.

Optional settings include a custom `fetch` implementation for tests, `timeoutMs`, `maxRetries`, and `retryBaseMs`. Use bounded values.

### `getSecretMetadata(reference)`

Read sanitized metadata for one stable reference.

```ts
const metadata = await accx.getSecretMetadata("provider.production.account");
```

The returned object may include provider, display name, reference, environment, status, active version, rotation state, expiry, health status, tags, aliases, and timestamps. It does not include the credential value. Successful results are cached by reference; call `clearMetadataCache()` after a known rotation or metadata update.

### `submitAction(job)`

Submit an action using references rather than credential values.

```ts
const result = await accx.submitAction({
  action: "provider.health_check",
  secretReferences: ["provider.production.account"],
  requiredScopes: ["job.execute"],
  input: {},
  idempotencyKey: crypto.randomUUID(),
});
```

The sanitized result is:

```ts
{
  jobId: string;
  status: "awaiting_approval" | "queued" | "running" |
    "succeeded" | "failed" | "cancelled";
  message: string;
  completedAt: string | null;
}
```

A successful HTTP submission is not the same as completed execution.

### `getJobStatus(jobId)`

Read the sanitized status of a job owned by the workload identity.

```ts
const status = await accx.getJobStatus(result.jobId);
```

Stop polling when the status is `succeeded`, `failed`, or `cancelled`.

### `redactAccxValue(value)`

Use before logging an object that could contain secret-shaped fields.

```ts
const safe = redactAccxValue({
  reference: "provider.production.account",
  token: "never-log-this",
});
```

### Errors and retries

`AccxError` exposes sanitized status and retryability. The SDK retries only transient network failures, HTTP 408, HTTP 429, and HTTP 5xx responses, using bounded attempts and delay. Do not retry authorization, validation, conflicts, approvals, revocations, or other side effects blindly.

## Python

### Install and import

```bash
python -m pip install accx
```

```python
from accx import AccxClient, AsyncAccxClient, AccxError, JobSubmission, redact
```

### Synchronous client

```python
import os
from accx import AccxClient, JobSubmission

client = AccxClient(
    base_url=os.environ["ACCX_BASE_URL"],
    workload_token=os.environ["ACCX_WORKLOAD_TOKEN"],
)

job = JobSubmission(
    action="provider.health_check",
    secret_references=["provider.production.account"],
    required_scopes=["job.execute"],
    input={},
    idempotency_key="00000000-0000-4000-8000-000000000001",
)
result = client.submit_action(job)
status = client.get_job_status(result.job_id)
metadata = client.get_secret_metadata("provider.production.account")
```

### Asynchronous client

```python
from accx import AsyncAccxClient

client = AsyncAccxClient(
    base_url=os.environ["ACCX_BASE_URL"],
    workload_token=os.environ["ACCX_WORKLOAD_TOKEN"],
)
result = await client.submit_action(job)
status = await client.get_job_status(result.job_id)
metadata = await client.get_secret_metadata("provider.production.account")
```

Both clients expose the same three operations:

| Method | Purpose | Return type |
|---|---|---|
| `submit_action(job)` | Submit a reference-only action | `SanitizedJobResult` |
| `get_job_status(job_id)` | Read sanitized status | `SanitizedJobResult` |
| `get_secret_metadata(reference)` | Read sanitized metadata | `SecretMetadata` |

The package also exports `AccxError`, `JobSubmission`, `SanitizedJobResult`, `SecretMetadata`, `redact`, `client_from_environment`, and `fastapi_client_dependency`.

Python `JobSubmission` uses snake_case fields and emits the server’s camelCase wire keys: `secretReferences`, `requiredScopes`, and `idempotencyKey`.

## Shared job contract

A job contains:

| Field | Rule |
|---|---|
| `action` | Use a documented supported action; 3–100 characters |
| `secretReferences` / `secret_references` | 1–10 known stable references |
| `requiredScopes` / `required_scopes` | 1–10 known scopes required by the action |
| `input` | JSON object; never place credentials, arbitrary URLs, raw headers, or adapter code inside it |
| `idempotencyKey` / `idempotency_key` | UUID; reuse only to retry the same logical submission |

Supported scopes are `metadata.read`, `secret.rotate`, `provider.publish`, `job.execute`, `audit.read`, and `identity.manage`. Request the smallest set that matches the action.

Current action policies:

| Action | Required scopes | Initial state |
|---|---|---|
| `provider.health_check` | `job.execute` | `queued` |
| `provider.publish` | `job.execute`, `provider.publish` | `awaiting_approval` |

`provider.health_check` is the safe built-in control-plane health action. `provider.publish` requires a separately configured reviewed provider adapter and human approval; do not claim it works merely because the SDK accepts the action name.

## What the SDK does not expose

The AI-facing SDK has no plaintext resolver, password getter, clipboard operation, raw provider response, arbitrary provider destination, internal database query, user-interface mutation API, or deployment operation. Do not add these methods as a shortcut. If a required capability is absent, identify the missing reviewed integration rather than bypassing the reference-only boundary.

## SDK verification

For a package release or integration change:

1. Install the exact package version in a clean Node project or Python virtual environment.
2. Import the public exports.
3. Exercise metadata, sanitized job, retry, timeout, and redaction behavior with fake transport or a disposable non-production fixture.
4. Run one controlled live journey only when a temporary workload token and safe reference are available.
5. Revoke temporary identities and fixtures after the live journey.
6. Report package version and sanitized outcomes, never credentials.
