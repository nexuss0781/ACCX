# ACCX HTTP API Reference

## API conventions

The deployed API origin is the ACCX Vercel project origin. The public health rewrite is `/health` → `/api/health`. All other routes use the six serverless entrypoints below.

The `command` may be supplied as a query parameter or JSON body. The shared dispatcher removes `command` before passing the remaining request to the preserved handler. Use the documented method and body for the selected command; do not mix command-specific bodies.

All JSON responses use `Content-Type: application/json; charset=utf-8` and `Cache-Control: no-store`. All command routes reject unsupported methods with HTTP 405.

### Credential classes

| Credential | Header | Allowed surface |
|---|---|---|
| Human session | `Cookie: accx_session=...` | Authenticated browser application and session routes |
| Admin key | `X-ACCX-Admin-Key` | Admin bootstrap, metadata/version control, identity/token management |
| Workload token | `X-ACCX-Workload-Token` | Service metadata and job operations |
| Worker key | `X-ACCX-Worker-Key` | Private worker dispatch and execution |

Never send an admin key, worker key, vault master key, workload token, or session cookie to browser UI code, URLs, logs, audits, or SDK responses.

### Common error mapping

| Condition | HTTP | Public error body |
|---|---:|---|
| Missing or invalid session/admin/workload/worker credential | 401 | `{ "error": "Unauthorized" }` |
| Missing scope, failed step-up, invalid same-origin, or forbidden action | 403 | `{ "error": "Forbidden" }` |
| Conflict, replayed nonce, or Paradox conflict | 409 | `{ "error": "Request conflicts with existing control-plane state." }` |
| Expired/stale mutation request | 400 | `{ "error": "Request expired or invalid." }` |
| Rate limited | 429 | `{ "error": "Too many requests." }` |
| Missing server configuration | 503 | `{ "error": "Service configuration is incomplete." }` |
| Unhandled server error | 500 | `{ "error": "Internal server error" }` |

Do not expose raw exception messages or database paths in normal API responses. During controlled diagnosis, expose only bounded, redacted classifications.

## 1. Health

### `GET /health`

Use this as the production readiness gate. Require HTTP 200, `status: "ok"`, and `dependencies.database: "ok"`.

```bash
curl -fsS https://<accx-origin>/health
```

Expected shape:

```json
{
  "service": "accx",
  "status": "ok",
  "runtime": "vercel-serverless",
  "dependencies": { "database": "ok" }
}
```

### `GET /api/health`

Use the direct function path when validating the rewrite or the serverless handler separately. The response contract is the same as `/health`.

## 2. Authentication and MFA: `/api/v1/auth`

Human auth commands use the session cookie after login or registration. Send JSON bodies for mutating commands. Never return a password, recovery code, passkey private material, or credential value to a client.

### Session lifecycle

| Command | Method | Input | Output |
|---|---|---|---|
| `register` | POST | `{ name, email, password }`; password 12–256 characters | `{ user }`, HTTP 201; sets HttpOnly session cookie |
| `login` | POST | `{ email, password }` | `{ user }`, HTTP 200; sets session cookie |
| `session` | GET | No body | `{ user, mfa }` |
| `logout` | POST | No body | Sanitized success response; clears session |
| `list_sessions` | GET | No body | `{ sessions: [...] }` with sanitized active sessions |
| `rotate_session` | POST | No body | `{ rotated: true, expiresAt }`; replaces cookie |
| `revoke_session` | POST | `{ sessionId }`; UUID | `{ revoked: true }` |

### MFA and step-up

| Command | Method | Input | Output |
|---|---|---|---|
| `step_up` | POST | `{ method: "totp", code: six digits }` or `{ method: "recovery", code }` | `{ verified: true, method, expiresInSeconds: 600 }` |
| `recovery_codes` | POST | No body | `{ codes: [...] }`; display once through a protected flow and never log or persist them in client storage |
| `totp_start` | POST | `{ label?: string }` | TOTP enrollment challenge |
| `totp_confirm` | POST | `{ factorId, code }` | `{ verified: true, method: "totp" }` |
| `passkey_register_options` | POST | `{ label?: string }` | WebAuthn registration options |
| `passkey_register_verify` | POST | `{ label?: string, response: object }` | `{ verified: true, method: "passkey" }` |
| `passkey_step_up_options` | POST | No body | WebAuthn step-up options |
| `passkey_step_up_verify` | POST | `{ response: object }` | `{ verified: true, method: "passkey", expiresInSeconds: 600 }` |

