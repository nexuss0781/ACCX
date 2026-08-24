# ACCX and Nexuss Auth Integration Proposal

**Status:** Implementation baseline for the ACCX `main` branch  
**Author:** Manus AI  
**Scope:** Continue with Nexuss Auth, GitHub-like project authorization, password-UX replacement, and portable Nexuss user-token login.

## Executive decision

ACCX will become a relying application for Nexuss Auth. The production login path will be a cross-site OAuth flow that starts at Nexuss Auth, returns through a one-time server-side handoff, maps the verified Nexuss subject to a local ACCX user, and then issues the existing ACCX HttpOnly session cookie. ACCX will not trust an email address, browser query parameter, OAuth code, or handoff payload by itself.

The current public email/password login and registration forms will be replaced by a single **Continue with nexuss-auth** journey. Existing local password hashes will not be deleted during this release. They remain only as migration material for accounts that have not yet been linked, while new account creation and normal public authentication use Nexuss Auth. This avoids an irreversible lockout while the external identity mapping is introduced.

Nexuss Auth `nxa_...` API keys are user-owned bearer credentials. The Nexuss Auth server accepts them as a user identity for user-scoped API operations, and `/v1/me` returns the corresponding verified Nexuss user. ACCX may therefore accept an `nxa_...` key through an explicit server-side token-login command, validate it against the configured Nexuss Auth project, link the returned issuer/subject to the ACCX user, and issue an ACCX session. The key is never stored, logged, returned, placed in a URL, or treated as an ACCX workload token.

## Verified Nexuss Auth contract

The inspected Nexuss Auth implementation establishes the following production contract.

| Contract | Verified behavior | ACCX use |
|---|---|---|
| OAuth start | `GET /oauth/start/{provider}` requires `project_id`, an enabled provider, and an exact allowed `redirect_uri`. | ACCX creates a short-lived state and redirects the browser to this URL. |
| OAuth callback | Nexuss Auth consumes its own OAuth state, creates or finds the Nexuss user, and redirects to the exact ACCX redirect URI. | ACCX receives `handoff_token` and does not receive a provider access token. |
| Handoff exchange | `POST /v1/handoff/exchange` accepts `{ projectId, handoffToken }`, validates project and expiry, consumes the handoff once, and returns `{ user }`. | ACCX exchanges server-to-server and only trusts this response over TLS. |
| User shape | The returned user contains a stable Nexuss `id`, `email`, `name`, and optional `avatarUrl`. | ACCX stores issuer plus subject in an external identity table and copies display metadata only. |
| User API key | `/v1/tokens` creates user-owned `nxa_...` keys; bearer use resolves to that user identity; revocation invalidates the key. | ACCX validates a supplied key by calling Nexuss Auth `/v1/me` with the configured project context. |
| Management/admin credentials | Project and administrative routes use separate management or admin authorization. | ACCX never uses an admin credential as an end-user identity. |

The source evidence is in `nexuss-auth/packages/server/src/server.ts`, `packages/server/src/db.ts`, `packages/server/src/types.ts`, and `packages/server/src/server.test.ts`. In particular, the server’s `userIdentity` helper resolves a bearer API key to a user, while project management remains scoped to that user. This supports portability as a **validated Nexuss user identity**, not as a general-purpose ACCX service token.

## Production browser journey

The normal browser journey is intentionally cross-site and server-mediated:

```text
Browser             ACCX                  Nexuss Auth             OAuth provider
   |                  |                         |                       |
   | GET /auth/start  |                         |                       |
   |----------------->|                         |                       |
   |                  | create one-time state  |                       |
   |                  | redirect to start URL   |                       |
   |<-----------------|                         |                       |
   |--------------------------------------------------------------->   |
   |                  |                         | provider login       |
   |<---------------------------------------------------------------   |
   |                  |                         |                       |
   |------------------------------ GET /auth/nexuss/callback?state&handoff_token
   |                  |                         |                       |
   |                  | validate state         |                       |
   |                  | POST /v1/handoff/exchange -------------------->
   |                  |<---------------------- verified user           |
   |                  | resolve issuer+subject                         |
   |                  | create/link ACCX user and workspace            |
   |                  | issue ACCX HttpOnly session cookie              |
   |<----------------- 302 / with clean URL                             |
```

