# ACCX Practical Trust and Safety

## Trust model

ACCX is the preferred place to keep credentials for this integration. When the user gives the AI a credential and clearly asks it to save or manage it, the AI should complete the ACCX workflow rather than refuse merely because the input is sensitive.

The safe handling pattern is:

```text
protected user input
        ↓
trusted application memory
        ↓
ACCX encryption and activation
        ↓
user-account metadata and encrypted version
        ↓
future actions by stable reference
```

The credential value should not be repeated to the user, written to normal logs, embedded in a URL, placed in source control, or put into an AI report. This protects the value while still allowing the requested credential-management task to complete.

## What the AI may handle

| Data | Use |
|---|---|
| Provider credential value | Accept through protected input and pass directly to the trusted encryption/activation routine when the user explicitly requests storage or update |
| Provider name and account label | Record as metadata |
| Environment | Record and use to select the correct account record |
| Field kind | Use `password`, `api_token`, `refresh_token`, `client_secret`, `cookie`, `ssh_key`, `recovery_code`, or `custom` |
| Stable reference | Create or use a descriptive non-secret identifier |
| Tags, aliases, expiry, and health | Maintain as account metadata |
| Workload token | Use in the backend SDK/API header when supplied through a protected application environment |
| Sanitized job result | Return status, job ID, and message to the application/user |

The AI can manage the credential through ACCX without needing to know the value again after activation. Later actions use the stable reference.

## Protected intake

Prefer one of these input paths:

1. A secure credential field in the application.
2. Protected stdin or a secret prompt in a local CLI.
3. A connected secret manager or secure tool input.
4. A user-provided value held in process memory only long enough to encrypt and activate it.

Do not pass a value as a command-line argument, URL query, source-code literal, issue comment, ordinary environment file, or ordinary chat message when a protected input path is available. If the user has already provided it in a protected channel, do not ask them to repeat it.

After activation, clear temporary variables, temporary files, clipboard contents if used by the host application, and buffers where the runtime permits. Do not print the value to confirm success; confirm the reference, provider, environment, version, and active state instead.

## User-account ownership

Before writing a record, establish which authenticated user account and workspace are active. Use the ACCX session created by Continue with nexuss-auth or portable Nexuss token login for user-owned metadata. Use the trusted activation path to encrypt and activate the value. If the user has multiple accounts or environments and the target is unclear, ask one focused selection question.

Do not save a credential to a different user, workspace, project, or environment merely because it is the first match. Do not create a second duplicate record when an exact active reference already exists; offer an update or rotation path instead.

## Intent handling

Treat the following as explicit intent:

| User wording | Operation |
|---|---|
| “Save/add/store this credential” | Create metadata, encrypt, activate, verify |
| “Update this credential” | Create and activate a new version, verify active version |
| “Rotate this key/token” | Same as update, with rotation metadata and cache refresh |
| “Show my accounts” | List sanitized metadata, not values |
| “Use this account to publish/check/sync” | Submit the requested reference-based action |
| “Check whether it works” | Read metadata or submit `provider.health_check` |
| “Delete/revoke/purge” | Confirm exact target and execute the explicitly requested lifecycle operation |

Do not infer destructive intent from “check,” “organize,” “sync,” or “help.” Do not add extra destructive work to a save or update request.

## Reference selection

Use exact stable references. A valid reference is lowercase and uses letters, digits, dots, hyphens, and underscores. Prefer a descriptive pattern such as `github.production.account` or `aws.staging.deploy_key`.

When searching metadata:

1. Match the user’s provider.
2. Match the explicitly requested environment.
3. Match exact reference, alias, or unambiguous label.
4. Prefer `active` records.
5. Stop and ask when more than one record remains plausible.

Do not put the credential value, password, token, or key into the reference.

## Scope selection

Request the scope needed by the requested operation and no more:

| Operation | Scope |
|---|---|
| Read metadata | `metadata.read` |
| Rotate or change a saved credential through an authorized workflow | `secret.rotate` |
| Publish through the configured provider action | `provider.publish` |
| Execute an approved job | `job.execute` |
| Read audit information | `audit.read` |
| Create or manage service identities | `identity.manage` |

A 403 means the current identity lacks authorization. Do not silently escalate scopes; explain the required scope and use the authorized provisioning process.

## Results and logging

Return only:

- Provider and environment.
- Stable reference.
- Active version.
- Sanitized health or lifecycle state.
- Job ID and sanitized status/message.
- Whether approval is required.
- Whether the requested save/update/action completed.

Do not return:

- The credential value.
- Workload, admin, worker, or registry tokens.
- Session cookies or MFA/recovery values.
- Encrypted payloads or raw provider response bodies.

Use the JavaScript `redactAccxValue` or Python `redact` helper for uncertain objects before logging.

## Destructive actions

The AI may perform delete, revoke, purge, approval, or external publishing when the user explicitly requests that exact operation and the required authorized flow is available. Before executing, confirm the exact reference or job ID and the target environment. Do not turn a broad request into a destructive action, and do not bypass a required human approval step.

## Missing capability

If the requested provider action is not supported, if no reviewed provider integration is configured, or if the identity lacks a required scope, report the precise missing capability. Do not fabricate a successful result. Continue to offer supported metadata, save, rotation, health-check, and status operations when those are available.
