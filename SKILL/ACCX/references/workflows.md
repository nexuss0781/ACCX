# ACCX Consumer Workflows

## 1. First connection

Use this workflow when an AI-backed application is connecting to an existing ACCX deployment for the first time.

### Inputs

- ACCX HTTPS origin.
- A protected workload token already provisioned for the backend service.
- A known ACCX secret reference.
- The intended action and its required scope.

### Steps

1. Store the origin as ordinary application configuration and the workload token in the backend secret store.
2. Install `@nexuss0781/accx` for JavaScript/TypeScript or `accx` for Python.
3. Construct the client in backend code only.
4. Call `GET /health` or the equivalent health check.
5. Call the SDK metadata method with the known reference.
6. Confirm that the metadata is present, active, and suitable for the intended action.
7. Submit only the reference, action, required scopes, structured input, and a UUID idempotency key.
8. Poll status until a terminal state.

### Success gate

The application has completed a sanitized metadata read and a permitted job journey. The AI has not received or stored the credential value.

## 2. Metadata-first action selection

Use metadata before submitting a credential-backed action. Check:

| Field | Decision |
|---|---|
| `reference` | Use exactly as returned; do not guess or rewrite |
| `status` | Use only when `active` |
| `environment` | Match the user’s explicit target environment |
| `healthStatus` | Do not hide an `attention` or `failed` state |
| `rotationState` | Do not start work with a known required rotation without user direction |
| `expiresAt` | Stop or warn when expired or too close to expiry |
| `deletedAt` | Do not use deleted metadata |
| `tags` and `aliases` | Use for selection only when the user’s intent is unambiguous |

If multiple references match, ask the user to choose rather than silently selecting a production credential.

## 3. Submit and poll

### Submit

Use `submitAction` or `submit_action` with a new UUID idempotency key for a new logical action. The initial status means:

| Status | Meaning | Next action |
|---|---|---|
| `queued` | Accepted for trusted execution | Poll status |
| `awaiting_approval` | Human approval is required | Tell the user; do not approve automatically |
| `running` | Trusted execution has started | Poll status |
| `succeeded` | Completed successfully | Return sanitized result |
| `failed` | Execution failed | Report sanitized message; decide whether retry is appropriate |
| `cancelled` | Cancelled before completion | Stop unless user requests a new action |

### Polling

Poll with bounded exponential backoff, for example 1, 2, 4, 8, and 16 seconds, with a total deadline appropriate to the action. Do not poll indefinitely. If the deadline expires, report that status is still pending and preserve the job ID for later retrieval.

Do not submit a second job while the first is pending unless the user explicitly wants parallel work and the action is safe to duplicate. For a network timeout after submission, reuse the same idempotency key to determine whether the original job was accepted.

## 4. Low-risk health check

Use `provider.health_check` for a safe in-control-plane check of an active reference.

```ts
const result = await accx.submitAction({
  action: "provider.health_check",
  secretReferences: [reference],
  requiredScopes: ["job.execute"],
  input: {},
  idempotencyKey: crypto.randomUUID(),
});
```

The action requires `job.execute`, enters `queued`, and returns a sanitized result. It does not authorize the AI to retrieve the credential or call an arbitrary external provider.

## 5. High-impact action

Use `provider.publish` only when the user has explicitly requested the exact publishing action, the reference and target environment are unambiguous, and the configured integration supports the action.

1. Confirm the action requires `job.execute` and `provider.publish`.
2. Submit once with a UUID idempotency key.
3. Treat `awaiting_approval` as a hard stop for autonomous execution.
4. Explain what approval is required without revealing the reference’s value.
5. Do not simulate or bypass human approval.
6. Continue only after the existing authorized approval flow has changed the job to `queued`.
7. Poll for a sanitized terminal result.

If the action has no registered provider adapter, report `blocked: provider integration unavailable`. Do not put a destination URL or provider implementation into `input`.

## 6. Rotation or expiry response

When metadata reports `rotation_required`, an imminent `expiresAt`, `failed` health, or `revoked` status:

1. Stop new credential-backed actions using that reference unless the user explicitly directs otherwise.
2. Explain the metadata state without exposing the value.
3. Ask for or use the documented rotation workflow only when explicitly authorized.
4. Clear the JavaScript metadata cache after a known update.
5. Re-read metadata and verify the new active version before submitting a new job.
6. Do not reuse an old reference if the application has issued a new one.

## 7. Error response

Handle errors by category:

- `401`: stop and use the protected token provisioning path; do not ask the user for a plaintext credential.
- `403`: explain that scope, ownership, approval, or authorization is missing; do not escalate scopes automatically.
- `409`: determine whether the request was replayed or conflicted; reuse the idempotency key only for the same logical action.
- `429`: apply bounded backoff for safe reads or idempotent submissions.
- `500`: retry only a safe idempotent operation; preserve the job ID if one exists.
- `503`: stop credential-backed work and report ACCX availability/configuration failure.
- `failed` job: return the sanitized message and do not expose provider response data.

## 8. End-to-end consumer verification

Use a disposable non-production reference and a temporary workload identity when performing a live verification.

1. Check service health.
2. Read metadata through the SDK.
3. Submit `provider.health_check`.
4. Confirm status `queued`.
5. Allow the configured trusted worker process to execute the job; the normal AI client does not need worker credentials.
6. Read status through the SDK.
7. Confirm `succeeded` and a sanitized message.
8. Revoke the temporary identity and test fixture through the authorized provisioning process.
9. Record only package version, job ID, status, and cleanup result.

The verification is `completed` only when the terminal status and cleanup are both confirmed.

## 9. Change boundary

If the user asks to change ACCX’s screens, database, server routes, deployment, human MFA flow, provider adapters, or internal runtime, stop using this consumer skill as an implementation guide. Treat that as a separate ACCX maintenance task. Do not modify internal ACCX code merely to make an AI integration request work.
