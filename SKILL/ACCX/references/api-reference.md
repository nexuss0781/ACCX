# ACCX Complete Consumer API

## 1. API roles

ACCX accepts both human-account operations and trusted service operations. Choose the role that matches the requested task.

| Role | Authentication | Main use |
|---|---|---|
| User account | ACCX session cookie from Continue with nexuss-auth or portable Nexuss token login | Create metadata, manage account records, encrypted vault operations |
| Nexuss Auth identity | Verified Nexuss Auth OAuth identity or one-time handoff | “Continue with nexuss-auth” login to ACCX |
| Trusted service | `X-ACCX-Workload-Token` | Read metadata, submit jobs, read job status |
| Provisioning operator | `X-ACCX-Admin-Key` plus audited subject | Create identities, activate encrypted versions, provision workload tokens |
| Worker runtime | `X-ACCX-Worker-Key` | Execute queued jobs |

The AI should use the user-account role to record a credential for a user and the trusted-service role to use an already-recorded reference. Provisioning and worker roles are used only when the integration has been explicitly configured for them.

## 2. Common conventions

The ACCX origin is the deployed application origin. Production requests use HTTPS. Commands are sent as the `command` query parameter or JSON field according to the endpoint contract.

All JSON responses use `Content-Type: application/json; charset=utf-8` and `Cache-Control: no-store`. Unsupported HTTP methods return `405`.

Never place a credential value, workload token, admin key, worker key, session cookie, OAuth code, state value, handoff token, or encrypted payload in a URL or ordinary log.

## 3. Health

### `GET /health`

```bash
curl -fsS --max-time 30 https://<accx-origin>/health
```

Success requires HTTP 200 and:

```json
{
  "service": "accx",
  "status": "ok",
  "runtime": "vercel-serverless",
  "dependencies": { "database": "ok" }
}
```

## 4. User authentication

The public ACCX login and registration routes use **Continue with nexuss-auth**. They do not collect raw passwords. The legacy `login` and `register` commands remain server-side migration compatibility paths for existing local accounts; new integrations should not build a new password UI around them.

### `GET /api/v1/auth?command=nexuss_start&provider=github&next=/`

The browser first requests an authorization URL, then navigates to the returned URL:

```json
{ "authorizationUrl": "https://nexuss-auth.vercel.app/oauth/start/github?..." }
```

Supported providers are `github` and `google`. ACCX sets a short-lived HttpOnly binding cookie and stores one-time state before returning this response. The `next` value must be an internal ACCX path.

### `GET /auth/nexuss/callback`

Nexuss Auth redirects to this public callback with a one-time `handoff_token`. Vercel rewrites the path to the consolidated auth function. ACCX validates the browser-bound state, exchanges the handoff server-to-server, maps the verified issuer and subject to a local ACCX user, sets an ACCX HttpOnly session cookie, clears the binding cookie, and redirects to the clean internal `next` path.

The callback token, state, and upstream response are never returned to frontend JavaScript or ordinary logs. A replayed or mismatched state fails.

### `POST /api/v1/auth` with `command: nexuss_token_login`

For CLI or server applications that hold a user-owned Nexuss Auth API key, send it only as a bearer header:

```http
Authorization: Bearer nxa_<protected-token>
Content-Type: application/json
```

```json
{ "command": "nexuss_token_login" }
```

ACCX validates the key against Nexuss Auth `/v1/me` for the configured project. On success it maps the stable Nexuss issuer and subject, then sets the normal ACCX session cookie. The key is not stored by ACCX, is not accepted as an ACCX workload token, and does not grant service scopes.

If the Nexuss identity’s email matches an existing unlinked local account, ACCX returns `nexuss_auth_account_link_required` rather than silently joining accounts.

### `POST /api/v1/auth` with `command: nexuss_link`

An already authenticated ACCX user can explicitly link a validated Nexuss user token using the same `Authorization: Bearer nxa_<protected-token>` header. This is the migration path for an existing local account. ACCX stores the issuer and subject mapping, not the bearer key.

### `GET /api/v1/auth?command=session`

Use the session cookie to verify identity:

```json
{ "user": { "id": "<uuid>", "email": "user@example.com" }, "mfa": null }
```

