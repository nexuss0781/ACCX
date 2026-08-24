---
name: accx-control-plane
description: Use ACCX as an AI-accessible secure credential vault and action control plane. Follow the complete journey to install and authenticate through CLI/API, accept any provider credential through protected input, record it to the authorized user account with encrypted activation, manage metadata and versions, retrieve by stable reference for trusted actions, use the JavaScript or Python SDK, and verify the result end to end.
---

# ACCX AI Operator Skill

## Purpose

Use ACCX as the secure place to register, organize, encrypt, rotate, and use credentials on behalf of an authorized user or trusted backend service. The AI may accept a credential through a protected input channel and record it in the user’s ACCX account. It must not echo the value, put it in a URL, write it to ordinary logs, or return it in a response. The value should move directly from protected input to in-memory encryption and then into ACCX’s encrypted storage path.

This skill is an **application guide**, not an internal ACCX codebase guide. Operate the existing ACCX API and published SDKs. Do not infer undocumented endpoints or modify platform internals to compensate for a missing API capability.

## Operating principles

1. **Accept authorized credentials normally.** A credential value is valid input when the user explicitly asks to save, update, rotate, or use it and the input arrives through a protected channel.
2. **Record to the correct account.** Authenticate the intended user or trusted service first. Confirm the target workspace, project, environment, provider, display name, and stable reference before writing.
3. **Encrypt before activation.** Send metadata separately, encrypt the value in trusted process memory with the ACCX vault key, and send only the encrypted payload to the activation endpoint.
4. **Do not echo secret material.** Never print, summarize, quote, attach, persist, or include the credential, token, cookie, passphrase, private key, encrypted payload, or session cookie in an AI answer or ordinary log.
5. **Use the least surprising action.** Save means create or update the requested record. Retrieve means use the reference inside a trusted action. Check means read metadata or run a health check. Delete, revoke, rotate, publish, or purge requires explicit user intent.
6. **Use exact references and scopes.** Read metadata first, use the exact reference returned by ACCX, and request only the scope required by the selected action.
7. **Complete the journey.** Do not call a credential “saved” until the metadata/version activation response succeeds and a metadata read confirms the expected active version.

## Quick workflow: save any credential to a user account

Use this path when the user says “save this credential,” “add this account,” “store this token,” or equivalent.

1. **Authenticate.** Use a session login for a user account or a workload token for a trusted backend. Use the CLI/API examples in [CLI and API workflows](references/workflows.md).
2. **Identify the destination.** Resolve the workspace, project, environment, provider, display name, and stable reference. Ask one focused question only if more than one target is possible.
3. **Create metadata.** Register the record with `create_secret_metadata`. Include the appropriate `fieldKind`, tags, and aliases where supplied.
4. **Collect the value securely.** Accept the value through protected stdin, a secure tool input, or an application secret field. Do not put it in a command argument, URL, source file, or chat transcript.
5. **Encrypt in memory.** Use the bundled encryption helper or an equivalent trusted server routine with `ACCX_VAULT_MASTER_KEY`. Do not send plaintext to ACCX.
6. **Activate the version.** Submit the encrypted payload with `activate_secret_version` through the trusted server-side activation path.
7. **Verify.** Read metadata through the authenticated SDK or API. Require `status: "active"`, the expected reference, and the expected active version.
8. **Clear temporary material.** Remove temporary payload files, unset shell variables, close stdin, clear buffers where possible, and never print the encrypted payload.
9. **Report only sanitized facts.** State provider, environment, reference, active version, and status—not the credential.

## Quick workflow: use a saved credential

1. Read metadata for the exact reference.
2. Confirm it is active and belongs to the requested environment.
3. Submit a supported action with `secretReferences`, required scopes, structured business input, and a new UUID idempotency key.
4. Treat `queued` or `awaiting_approval` as intermediate states.
5. Poll status until `succeeded`, `failed`, or `cancelled`.
6. Return the sanitized status and message. ACCX uses the credential internally; the AI does not need the value.

## Quick workflow selector

