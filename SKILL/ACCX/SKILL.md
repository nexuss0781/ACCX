---
name: accx-control-plane
description: Operate, integrate, test, secure, deploy, publish, and document the ACCX reference-only credential control plane. Use for ACCX API or SDK work, human authentication, secret metadata lifecycle, workload identities, job orchestration, worker execution, Vercel deployment, package publication, production diagnosis, and end-to-end verification.
---

# ACCX Control Plane

## Mission

Treat ACCX as a **reference-only credential control plane**. Use stable secret references, encrypted server-side values, scoped identities, short-lived workload tokens, approval-gated actions, and sanitized results. Never return, log, copy, persist, place in a URL, or expose a plaintext credential to a browser, SDK consumer, audit record, worker, or model.

Use this skill to move from the shortest correct workflow to the complete API and production journey. Do not invent endpoints, commands, scopes, response fields, or security exceptions. Read the linked reference that matches the requested operation before changing or invoking it.

## Non-negotiable rules

1. **Never expose secrets.** Do not print, attach, commit, paste, or echo `DATABASE_URL`, `ACCX_VAULT_MASTER_KEY`, `ACCX_ADMIN_KEY`, `ACCX_WORKER_KEY`, workload tokens, registry tokens, session cookies, encrypted payloads, or `.env` files. Redact command output before reporting it.
2. **Keep authorization server-side.** Never trust a client-supplied scope, project, destination URL, approval state, actor ID, or worker identity. The server resolves identity, membership, scope, lease, policy, and ownership.
3. **Use the correct credential for the actor.** Human browser actions use an HttpOnly session cookie. Admin control-plane actions use `X-ACCX-Admin-Key`. Workload clients use `X-ACCX-Workload-Token`. Workers use `X-ACCX-Worker-Key`. Never substitute one credential class for another.
4. **Use references, not values.** SDK job requests contain `secretReferences`; metadata responses may contain references and lifecycle fields, never credential values.
5. **Require step-up for destructive human mutations.** Sensitive browser operations need recent MFA/passkey step-up plus fresh mutation timestamp, nonce, same-origin, rate-limit, and replay checks.
6. **Preserve capabilities during consolidation.** Keep the six Vercel entrypoints and route capabilities. Add or change a `command` mapping rather than creating a new serverless function unless the deployment limit is explicitly reconsidered.
7. **Do not claim end-to-end completion from unit tests alone.** Separate implemented, locally validated, package-installed, live API-verified, and credentialed production-verified status.
8. **Treat provider adapters as reviewed server code.** Do not let job input supply an adapter, destination, raw headers, or plaintext. Require HTTPS, a server-owned origin allowlist, no redirects, abort support, and sanitized results. If no adapter is registered for an action, report that action as incomplete rather than pretending it executed.

## Quick workflow selector

Choose exactly one path before acting:

| Request | Start here | Stop condition |
|---|---|---|
| Understand the API | Read [API reference](references/api-reference.md) | Command, method, auth, input, output, and error are identified |
| Integrate a backend service | Read [SDK reference](references/sdk-reference.md), then the workload journey in [journeys](references/journeys.md) | Token, metadata, submit, status, and retry behavior are implemented |
| Build a browser feature | Read browser/auth and app sections in [API reference](references/api-reference.md) | Session, same-origin, step-up, nonce, and zero-plaintext rules are satisfied |
| Add a secret or rotate metadata | Read the metadata lifecycle section in [API reference](references/api-reference.md) | Correct environment, version, scope, encryption, audit, and cleanup are verified |
| Run a job | Read orchestration and worker sections in [API reference](references/api-reference.md) | Policy, scopes, leases, approval, worker claim, adapter, timeout, and sanitized status are verified |
| Deploy or diagnose Vercel | Read [operations reference](references/security-operations.md) | Build, function count, runtime assets, environment, live health, and logs are verified |
| Publish an SDK | Read publication section in [security and operations](references/security-operations.md) | Versioned artifacts are checked, published, clean-installed, and smoke-tested |
| Perform a full audit | Read all three references in order: SDK, API, journeys/operations | Every claimed phase is labeled with evidence and remaining gaps |

## Common quick workflows

### Query production health

