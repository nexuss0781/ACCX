import { randomBytes, randomUUID } from "node:crypto";
import type { ParadConnection } from "parad";
import { type JobSubmission, type SanitizedJobResult, type Scope, sanitizedJobResultSchema } from "../../shared/contracts.js";
import { assertScopes, hashOpaqueToken, recordAudit } from "./vault.js";

const now = () => new Date().toISOString();
const actionPolicies: Record<string, readonly Scope[]> = {
  "provider.publish": ["job.execute", "provider.publish"],
  "provider.health_check": ["job.execute"],
};

export function isLeaseActive(input: { expiresAt: string; revokedAt: string | null; secretStatus: "active" | "pending" | "revoked" }, at = Date.now()): boolean {
  return input.secretStatus === "active" && !input.revokedAt && new Date(input.expiresAt).getTime() > at;
}

type Row = Record<string, unknown>;
function first<T extends Row>(result: { rows: Row[] }): T | null { return (result.rows[0] as T | undefined) ?? null; }

export function requiredScopesForAction(action: string): Scope[] {
  const policy = actionPolicies[action];
  if (!policy) throw new Error("UNSUPPORTED_ACTION");
  return [...policy];
}

export function createServiceIdentity(db: ParadConnection, input: { projectId: string; name: string; scopes: Scope[]; actorId: string }): { id: string; name: string } {
  const project = first<{ workspace_id: string }>(db.execute(`SELECT workspace_id FROM projects WHERE id = ?`, [input.projectId]));
  if (!project) throw new Error("NOT_FOUND");
  assertScopes(db, project.workspace_id, input.actorId, ["identity.manage"]);
  const id = randomUUID();
  db.execute(`INSERT INTO service_identities (id, project_id, name, scopes_json, status, created_at) VALUES (?, ?, ?, ?, 'active', ?)`, [id, input.projectId, input.name, JSON.stringify(input.scopes), now()]);
  recordAudit(db, { workspaceId: project.workspace_id, projectId: input.projectId, actorType: "human", actorId: input.actorId, eventType: "identity.created", metadata: { identityName: input.name, scopeCount: input.scopes.length } });
  return { id, name: input.name };
}

export function revokeServiceIdentity(db: ParadConnection, input: { serviceIdentityId: string; actorId: string }): void {
  const identity = first<{ id: string; project_id: string; workspace_id: string; name: string }>(db.execute(`SELECT si.id, si.project_id, p.workspace_id, si.name FROM service_identities si JOIN projects p ON p.id = si.project_id WHERE si.id = ?`, [input.serviceIdentityId]));
  if (!identity) throw new Error("NOT_FOUND");
  assertScopes(db, identity.workspace_id, input.actorId, ["identity.manage"]);
  db.execute(`UPDATE service_identities SET status = 'revoked', revoked_at = ? WHERE id = ?`, [now(), identity.id]);
  db.execute(`UPDATE workload_tokens SET revoked_at = ? WHERE service_identity_id = ? AND revoked_at IS NULL`, [now(), identity.id]);
  db.execute(`UPDATE secret_leases SET revoked_at = ? WHERE service_identity_id = ? AND revoked_at IS NULL`, [now(), identity.id]);
  recordAudit(db, { workspaceId: identity.workspace_id, projectId: identity.project_id, actorType: "human", actorId: input.actorId, eventType: "identity.revoked", metadata: { identityName: identity.name } });
}

/** This function is server-provisioning only. Callers must place the returned value directly in a server secret store. */
export function provisionWorkloadToken(db: ParadConnection, input: { serviceIdentityId: string; actorId: string; ttlSeconds: number }): { tokenId: string; token: string; expiresAt: string } {
  const identity = first<{ id: string; project_id: string; workspace_id: string; name: string; status: string }>(db.execute(`SELECT si.id, si.project_id, p.workspace_id, si.name, si.status FROM service_identities si JOIN projects p ON p.id = si.project_id WHERE si.id = ?`, [input.serviceIdentityId]));
  if (!identity) throw new Error("NOT_FOUND");
  assertScopes(db, identity.workspace_id, input.actorId, ["identity.manage"]);
  if (identity.status !== "active") throw new Error("FORBIDDEN");
  const token = randomBytes(32).toString("base64url");
  const tokenId = randomUUID();
  const expiresAt = new Date(Date.now() + Math.min(Math.max(input.ttlSeconds, 60), 900) * 1000).toISOString();
  db.execute(`INSERT INTO workload_tokens (id, service_identity_id, token_digest, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`, [tokenId, identity.id, hashOpaqueToken(token), expiresAt, now()]);
  recordAudit(db, { workspaceId: identity.workspace_id, projectId: identity.project_id, actorType: "human", actorId: input.actorId, eventType: "identity.token_provisioned", metadata: { identityName: identity.name, tokenId, expiresAt } });
  return { tokenId, token, expiresAt };
}

