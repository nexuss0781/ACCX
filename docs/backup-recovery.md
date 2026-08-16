# ACCX Backup and Recovery Runbook

ACCX uses Paradox-DB encrypted synchronization as its control-plane persistence layer. Backups and encrypted exports are **ciphertext-only**. They must be stored in an access-controlled location separate from application deployments and labeled with workspace, export date, and control-plane version; they must not be opened or transformed in browser tools that could upload their contents.

To recover, first validate the target control-plane environment and master-key continuity. Use a step-up-authorized encrypted import into the intended workspace only after comparing reference conflicts and retention state. Recovery does not bypass tenant scopes, job approvals, revoked leases, or audit requirements. Verify metadata count, active-version count, aliases, and audit event continuity after import; do not attempt to inspect credential values as a recovery check.

Exercise a non-production ciphertext import at least quarterly. Document the exercise with counts and result status only, then purge temporary restored data according to the retention policy.
