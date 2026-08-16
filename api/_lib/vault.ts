import { createHash, randomUUID } from "node:crypto";
import type { ParadConnection } from "parad";
import type { EnvironmentLabel, Scope, SecretMetadata } from "../../shared/contracts.js";
import { redactAuditMetadata, type EncryptedSecretPayload } from "./security.js";

const now = () => new Date().toISOString();
const allScopes: Scope[] = ["metadata.read", "secret.rotate", "provider.publish", "job.execute", "audit.read", "identity.manage"];

type Row = Record<string, unknown>;

function first<T extends Row>(result: { rows: Row[] }): T | null { return (result.rows[0] as T | undefined) ?? null; }
function rows<T extends Row>(result: { rows: Row[] }): T[] { return result.rows as T[]; }
function asString(value: unknown): string { return String(value ?? ""); }

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function recordAudit(db: ParadConnection, input: { workspaceId: string; projectId?: string | null; environmentId?: string | null; actorType: "human" | "service" | "system"; actorId: string; eventType: string; reference?: string | null; secretVersion?: number | null; metadata?: Record<string, unknown> }): void {
  db.execute(
    `INSERT INTO audit_events (id, workspace_id, project_id, environment_id, actor_type, actor_id, event_type, reference, secret_version, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), input.workspaceId, input.projectId ?? null, input.environmentId ?? null, input.actorType, input.actorId, input.eventType, input.reference ?? null, input.secretVersion ?? null, JSON.stringify(redactAuditMetadata(input.metadata ?? {})), now()],
  );
}

export function bootstrapControlPlane(db: ParadConnection, operatorId: string): { workspaceId: string; projectId: string } {
  const existing = first<{ id: string }>(db.execute(`SELECT id FROM workspaces ORDER BY created_at LIMIT 1`));
  if (existing) {
    const project = first<{ id: string }>(db.execute(`SELECT id FROM projects WHERE workspace_id = ? ORDER BY created_at LIMIT 1`, [existing.id]));
    if (!project) throw new Error("ACCX control-plane workspace has no project.");
    return { workspaceId: existing.id, projectId: project.id };
  }
  const workspaceId = randomUUID();
  const projectId = randomUUID();
  db.execute(`INSERT INTO workspaces (id, name, slug, created_at) VALUES (?, ?, ?, ?)`, [workspaceId, "ACCX Control Plane", "accx", now()]);
  db.execute(`INSERT INTO projects (id, workspace_id, name, slug, created_at) VALUES (?, ?, ?, ?, ?)`, [projectId, workspaceId, "Primary", "primary", now()]);
  for (const label of ["development", "staging", "production"] satisfies EnvironmentLabel[]) {
    db.execute(`INSERT INTO environments (id, project_id, label, created_at) VALUES (?, ?, ?, ?)`, [randomUUID(), projectId, label, now()]);
  }
  db.execute(`INSERT INTO workspace_members (id, workspace_id, subject_id, subject_type, scopes_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`, [randomUUID(), workspaceId, operatorId, "human", JSON.stringify(allScopes), now()]);
  recordAudit(db, { workspaceId, projectId, actorType: "system", actorId: "bootstrap", eventType: "workspace.bootstrapped", metadata: { environments: 3 } });
  return { workspaceId, projectId };
}

export function assertScopes(db: ParadConnection, workspaceId: string, subjectId: string, needed: Scope[]): void {
  const membership = first<{ scopes_json: string }>(db.execute(`SELECT scopes_json FROM workspace_members WHERE workspace_id = ? AND subject_id = ?`, [workspaceId, subjectId]));
  const granted = membership ? JSON.parse(membership.scopes_json) as Scope[] : [];
  if (!needed.every(scope => granted.includes(scope))) throw new Error("FORBIDDEN");
}

export function listSecretMetadata(db: ParadConnection, workspaceId: string): SecretMetadata[] {
  const result = db.execute(
    `SELECT s.id, s.provider, s.display_name, s.reference, e.label AS environment, s.status, s.active_version, s.rotation_state, s.expires_at, s.last_used_at FROM secrets s JOIN environments e ON e.id = s.environment_id JOIN projects p ON p.id = e.project_id WHERE p.workspace_id = ? ORDER BY s.updated_at DESC`,
    [workspaceId],
  );
  return rows<Row>(result).map(row => ({
    id: asString(row.id), provider: asString(row.provider), displayName: asString(row.display_name), reference: asString(row.reference), environment: asString(row.environment) as EnvironmentLabel,
    status: asString(row.status) as "pending" | "active" | "revoked", activeVersion: Number(row.active_version), rotationState: asString(row.rotation_state) as "stable" | "rotation_required" | "rotating",
    expiresAt: row.expires_at ? asString(row.expires_at) : null, lastUsedAt: row.last_used_at ? asString(row.last_used_at) : null,
  }));
}

export function registerSecretMetadata(db: ParadConnection, input: { environmentId: string; provider: string; displayName: string; reference: string; actorId: string }): SecretMetadata {
  const environment = first<{ workspace_id: string; project_id: string; label: EnvironmentLabel }>(db.execute(`SELECT p.workspace_id, e.project_id, e.label FROM environments e JOIN projects p ON p.id = e.project_id WHERE e.id = ?`, [input.environmentId]));
  if (!environment) throw new Error("NOT_FOUND");
  assertScopes(db, environment.workspace_id, input.actorId, ["secret.rotate"]);
  const id = randomUUID();
  db.execute(`INSERT INTO secrets (id, environment_id, provider, display_name, reference, status, active_version, rotation_state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', 0, 'stable', ?, ?)`, [id, input.environmentId, input.provider, input.displayName, input.reference, now(), now()]);
  recordAudit(db, { workspaceId: environment.workspace_id, projectId: environment.project_id, environmentId: input.environmentId, actorType: "human", actorId: input.actorId, eventType: "secret.metadata_created", reference: input.reference, metadata: { provider: input.provider } });
  return { id, provider: input.provider, displayName: input.displayName, reference: input.reference, environment: environment.label, status: "pending", activeVersion: 0, rotationState: "stable", expiresAt: null, lastUsedAt: null };
}

/** Only trusted server provisioning code may call this. It accepts ciphertext, never plaintext. */
export function activateEncryptedVersion(db: ParadConnection, input: { secretId: string; encryptedPayload: EncryptedSecretPayload; actorId: string }): { version: number } {
  const secret = first<{ id: string; reference: string; active_version: number; environment_id: string; workspace_id: string; project_id: string }>(db.execute(`SELECT s.id, s.reference, s.active_version, s.environment_id, p.workspace_id, e.project_id FROM secrets s JOIN environments e ON e.id = s.environment_id JOIN projects p ON p.id = e.project_id WHERE s.id = ?`, [input.secretId]));
  if (!secret) throw new Error("NOT_FOUND");
  assertScopes(db, secret.workspace_id, input.actorId, ["secret.rotate"]);
  const version = Number(secret.active_version) + 1;
  db.execute(`UPDATE secret_versions SET revoked_at = ? WHERE secret_id = ? AND revoked_at IS NULL`, [now(), secret.id]);
  db.execute(`INSERT INTO secret_versions (id, secret_id, version, encrypted_data_key_json, encrypted_secret_json, algorithm, created_at, activated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [randomUUID(), secret.id, version, JSON.stringify(input.encryptedPayload.encryptedDataKey), JSON.stringify(input.encryptedPayload.secretCiphertext), input.encryptedPayload.algorithm, now(), now()]);
  db.execute(`UPDATE secrets SET status = 'active', active_version = ?, rotation_state = 'stable', updated_at = ? WHERE id = ?`, [version, now(), secret.id]);
  db.execute(`UPDATE secret_leases SET revoked_at = ? WHERE secret_version_id IN (SELECT id FROM secret_versions WHERE secret_id = ? AND version <> ?) AND revoked_at IS NULL`, [now(), secret.id, version]);
  recordAudit(db, { workspaceId: secret.workspace_id, projectId: secret.project_id, environmentId: secret.environment_id, actorType: "human", actorId: input.actorId, eventType: "secret.version_activated", reference: secret.reference, secretVersion: version, metadata: { rotation: true } });
  return { version };
}

export function revokeSecret(db: ParadConnection, input: { secretId: string; actorId: string; reason: string }): void {
  const secret = first<{ id: string; reference: string; environment_id: string; workspace_id: string; project_id: string }>(db.execute(`SELECT s.id, s.reference, s.environment_id, p.workspace_id, e.project_id FROM secrets s JOIN environments e ON e.id = s.environment_id JOIN projects p ON p.id = e.project_id WHERE s.id = ?`, [input.secretId]));
  if (!secret) throw new Error("NOT_FOUND");
  assertScopes(db, secret.workspace_id, input.actorId, ["secret.rotate"]);
  db.execute(`UPDATE secrets SET status = 'revoked', rotation_state = 'rotation_required', updated_at = ? WHERE id = ?`, [now(), secret.id]);
  db.execute(`UPDATE secret_versions SET revoked_at = ? WHERE secret_id = ? AND revoked_at IS NULL`, [now(), secret.id]);
  db.execute(`UPDATE secret_leases SET revoked_at = ? WHERE secret_version_id IN (SELECT id FROM secret_versions WHERE secret_id = ?) AND revoked_at IS NULL`, [now(), secret.id]);
  recordAudit(db, { workspaceId: secret.workspace_id, projectId: secret.project_id, environmentId: secret.environment_id, actorType: "human", actorId: input.actorId, eventType: "secret.revoked", reference: secret.reference, metadata: { reason: input.reason } });
}

export function listAuditEvents(db: ParadConnection, input: { workspaceId: string; actorId: string; limit: number }): { id: string; eventType: string; actorType: string; actorId: string; reference: string | null; secretVersion: number | null; metadata: Record<string, string | number | boolean | null>; createdAt: string }[] {
  assertScopes(db, input.workspaceId, input.actorId, ["audit.read"]);
  const result = db.execute(`SELECT id, event_type, actor_type, actor_id, reference, secret_version, metadata_json, created_at FROM audit_events WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?`, [input.workspaceId, input.limit]);
  return rows<Row>(result).map(row => ({ id: asString(row.id), eventType: asString(row.event_type), actorType: asString(row.actor_type), actorId: asString(row.actor_id), reference: row.reference ? asString(row.reference) : null, secretVersion: row.secret_version === null ? null : Number(row.secret_version), metadata: JSON.parse(asString(row.metadata_json)) as Record<string, string | number | boolean | null>, createdAt: asString(row.created_at) }));
}