The ACCX state record is one-time, expires quickly, and is bound to the initiating browser by a cryptographic hash of a SameSite cookie value. The state includes the expected provider, exact redirect URI, and a post-login destination restricted to an internal ACCX path. Nexuss Auth’s production callback may return `nex_auth=success` and `handoff_token` without echoing ACCX’s internal state query, so ACCX correlates the response through the HttpOnly binding cookie and optionally verifies a returned state when present. The callback rejects a missing, expired, consumed, mismatched, or malformed binding/state. The callback never forwards `state`, `handoff_token`, OAuth `code`, or provider errors into the frontend route after processing.

The server-to-server handoff request uses the configured Nexuss Auth origin and sends JSON only. ACCX verifies an HTTPS origin in production, checks the HTTP response, validates the response object, and requires a non-empty stable subject. The one-time handoff token is held only in process memory for the duration of the request and is not written to logs.

## ACCX identity model

The existing `users` table is local and currently requires a password hash. The integration adds a separate identity-link table rather than putting provider-specific columns on `users`.

```sql
CREATE TABLE IF NOT EXISTS external_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  provider TEXT NOT NULL,
  email_at_link TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE (issuer, subject),
  UNIQUE (user_id, issuer, subject)
)
```

The issuer is normalized from the configured Nexuss Auth origin, with the trailing slash removed. The subject is the Nexuss Auth user `id`. The provider is metadata for audit and display, not an identity key. A verified handoff or `/v1/me` response can create a new local user with a generated non-usable migration password marker, or attach the external identity to an existing local account only under the linking rule below.

The local ACCX user ID remains the owner of workspaces, scopes, audit events, MFA records, passkeys, sessions, and all credential metadata. This preserves the existing control plane and avoids a destructive migration of user-owned data.

## Linking and takeover policy

A previously linked `(issuer, subject)` always resolves to its existing ACCX user. It is never re-assigned based on an email change.

A new Nexuss subject may be linked to an existing ACCX user only when the Nexuss Auth response explicitly indicates a verified email and the address matches the existing local account, or when an already authenticated ACCX user completes an explicit account-linking flow. An unverified or absent email never links by email. If the match is ambiguous, the flow fails safely and directs the user to an authenticated linking journey instead of creating an account takeover path.

A new subject with no eligible local match creates a local user and runs the same control-plane bootstrap used by registration. The user’s name and email are display/account metadata copied from the verified Nexuss response; ACCX does not use the display email as the identity key.

## Portable `nxa_...` identity journey

ACCX exposes an explicit command, `nexuss_token_login`, through the existing consolidated `/api/v1/auth` entrypoint. The request accepts a bearer token in the `Authorization` header, not in JSON or a URL. The handler requires the configured Nexuss project ID, sends the bearer to Nexuss Auth `/v1/me` with `project_id` and `x-nex-auth-project`, validates the returned user, resolves the external identity, and issues the normal ACCX session cookie.

This design preserves the distinction between three credential classes:

| Credential | Accepted by | Purpose | ACCX storage |
|---|---|---|---|
| Nexuss `nxa_...` API key | `nexuss_token_login` validation call | Portable Nexuss user authentication | Never stored; only its hash/metadata may appear in remote Nexuss systems. |
| ACCX `accx_session` cookie | ACCX browser/API session | Human session after OAuth or token login | ACCX stores only a hash, expiry, and revocation state. |
| ACCX workload token | Protected workload endpoints | Short-lived service identity execution | ACCX stores only a digest and keeps scope checks unchanged. |

An `nxa_...` key is not inserted into `workload_tokens`, is not accepted as an ACCX workload token, and does not receive service scopes. ACCX validates it against Nexuss Auth each time the explicit token-login command is used, so Nexuss revocation takes effect before a new ACCX session is issued. Existing ACCX sessions remain governed by ACCX session expiry and revocation.

## Password migration and cutover

The public UI no longer asks for a raw email/password pair. The `/register` route becomes an onboarding alias to the Nexuss Auth continuation flow, and `/login` presents the same continuation action. Local password handlers remain server-side only during migration so existing accounts are not silently destroyed; they are not called by the new UI.