A signed-out session may validly return:

```json
{ "user": null, "mfa": null }
```

## 5. Continue with nexuss-auth project authorization

Nexuss Auth is the ACCX relying-party identity provider. The user authenticates with Google or GitHub through the Nexuss Auth project; ACCX then establishes its own local session from the verified Nexuss identity. This is authorization in the same practical sense as a GitHub OAuth application: the Nexuss project allowlist controls which ACCX callback and origin may participate, while ACCX remains responsible for its own session and workspace authorization.

### Configuration values

The ACCX application needs these non-secret values:

```text
NEXUSS_AUTH_URL=https://nexuss-auth.vercel.app
NEXUSS_AUTH_PROJECT_ID=<nexuss-auth-project-id>
NEXUSS_AUTH_REDIRECT_URI=https://<accx-origin>/auth/nexuss/callback
```

Provider client secrets belong in Nexuss Auth’s protected service configuration, not in ACCX browser configuration.

### Browser start URL

The ACCX UI uses `nexuss_start`; direct navigation is also available for integrations that already manage state and callback handling:

```text
https://nexuss-auth.vercel.app/oauth/start/github?project_id=<project-id>&redirect_uri=<url-encoded-accx-callback>&handoff=1
```

Use `/oauth/start/google` for Google. The Nexuss Auth project must be active, the provider must be enabled, the exact ACCX callback must be in `allowedRedirectUris`, and the exact ACCX origin must be in `allowedOrigins`.

### Cross-site handoff exchange

For cross-site ACCX and Nexuss Auth deployments, Nexuss Auth redirects to the ACCX callback with a short-lived one-time `handoff_token`. The ACCX callback server exchanges it:

```http
POST https://nexuss-auth.vercel.app/v1/handoff/exchange
Content-Type: application/json
```

```json
{
  "projectId": "<nexuss-auth-project-id>",
  "handoffToken": "<received only by the callback server>"
}
```

A successful response contains a verified user identity. ACCX maps that identity to its local user account and creates the ACCX HttpOnly session. The token is single-use; replay must fail. Redirect the browser to a clean ACCX URL after session creation.

### Same-site session lookup

When the deployment topology supports the Nexuss Auth browser cookie model, query:

```http
GET https://nexuss-auth.vercel.app/v1/me?project_id=<project-id>
x-nex-auth-project: <project-id>
```

A `200` response with `user` or `user: null` is valid. ACCX must establish its own authorization state from the verified identity; a success query parameter alone is not authentication.

### Logout

```http
POST https://nexuss-auth.vercel.app/v1/logout
```

Then clear the ACCX session through the ACCX logout command. The application must clear its own local session; clearing only frontend state is insufficient.

## 6. User-account metadata API

Use an authenticated ACCX session cookie. These operations create and manage the user’s account records without returning plaintext values.

### `GET /api/v1/app?command=bootstrap`

Returns the authenticated user, workspace, environments, sanitized secret metadata, and audit summary.

### `POST /api/v1/app` with `command: create_secret_metadata`

```json
{
  "command": "create_secret_metadata",
  "environmentId": "<environment uuid>",
  "provider": "github",
  "displayName": "GitHub production account",
  "reference": "github.production.account",
  "fieldKind": "api_token",
  "tags": ["production"],
  "aliases": []
}
```

Use `password`, `api_token`, `refresh_token`, `client_secret`, `cookie`, `ssh_key`, `recovery_code`, or `custom` for `fieldKind`. The reference is lowercase and uses letters, digits, dots, hyphens, or underscores.

### `POST /api/v1/app` with `command: update_secret_metadata`

```json
{
  "command": "update_secret_metadata",
  "operation": "metadata",
  "secretId": "<secret uuid>",
  "tags": ["production", "engineering"],
  "aliases": ["github.prod"],
  "healthStatus": "healthy",
  "expiresAt": null
}
```

Use a fresh mutation timestamp and nonce for each user-account mutation. Verify the returned metadata after updating.

## 7. Encrypted credential activation

To record the actual credential value, first create metadata, then encrypt the value in trusted server memory, then activate an encrypted version. Never send plaintext to ACCX.

