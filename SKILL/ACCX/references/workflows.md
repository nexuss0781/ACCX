# ACCX End-to-End AI Workflows

## 1. Choose the operating mode

ACCX has two practical consumer modes:

| Mode | Use when | Authentication |
|---|---|---|
| User-account mode | The AI is acting for a logged-in ACCX user and must record credentials to that user’s account | ACCX session created by Continue with nexuss-auth or portable Nexuss token login |
| Trusted-service mode | A backend service must use saved references and submit jobs | Protected workload token |

Use user-account mode to create or manage the user’s vault records. Use trusted-service mode to read metadata and execute approved reference-based actions. Do not substitute a workload token for a human session.

## 2. Install ACCX clients

### JavaScript/TypeScript

```bash
npm install @nexuss0781/accx
```

### Python

```bash
python -m pip install accx
```

Use the package version requested by the application. Verify the installed version before running a release or migration.

## 3. Authenticate through CLI/API

ACCX does not require a separate AI-specific CLI. Use `curl` for direct CLI/API operation or use the published SDK for backend code.

### Continue with nexuss-auth from a browser

Use the ACCX start command to create browser-bound state and obtain the provider URL. Navigate the browser to the returned `authorizationUrl`; do not copy OAuth parameters into an AI transcript or manually exchange the callback token.

```bash
curl -sS -c /tmp/accx-session.cookies -b /tmp/accx-session.cookies \
  "$ACCX_ORIGIN/api/v1/auth?command=nexuss_start&provider=github&next=/"
```

The browser completes Google or GitHub sign-in at Nexuss Auth. The ACCX callback performs the one-time server-side handoff exchange and sets the ACCX session cookie. The final URL is clean and contains no OAuth code, state, or handoff token.

### Portable Nexuss API-key login

A user-owned `nxa_...` key can authenticate an API or CLI session without storing the key in ACCX. Send it only in the `Authorization` header to the explicit token-login command. Use a protected environment variable or secret manager and do not print it.

```bash
export NEXUSS_USER_TOKEN='<read from protected secret input>'
curl -sS -c /tmp/accx-session.cookies -b /tmp/accx-session.cookies \
  -X POST \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $NEXUSS_USER_TOKEN" \
  -d '{"command":"nexuss_token_login"}' \
  "$ACCX_ORIGIN/api/v1/auth"
unset NEXUSS_USER_TOKEN
```

If the Nexuss subject matches an existing unlinked ACCX account, the response is `nexuss_auth_account_link_required`. Authenticate that ACCX account and call `nexuss_link` explicitly with the same protected bearer header. ACCX stores the issuer and subject mapping, not the API key.

Use a protected cookie jar with restrictive permissions. Do not print the cookie file. Verify the session without exposing cookies:

```bash
curl -sS -b /tmp/accx-session.cookies \
  "$ACCX_ORIGIN/api/v1/auth?command=session"
```

### Trusted-service authentication

The service token is normally supplied by the application environment, not typed into an AI conversation.

```bash
export ACCX_ORIGIN='https://<your-accx-origin>'
# ACCX_WORKLOAD_TOKEN must come from the protected backend secret store.
```

Use it only in the designated header:

```bash
curl -sS \
  -H "X-ACCX-Workload-Token: $ACCX_WORKLOAD_TOKEN" \
  "$ACCX_ORIGIN/api/v1/workloads?command=list_secret_metadata"
unset ACCX_WORKLOAD_TOKEN
```

## 4. Configure Continue with nexuss-auth

Use Nexuss Auth as the preferred sign-in path when the ACCX project is connected to a Nexuss Auth project. The user authenticates with Google or GitHub at Nexuss Auth; ACCX receives a verified identity and creates or loads the matching ACCX user account.

### Install and authenticate the Nexuss Auth CLI

```bash
python -m pip install --upgrade nexuss-auth
nexuss --help
export NEXUSS_AUTH_CONFIG_DIR="$HOME/.config/nexuss-agent"
nexuss login --provider github
nexuss --json whoami
```

Use `--provider google` for Google. The browser login is interactive; do not paste provider passwords, OAuth codes, or cookies into the terminal. If an authorized project-scoped `nxa_` token is already available, activate it without browser login:

```bash
nexuss token use --value nxa_<protected-token>
nexuss --json whoami
```

Keep the token in protected input and never echo it. The token authorizes Nexuss Auth project operations; it is not an ACCX workload token.

