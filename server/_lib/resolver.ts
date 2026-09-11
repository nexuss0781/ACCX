import type { ParadConnection } from "parad";
import type { EnvironmentLabel } from "../../shared/contracts.js";
import { decryptSecret, type EncryptedSecretPayload } from "./security.js";
import { ensurePersonalWorkspace, recordAudit } from "./vault.js";

type Row = Record<string, unknown>;
function first<T extends Row>(result: { rows: Row[] }): T | null { return (result.rows[0] as T | undefined) ?? null; }

export function resolveEnvironmentVariables(db: ParadConnection, input: { userId: string; patId: string; project: string; environment: EnvironmentLabel; keys?: string[] }): { key: string; value: string }[] {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.project);
  const { workspaceId } = ensurePersonalWorkspace(db, input.userId);
  const project = first<{ id: string; slug: string }>(db.execute(isUuid ? `SELECT id, slug FROM projects WHERE id = ? AND workspace_id = ?` : `SELECT id, slug FROM projects WHERE slug = ? AND workspace_id = ?`, [input.project, workspaceId]));
  if (!project) throw new Error("NOT_FOUND");
  const environment = first<{ id: string; project_id: string }>(db.execute(`SELECT id, project_id FROM environments WHERE project_id = ? AND label = ?`, [project.id, input.environment]));
  if (!environment) throw new Error("NOT_FOUND");
  const placeholders = input.keys ? input.keys.map(() => "?").join(", ") : null;
  const params: unknown[] = [environment.id];
  if (input.keys) params.push(...input.keys);
  const result = db.execute(`SELECT key, encrypted_data_key_json, encrypted_secret_json, algorithm FROM environment_variables WHERE environment_id = ?${placeholders ? ` AND key IN (${placeholders})` : ""} ORDER BY key`, params);
  const variables = (result.rows as Row[]).map(row => {
    const payload: EncryptedSecretPayload = { encryptedDataKey: JSON.parse(String(row.encrypted_data_key_json)), secretCiphertext: JSON.parse(String(row.encrypted_secret_json)), algorithm: String(row.algorithm) as EncryptedSecretPayload["algorithm"] };
    return { key: String(row.key), value: decryptSecret(payload) };
  });
  recordAudit(db, { workspaceId, projectId: project.id, environmentId: environment.id, actorType: "service", actorId: input.patId, eventType: "environment.variables_resolved", metadata: { count: variables.length } });
  return variables;
}