| User request | Workflow |
|---|---|
| “Install ACCX” | Install the published SDK or use the CLI/API recipes in [workflows](references/workflows.md) |
| “Log in to ACCX” | Use session login for a user account or protected workload-token configuration for a backend |
| “Save this password/token/key” | Authenticate, create metadata, encrypt, activate, verify |
| “Show my accounts” | List sanitized metadata; never list values |
| “Update tags/name/expiry” | Read the record, submit metadata update, verify |
| “Rotate this credential” | Create a new encrypted version, activate it, verify active version, clear cache |
| “Use this credential to do X” | Read metadata, submit the supported reference-based action, poll status |
| “Delete/revoke/purge” | Confirm exact record and explicit destructive intent, then use the authorized lifecycle flow |
| “Run provider publish” | Submit only if action and reference are explicit; stop at human approval when required |

## CLI/API authentication summary

ACCX does not require a special AI command language. Use ordinary shell HTTP clients such as `curl`, or the published SDK. Keep cookies and tokens in protected files or process memory.

```bash
export ACCX_ORIGIN='https://<your-accx-origin>'

# Register or log in using a cookie jar. Do not print the cookie jar.
curl -sS -c /tmp/accx-session.cookies -b /tmp/accx-session.cookies \
  -H 'Content-Type: application/json' \
  -d '{"command":"login","email":"<user-email>","password":"<user-password>"}' \
  "$ACCX_ORIGIN/api/v1/auth"

# Check the authenticated session without printing cookie contents.
curl -sS -b /tmp/accx-session.cookies \
  "$ACCX_ORIGIN/api/v1/auth?command=session"
```

Use the complete secure save, update, rotate, and use recipes in [workflows](references/workflows.md). Replace angle-bracket values locally; never paste real credentials into this skill or into an AI-visible command transcript.

## SDK quick start

### JavaScript

```bash
npm install @nexuss0781/accx
```

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
```

### Python

```bash
python -m pip install accx
```

```python
from accx import AccxClient, JobSubmission

client = AccxClient(
    base_url=os.environ["ACCX_BASE_URL"],
    workload_token=os.environ["ACCX_WORKLOAD_TOKEN"],
)
job = JobSubmission(
    action="provider.health_check",
    secret_references=["provider.production.account"],
    required_scopes=["job.execute"],
    input={},
    idempotency_key=str(uuid.uuid4()),
)
result = client.submit_action(job)
```

Read [SDK reference](references/sdk-reference.md) for all exports, metadata fields, retries, polling, errors, and Python/JavaScript method parity.

## Supported data model

Use these credential field kinds when the user identifies the type: `password`, `api_token`, `refresh_token`, `client_secret`, `recovery_code`, `cookie`, `ssh_key`, or `custom`. Any provider can use `custom` when no narrower kind is appropriate.

Stable references use lowercase letters, digits, dots, hyphens, and underscores. Use a descriptive pattern such as `github.production.account` or `aws.staging.deploy_key`; do not encode the credential value in the reference.

## Completion states

Use exact states in the final response:

| State | Meaning |
|---|---|
| `authenticated` | User session or workload token is valid |
| `metadata-created` | The account record exists but no active encrypted version is confirmed |
| `active` | Encrypted version activation succeeded and metadata confirms the record is active |
| `metadata-verified` | Sanitized metadata was read successfully |
| `submitted` | ACCX accepted an action |
| `completed` | The action reached `succeeded` |
| `blocked` | A required target, scope, approval, adapter, or explicit intent is missing |
| `failed` | ACCX returned a sanitized failure |

Never report a credential as saved when the state is only `metadata-created`.

## Detailed references

- **[Workflows](references/workflows.md):** CLI/API authentication, credential intake, encryption/activation, account management, rotation, reference-based use, polling, cleanup, and troubleshooting.
- **[API reference](references/api-reference.md):** Consumer and trusted activation endpoints, exact methods, headers, payloads, responses, scopes, and errors.
- **[SDK reference](references/sdk-reference.md):** Published JavaScript and Python packages, constructors, methods, contracts, retries, redaction, and examples.
- **[Consumer safety](references/consumer-safety.md):** Practical handling of credential input, user intent, secure temporary storage, reporting, and destructive actions.