### Inspect or register the Nexuss Auth project

```bash
nexuss --json project list
nexuss --json project show --id <nexuss-project-id>
```

The project must be active, enable the selected provider, contain the exact ACCX callback in `allowedRedirectUris`, and contain the exact ACCX origin in `allowedOrigins`. Create or update only after inspecting the existing project:

```bash
nexuss --json project create \
  --id <nexuss-project-id> \
  --name "ACCX" \
  --home https://<accx-origin>/ \
  --redirect https://<accx-origin>/auth/nexuss/callback \
  --provider github
```

### Start Continue with nexuss-auth

The ACCX UI calls `GET /api/v1/auth?command=nexuss_start&provider=github&next=/` and navigates to the returned `authorizationUrl`. Direct Nexuss Auth navigation is suitable only for integrations that implement their own browser-bound state and callback handler:

```text
https://nexuss-auth.vercel.app/oauth/start/github?project_id=<nexuss-project-id>&redirect_uri=<url-encoded-accx-callback>&handoff=1
```

Use `/oauth/start/google` for Google. Do not treat a redirect or success query parameter as proof of an ACCX session.

### Exchange the one-time handoff

For cross-site ACCX and Nexuss Auth deployments, the ACCX callback server receives a short-lived `handoff_token` and exchanges it once. Normal ACCX consumers do not call this endpoint; it is shown here to define the trusted server boundary:

```bash
curl -sS -X POST \
  -H 'Content-Type: application/json' \
  -d '{"projectId":"<nexuss-project-id>","handoffToken":"<received-in-callback-server>"}' \
  'https://nexuss-auth.vercel.app/v1/handoff/exchange'
```

The callback server maps the returned verified Nexuss identity to the ACCX user account, creates the ACCX session, and redirects to a clean URL. Never exchange the handoff from browser JavaScript. A replay must fail; if it does not, stop the integration.

### ACCX authentication migration

Use Continue with Nexuss Auth as the default for new ACCX sessions. During migration, link a verified Nexuss identity to the existing ACCX user account before disabling password login. Keep the password path only as an explicit migration fallback until every required account has a verified link. Do not silently create duplicate accounts from the same email; match the verified Nexuss subject and issuer, then require deliberate account-linking rules.

## 5. Record any provider credential to the user account

Use this workflow when the user gives the AI a password, API token, refresh token, client secret, cookie, SSH key, recovery code, or another provider credential and asks to save it.

### Confirm the record destination

Obtain or derive only the non-secret fields:

| Field | Example |
|---|---|
| Provider | `github` |
| Display name | `GitHub production account` |
| Environment | `production` |
| Field kind | `api_token`, `password`, `refresh_token`, `client_secret`, `cookie`, `ssh_key`, `recovery_code`, or `custom` |
| Stable reference | `github.production.account` |
| Tags | `production`, `engineering` |
| Aliases | Other non-secret references, if needed |

If the target account or environment is ambiguous, ask one focused question before writing. If it is clear, proceed without asking the user to repeat the credential.

### Create metadata

Use the authenticated user application path for user-owned metadata. Send a fresh timestamp and nonce for every mutation and include same-origin headers.

```bash
ACCX_NONCE="$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')"
ACCX_TIMESTAMP="$(date +%s%3N)"
curl -sS -b /tmp/accx-session.cookies \
  -H 'Content-Type: application/json' \
  -H "Origin: $ACCX_ORIGIN" \
  -H "Host: $(python3 -c 'from urllib.parse import urlparse; import os; print(urlparse(os.environ["ACCX_ORIGIN"]).netloc)')" \
  -H "X-ACCX-Request-Timestamp: $ACCX_TIMESTAMP" \
  -H "X-ACCX-Request-Nonce: $ACCX_NONCE" \
  -d '{"command":"create_secret_metadata","environmentId":"<environment UUID>","provider":"github","displayName":"GitHub production account","reference":"github.production.account","fieldKind":"api_token","tags":["production"],"aliases":[]}' \
  "$ACCX_ORIGIN/api/v1/app"
unset ACCX_NONCE ACCX_TIMESTAMP
```

The response returns a secret metadata object and its `id`. Save only the metadata ID and reference for the next operation. Do not print the credential value alongside the response.

### Encrypt and activate the value

