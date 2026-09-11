import { createHash, randomUUID } from "node:crypto";
import type { ParadConnection } from "parad";
import type { EnvironmentLabel } from "../../shared/contracts.js";
import { decryptSecret, encryptSecret, type EncryptedSecretPayload } from "./security.js";
import { ensurePersonalWorkspace, recordAudit } from "./vault.js";

const now = () => new Date().toISOString();
const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

type Row = Record<string, unknown>;
function first<T extends Row>(result: { rows: Row[] }): T | null { return (result.rows[0] as T | undefined) ?? null; }

export function listEnvironmentVariables(db: ParadConnection, userId: string): { key: string; projectId: string; projectName: string; environmentId: string; environment: EnvironmentLabel; updatedAt: string | null; createdBy: string }[] {
  const { workspaceId } = ensurePersonalWorkspace(db, userId);
  const result = db.execute(`SELECT ev.key, e.project_id, p.name AS project_name, e.id AS environment_id, e.label AS environment, ev.updated_at, ev.created_by_subject FROM environment_variables ev JOIN environments e ON e.id = ev.environment_id JOIN projects p ON p.id = e.project_id WHERE p.workspace_id = ? ORDER BY p.name, e.label, ev.key`, [workspaceId]);
  return (result.rows as Row[]).map(row => ({
    key: String(row.key), projectId: String(row.project_id), projectName: String(row.project_name), environmentId: String(row.environment_id), environment: String(row.environment) as EnvironmentLabel,
    updatedAt: row.updated_at === null ? null : String(row.updated_at), createdBy: String(row.created_by_subject),
  }));
}

export function setEnvironmentVariable(db: ParadConnection, input: { userId: string; actorType: "human" | "service"; actorId: string; environmentId: string; key: string; value: string }): { key: string; updated: boolean } {
  const key = input.key.trim();
  if (!ENV_KEY.test(key)) throw new Error("REQUEST_INVALID");
  const { workspaceId } = ensurePersonalWorkspace(db, input.userId);
  const environment = first<{ id: string; label: EnvironmentLabel; project_id: string }>(db.execute(`SELECT e.id, e.label, e.project_id FROM environments e JOIN projects p ON p.id = e.project_id WHERE e.id = ? AND p.workspace_id = ?`, [input.environmentId, workspaceId]));
  if (!environment) throw new Error("NOT_FOUND");
  const payload = encryptSecret(input.value);
  const valueHash = createHash("sha256").update(input.value).digest("hex");
  const existing = first<{ id: string }>(db.execute(`SELECT id FROM environment_variables WHERE environment_id = ? AND key = ?`, [input.environmentId, key]));
  if (existing) {
    db.execute(`UPDATE environment_variables SET value_hash = ?, encrypted_data_key_json = ?, encrypted_secret_json = ?, algorithm = ?, updated_at = ?, created_by_type = ?, created_by_subject = ? WHERE id = ?`, [valueHash, JSON.stringify(payload.encryptedDataKey), JSON.stringify(payload.secretCiphertext), payload.algorithm, now(), input.actorType, input.actorId, existing.id]);
    recordAudit(db, { workspaceId, projectId: environment.project_id, environmentId: environment.id, actorType: input.actorType, actorId: input.actorId, eventType: "environment.variable_updated", metadata: { variable: key } });
    return { key, updated: true };
  }
  db.execute(`INSERT INTO environment_variables (id, environment_id, key, value_hash, encrypted_data_key_json, encrypted_secret_json, algorithm, created_by_type, created_by_subject, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [randomUUID(), input.environmentId, key, valueHash, JSON.stringify(payload.encryptedDataKey), JSON.stringify(payload.secretCiphertext), payload.algorithm, input.actorType, input.actorId, now(), now()]);
  recordAudit(db, { workspaceId, projectId: environment.project_id, environmentId: environment.id, actorType: input.actorType, actorId: input.actorId, eventType: "environment.variable_created", metadata: { variable: key } });
  return { key, updated: false };
}

export function deleteEnvironmentVariable(db: ParadConnection, input: { userId: string; actorType: "human" | "service"; actorId: string; environmentId: string; key: string }): void {
  const { workspaceId } = ensurePersonalWorkspace(db, input.userId);
  const environment = first<{ id: string; project_id: string }>(db.execute(`SELECT e.id, e.project_id FROM environments e JOIN projects p ON p.id = e.project_id WHERE e.id = ? AND p.workspace_id = ?`, [input.environmentId, workspaceId]));
  if (!environment) throw new Error("NOT_FOUND");
  const row = first<{ id: string }>(db.execute(`SELECT id FROM environment_variables WHERE environment_id = ? AND key = ?`, [input.environmentId, input.key]));
  if (!row) throw new Error("NOT_FOUND");
  db.execute(`DELETE FROM environment_variables WHERE id = ?`, [row.id]);
  recordAudit(db, { workspaceId, projectId: environment.project_id, environmentId: environment.id, actorType: input.actorType, actorId: input.actorId, eventType: "environment.variable_deleted", metadata: { variable: input.key } });
}

export function revealEnvironmentVariable(db: ParadConnection, input: { userId: string; actorType: "human" | "service"; actorId: string; environmentId: string; key: string }): { key: string; value: string } {
  const { workspaceId } = ensurePersonalWorkspace(db, input.userId);
  const environment = first<{ id: string; label: EnvironmentLabel; project_id: string }>(db.execute(`SELECT e.id, e.label, e.project_id FROM environments e JOIN projects p ON p.id = e.project_id WHERE e.id = ? AND p.workspace_id = ?`, [input.environmentId, workspaceId]));
  if (!environment) throw new Error("NOT_FOUND");
  const row = first<{ encrypted_data_key_json: string; encrypted_secret_json: string; algorithm: string }>(db.execute(`SELECT encrypted_data_key_json, encrypted_secret_json, algorithm FROM environment_variables WHERE environment_id = ? AND key = ?`, [input.environmentId, input.key]));
  if (!row) throw new Error("NOT_FOUND");
  const payload: EncryptedSecretPayload = {
    encryptedDataKey: JSON.parse(row.encrypted_data_key_json),
    secretCiphertext: JSON.parse(row.encrypted_secret_json),
    algorithm: row.algorithm as EncryptedSecretPayload["algorithm"],
  };
  const value = decryptSecret(payload);
  recordAudit(db, { workspaceId, projectId: environment.project_id, environmentId: environment.id, actorType: input.actorType, actorId: input.actorId, eventType: "environment.variable_revealed", metadata: { variable: input.key } });
  return { key: input.key, value };
}

export const environmentVariableKeyRegex = ENV_KEY;