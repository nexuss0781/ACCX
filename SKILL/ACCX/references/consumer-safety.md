# ACCX Consumer Safety

## Use the safe architecture

ACCX is designed so an AI-backed application can perform authorized secret-backed work without receiving the underlying credential value. The application holds a protected workload token; ACCX holds and uses the encrypted credential; the AI supplies an intended action and stable reference; the result is sanitized.

This is not a reason to refuse normal ACCX work. Use the SDK and workload API as intended. The safety boundary is about **where values appear**, not about blocking the operation itself.

## Credential handling

| Data | May the AI use it? | Correct handling |
|---|---|---|
| ACCX origin | Yes | Use as ordinary configuration; use HTTPS in production |
| Workload token | Backend only | Send as `X-ACCX-Workload-Token`; never reveal or log |
| Secret reference | Yes | Pass the exact stable reference to metadata/jobs |
| Secret metadata | Yes, if sanitized | Use for selection and state decisions |
| Underlying credential value | No | Leave inside ACCX’s trusted execution boundary |
| Admin key | Provisioning service only | Do not use for ordinary AI tasks |
| Worker key | Worker runtime only | Do not use from SDK consumer code |
| Human password/MFA/recovery code | Human session only | Do not request or reimplement in the AI client |

Do not ask the user to paste a plaintext credential when a reference already exists. Do not place any token or value in a prompt, URL, source file, frontend bundle, issue, telemetry event, or report.

## User intent

Use the user’s explicit target, action, reference, and environment. Ask one focused clarification when any of these is genuinely ambiguous. Do not silently choose a production reference when multiple metadata records match.

Use a read or health-check action when the user asks to inspect status. Use a publishing or mutation action only when the user clearly requests that side effect. Do not infer permission to publish, revoke, delete, purge, rotate, or approve from a general request to “check,” “sync,” or “help.”

Once the user has explicitly authorized a safe action and the reference is unambiguous, perform the SDK/API workflow instead of adding unnecessary refusal language. Report the sanitized status and any approval requirement.

## Scope selection

Request the minimum scope required by the action:

| Need | Scope |
|---|---|
| Read metadata | `metadata.read` |
| Rotate a secret through an authorized workflow | `secret.rotate` |
| Publish through a reviewed provider integration | `provider.publish` |
| Execute an approved job | `job.execute` |
| Read audit data through an authorized surface | `audit.read` |
| Manage service identities | `identity.manage` |

Do not add scopes automatically after a 403. Explain which scope is required and let the authorized owner decide.

## Reference and metadata discipline

Use exact references returned by ACCX. Do not derive them from display names, tags, aliases, or natural-language guesses. If a user says “the production GitHub key” and more than one active reference matches, ask the user to select one.

Before submitting a job, check that metadata is active, belongs to the requested environment, is not deleted or revoked, and does not report a blocking health or rotation state. Treat `attention`, `failed`, `rotation_required`, expiry, and revocation as useful state information; do not hide it.

## Job safety

Use a new UUID idempotency key for every new logical action. Reuse a key only to recover from uncertainty about the same submission. Do not submit duplicate jobs to compensate for a timeout.

Treat `awaiting_approval` and `queued` as intermediate states. Do not say “done” until the job is `succeeded`. If the status is `failed` or `cancelled`, return the sanitized message and stop unless the user requests a new attempt.

Do not put raw credentials, raw provider headers, arbitrary URLs, adapter implementations, or unrelated sensitive data into the job’s `input` object. Include only the minimum structured business input needed by the reviewed action.

## Logging and reporting

It is safe to report:

- Package name and version.
- Action name.
- Stable job ID.
- Sanitized status and message.
- Non-sensitive metadata such as environment, active version, or health state.
- Whether an approval is required.
- Whether disposable test cleanup succeeded.

Do not report:

- Workload tokens or admin/worker keys.
- Credential values.
- Session cookies or MFA/recovery values.
- Encrypted payloads or vault bundles.
- Raw provider responses.
- Full request headers or environment files.

Use `redactAccxValue` or Python `redact` before logging uncertain objects.

## What the AI should not implement

Do not implement a plaintext secret resolver, password getter, clipboard copier, arbitrary provider URL, admin-key workaround, worker-key shortcut, browser local-storage vault, or direct database query. If the requested business capability needs one of these, explain that it is outside the consumer contract and identify the reviewed ACCX integration that must be added by the service owner.

Do not modify ACCX’s internal UI, database, serverless runtime, deployment configuration, or authentication implementation as part of an ordinary SDK integration. Keep consumer integration changes in the application that calls ACCX.

## Failure transparency

Use precise labels:

| Label | Meaning |
|---|---|
| `configured` | Origin and protected workload token are available |
| `metadata-verified` | Sanitized metadata was retrieved |
| `submitted` | ACCX accepted the job |
| `completed` | Job reached `succeeded` |
| `blocked` | A required reference, scope, adapter, approval, or explicit intent is missing |
| `failed` | ACCX or the reviewed provider action returned a sanitized failure |

Never convert `submitted`, `queued`, `awaiting_approval`, or `blocked` into `completed`.
