# ACCX Security and Operations Reference

## Security model

ACCX separates human sessions, admin control, workload service access, and worker execution. The separation is mandatory, not a convention.

| Actor | Credential | Can do | Cannot do |
|---|---|---|---|
| Human browser | HttpOnly secure session cookie | View and mutate authorized metadata; approve with step-up | Receive plaintext credentials or use admin/worker APIs |
| Admin operator | `X-ACCX-Admin-Key` | Bootstrap, manage metadata/versions, identities, and workload tokens | Expose the key to browser or workload clients |
| Workload service | `X-ACCX-Workload-Token` | Read permitted metadata, submit jobs, read own job status | Manage identities, approve jobs, or dispatch workers |
| Private worker | `X-ACCX-Worker-Key` | Dispatch and execute queued jobs | Receive master key, admin key, workload token, or broad database access |

## Zero-plaintext invariant

Enforce this invariant in code review, tests, logs, responses, and documentation:

```text
Raw secret values must never be serialized to a browser, client SDK response,
audit event, log entry, URL, or persistent client storage.
```

Use encrypted payloads only for trusted server-side activation. Use secret references for all client and workload requests. Return sanitized job states and provider status messages only.

## Encryption and lifecycle

Secret activation uses envelope encryption with AES-256-GCM:

1. Generate a random 32-byte data key.
2. Encrypt the data key with the 32-byte base64-decoded `ACCX_VAULT_MASTER_KEY`.
3. Encrypt the secret value with the data key.
4. Submit only `{ encryptedDataKey, secretCiphertext, algorithm: "AES-256-GCM" }` to the activation handler.
5. Zero temporary key buffers after use.
6. Decrypt only inside the trusted execution path and clear the plaintext variable in a `finally` block.

Never store the vault master key in source, frontend variables, a workload token, worker configuration, or a test fixture. Never use a raw credential as an idempotency key or reference.

## Mutation integrity

For browser mutations, send all of the following:

```text
Origin: https://<accx-origin>
Host: <accx-origin>
X-ACCX-Request-Timestamp: <current Unix milliseconds>
X-ACCX-Request-Nonce: <unique 16–160 character nonce>
```

The server checks same-origin, timestamp skew, rate limits, and nonce replay. Generate a fresh nonce for every mutation. Do not retry a mutation automatically after an uncertain network failure unless the operation is idempotent and the API contract explicitly permits it.

## Provider adapter isolation

Provider-specific actions must be implemented as reviewed server-side adapters. The adapter receives provider name, action name, decrypted secret, structured input, abort signal, and immutable policy. It must:

1. Ignore any client-supplied destination or adapter code.
2. Construct the destination from server-owned configuration.
3. Require HTTPS.
4. Require an exact server-owned origin allowlist.
5. Reject redirects.
6. Honor the abort signal and timeout budget.
7. Avoid serializing response bodies.
8. Return a bounded sanitized message only.
9. Clear secret variables after execution.

The built-in `provider.health_check` validates the active encrypted lease inside ACCX without external side effects. `provider.publish` remains incomplete until a concrete reviewed provider adapter is registered and tested.

## Vercel deployment

Keep the deployment within the Vercel Hobby function limit by using exactly these entrypoints:

```text
api/health.ts
api/v1/auth.ts
api/v1/app.ts
api/v1/admin.ts
api/v1/workloads.ts
api/v1/worker.ts
```

Use `command` subcommands through the shared dispatcher. Keep `functions.<glob>.includeFiles` as a string when needed. Do not use a recursive `node_modules` include that follows pnpm symlinks. Required runtime modules/assets must be repository-owned, statically analyzable, and locally tested from a clean install.

The Vercel configuration must provide:

- Vite framework/build configuration.
- Frozen pnpm install.
- Production build command and `dist` output.
- Supported Node runtime.
- `/health` rewrite to `/api/health`.
- Function duration within the project plan.
- Server-only environment variables.
- No `VITE_` prefix for secret-bearing variables.

## Environment contract

Required server variables are:

| Variable | Purpose | Exposure |
|---|---|---|
| `DATABASE_URL` | Canonical Paradox connection URL | Server only |
| `ACCX_VAULT_MASTER_KEY` | Envelope-encryption root key | Server only |
| `ACCX_ADMIN_KEY` | Admin header secret | Server-only provisioning calls |
| `ACCX_WORKER_KEY` | Worker header secret | Private worker only |

