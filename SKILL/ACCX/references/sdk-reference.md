# ACCX SDK Reference

## Purpose and boundary

Use the SDKs from trusted backend services to submit reference-based actions and read sanitized metadata or job state. Do not use either server SDK as a credential retrieval library. Do not add a plaintext resolver, password getter, clipboard method, browser export method, or raw provider-result method.

The current package names are:

| Ecosystem | Package | Current release |
|---|---|---:|
| JavaScript | `@nexuss0781/accx` | `0.1.1` |
| Python | `accx` | `0.1.1` |

## JavaScript SDK

### Installation and import

```bash
npm install @nexuss0781/accx
```

```ts
import { AccxClient, AccxError, redactAccxValue } from "@nexuss0781/accx";
import { AccxBrowserMetadataClient } from "@nexuss0781/accx/browser";
```

The package exports ESM JavaScript, TypeScript declarations, and a browser subpath. It requires Node 18 or later for the server SDK.

### Constructor

```ts
const client = new AccxClient({
  baseUrl: process.env.ACCX_BASE_URL!,
  workloadToken: process.env.ACCX_WORKLOAD_TOKEN!,
  fetch,                 // optional replacement for tests or a custom runtime
  timeoutMs: 15_000,     // optional; bounded by the SDK
  maxRetries: 2,         // optional; bounded by the SDK
  retryBaseMs: 250,      // optional backoff base
});
```

Keep `workloadToken` in a server-side secret store. Never pass it to browser code, logs, URLs, telemetry, or model context.

### Methods

#### `submitAction(job)`

Submit a trusted action to `POST /api/v1/workloads?command=submit_job` with the `X-ACCX-Workload-Token` header.

```ts
const result = await client.submitAction({
  action: "provider.health_check",
  secretReferences: ["github.production.token"],
  requiredScopes: ["job.execute"],
  input: {},
  idempotencyKey: crypto.randomUUID(),
});
```

The method validates the job before sending it and returns only:

```ts
{
  jobId: string;
  status: "awaiting_approval" | "queued" | "running" |
    "succeeded" | "failed" | "cancelled";
  message: string;
  completedAt: string | null;
}
```

Do not assume submission means execution. `provider.publish` normally returns `awaiting_approval`; `provider.health_check` can return `queued`.

#### `getJobStatus(jobId)`

Read `GET /api/v1/workloads?command=job_status&jobId=<UUID>` using the workload token. The SDK validates that `jobId` is a UUID and returns a `SanitizedJobResult`.

```ts
const status = await client.getJobStatus(jobId);
```

#### `getSecretMetadata(reference)`

Read `GET /api/v1/workloads?command=list_secret_metadata` and select the requested stable reference from `{ secrets: SecretMetadata[] }`. The SDK validates metadata and caches successful results by reference.

```ts
const metadata = await client.getSecretMetadata("github.production.token");
console.log(metadata.status, metadata.activeVersion, metadata.healthStatus);
```

This method never returns the credential value.

#### `clearMetadataCache()`

Clear the in-memory metadata cache after a rotation or deployment notification.

#### `redactAccxValue(value)`

Return a log-safe copy. Use it before writing ACCX data to logs, traces, audit-adjacent diagnostics, or error reports. Secret-shaped keys and string values are redacted.

### Retries, timeout, and errors

The SDK retries only transient transport responses: network failures, HTTP 408, HTTP 429, and HTTP 5xx responses. Retry attempts and delay are bounded. It must not retry arbitrary validation failures, authorization failures, conflicts, or destructive mutations unless the operation is idempotent and the server contract allows it.

`AccxError` exposes a sanitized status and a `retryable` flag. Do not serialize the original response body if it may contain provider or credential material.

## Browser SDK

### Import and method

```ts
import { AccxBrowserMetadataClient } from "@nexuss0781/accx/browser";

const browserClient = new AccxBrowserMetadataClient();
const secrets = await browserClient.listMetadata();
```

`listMetadata()` calls same-origin `GET /api/v1/app?command=bootstrap` with browser credentials and extracts only the validated `secrets` metadata array.

The browser SDK intentionally has no workload-token constructor and no method for:

