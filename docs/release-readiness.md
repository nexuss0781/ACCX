# ACCX Release Readiness

ACCX is intended to be released as one Vercel project containing the React control-plane interface and serverless API routes. The release boundary is metadata-only in the browser: the frontend can authenticate a user, register a stable reference, list sanitized metadata, and view sanitized audit events, but it cannot resolve or copy a credential value.

## Verification sequence

Run the following commands from the repository root before a release candidate is created:

```bash
pnpm run check:api
pnpm run check:sdk
pnpm test
pnpm run build
node --check worker/accx-worker.mjs
```

The deterministic suite includes encryption, RBAC, lease, audit-redaction, SDK-surface, frontend-boundary, worker-contract, and managed-secret configuration checks. The gateway probe is run with `pnpm test:network`, and the opt-in live Paradox control-plane test is run with `ACCX_LIVE_PARADOX_TEST=true`; both must execute only in a secure server environment.

## Vercel configuration

The Vercel project must contain the server-only values already documented by the environment accessor, including `ACCX_VAULT_MASTER_KEY`, `ACCX_ADMIN_KEY`, `ACCX_WORKER_KEY`, `PARADOX_PASSPHRASE`, `PARADOX_API_KEY`, `PARADOX_GATEWAY_URL`, and `PARADOX_RESOLVER_URL`. These values must never be placed in `VITE_*` variables, committed files, SDK responses, URLs, browser storage, or logs.

The internal routes under `/api/v1/internal/*` are not browser APIs. They require the worker key and should be reachable only by the private worker runtime and controlled operational tooling. The worker runtime receives only its HTTPS control-plane origin, worker key, and audit identifier as described in [worker-deployment.md](./worker-deployment.md).

## Package release boundary

The npm and PyPI SDKs accept stable secret references and return sanitized orchestration results. They do not expose plaintext-resolution methods. Before publishing either package, build the artifact in an isolated directory and inspect its file list; the artifact must contain source contracts, client code, and documentation only, never `.env` files, managed credentials, encrypted database snapshots, or runtime logs.

Publishing remains a separate human-controlled action. Version 0.1.0 of the JavaScript and Python SDKs is already published; subsequent releases must use the protected manual workflow and the verification sequence above.

## Handoff checklist

| Area | Required state |
|---|---|
| Browser | No account password field, secret reveal control, secret clipboard path, or credential persistence remains. |
| API | Session routes issue and revoke HttpOnly cookies; metadata routes require a session; administrative and worker keys remain server-only. |
| Database | Schema initialization is idempotent, version conflicts are rejected, and queued jobs are atomically claimed before execution. |
| Worker | The one-shot worker uses HTTPS, a dedicated worker key, a stable worker identifier, a bounded request timeout, and sanitized logging. |
| SDKs | `pnpm run check:sdk` passes and both SDK surfaces remain reference-only. |
| Operations | Worker key rotation and incident response follow the dedicated worker guide. |

Any failed item blocks release until the failure is understood and recorded in `docs/error-cycles.md`.
