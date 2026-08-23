# ACCX Error Cycles

## 2026-08-16 — Vercel API type-check imports

- Symptom: NodeNext rejected extensionless internal TypeScript imports in Vercel API sources.
- Resolution: used `.js` import specifiers for compiled ESM module references.
- Verification: `npm run check:api` passed.

## 2026-08-16 — Paradox gateway domain and API path

- Symptom: the legacy gateway domain returned HTTP 404 for registration and authentication.
- Resolution: used the Paradox active-domain resolver and normalized the resolved gateway domain to its required `/v1` API base.
- Verification: the managed gateway authentication route returned the expected unauthorized response without a key, and the managed API key authenticated successfully.

## 2026-08-16 — Initial encrypted database synchronization

- Symptom: first control-plane startup failed when the newly provisioned Paradox database had no uploaded snapshot.
- Resolution: treated the gateway’s “No file data available” response as the expected empty first-write state; all other download failures remain errors.
- Verification: the opt-in live Paradox test provisioned, uploaded, rehydrated, and read the ACCX control-plane workspace successfully.

## 2026-08-16 — Concurrent cloud writes

- Symptom: the installed Paradox client’s default local-wins conflict handling could overwrite an independent Vercel request.
- Resolution: ACCX uses an explicit base-version read and a strict upload. A remote version conflict is returned as HTTP 409 for the caller to retry instead of silently overwriting state.
- Verification: backend type checks and the security suite passed after the adapter change.

## 2026-08-16 — Worker claim test fixture

- Symptom: the existing unregistered-provider executor fixture modeled a queued job after the executor gained an atomic `queued` to `running` claim step, so it correctly appeared unavailable to the simulated worker.
- Resolution: updated the fixture to represent the post-claim job state and added dedicated contract tests for worker-only configuration, authenticated dispatch, and replay-safe claiming.
- Verification: `npm test`, `npm run check:api`, `npm run check:sdk`, and `npm run build` passed.

## 2026-08-16 — Hosted gateway probe cold start

- Symptom: the two managed Paradox gateway probes intermittently exceeded Vitest’s default five-second timeout even though a bounded direct probe returned HTTP 401 and the gateway was reachable.
- Resolution: assigned a 15-second timeout only to those two external integration tests; response and authentication assertions were unchanged.
- Verification: the full suite passed with 16 tests and one opt-in live test skipped.

## 2026-08-16 — PyPI release metadata validation

- Symptom: the first PyPI artifact build rejected an unsupported `project.repository` field, and a follow-up section placement temporarily treated classifiers as URLs.
- Resolution: moved the repository link into `[project.urls]` and kept classifiers in the project table; the license now uses the SPDX string form.
- Verification: the `accx-0.1.0-py3-none-any.whl` artifact built successfully and the npm dry-run reported only the ten intended SDK files.

## 2026-08-16 — Hosted gateway test isolation

- Symptom: an external Paradox gateway probe intermittently exceeded its test timeout despite the deterministic ACCX identity and API checks succeeding.
- Resolution: kept managed-secret configuration coverage in the normal suite and moved the variable-latency gateway probes behind the explicit `pnpm test:network` command.
- Verification: the identity-security suite and both API and SDK type checks passed without a network dependency.

## 2026-08-16 — Approval audit regression assertion

- Symptom: the new orchestration-control test expected a literal approval audit event even though the implementation intentionally selects between approval and ordinary submission events in one conditional expression.
- Resolution: adjusted the assertion to verify the conditional expression rather than weakening the server-side approval policy.
- Verification: orchestration-control tests and API type checks passed.

## 2026-08-16 — SDK callback and redaction compilation

- Symptom: the new JavaScript SDK initially had an incomplete redaction tuple expression and passed Zod parser methods directly into array mapping, which conflicted with callback index arguments.
- Resolution: used an explicit key-value tuple map and item-only parser callbacks.
- Verification: JavaScript SDK type checks, package build, Python wheel build, and SDK resilience tests passed.