Use `step_up` before destructive metadata operations, vault export/import, and job approval. A recent step-up alone is insufficient: the mutation must also pass fresh timestamp, nonce, same-origin, rate-limit, and replay checks.

## 3. Browser application: `/api/v1/app`

Use a valid human session cookie. Sensitive mutations additionally require:

```text
Origin: https://<accx-origin>
Host: <accx-origin>
X-ACCX-Request-Timestamp: <current Unix milliseconds>
X-ACCX-Request-Nonce: <unique 16–160 character nonce>
```

### Bootstrap and metadata

| Command | Method | Input | Output |
|---|---|---|---|
| `bootstrap` | GET | No body | `{ user, workspaceId, environments, secrets, audit }` |
| `create_secret_metadata` | POST | `{ environmentId, provider, displayName, reference, fieldKind?, tags?, aliases? }` | `{ secret }`, HTTP 201 |
| `update_secret_metadata` | POST | `{ operation: "metadata", secretId, tags, aliases, healthStatus, expiresAt }` | `{ updated: true }` |

Stable references must be lowercase and use letters, digits, dots, hyphens, or underscores. Metadata does not contain the secret value.

### Secret lifecycle

| Command | Method | Input | Authorization |
|---|---|---|---|
| `soft_delete_secret` | POST | `{ operation: "soft_delete", secretId, retentionDays? }` | Session, recent step-up, fresh mutation |
| `revoke_secret` | POST | `{ operation: "revoke", secretId, reason }` | Session, recent step-up, fresh mutation |
| `purge_deleted_secrets` | POST | `{ operation: "purge", workspaceId, force? }` | Session, recent step-up, fresh mutation |

A metadata update requires a session and fresh mutation integrity. Soft delete, revoke, and purge require recent step-up as well. All lifecycle changes must record sanitized audit events.

### Encrypted vault transfer

| Command | Method | Input | Output |
|---|---|---|---|
| `export_vault` | POST | `{ workspaceId }` | `{ bundle }` containing encrypted vault data |
| `import_vault` | POST | `{ workspaceId, bundle }` | `{ imported }` |

The bundle must use format `accx.encrypted-vault.v1`, include `generatedAt`, `workspaceId`, and at most 500 secret records. Treat bundles as sensitive encrypted material; do not log, attach, or place them in model context unnecessarily.

### Audit and approvals

| Command | Method | Input | Output |
|---|---|---|---|
| `list_audit_events` | GET | `{ workspaceId, limit? }`; limit 1–100 | `{ events }` |
| `approve_job` | POST | `{ jobId, approve, reason }`; reason 3–240 characters | `{ status: "queued" | "cancelled" }` |

`approve_job` requires a valid session, recent step-up, fresh mutation integrity, and the `provider.publish` scope. Do not approve a job solely because a client says it is safe; inspect action, project, references, and policy through the control plane.

## 4. Admin control plane: `/api/v1/admin`

Every admin command requires `X-ACCX-Admin-Key`. Set `X-ACCX-Subject-Id` to the real audited operator subject when applicable. Admin routes are server-to-server and must not be called from browser code.

### Bootstrap

`POST /api/v1/admin?command=bootstrap_control_plane`

Input: `{}`.

Output, HTTP 201:

```json
{ "workspaceId": "<uuid>", "projectId": "<uuid>" }
```

The command returns existing control-plane identifiers when already initialized and creates the workspace, primary project, and development/staging/production environments when needed.

### Secret metadata and versions

| Command | Method | Input | Output |
|---|---|---|---|
| `list_secret_metadata` | GET | `workspaceId` query parameter | `{ secrets }` |
| `create_secret_metadata` | POST | `{ environmentId, provider, displayName, reference }` | `{ secret }`, HTTP 201 |
| `activate_secret_version` | POST | `{ secretId, encryptedPayload }` | Version activation result, HTTP 201 |
| `revoke_secret` | POST | `{ secretId, reason }` | No body, HTTP 204 |
| `list_audit_events` | GET | `workspaceId` and optional `limit` query parameters | `{ events }` |

