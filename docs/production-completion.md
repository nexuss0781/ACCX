# ACCX Production Completion Criteria

This document converts the original ACCX proposal into concrete completion criteria. ACCX remains **cloud-first and zero-plaintext in browser-facing workflows**: managed credential values must not appear in frontend bundles, browser storage, URLs, ordinary API responses, logs, analytics, or SDK result objects.

| Completion area | Required implementation boundary | Required verification |
|---|---|---|
| Identity | Bounded server sessions, session revocation, step-up authorization, WebAuthn/passkey, TOTP, recovery, and audit events. | Unit tests for enrollment, verification, expiration, recovery, and destructive-operation denial without a current step-up grant. |
| Vault lifecycle | Typed fields, aliases, tags, health and rotation history, soft delete/retention/purge, encrypted export, and policy-checked import. | Metadata-only response tests, retention/purge tests, and audit-redaction tests. |
| API abuse protection | Tenant-bound authorization, request timestamps/nonces, idempotency, rate controls, replay rejection, and safe errors. | Cross-tenant, cross-project, cross-environment, stale-request, nonce replay, and rate-limit tests. |
| Orchestration | Approval gates, leased secret use, bounded provider execution, egress-policy contracts, and isolated-runtime handoff. | Job state-machine tests, approval denial tests, lease expiry tests, and provider result-redaction tests. |
| SDKs | Reference-only clients, typed errors, safe retry/backoff, rotation-aware metadata refresh, safe logging, and documented browser/server boundaries. | JavaScript and Python package build, smoke, API-contract, and forbidden-surface tests. |
| Metadata UI | Cloud metadata workflows for templates, tags, rotation, revocation, history, import/export, and emergency controls. | Frontend source audit plus route/API interaction tests that exclude secret values. |
| Operations | CI scanning, dependency audit, artifact inspection, threat model, monitoring/runbooks, backup recovery, and incident exercise. | CI configuration review, documented rehearsal, and release checklist sign-off. |

## Release gate

No package publication or production promotion occurs until every checklist item in `todo.md` is complete, all tests pass, the live Paradox control-plane check is performed in a protected environment, and the user explicitly authorizes external publication.
