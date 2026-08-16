# ACCX Provider Execution Isolation Contract

ACCX provider actions are permitted only through a reviewed server-side adapter registered for an immutable action name. Workload clients submit references and job input; they never submit a destination URL, raw provider headers, an adapter implementation, or a plaintext credential value.

The executor validates the action policy, approval status, lease activity, and worker claim before decrypting a secret in server memory. Each adapter receives an `AbortSignal`, an immutable timeout budget, and an egress class. A provider adapter must honor the abort signal, use HTTPS, avoid redirects, restrict its destination to an allowlist compiled into server configuration, and return a sanitized status message only.

`createHttpProviderAdapter` is the baseline adapter template. It rejects non-HTTPS destinations and origins not present in the server-side allowlist. It does not read arbitrary URLs from a job payload and it does not serialize response bodies into job results, audits, or logs.

## Runtime boundary

The current one-shot worker dispatches jobs to the Vercel control plane, where lease validation and decryption occur. For provider actions that require browser automation, untrusted third-party binaries, custom operating-system packages, or a filesystem sandbox, deploy a separate isolated worker runtime. That runtime must receive only the dedicated worker key and a job identifier; it must not receive the vault master key, Paradox credentials, user session cookies, workload tokens, or broad database access.

Use a fresh process or container per tenant-bound job, restrict outbound network destinations to provider allowlists, use an ephemeral writable filesystem, delete temporary data on completion, and never inject raw credentials as process environment variables when a direct in-memory request header or process channel can be used. The worker returns only a sanitized result status to ACCX.