`encryptedPayload` must contain `encryptedDataKey`, `secretCiphertext`, and `algorithm: "AES-256-GCM"`; each cipher box contains `ciphertext`, `iv`, and `tag`. Generate the payload only in trusted server code using the configured vault master key. Never submit plaintext to this endpoint.

## 5. Workload identity and service API: `/api/v1/workloads`

### Identity management

These commands require `X-ACCX-Admin-Key` and must be run by a trusted provisioning service.

#### Create identity

`POST /api/v1/workloads?command=create_identity`

```json
{
  "operation": "create",
  "projectId": "<project UUID>",
  "name": "billing-service",
  "scopes": ["metadata.read", "job.execute"]
}
```

The name is 3–100 trimmed characters. The response is HTTP 201 with an identity object containing its ID and name.

#### Provision token

`POST /api/v1/workloads?command=provision_token`

```json
{
  "operation": "provision",
  "serviceIdentityId": "<identity UUID>",
  "ttlSeconds": 300
}
```

The effective lifetime is bounded between 60 and 900 seconds. The HTTP 201 response contains a one-time token receipt. Place the token directly in the backend service secret store; never print it or return it through a browser.

#### Revoke identity

`POST /api/v1/workloads?command=revoke_identity`

```json
{
  "operation": "revoke",
  "serviceIdentityId": "<identity UUID>"
}
```

Revocation invalidates the identity’s workload tokens and active secret leases.

### Workload operations

These commands require `X-ACCX-Workload-Token`.

#### List metadata

`GET /api/v1/workloads?command=list_secret_metadata`

Requires `metadata.read`. Returns `{ secrets: SecretMetadata[] }`.

#### Submit job

`POST /api/v1/workloads?command=submit_job`

```json
{
  "action": "provider.health_check",
  "secretReferences": ["github.production.token"],
  "requiredScopes": ["job.execute"],
  "input": {},
  "idempotencyKey": "<UUID>"
}
```

The request must contain 1–10 valid references, 1–10 recognized scopes, and a UUID idempotency key. The server authenticates the token, verifies project ownership, checks action policy and scopes, verifies active references, creates short-lived leases, and returns HTTP 202 with a sanitized job result.

`provider.health_check` enters `queued`. `provider.publish` enters `awaiting_approval` and creates approval state.

#### Read job status

`GET /api/v1/workloads?command=job_status&jobId=<UUID>`

Returns HTTP 200 with a `SanitizedJobResult` only when the job belongs to the authenticated workload identity and project.

## 6. Private worker: `/api/v1/worker`

Every worker command requires `X-ACCX-Worker-Key`. Never send the vault master key, admin key, or workload token to the worker process.

### Dispatch queued jobs

`POST /api/v1/worker?command=dispatch_jobs`

```json
{
  "workerId": "worker-prod-a",
  "limit": 1
}
```

`workerId` is a non-secret audited identifier. `limit` is bounded from 1 to 5. The endpoint atomically claims queued jobs, verifies policy and active leases, invokes registered server-side adapters, and returns sanitized results.

### Execute one job

`POST /api/v1/worker?command=execute_job`

```json
{
  "jobId": "<job UUID>",
  "workerId": "worker-prod-a"
}
```

The handler requires a queued job and trusted worker authorization. It never returns decrypted secret material or raw provider responses.

## 7. Action and adapter rules

The server action policy is immutable application code:

| Action | Required scopes | Approval | Timeout | Egress class |
|---|---|---:|---:|---|
| `provider.health_check` | `job.execute` | No | 10 seconds | `health` |
| `provider.publish` | `job.execute`, `provider.publish` | Yes | 30 seconds | `provider` |

The built-in health adapter validates the active encrypted lease inside ACCX without external side effects. Provider-specific publishing requires a reviewed adapter registered in trusted server code. That adapter must use HTTPS, a server-owned origin allowlist, `redirect: "error"`, an abort signal, and sanitized status output. Job input must never control the destination URL or adapter implementation.

## 8. Dispatcher and route-extension rule

When adding a capability:

1. Add or preserve the handler under `server/v1/`.
2. Add one `command` mapping to the correct consolidated entrypoint.
3. Validate HTTP method, body, query, headers, ownership, scopes, and step-up state.
4. Add an authorization-abuse test and a route-consolidation test.
5. Keep the total Vercel function count within the project limit.
6. Update the SDK only if the operation is safe and useful for a trusted client; never expose admin or worker credentials through SDK constructors.
