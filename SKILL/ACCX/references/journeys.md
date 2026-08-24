# ACCX End-to-End Journeys

Use these journeys to plan, execute, and report ACCX work. Every journey has an entry condition, a deterministic sequence, an exit gate, and a failure interpretation. Do not skip a gate silently.

## Journey 0 — Establish the project

### Entry

The repository is available, the deployment origin is known, and no secret values have been copied into source, logs, attachments, or model context.

### Sequence

1. Inspect `package.json`, `pnpm-lock.yaml`, `vercel.json`, `.env.example`, `server/`, `api/`, `shared/`, `packages/sdk-js/`, and `packages/sdk-python/`.
2. Confirm that the API uses six entrypoints: health, auth, app, admin, workloads, and worker.
3. Confirm that the server environment contract requires `DATABASE_URL`, `ACCX_VAULT_MASTER_KEY`, `ACCX_ADMIN_KEY`, and `ACCX_WORKER_KEY`.
4. Confirm that server-only variables are not prefixed `VITE_` and are not included in client bundles.
5. Read the API and SDK references before changing a contract.

### Exit gate

The architecture, credential classes, command maps, database adapter, SDK package names, and deployment constraints are documented without exposing values.

## Journey 1 — Provision the control plane

### Entry

A Paradox project/database or a canonical `DATABASE_URL` is available in a protected server environment.

### Sequence

1. Connect through the ACCX Paradox adapter using the canonical URL.
2. Run the control-plane bootstrap with the admin key.
3. Confirm the workspace, primary project, and development/staging/production environments exist.
4. Run `GET /health` and require `status: "ok"` plus `dependencies.database: "ok"`.
5. Record only sanitized identifiers and health status.

### Exit gate

The control plane is initialized, database connectivity succeeds, and no database path, URL, token, or passphrase appears in output.

### Failure branches

- `database_runtime_asset`: inspect the bundled sql.js/asm.js runtime and Vercel include rules.
- `configuration is incomplete`: inspect server environment variables without printing values.
- Connection or sync failure: inspect Paradox configuration and writable `/tmp` behavior in serverless runtime.

## Journey 2 — Register a human and establish MFA

### Entry

The client is a browser or trusted test harness and the API origin is known.

### Sequence

1. Call `POST /api/v1/auth` with `command: "register"` or `command: "login"`.
2. Store the HttpOnly session cookie only in the browser/client cookie jar.
3. Call `GET /api/v1/auth?command=session` and verify the current user shape.
4. Start and confirm TOTP or register a passkey when required.
5. Perform a `step_up` verification before destructive operations or job approval.
6. Verify that step-up expiry is bounded and that recovery material is never logged.

### Exit gate

Session introspection works, MFA state is represented, and the caller can prove recent step-up without exposing authentication secrets.

## Journey 3 — Create and manage secret metadata

### Entry

A human session with the correct workspace scope exists, or an authorized server-side admin path is intentionally being used.

### Create sequence

1. Select an existing environment ID; do not invent a project or environment relationship in the client.
2. Submit `create_secret_metadata` with provider, display name, stable lowercase reference, field kind, tags, and aliases.
3. For browser mutation, send matching HTTPS `Origin` and `Host`, a current timestamp, and a unique nonce.
4. Verify HTTP 201 and inspect only the sanitized metadata response.
5. If a value must be activated, encrypt it in trusted server memory and submit only the AES-256-GCM encrypted payload through the admin activation path.

### Update sequence

1. Submit metadata-only changes using `update_secret_metadata`.
2. Keep tags, aliases, health, and expiry within schema limits.
3. Verify the updated metadata and audit event.

### Destructive sequence

1. Perform recent step-up.
2. Create a fresh mutation timestamp and nonce.
3. Call `soft_delete_secret`, `revoke_secret`, or `purge_deleted_secrets`.
4. Verify the lifecycle state, invalidated leases where applicable, and sanitized audit event.

### Exit gate

Metadata is queryable and organized, values remain inaccessible to the client, destructive operations require step-up, and audit records contain no secret-shaped values.

## Journey 4 — Create a service identity and workload token

### Entry

An authorized provisioning operator has the admin key and a valid project ID.

### Sequence

1. Call `create_identity` with the project ID, a descriptive name, and the minimum required scopes.
2. Call `provision_token` with a TTL between 60 and 900 seconds.
3. Place the returned token directly into the backend service secret store.
4. Delete the token from local variables or test output as soon as the store write completes.
5. Never send this token to a browser, model, log, URL, or source file.

### Exit gate

The service identity is active, scopes are minimal, the token has a bounded expiry, and only a server-side workload client possesses it.

### Cleanup