1. Request `GET /health`.
2. Require HTTP `200`.
3. Require JSON `status: "ok"` and `dependencies.database: "ok"`.
4. If the response is degraded, classify only the bounded non-secret error and do not report the service healthy.
5. Also request `GET /api/health` when verifying the rewrite or function directly.

```bash
curl -fsS --max-time 30 https://<accx-origin>/health
curl -fsS --max-time 30 https://<accx-origin>/api/health
```

### Integrate a trusted backend

1. Provision a service identity with only required scopes.
2. Provision a short-lived workload token and place it directly in the service secret store.
3. List metadata using `X-ACCX-Workload-Token`.
4. Submit a job containing an action, stable references, required scopes, input object, and UUID idempotency key.
5. Poll `job_status` using the same workload token.
6. Never print the token or provider result.

Use [SDK reference](references/sdk-reference.md) for JavaScript and Python method names and [journeys](references/journeys.md) for the complete sequence.

### Change a browser-owned secret record

1. Use the authenticated session cookie.
2. Send `Origin` matching the HTTPS host and a fresh `X-ACCX-Request-Timestamp` plus unique `X-ACCX-Request-Nonce`.
3. Use metadata-only fields for ordinary updates.
4. Require recent step-up for soft delete, revoke, purge, and job approval.
5. Expect sanitized JSON and audit recording.

Do not call admin or worker APIs from browser code.

### Publish an SDK

1. Confirm the package name and increment both SDK versions to a new immutable version.
2. Build the JavaScript package and run `npm pack --dry-run`.
3. Build the Python wheel and run `twine check`.
4. Inspect file lists for secrets, local databases, `.env` files, fixtures, or credentials.
5. Run API checks, SDK checks, lint, tests, build, and `git diff --check`.
6. Publish only with explicitly authorized registry credentials supplied through a transient secure mechanism.
7. Install the exact version from a clean Node project and Python virtual environment.
8. Run metadata-only and sanitized-result smoke tests.
9. Record package names, versions, commit, publication status, and test evidence without recording tokens.

## Deterministic implementation rules

Use the repository’s six function entrypoints:

```text
/api/health.ts
/api/v1/auth.ts
/api/v1/app.ts
/api/v1/admin.ts
/api/v1/workloads.ts
/api/v1/worker.ts
```

Route subcommands through the shared dispatcher. Keep request validation in the server handler, database access in the control-plane adapter, authorization in the shared helpers, and provider egress in reviewed adapters. Keep the Vercel runtime self-contained; do not rely on pnpm symlink tracing or postinstall mutation for required runtime assets.

When editing code, update the relevant regression test in the same change. For a new command, add route mapping, method validation, payload schema, authorization test, error mapping, and a safe end-to-end fixture or explicitly document why live execution is unavailable.

## Completion rubric

Report each capability using one of these exact states:

| State | Meaning |
|---|---|
| `implemented` | Source and route exist; no runtime proof yet |
| `locally-validated` | Type, lint, unit, build, or local database evidence exists |
| `package-verified` | Published artifact was installed from its registry and smoke-tested |
| `live-verified` | Deployed endpoint returned the expected sanitized result |
| `credentialed-e2e-verified` | A controlled identity/token/fixture/worker journey completed and was cleaned up |
| `blocked` | A specific missing adapter, credential, fixture, deployment, or external dependency prevents proof |

Do not label the entire SDK ecosystem complete when package publication, workload-token execution, worker execution, or provider adapters remain unverified. Use [journeys](references/journeys.md) to list the exact phase that remains.

## Reference navigation

Read references directly from this file; do not search for undocumented behavior:

- **[SDK reference](references/sdk-reference.md):** JavaScript, browser, and Python exports, constructors, methods, contracts, retries, redaction, packaging, and parity.
- **[API reference](references/api-reference.md):** All six entrypoints, every command, methods, headers, inputs, outputs, scopes, status codes, and error rules.
- **[Journeys](references/journeys.md):** Human, metadata, identity, workload, approval, worker, provider, package, and verification sequences with gates.
- **[Security and operations](references/security-operations.md):** Zero-plaintext rules, encryption, deployment, Vercel limits, runtime diagnosis, release checks, and publication procedure.
