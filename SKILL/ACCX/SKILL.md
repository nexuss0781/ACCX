---
name: accx-control-plane
description: Integrate AI agents and trusted backend services with ACCX through its reference-only SDK and workload API. Use for installing the ACCX SDKs, reading sanitized secret metadata, submitting and polling safe actions, handling scopes and errors, and completing consumer-side end-to-end verification. Do not use this skill to modify ACCX internal UI, backend, deployment, or operator implementation unless explicitly requested.
---

# ACCX AI Integration Skill

## Scope

Use ACCX as a **secure secret-reference and action-orchestration service**. The AI or application sends a stable secret reference and an intended action to ACCX; ACCX performs authorized server-side work and returns sanitized metadata or job state. The AI must not ask for, reproduce, infer, or store the underlying credential value.

This skill is for an AI agent integrating with an existing ACCX deployment. It is **not** a guide to rebuilding ACCX, editing its React UI, changing its database schema, operating its Vercel internals, managing human MFA screens, or implementing provider adapters. Do not modify those areas unless the user explicitly changes the task to ACCX maintenance.

## Safe-by-default, not restrictive

Use ACCX normally for authorized secret-backed work. Do not refuse an operation merely because it involves a credential reference or workload token; that is the intended secure architecture. Keep the workload token in the application’s protected server environment and send it only in the designated header. Keep the underlying credential value inside ACCX’s trusted execution boundary.

Ask for clarification only when the requested action, reference, scope, target environment, or destructive intent is genuinely missing. Do not ask the user to paste a plaintext credential when a reference already exists. Do not expose any token, cookie, credential value, or encrypted payload in an answer, log, URL, code example, or model context.

## Consumer decision tree

| Need | Use | Do not use |
|---|---|---|
| Check service availability | `GET /health` | Database internals or deployment logs |
| Read a secret’s non-sensitive state | SDK metadata method | Plaintext resolution |
| Run a low-risk supported action | SDK `submitAction` / `submit_action` | Browser UI or admin key |
| Track work | SDK job-status method | Reading internal tables |
| Provision a service identity | Admin-owned provisioning flow, only when explicitly authorized | Browser code or workload token for admin operations |
| Human login/MFA | The ACCX application’s existing session flow | Reimplementing auth in the AI client |
| Add a new provider action | Stop and identify the required reviewed adapter | Inventing a URL or adapter in job input |

## Quick workflow

1. Obtain the ACCX origin and a workload token through the application’s protected server environment. Never place either in frontend source or user-visible output.
2. Install the published SDK from the package registry; use [SDK reference](references/sdk-reference.md).
3. Call the SDK metadata method with a known stable reference. Confirm the returned metadata is sanitized.
4. Submit an action with only the required reference(s), scopes, structured input, and a fresh UUID idempotency key.
5. Treat `awaiting_approval` or `queued` as an intermediate state, not success.
6. Poll job status with bounded backoff until `succeeded`, `failed`, or `cancelled`.
7. Return the sanitized result to the calling application. Never return a credential value.
8. Use [workflows](references/workflows.md) for retries, long-running jobs, rotation, failure handling, and final verification.

## Minimal JavaScript example

```ts
import { AccxClient } from "@nexuss0781/accx";

const accx = new AccxClient({
  baseUrl: process.env.ACCX_BASE_URL!,
  workloadToken: process.env.ACCX_WORKLOAD_TOKEN!,
});

const metadata = await accx.getSecretMetadata("provider.production.account");
const result = await accx.submitAction({
  action: "provider.health_check",
  secretReferences: [metadata.reference],
  requiredScopes: ["job.execute"],
  input: {},
  idempotencyKey: crypto.randomUUID(),
});

console.log({ jobId: result.jobId, status: result.status });
```

The example logs only a job ID and status. Use the Python equivalent in [SDK reference](references/sdk-reference.md).

## Contract rules

- Use only stable references returned or configured by the application; do not construct references by guessing.
- Request only scopes required by the selected action.
- Use a UUID idempotency key for every new job. Reuse the same key only when intentionally retrying the same logical submission.
- Treat all SDK results as untrusted application data and validate them through the SDK contract.
- Do not assume that a successful HTTP submission means that the provider action completed.
- Do not send arbitrary destination URLs, provider headers, adapter names, or plaintext credentials in `input`.
- Keep retries bounded. Retry transport failures only; do not retry authorization, validation, conflict, or destructive failures blindly.
- Preserve user intent. Do not rotate, revoke, delete, purge, approve, publish, or otherwise create side effects unless that exact action was explicitly requested and the required workflow is available.

## Completion states

Use precise status labels in reports:

| State | Meaning |
|---|---|
| `configured` | Origin and protected workload-token wiring are present |
| `package-installed` | Published SDK installed successfully in a clean environment |
| `metadata-verified` | Sanitized metadata was retrieved and validated |
| `submitted` | ACCX accepted the job request |
| `completed` | Job reached a terminal success state |
| `failed` | ACCX or the provider reported a sanitized failure |
| `blocked` | Required scope, reference, adapter, approval, credential, or user intent is missing |

Do not call an integration complete when it only reaches `submitted` or when the action has no registered provider adapter.

## Detailed references

Read only the reference needed for the current consumer task:

- **[SDK reference](references/sdk-reference.md):** Published JavaScript, browser metadata, and Python client surfaces, methods, contracts, errors, retries, and clean-install checks.
- **[API reference](references/api-reference.md):** AI-consumer health, workload, job, provisioning, status, error, and response contracts.
- **[Workflows](references/workflows.md):** Common integration sequences, polling, idempotency, rotation, failures, and end-to-end verification.
- **[Consumer safety](references/consumer-safety.md):** Secret handling, scope selection, action boundaries, user intent, logging, and what the AI must never implement or expose.