Call `revoke_identity` after a disposable integration test. Revocation must invalidate tokens and active secret leases.

## Journey 5 — Use the SDK for metadata and a health-check job

### Entry

A live service identity, short-lived workload token, active secret reference, and safe non-production fixture exist.

### Sequence

1. Construct the JavaScript or Python SDK with the ACCX origin and workload token.
2. Call `getSecretMetadata` or `get_secret_metadata` and verify metadata only.
3. Submit `provider.health_check` with a stable reference, `job.execute`, object input, and UUID idempotency key.
4. Require HTTP 202 and status `queued`.
5. Invoke the private worker with `dispatch_jobs` using only the worker key.
6. Require a sanitized worker result with status `succeeded`.
7. Read `job_status` with the workload token and require the same job ID with terminal status `succeeded`.
8. Revoke the service identity and test fixture secret.

### Exit gate

The workload-token, metadata, queue, worker, and sanitized status journey completes without a plaintext credential crossing the API boundary.

## Journey 6 — High-impact provider publishing

### Entry

A reviewed provider adapter is registered for the exact immutable action name, its HTTPS origin allowlist is server-owned, and a non-production provider fixture exists.

### Sequence

1. Confirm `provider.publish` requires `job.execute` and `provider.publish`.
2. Submit the job with a UUID idempotency key.
3. Require status `awaiting_approval`.
4. Present the sanitized job context to an authorized human reviewer.
5. Require recent step-up and fresh mutation integrity for `approve_job`.
6. Require the job to transition to `queued` only after approval.
7. Dispatch it with the private worker.
8. Verify only sanitized result/status and audit event.
9. Revoke the test identity, leases, and fixture.

### Exit gate

Publishing is not complete until a concrete reviewed provider adapter executes successfully. If no adapter is registered, mark the action `blocked` or `implemented-only`; do not claim provider execution.

## Journey 7 — Browser vault transfer

### Entry

An authenticated user has a recent step-up and the workspace ID is authorized.

### Export

1. Send fresh same-origin mutation headers.
2. Call `export_vault` with the workspace ID.
3. Treat the encrypted bundle as sensitive; do not log or attach it.
4. Verify the bundle format is `accx.encrypted-vault.v1`.

### Import

1. Validate the bundle format, timestamp, workspace ID, and record limit.
2. Send the bundle only over HTTPS to the authenticated API.
3. Call `import_vault` with fresh mutation headers.
4. Verify imported count and audit event without printing bundle content.

### Exit gate

Only encrypted vault data crosses the transfer boundary and step-up plus mutation integrity are enforced.

## Journey 8 — Deploy and diagnose Vercel

### Entry

The repository passes local checks and no secret or local database file is tracked.

### Sequence

1. Run API type checks, SDK type checks, lint, tests, production build, and `git diff --check`.
2. Confirm exactly six API entrypoints are deployed.
3. Confirm required runtime assets are repository-owned and statically traceable.
4. Confirm the Node runtime is the supported project version.
5. Push the commit and wait for the deployment status.
6. Request both `/health` and `/api/health` with cache-busting if necessary.
7. Require HTTP 200, `status: "ok"`, and database `ok`.
8. Request the session endpoint and require a non-500 response.
9. If the deployment is degraded, use only the bounded redacted diagnostic and inspect the latest deployment rather than an earlier log.

### Exit gate

The exact pushed revision serves production, health is HTTP 200 with database `ok`, auth does not crash, and the deployment status is successful.

## Journey 9 — Publish and verify SDK artifacts

### Entry

The source commit is clean, package versions are new and matching the intended release, and registry publication is explicitly authorized.

### Sequence

1. Build JavaScript distribution from `packages/sdk-js`.
2. Run `npm pack --dry-run` and inspect its file list.
3. Build the Python wheel from `packages/sdk-python`.
4. Run `twine check` on every Python artifact.
5. Reject artifacts containing environment files, local databases, provider credentials, workload tokens, registry tokens, or test values.
6. Publish the immutable version to NPM and PyPI through a transient secure credential mechanism.
7. Install the exact version in a clean Node project and Python virtual environment.
8. Run import, schema, retry, timeout, and redaction smoke tests.
9. Record only package names, versions, publication URLs, commit ID, and sanitized results.

### Exit gate

Both artifacts are publicly discoverable, clean-installable, importable, and behaviorally smoke-tested without exposing credentials.

## Journey 10 — Final release report

Report a table with one row per capability and one of the exact completion states from `SKILL.md`. Include the commit, package versions, live health status, test totals, and explicitly unverified actions. Never replace a missing provider adapter or skipped credentialed test with an optimistic claim.
