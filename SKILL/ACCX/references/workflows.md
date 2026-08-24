# ACCX End-to-End AI Workflows

## 1. Choose the operating mode

ACCX has two practical consumer modes:

| Mode | Use when | Authentication |
|---|---|---|
| User-account mode | The AI is acting for a logged-in ACCX user and must record credentials to that user’s account | Session cookie from `register` or `login` |
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

### Register a user

Use a unique email and a password supplied through protected input. Do not put a real password in shell history or a transcript. Prefer a prompt/read mechanism or a secret manager.

```bash
read -r ACCX_USER_EMAIL
read -rs ACCX_USER_PASSWORD
curl -sS -c /tmp/accx-session.cookies -b /tmp/accx-session.cookies \
  -H 'Content-Type: application/json' \
  -d "{\"command\":\"register\",\"name\":\"<display name>\",\"email\":\"$ACCX_USER_EMAIL\",\"password\":\"$ACCX_USER_PASSWORD\"}" \
  "$ACCX_ORIGIN/api/v1/auth"
unset ACCX_USER_EMAIL ACCX_USER_PASSWORD
```

### Log in

```bash
read -r ACCX_USER_EMAIL
read -rs ACCX_USER_PASSWORD
curl -sS -c /tmp/accx-session.cookies -b /tmp/accx-session.cookies \
  -H 'Content-Type: application/json' \
  -d "{\"command\":\"login\",\"email\":\"$ACCX_USER_EMAIL\",\"password\":\"$ACCX_USER_PASSWORD\"}" \
  "$ACCX_ORIGIN/api/v1/auth"
unset ACCX_USER_EMAIL ACCX_USER_PASSWORD
```

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

## 4. Record any provider credential to the user account

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
