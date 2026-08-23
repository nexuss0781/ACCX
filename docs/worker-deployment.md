# ACCX Dedicated Worker Contract

ACCX uses a **pull-only, one-shot worker** to trigger trusted provider execution. The worker is not a vault client: it never receives `ACCX_VAULT_MASTER_KEY`, Paradox credentials, administrator credentials, workload tokens, encrypted payloads, plaintext credentials, or provider responses containing sensitive material. Those operations remain inside the same Vercel control-plane function that validates the worker request.

## Required worker configuration

| Variable | Required | Meaning |
|---|---:|---|
| `ACCX_CONTROL_PLANE_URL` | Yes | HTTPS origin of the deployed ACCX Vercel project; no URL path or credentials. |
| `ACCX_WORKER_KEY` | Yes | Dedicated server secret matching the Vercel control-plane `ACCX_WORKER_KEY`. |
| `ACCX_WORKER_ID` | Yes | Stable, non-secret identifier such as `prod-worker-a`. It appears in audit records. |

Run `node worker/accx-worker.mjs` as a **single scheduled invocation**. It asks `POST /api/v1/worker` with `{ "command": "dispatch_jobs" }` to process at most one queued job. A scheduler may invoke it frequently, but concurrent invocations are safe: the control plane atomically changes `queued` jobs to `running` and binds them to exactly one `workerId`. Replays return a sanitized state and do not call provider adapters twice.

## Deployment rules

The control plane remains in the existing ACCX Vercel project. Deploy the worker in a private scheduler or one-shot container runtime that can hold the two worker-only values above. Do not run it in a browser, frontend build, public cron URL, or a process that shares a secret store with workload clients.

The worker must make outbound HTTPS requests only to the configured ACCX origin. It must not log headers, request bodies, environment variables, or full responses. The included worker logs only the dispatch count and sanitized final statuses. Set a process timeout below the Vercel function limit; the included script uses 55 seconds.

> **Operational boundary:** the worker authenticates dispatch only. The Vercel `/api/v1/worker` endpoint dispatches the `dispatch_jobs` subcommand and enforces the worker key, atomically claims a queued job, verifies action policy and lease activity, decrypts only in server memory, invokes the registered trusted adapter, clears the in-memory secret reference, and returns a sanitized result.

## Incident response

Rotate `ACCX_WORKER_KEY` in the Vercel project and worker secret store together when compromise is suspected. Disable the worker scheduler before rotation. Existing queued jobs remain safe because no provider call begins without a fresh authenticated dispatch and valid lease. Review `job.*` audit events using the cloud audit API before resuming the worker.