### `POST /api/v1/admin?command=activate_secret_version`

This trusted activation operation requires the protected admin credential and the audited user subject. The request contains only the encrypted payload:

```json
{
  "secretId": "<metadata uuid>",
  "encryptedPayload": {
    "encryptedDataKey": {
      "ciphertext": "<base64>",
      "iv": "<base64>",
      "tag": "<base64>"
    },
    "secretCiphertext": {
      "ciphertext": "<base64>",
      "iv": "<base64>",
      "tag": "<base64>"
    },
    "algorithm": "AES-256-GCM"
  }
}
```

After activation, read metadata and require the expected `activeVersion` and `status: "active"`. The user-facing result should contain the reference, provider, environment, active version, and status—not the value or encrypted payload.

## 8. Metadata lifecycle

| Command | Method | Purpose |
|---|---:|---|
| `soft_delete_secret` | POST | Mark a record deleted while retaining it for the retention policy |
| `revoke_secret` | POST | Revoke a record or version and invalidate applicable leases |
| `purge_deleted_secrets` | POST | Permanently purge eligible deleted records |
| `export_vault` | POST | Export an encrypted vault bundle |
| `import_vault` | POST | Import an encrypted vault bundle |
| `list_audit_events` | GET | Read sanitized account audit events |

Deletion, revocation, purge, and encrypted transfer require the existing authenticated user flow and appropriate step-up/mutation integrity. Use only when the user explicitly requests the operation.

## 9. Trusted workload API

Use `X-ACCX-Workload-Token` for backend automation.

### `GET /api/v1/workloads?command=list_secret_metadata`

Returns `{ "secrets": [...] }` containing sanitized metadata.

### `POST /api/v1/workloads?command=submit_job`

```json
{
  "action": "provider.health_check",
  "secretReferences": ["github.production.account"],
  "requiredScopes": ["job.execute"],
  "input": {},
  "idempotencyKey": "<uuid>"
}
```

### `GET /api/v1/workloads?command=job_status&jobId=<uuid>`

Returns a sanitized job result. Possible statuses are `awaiting_approval`, `queued`, `running`, `succeeded`, `failed`, and `cancelled`.

## 10. Identity provisioning

When explicitly authorized, a protected provisioning service uses `X-ACCX-Admin-Key` to create a service identity, provision a short-lived workload token, and revoke the identity after a disposable test. The ordinary AI client uses the resulting workload token; it does not need the admin key.

```text
POST /api/v1/workloads?command=create_identity
POST /api/v1/workloads?command=provision_token
POST /api/v1/workloads?command=revoke_identity
```

Grant only the scopes required by the intended actions. Workload tokens are bounded-lived and must be stored directly in the backend secret store.

## 11. Status and errors

| Status | Meaning | Action |
|---:|---|---|
| `200` | Read or mutation succeeded | Validate the sanitized body |
| `201` | User/metadata/identity created | Record the returned non-secret identifier |
| `202` | Job accepted | Poll status; do not claim completion |
| `302` | OAuth navigation/callback | Follow as browser navigation |
| `400` | Invalid payload or stale request | Correct the request |
| `401` | Missing, invalid, expired, or replayed credential/handoff | Re-authenticate or use a fresh token |
| `403` | Scope, ownership, origin, approval, or authorization failure | Do not escalate automatically |
| `409` | Conflict, replay, or duplicate state | Inspect the existing record and idempotency key |
| `429` | Rate limit | Apply bounded backoff to safe/idempotent calls |
| `500` | Server/provider failure | Retry only safe idempotent operations |
| `503` | Service unavailable or incomplete configuration | Stop credential-backed work |

## 12. Complete save-to-use sequence

```text
Authenticate user with ACCX or Continue with nexuss-auth
        ↓
Resolve ACCX user account, workspace, and environment
        ↓
Create secret metadata
        ↓
Accept provider credential through protected input
        ↓
Encrypt in trusted memory
        ↓
Activate encrypted version
        ↓
Read metadata and verify active status/version
        ↓
Use exact reference in SDK/API action
        ↓
Poll sanitized job status
```

The save operation is complete only after encrypted activation and metadata verification. The action is complete only after a terminal `succeeded` status.