A later release may remove local password verification after an account migration report confirms that all active accounts have a linked Nexuss identity and that recovery procedures are available. Until then, local password hashes are retained as legacy material and are not returned through any API. The external identity table is the authoritative authentication link for new and migrated users.

## Configuration contract

The following server variables are required for the Nexuss Auth flow. They must be configured in the deployment environment, never committed to the repository, and never exposed to browser bundles except for non-secret values that are explicitly needed to build the start URL.

| Variable | Required value | Exposure |
|---|---|---|
| `NEXUSS_AUTH_URL` | `https://nexuss-auth.vercel.app` in production, normalized without a trailing slash | Server only |
| `NEXUSS_AUTH_PROJECT_ID` | The active ACCX project ID registered in Nexuss Auth | Server and response-derived URL only |
| `NEXUSS_AUTH_REDIRECT_URI` | Exact public callback URI, for example `https://accx-taupe.vercel.app/auth/nexuss/callback` | Server and start URL |
| `ACCX_PUBLIC_ORIGIN` | Exact public ACCX origin used to restrict safe post-login destinations | Server only |

The Nexuss Auth project must be active, enable the selected provider, list the exact callback URI in allowed redirects, and list the ACCX origin in allowed origins. Provider secrets remain in Nexuss Auth. ACCX does not need Google or GitHub client secrets for this integration.

When these variables are absent, ACCX returns a stable `nexuss_auth_not_configured` response for start/token-login commands and keeps health and unrelated APIs operational. It does not fabricate a login URL or silently fall back to an unconfigured external identity.

## Routes and response behavior

The implementation stays within the existing consolidated serverless-function budget by adding commands to `/api/v1/auth` and using a Vercel rewrite for the public callback path.

| Route | Method | Behavior |
|---|---:|---|
| `/api/v1/auth?command=nexuss_start` | `GET` or `POST` | Creates browser-bound state and returns a provider-specific Nexuss Auth URL, or redirects when requested by the browser. |
| `/auth/nexuss/callback` | `GET` via rewrite | Validates state, exchanges the one-time handoff, creates/links local identity, sets ACCX session, and redirects to a clean internal path. |
| `/api/v1/auth?command=nexuss_token_login` | `POST` | Validates `Authorization: Bearer nxa_...` against Nexuss Auth `/v1/me`, creates/links identity, and sets ACCX session. |
| `/api/v1/auth?command=session` | `GET` | Existing local ACCX session behavior, unchanged. |
| `/api/v1/auth?command=logout` | `POST` | Existing local session revocation, unchanged. |

All failure responses use stable machine-readable error names without echoing provider payloads, bearer credentials, cookies, OAuth parameters, or upstream response bodies.

## Validation requirements

The release is complete only after the following checks pass:

1. Type checking, API checks, SDK checks, lint, unit tests, production build, and `git diff --check` pass.
2. Unit tests cover state creation, cookie binding, expiry, replay, redirect validation, upstream handoff failure, issuer/subject mapping, verified-email linking, new-user bootstrap, and token-login credential redaction.
3. The frontend contains no raw password input in the normal login or registration routes and both routes provide the same Nexuss continuation path.
4. Missing Nexuss configuration produces a controlled response while `/health` remains healthy.
5. After deployment, `https://accx-taupe.vercel.app/health` returns HTTP 200 with database status `ok`.
6. OAuth E2E is reported as complete only when an active Nexuss project, exact redirect allowlist, real provider session, successful one-time handoff exchange, ACCX session creation, and clean redirect have all been observed. Without those deployment values and an authorized user session, the release can be validated structurally but not honestly labeled live OAuth E2E.

## References

[1]: https://github.com/nexuss0781/nexuss-auth/blob/main/packages/server/src/server.ts "Nexuss Auth server routes and identity verification"

[2]: https://github.com/nexuss0781/nexuss-auth/blob/main/packages/server/src/db.ts "Nexuss Auth persistence and provider identity linking"

[3]: https://github.com/nexuss0781/nexuss-auth/blob/main/packages/server/src/server.test.ts "Nexuss Auth API-token behavior tests"

[4]: https://github.com/nexuss0781/nexuss-auth/blob/main/SKILL/INTEGRATION.md "Nexuss Auth application integration guide"