Workload service configuration additionally needs the ACCX origin and a provisioned workload token. A worker process needs the ACCX origin, worker key, and a non-secret worker ID. Never put these into frontend build variables or package archives.

## Build and test gates

Run all applicable gates before deploying or publishing:

```bash
pnpm run check:api
pnpm run check:sdk
pnpm run lint
pnpm test
pnpm run build
git diff --check
```

For SDK artifacts:

```bash
pnpm exec tsc -p packages/sdk-js/tsconfig.json
npm pack --dry-run ./packages/sdk-js
python -m pip wheel --no-deps ./packages/sdk-python -w /tmp/accx-python-dist
python -m twine check /tmp/accx-python-dist/*
```

The normal test suite includes security, authorization-abuse, route-consolidation, worker-contract, orchestration, vault lifecycle, frontend, SDK resilience, and release-readiness tests. Some live or registry tests may be skipped when protected credentials or fixtures are absent; report those skips explicitly.

## Production verification gate

Do not report a deployment healthy unless all of these are true:

1. The Vercel/GitHub deployment status is successful.
2. `GET /health` returns HTTP 200.
3. The response contains `status: "ok"`.
4. The response contains `dependencies.database: "ok"`.
5. `GET /api/health` also succeeds when the direct function path is being verified.
6. `GET /api/v1/auth?command=session` does not return HTTP 500.
7. The response revision, if present, corresponds to the intended deployment.

Use cache-busting only to distinguish stale aliases; do not use it to conceal a failed deployment.

## Safe diagnosis

Classify failures without exposing raw paths, URLs, environment values, headers, or exception payloads.

| Symptom | Likely area | Action |
|---|---|---|
| HTTP 503 with configuration classification | Missing server variable | Check presence and deployment environment; never print values |
| `database_runtime_asset` | sql.js runtime missing | Check repository-owned runtime, static import, clean build, and Vercel bundle |
| Missing module classification | Function tracer omitted a local module | Replace dynamic import with static local import and re-test clean deployment |
| Unwritable home/config path | SDK writes outside `/tmp` | Redirect serverless-writable state to `/tmp` |
| HTTP 401 | Wrong credential class, missing header, expired token | Check header name and token lifecycle without printing token |
| HTTP 403 | Missing scope, session membership, step-up, or same-origin | Inspect authorization path and mutation headers |
| HTTP 409 | Replay, conflict, or duplicate idempotency | Use a new nonce or intentionally reuse the idempotency key |
| Job `failed` with adapter-unregistered message | No reviewed provider adapter | Mark provider action incomplete; do not claim external execution |
| `DEP0169` in Vercel logs | Platform/runtime legacy URL parsing | Keep supported Node runtime pin; do not suppress all warnings globally |

The deprecation warning is non-fatal if the endpoint is healthy, but it should be treated as a platform/runtime signal. Do not misclassify it as a database failure.

## SDK publication

The packages are published independently of application deployment:

| Registry | Name | Required artifact |
|---|---|---|
| NPM | `@nexuss0781/accx` | JavaScript package with `dist`, declarations, and README |
| PyPI | `accx` | Python wheel and source distribution when applicable |

Before publication:

1. Increment both package versions to a new immutable version.
2. Confirm versions match the intended release record.
3. Build and inspect the NPM dry-run file list.
4. Build and run `twine check` on Python artifacts.
5. Reject artifacts containing secrets, environment files, local databases, provider fixtures with values, or registry credentials.
6. Use only explicitly authorized registry credentials through transient secure input or protected CI environment secrets.
7. Never put credentials in shell history, source, package metadata, logs, or the skill.
8. Install the exact published versions in clean environments.
9. Run SDK smoke tests with fake transport or a disposable non-production fixture.
10. Record names, versions, URLs, commit ID, and sanitized results only.

Published archives are immutable. If a mistake is found, publish a corrected later version and revoke compromised workload tokens; do not attempt to alter the old archive.

## Rollback and incident response

If a package token, workload token, session, admin key, worker key, or vault key is exposed:

1. Stop publication and deployment.
2. Revoke the exposed token or rotate the affected key.
3. Inspect package and repository history for contamination.
4. Publish a corrected later package version if necessary.
5. Redeploy from a clean commit.
6. Run health and auth checks.
7. Report only the incident class, affected component, rotation status, and verified result.

Do not delete evidence that is needed for incident analysis, but do not preserve secret values in logs or reports.
