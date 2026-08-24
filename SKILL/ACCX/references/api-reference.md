# ACCX API Reference for AI Consumers

## Scope

Use this reference when an AI agent or trusted backend service calls an existing ACCX deployment. It documents the stable consumer contract: service health, sanitized metadata, workload actions, job status, and the optional provisioning boundary.

It intentionally excludes ACCX’s React screens, internal database tables, deployment configuration, human MFA implementation, vault storage internals, and provider-adapter source code. Those are ACCX maintenance concerns, not AI integration instructions.

## Common request rules

Use the configured ACCX HTTPS origin. The `command` may be supplied as a query parameter or JSON field; use one consistent form for each request. The server removes `command` before validating the command-specific payload.

Ordinary AI/backend calls use:

```text
X-ACCX-Workload-Token: <protected workload token>
```

It is expected that the backend uses this token. Keep it in the backend’s protected secret environment. Never expose it in an AI response, prompt, URL, frontend bundle, log, telemetry event, or source example.

## 1. Health

### `GET /health`

Use this as the availability check.

```bash
curl -fsS --max-time 30 https://<accx-origin>/health
```

Require HTTP 200 and:

```json
{
  "service": "accx",
  "status": "ok",
  "runtime": "vercel-serverless",
  "dependencies": { "database": "ok" }
}
```

If the response is not HTTP 200, does not have `status: "ok"`, or does not have `dependencies.database: "ok"`, report ACCX as unavailable or degraded. Do not start a credential-backed job merely because the URL responded.

### `GET /api/health`

Use only when the direct health path is required. It has the same success contract. Prefer `/health` for normal consumer checks.

## 2. List sanitized metadata

### `GET /api/v1/workloads?command=list_secret_metadata`

Required header: `X-ACCX-Workload-Token`.

Successful response: HTTP 200.

```json
{
  "secrets": [
    {
      "id": "<uuid>",
      "provider": "github",
      "displayName": "Production account",
      "reference": "github.production.account",
      "environment": "production",
      "status": "active",
      "activeVersion": 2,
      "rotationState": "stable",
      "expiresAt": null,
      "lastUsedAt": null,
      "fieldKind": "api_token",
      "tags": ["production"],
      "aliases": [],
      "healthStatus": "healthy",
      "lastRotatedAt": null,
      "deletedAt": null,
      "purgeAfter": null
    }
  ]
}
```

Use the exact returned `reference` in later jobs. Do not guess a reference from a display name. Metadata identifies a record; it is never the credential itself.

## 3. Submit a job

### `POST /api/v1/workloads?command=submit_job`

Required header: `X-ACCX-Workload-Token`.

```json
{
  "action": "provider.health_check",
  "secretReferences": ["github.production.account"],
  "requiredScopes": ["job.execute"],
  "input": {},
  "idempotencyKey": "<uuid>"
}
```

| Field | Rule |
|---|---|
| `action` | 3–100 characters and supported by ACCX |
| `secretReferences` | 1–10 known stable references |
| `requiredScopes` | 1–10 supported scopes required by the action |
| `input` | JSON object; no plaintext credentials, raw headers, arbitrary destination URLs, or adapter code |
| `idempotencyKey` | UUID; reuse only for the same logical submission |

The server authenticates the workload token, verifies project and identity ownership, checks action policy and scopes, verifies active references, creates short-lived leases, and returns HTTP 202 with a sanitized result.

Example response:

```json
{
  "jobId": "<uuid>",
  "status": "queued",
  "message": "Trusted execution accepted; no credential material was returned.",
  "completedAt": null
}
```

Submission is not completion. `provider.health_check` starts as `queued`; `provider.publish` starts as `awaiting_approval`.

## 4. Read job status

### `GET /api/v1/workloads?command=job_status&jobId=<uuid>`

Required header: `X-ACCX-Workload-Token`.

Successful response: HTTP 200.

```json
{
  "jobId": "<uuid>",
  "status": "succeeded",
  "message": "Sanitized job status.",
  "completedAt": "<ISO-8601 timestamp>"
}
```

Possible statuses are `awaiting_approval`, `queued`, `running`, `succeeded`, `failed`, and `cancelled`. Stop polling at a terminal status. ACCX returns a job only when it belongs to the authenticated workload identity and project.

## 5. Actions and scopes

Supported scopes are:

```text
metadata.read
secret.rotate
provider.publish
job.execute
audit.read
identity.manage
```

Current action policies are:

| Action | Required scopes | Initial state | Consumer meaning |
|---|---|---|---|
| `provider.health_check` | `job.execute` | `queued` | Safe in-control-plane active-lease/health validation |
| `provider.publish` | `job.execute`, `provider.publish` | `awaiting_approval` | High-impact action requiring human approval and a reviewed provider integration |

Do not invent actions or add scopes automatically. If ACCX reports `UNSUPPORTED_ACTION`, `FORBIDDEN`, or an unavailable adapter, stop and report the missing configuration.

## 6. Optional provisioning boundary

Provisioning is not an ordinary AI end-user call. Use it only when the user explicitly authorizes setup of a trusted backend integration and the application has a protected admin credential.

### Create service identity

`POST /api/v1/workloads?command=create_identity`

Required header: `X-ACCX-Admin-Key`.

```json
{
  "operation": "create",
  "projectId": "<project uuid>",
  "name": "automation-service",
  "scopes": ["metadata.read", "job.execute"]
}
```

Grant the smallest scope set required by the intended integration.

### Provision workload token

`POST /api/v1/workloads?command=provision_token`

Required header: `X-ACCX-Admin-Key`.

```json
{
  "operation": "provision",
  "serviceIdentityId": "<identity uuid>",
  "ttlSeconds": 300
}
```

Store the returned token directly in the trusted backend secret store. Never return it to the AI, browser, user-visible output, logs, URLs, or package files.

### Revoke service identity

`POST /api/v1/workloads?command=revoke_identity`

Required header: `X-ACCX-Admin-Key`.

```json
{
  "operation": "revoke",
  "serviceIdentityId": "<identity uuid>"
}
```

Use this for explicit identity retirement or cleanup of a disposable integration. Do not revoke an identity merely because an ordinary job failed.

## 7. Human and internal boundaries

Human login, MFA, browser sessions, approvals, metadata lifecycle mutations, encrypted vault transfer, and destructive operations belong to the existing ACCX application. An AI backend should not reimplement them or request a user’s password, MFA code, recovery code, or session cookie.

For `provider.publish`, the AI may submit a job and explain that human approval is required. It must not simulate approval, bypass step-up, or substitute an admin key for a human decision.

Private worker dispatch is an operator/runtime boundary. The ordinary SDK consumer submits and polls; it does not dispatch workers or receive worker keys.

## 8. Errors

| HTTP | Meaning | Correct consumer action |
|---:|---|---|
| 400 | Invalid or stale request | Correct the request; do not blindly retry |
| 401 | Missing, invalid, or expired workload token | Stop and use protected provisioning |
| 403 | Scope, ownership, approval, or authorization failure | Do not escalate scopes automatically |
| 409 | Conflict, replay, or idempotency conflict | Reuse the key only for the same logical request |
| 429 | Rate limited | Retry safe reads or idempotent submissions with bounded backoff |
| 500 | Server failure | Retry only when the operation is safe and idempotent |
| 503 | Service unavailable or incomplete configuration | Stop credential-backed work and report degraded availability |

The SDK maps these conditions to `AccxError` where applicable. Do not print the workload token or raw response body while diagnosing failures.
