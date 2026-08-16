# ACCX Monitoring and Operational Controls

Monitor health endpoint availability, Paradox gateway authentication failures, database synchronization conflicts, session revocation volume, MFA verification failures, replay rejections, rate-limit rejections, job approval age, worker claim age, provider timeouts, failed health checks, and emergency revocations. Alerts must include workspace-safe identifiers, job identifiers, reference names, and event types only; they must never include ciphertext payloads, secrets, tokens, request bodies, or provider response bodies.

Review elevated `STALE_REQUEST`, `REPLAYED_REQUEST`, `RATE_LIMITED`, `FORBIDDEN`, worker timeout, and approval-rejection counts for abuse or configuration drift. Configure an on-call notification path outside the ACCX browser UI. Test alert routing with synthetic, metadata-only test events before enabling production escalation.
