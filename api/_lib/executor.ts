import type { ParadConnection } from "parad";
import { decryptSecret, type EncryptedSecretPayload } from "./security.js";
import { isLeaseActive } from "./orchestrator.js";
import { recordAudit } from "./vault.js";

const now = () => new Date().toISOString();
type Row = Record<string, unknown>;
function first<T extends Row>(result: { rows: Row[] }): T | null { return (result.rows[0] as T | undefined) ?? null; }

export type TrustedProviderAdapter = (input: { provider: string; action: string; secret: string; input: Record<string, unknown> }) => Promise<{ message: string }>;
const adapters = new Map<string, TrustedProviderAdapter>();

/** Server-module-only registration. Never call this from browser code. */
export function registerTrustedProviderAdapter(action: string, adapter: TrustedProviderAdapter): void {
  adapters.set(action, adapter);
}

function complete(db: ParadConnection, jobId: string, status: "succeeded" | "failed", message: string): void {
  db.execute(`UPDATE orchestration_jobs SET status = ?, result_json = ?, completed_at = ? WHERE id = ?`, [status, JSON.stringify({ message }), now(), jobId]);
}

export async function executeQueuedJob(db: ParadConnection, jobId: string): Promise<{ jobId: string; status: "succeeded" | "failed"; message: string }> {
  const job = first<{ id: string; action: string; status: string; service_identity_id: string; project_id: string; workspace_id: string; input_json: string }>(db.execute(`SELECT j.id, j.action, j.status, j.service_identity_id, j.project_id, p.workspace_id, j.input_json FROM orchestration_jobs j JOIN projects p ON p.id = j.project_id WHERE j.id = ?`, [jobId]));
  if (!job) throw new Error("NOT_FOUND");
  if (job.status === "succeeded" || job.status === "failed") return { jobId, status: job.status, message: "Job already reached a terminal state." };

  const adapter = adapters.get(job.action);
  if (!adapter) {
    const message = "No trusted provider adapter is registered for this action.";
    complete(db, job.id, "failed", message);
    recordAudit(db, { workspaceId: job.workspace_id, projectId: job.project_id, actorType: "system", actorId: "executor", eventType: "job.failed", metadata: { action: job.action, reason: "adapter_unregistered" } });
    return { jobId, status: "failed", message };
  }

  const lease = first<{ lease_id: string; expires_at: string; revoked_at: string | null; secret_status: "active" | "pending" | "revoked"; provider: string; encrypted_data_key_json: string; encrypted_secret_json: string; algorithm: "AES-256-GCM" }>(db.execute(`SELECT l.id AS lease_id, l.expires_at, l.revoked_at, s.status AS secret_status, s.provider, sv.encrypted_data_key_json, sv.encrypted_secret_json, sv.algorithm FROM secret_leases l JOIN secret_versions sv ON sv.id = l.secret_version_id JOIN secrets s ON s.id = sv.secret_id WHERE l.service_identity_id = ? AND l.action = ? ORDER BY l.created_at ASC LIMIT 1`, [job.service_identity_id, job.action]));
  if (!lease || !isLeaseActive({ expiresAt: lease.expires_at, revokedAt: lease.revoked_at, secretStatus: lease.secret_status })) {
    const message = "The required credential lease is not active.";
    complete(db, job.id, "failed", message);
    recordAudit(db, { workspaceId: job.workspace_id, projectId: job.project_id, actorType: "system", actorId: "executor", eventType: "job.failed", metadata: { action: job.action, reason: "lease_inactive" } });
    return { jobId, status: "failed", message };
  }

  db.execute(`UPDATE orchestration_jobs SET status = 'running' WHERE id = ?`, [job.id]);
  let secret = "";
  try {
    secret = decryptSecret({ encryptedDataKey: JSON.parse(lease.encrypted_data_key_json), secretCiphertext: JSON.parse(lease.encrypted_secret_json), algorithm: lease.algorithm } as EncryptedSecretPayload);
    const result = await adapter({ provider: lease.provider, action: job.action, secret, input: JSON.parse(job.input_json) as Record<string, unknown> });
    complete(db, job.id, "succeeded", result.message.slice(0, 500));
    recordAudit(db, { workspaceId: job.workspace_id, projectId: job.project_id, actorType: "system", actorId: "executor", eventType: "job.completed", metadata: { action: job.action, leaseUsed: true } });
    return { jobId, status: "succeeded", message: result.message.slice(0, 500) };
  } catch {
    const message = "Trusted provider execution failed.";
    complete(db, job.id, "failed", message);
    recordAudit(db, { workspaceId: job.workspace_id, projectId: job.project_id, actorType: "system", actorId: "executor", eventType: "job.failed", metadata: { action: job.action, reason: "provider_error" } });
    return { jobId, status: "failed", message };
  } finally {
    secret = "";
  }
}