function authenticateWorkload(db: ParadConnection, token: string): { identityId: string; projectId: string; workspaceId: string; scopes: Scope[] } {
  const record = first<{ service_identity_id: string; expires_at: string; token_revoked_at: string | null; identity_status: string; project_id: string; workspace_id: string; scopes_json: string }>(db.execute(`SELECT wt.service_identity_id, wt.expires_at, wt.revoked_at AS token_revoked_at, si.status AS identity_status, si.project_id, p.workspace_id, si.scopes_json FROM workload_tokens wt JOIN service_identities si ON si.id = wt.service_identity_id JOIN projects p ON p.id = si.project_id WHERE wt.token_digest = ?`, [hashOpaqueToken(token)]));
  if (!record || record.token_revoked_at || record.identity_status !== "active" || new Date(record.expires_at).getTime() <= Date.now()) throw new Error("UNAUTHORIZED");
  return { identityId: record.service_identity_id, projectId: record.project_id, workspaceId: record.workspace_id, scopes: JSON.parse(record.scopes_json) as Scope[] };
}

export function submitJob(db: ParadConnection, workloadToken: string, job: JobSubmission): SanitizedJobResult {
  const workload = authenticateWorkload(db, workloadToken);
  const requiredScopes = requiredScopesForAction(job.action);
  if (!requiredScopes.every(scope => job.requiredScopes.includes(scope))) throw new Error("FORBIDDEN");
  if (!requiredScopes.every(scope => workload.scopes.includes(scope))) throw new Error("FORBIDDEN");
  const existing = first<{ id: string; status: SanitizedJobResult["status"]; completed_at: string | null }>(db.execute(`SELECT id, status, completed_at FROM orchestration_jobs WHERE idempotency_key = ?`, [job.idempotencyKey]));
  if (existing) return sanitizedJobResultSchema.parse({ jobId: existing.id, status: existing.status, message: "Existing idempotent job returned.", completedAt: existing.completed_at });

  const leaseExpiry = new Date(Date.now() + 60_000).toISOString();
  for (const reference of job.secretReferences) {
    const secret = first<{ id: string; active_version: number; version_id: string; status: string }>(db.execute(`SELECT s.id, s.active_version, sv.id AS version_id, s.status FROM secrets s JOIN environments e ON e.id = s.environment_id JOIN secret_versions sv ON sv.secret_id = s.id AND sv.version = s.active_version AND sv.revoked_at IS NULL WHERE e.project_id = ? AND s.reference = ?`, [workload.projectId, reference]));
    if (!secret || secret.status !== "active" || !secret.version_id) throw new Error("REFERENCE_UNAVAILABLE");
    db.execute(`INSERT INTO secret_leases (id, secret_version_id, service_identity_id, action, scopes_json, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [randomUUID(), secret.version_id, workload.identityId, job.action, JSON.stringify(requiredScopes), leaseExpiry, now()]);
  }
  const jobId = randomUUID();
  db.execute(`INSERT INTO orchestration_jobs (id, project_id, service_identity_id, action, secret_references_json, required_scopes_json, input_json, idempotency_key, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)`, [jobId, workload.projectId, workload.identityId, job.action, JSON.stringify(job.secretReferences), JSON.stringify(requiredScopes), JSON.stringify(job.input), job.idempotencyKey, now()]);
  recordAudit(db, { workspaceId: workload.workspaceId, projectId: workload.projectId, actorType: "service", actorId: workload.identityId, eventType: "job.submitted", metadata: { action: job.action, referenceCount: job.secretReferences.length } });
  return sanitizedJobResultSchema.parse({ jobId, status: "queued", message: "Trusted execution accepted; no credential material was returned.", completedAt: null });
}

export function getJobStatus(db: ParadConnection, workloadToken: string, jobId: string): SanitizedJobResult {
  const workload = authenticateWorkload(db, workloadToken);
  const job = first<{ id: string; status: SanitizedJobResult["status"]; completed_at: string | null }>(db.execute(`SELECT id, status, completed_at FROM orchestration_jobs WHERE id = ? AND project_id = ? AND service_identity_id = ?`, [jobId, workload.projectId, workload.identityId]));
  if (!job) throw new Error("NOT_FOUND");
  return sanitizedJobResultSchema.parse({ jobId: job.id, status: job.status, message: job.status === "queued" ? "Awaiting trusted execution." : "Sanitized job status.", completedAt: job.completed_at });
}
