# ACCX Threat Model

ACCX protects cloud credential custody and credential-consuming actions. The primary asset is the credential value, which is encrypted at rest and is never a browser API response, SDK response, audit field, URL segment, persistent browser value, or provider-job result.

| Threat | Control | Verification |
|---|---|---|
| Browser compromise or accidental UI disclosure | Metadata-only types, session cookies, no browser credential persistence, no reveal/copy path | Frontend security tests and source audit |
| Cross-tenant access | Workspace membership checks, project-scoped secret lookup, workload identity scope checks | Authorization-abuse tests |
| Stolen workload token | Hashed short-lived tokens, revocation, project binding, constrained scopes | Orchestration tests |
| Request replay or CSRF | Same-origin check, nonce consumption, timestamp window, rate buckets | Mutation-integrity tests |
| Privileged destructive operation | Bounded step-up grants, TOTP/passkey flows, server-side scope checks, audit events | Identity and lifecycle tests |
| Provider misuse | Immutable action policies, human approval state, leases, trusted adapters, egress allowlist and timeout policy | Orchestration controls tests |
| Worker duplication | Atomic queued-to-running claims and worker IDs | Worker contract tests |
| Database conflict | Strict versioned Paradox upload and transaction boundaries | Live control-plane tests |

The residual risk is a compromise of the Vercel control-plane runtime or managed master-key environment. Operational owners must protect production secrets, rotate them on suspected compromise, restrict deployment permissions, and follow the incident runbook.