- Resolving plaintext.
- Downloading a credential.
- Copying a credential to the clipboard.
- Exporting raw credentials.
- Persisting secret values to local storage.
- Submitting privileged admin or worker operations.

Use the browser SDK only for session-authenticated metadata display.

## Python SDK

### Installation and import

```bash
python -m pip install accx
```

```python
from accx import (
    AccxClient,
    AsyncAccxClient,
    AccxError,
    JobSubmission,
    SanitizedJobResult,
    SecretMetadata,
    redact,
)
```

### Synchronous client

```python
client = AccxClient(
    base_url=os.environ["ACCX_BASE_URL"],
    workload_token=os.environ["ACCX_WORKLOAD_TOKEN"],
)

result = client.submit_action(job)
status = client.get_job_status(result.job_id)
metadata = client.get_secret_metadata("github.production.token")
```

The synchronous methods are:

| Method | Endpoint | Result |
|---|---|---|
| `submit_action(job)` | `POST /api/v1/workloads?command=submit_job` | `SanitizedJobResult` |
| `get_job_status(job_id)` | `GET /api/v1/workloads?command=job_status` | `SanitizedJobResult` |
| `get_secret_metadata(reference)` | `GET /api/v1/workloads?command=list_secret_metadata` | `SecretMetadata` |

### Asynchronous client

```python
client = AsyncAccxClient(
    base_url=os.environ["ACCX_BASE_URL"],
    workload_token=os.environ["ACCX_WORKLOAD_TOKEN"],
)

result = await client.submit_action(job)
status = await client.get_job_status(result.job_id)
metadata = await client.get_secret_metadata("github.production.token")
```

`AsyncAccxClient` provides asynchronous versions of the same three operations. The implementation delegates blocking HTTP work safely rather than exposing a separate wire contract.

### Python models

`JobSubmission` contains `action`, `secret_references`, `required_scopes`, `input`, and `idempotency_key`. Its wire representation uses the server’s camelCase keys: `secretReferences`, `requiredScopes`, and `idempotencyKey`.

`SanitizedJobResult` contains `job_id`, `status`, `message`, and `completed_at`.

`SecretMetadata` contains provider, display name, reference, environment, lifecycle state, version, rotation, health, tags, aliases, and timestamps. Extend it when the server adds metadata fields; do not add plaintext fields.

`redact(value)` recursively replaces strings and secret-shaped dictionary fields with `[redacted]` for safe logging.

### Environment and FastAPI helpers

Use `client_from_environment()` for a backend process that already has `ACCX_BASE_URL` and `ACCX_WORKLOAD_TOKEN`. Use `fastapi_client_dependency()` to provide a client factory without importing FastAPI inside the SDK.

## Shared contract

Supported scopes are:

```text
metadata.read
secret.rotate
provider.publish
job.execute
audit.read
identity.manage
```

A job must contain 1–10 valid stable secret references, 1–10 known scopes, an action between 3 and 100 characters, an object input, and a UUID idempotency key. The current supported server action policies are:

| Action | Required scopes | Approval | Timeout |
|---|---|---:|---:|
| `provider.health_check` | `job.execute` | No | 10 seconds |
| `provider.publish` | `job.execute`, `provider.publish` | Yes | 30 seconds |

## SDK verification workflow

1. Build the JavaScript SDK with `tsc -p packages/sdk-js/tsconfig.json`.
2. Build the Python wheel from `packages/sdk-python`.
3. Run `twine check` on Python artifacts.
4. Run the project API, SDK, lint, test, build, and diff checks.
5. Run a JavaScript smoke test from a clean temporary Node project installed from NPM.
6. Run a Python smoke test from a clean virtual environment installed from PyPI.
7. Verify that tests use fake fetchers or a disposable non-production fixture and never print tokens.
8. For live verification, use a short-lived workload identity and revoke it after the journey.

## Publication caveats

NPM and PyPI archives are immutable. Publish a corrected later version rather than attempting to alter an existing archive. Before publishing, inspect the exact file list and reject any artifact containing `.env` files, local databases, encrypted fixtures, registry credentials, workload tokens, or provider credentials.
