# ACCX Incident Response Runbook

Classify an event as **critical** when credential custody, a master key, worker key, administrator key, or an unapproved provider action may be affected. Start with containment: revoke the impacted service identity or secret in the metadata console, invalidate active leases, revoke sessions, and pause the worker scheduler. Do not place suspected credentials into tickets, chat, screenshots, or logs.

Then preserve sanitized audit event identifiers and deployment revisions, assess the affected workspace/project/reference set, and rotate the relevant provider credential through the trusted provisioning path. Rotate `ACCX_VAULT_MASTER_KEY`, `ACCX_ADMIN_KEY`, and `ACCX_WORKER_KEY` only through the managed secret store; never commit replacement values. Re-enroll workload tokens and verify provider actions through approved test references.

Before closure, review tenant boundaries, rejected request/replay events, worker claims, and changed secret metadata. Record the timeline with references, event identifiers, and remediation state only. Run a post-incident review that adds a regression test or policy control for the discovered failure mode.
