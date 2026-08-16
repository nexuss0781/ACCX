# ACCX Backend Upgrade TODO

- [x] Confirm the existing Vercel frontend structure and leave its visual design unchanged.
- [x] Define the backend service boundaries, zero-plaintext invariant, and shared SDK contract package.
- [x] Add the cloud backend scaffold compatible with Vercel serverless deployment.
- [x] Add multi-tenant workspace, project, environment, membership, and scope-based authorization models.
- [x] Add envelope-encrypted secret metadata and version records without frontend plaintext access.
- [x] Add version activation, rotation validation, short-lived leases, revocation, and audit logging.
- [x] Add service identities and server-only short-lived workload-token provisioning with revocation.
- [x] Add trusted orchestrator job submission, server-side action policies, and sanitized results.
- [x] Add a dedicated worker deployment contract for credential-consuming actions.
- [x] Create the shared TypeScript and Zod SDK contract layer.
- [x] Create the publishable npm accx SDK with no plaintext resolution API.
- [x] Create the publishable PyPI accx SDK with no plaintext resolution API.
- [x] Connect the existing frontend only to metadata and audit APIs, without redesigning it.
- [x] Remove the legacy password clipboard handler and local credential persistence during the backend metadata integration, while preserving the completed frontend design.
- [x] Add tests for encryption, RBAC, lease expiry/revocation, audit redaction, and SDK surface restrictions.
- [x] Verify Vercel compatibility, type checks, builds, package artifacts, and security source audit.
- [x] Commit and push the completed backend upgrade to a dedicated GitHub branch.
- [x] Keep the existing Vercel frontend and add all backend API routes within the same Vercel project and repository.
- [x] Design orchestration for Vercel serverless execution without relying on a separate website or local credential storage.
- [x] Review the Paradox-DB skill and configure the ACCX cloud data layer from its Vercel-compatible guidance.
- [x] Build a request-scoped Paradox-DB adapter that pulls, performs a transaction, pushes, and closes the encrypted database within each Vercel invocation.
- [x] Store the Paradox gateway API key, passphrase, and gateway configuration as server-only Vercel secrets and never in URLs, browser code, or repository files.
- [x] Generate and store the ACCX master key, administrator key, and Paradox passphrase in managed server-only configuration.
- [x] Add the issued PARADOX_API_KEY to managed server-only configuration without committing it.
- [x] Register or log in to the Paradox gateway service account and securely obtain its server-only API key.
- [x] Provision and verify the live encrypted ACCX Paradox control-plane database.
- [x] Add a server-only executor protocol that validates an active lease before decrypting any secret version for a provider action.
- [x] Add explicit safe failure behavior for unregistered provider actions and provider execution timeouts.
- [x] Build and install the npm SDK package artifact in an isolated verification directory.
- [x] Build and install the PyPI SDK package artifact in an isolated verification directory.
- [x] Add frontend API client, cloud metadata state, and server session bootstrap without altering existing page layout or styling.
- [x] Replace account password reveal, copy, local account persistence, local credential notes, and local login/register paths with metadata-only cloud workflows.
- [x] Add focused frontend security regression tests and a final source audit confirming no ACCX credential values reach browser storage or clipboard APIs.
- [x] Add concurrency and conflict controls for Vercel requests so Paradox-DB local-wins synchronization cannot silently overwrite independent vault updates.
- [x] Define a deployable worker contract with authenticated execution, replay protection, and no browser/plaintext boundary violations.
- [x] Add worker configuration documentation, deployment variables, and security-focused contract tests.
- [x] Run a release-readiness audit across Vercel routes, worker dispatch, session cookies, and secret boundaries.
- [x] Add end-to-end smoke coverage for authenticated metadata bootstrap, worker dispatch authorization, and sanitized responses.
- [x] Prepare final SDK/package release documentation and deployment handoff without publishing or exposing secrets.
- [ ] Save a final verified project checkpoint for release readiness.

## Original proposal completion program

- [x] Add session refresh-token rotation, device/session inventory, session revocation controls, and bounded session lifetimes.
- [x] Add step-up authorization for destructive vault operations and privileged action approval.
- [x] Add WebAuthn/passkey enrollment and TOTP MFA enrollment, verification, recovery, and audit paths.
- [x] Add typed secret-field templates, tags, aliases, health state, last-rotated tracking, soft deletion, retention, and controlled purge.
- [x] Add encrypted import/export workflows with explicit confirmation, re-authentication, audit events, and server-side policy checks.
- [x] Add reusable server-side rate limits, request timestamps/nonces, token binding, and replay protection for sensitive paths.
- [x] Add automated cross-tenant, cross-project, cross-environment, token-replay, rotation, and authorization abuse-case tests.
- [x] Add approval-gated orchestration jobs, provider execution timeouts, egress policy contracts, and isolated runtime handoff documentation.
- [x] Add provider adapter templates and safe health-check orchestration without retaining secret-bearing results.
- [ ] Add npm SDK retry, explicit errors, rotation-aware metadata refresh, and restricted browser entry-point documentation.
- [ ] Add Python SDK async support, explicit errors, safe logging/redaction helpers, and optional framework integration boundaries.
- [ ] Add metadata-only UI workflows for rotation, revocation, access history, tags, typed account templates, import/export, and emergency controls.
- [ ] Add CI dependency audit, secret scanning, code scanning, artifact checks, and automated release-verification workflows.
- [ ] Add threat model, operational runbooks, backup/recovery procedures, monitoring controls, and incident-response exercise documentation.
- [ ] Prepare versioned npm/PyPI publication workflows and perform release publication only after the user authorizes external publishing.

> Historical continuation items added 2026-08-16 after the frontend migration and dedicated worker contract were completed.

- [x] Add a dedicated worker deployment contract for credential-consuming actions.
- [x] Define a deployable worker contract with authenticated execution, replay protection, and no browser/plaintext boundary violations.
- [x] Add worker configuration documentation, deployment variables, and security-focused contract tests.
