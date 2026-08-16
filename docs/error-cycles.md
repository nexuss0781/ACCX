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