The value must be encrypted in a trusted backend process before activation. Do not send plaintext to any HTTP endpoint. Use the application’s trusted encryption helper or an equivalent AES-256-GCM envelope-encryption routine:

1. Generate a random 32-byte data key.
2. Encrypt the data key with the configured ACCX vault key.
3. Encrypt the supplied credential with the data key.
4. Submit `{ encryptedDataKey, secretCiphertext, algorithm: "AES-256-GCM" }` to the trusted activation operation.
5. Clear the plaintext variable, data key, and temporary payload after the request.

The activation endpoint is:

```text
POST /api/v1/admin?command=activate_secret_version
```

It requires the protected admin credential and the authenticated user’s audited subject ID in the provisioning process. Do not use this endpoint from browser code or expose the admin credential to the AI’s user-visible output. The activation body is:

```json
{
  "secretId": "<metadata UUID>",
  "encryptedPayload": {
    "encryptedDataKey": { "ciphertext": "<base64>", "iv": "<base64>", "tag": "<base64>" },
    "secretCiphertext": { "ciphertext": "<base64>", "iv": "<base64>", "tag": "<base64>" },
    "algorithm": "AES-256-GCM"
  }
}
```

Do not put real payloads in this skill, shell history, logs, tickets, or AI responses.

### Verify the save

Read metadata through the user session or workload SDK and require:

```text
reference = requested reference
status = active
activeVersion >= 1
```

Report: “Credential metadata and encrypted active version saved for `<reference>` in `<environment>`.” Do not report the value.

## 5. List and inspect saved accounts

Use the workload SDK/API for trusted backend listing:

```bash
curl -sS \
  -H "X-ACCX-Workload-Token: $ACCX_WORKLOAD_TOKEN" \
  "$ACCX_ORIGIN/api/v1/workloads?command=list_secret_metadata"
```

Filter the returned metadata by exact reference, provider, environment, tag, alias, status, or health state. If multiple records match the user’s request, ask them to choose. Never select a production record merely because it is the first result.

## 6. Update account organization

For user-owned metadata changes, use the existing authenticated session and fresh mutation headers. Supported changes include tags, aliases, health status, expiry, and other documented metadata fields.

1. Read the current metadata.
2. Identify the exact metadata ID.
3. Apply only the requested field changes.
4. Send a new nonce and timestamp.
5. Verify the returned metadata and the resulting state.
6. Clear the JavaScript SDK metadata cache when using the SDK.

Do not treat changing a display label or tag as changing the stored credential.

## 7. Rotate a saved credential

Use when the user explicitly asks to replace or rotate a credential.

1. Read the exact current reference and metadata ID.
2. Confirm the target environment and provider.
3. Accept the new credential through protected input.
4. Encrypt the new value in trusted memory.
5. Activate a new encrypted version.
6. Re-read metadata and require a higher `activeVersion` or the documented activation result.
7. Clear SDK metadata cache.
8. Report only the new active version and sanitized status.

Do not revoke the old version before the new encrypted version is confirmed active unless the user explicitly requests emergency revocation.

## 8. Use a saved credential for an action

```ts
const metadata = await accx.getSecretMetadata(reference);
if (metadata.status !== "active") throw new Error("Reference is not active");

const result = await accx.submitAction({
  action: "provider.health_check",
  secretReferences: [metadata.reference],
  requiredScopes: ["job.execute"],
  input: {},
  idempotencyKey: crypto.randomUUID(),
});
```

For Python, use `get_secret_metadata`, `JobSubmission`, and `submit_action` as documented in the SDK reference. Poll with `getJobStatus` or `get_job_status` until terminal status.

## 9. Handle approval-required actions

For `provider.publish`, submit the action only when the user clearly requested it and the reference/environment are unambiguous. The expected initial status is `awaiting_approval`.

Explain the approval requirement and stop. Do not approve it as the AI, bypass the approval flow, or use the admin credential as a substitute. Continue only after the authorized approval process reports that the job is queued.

## 10. Cleanup and verification

After a disposable integration test:

1. Confirm the job reached `succeeded`, `failed`, or `cancelled`.
2. Revoke the temporary service identity through the authorized provisioning process.
3. Revoke or remove the temporary test record according to the user’s explicit cleanup instruction.
4. Delete temporary cookie jars, payload files, and local variables.
5. Report the job ID, sanitized status, and cleanup result only.

A save is complete only after encrypted activation and metadata verification. An action is complete only after a terminal `succeeded` status.
