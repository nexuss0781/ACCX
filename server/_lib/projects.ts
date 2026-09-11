import { randomUUID } from "node:crypto";
import type { ParadConnection } from "parad";
import type { EnvironmentLabel } from "../../shared/contracts.js";
import { ensurePersonalWorkspace, recordAudit } from "./vault.js";

const now = () => new Date().toISOString();
const PROJECT_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?$/;
const ENV_LABELS: readonly EnvironmentLabel[] = ["development", "staging", "production"];

type Row = Record<string, unknown>;
function first<T extends Row>(result: { rows: Row[] }): T | null { return (result.rows[0] as T | undefined) ?? null; }
function rows<T extends Row>(result: { rows: Row[] }): T[] { return result.rows as T[]; }

export type ProjectRecord = { id: string; name: string; slug: string; createdAt: string; environments: EnvironmentLabel[] };

function personalWorkspace(db: ParadConnection, userId: string): { workspaceId: string; projectId: string } {
  return ensurePersonalWorkspace(db, userId);
}

function workspaceProject(db: ParadConnection, workspaceId: string, projectId: string): { id: string; name: string; slug: string; created_at: string } | null {
  return first<{ id: string; name: string; slug: string; created_at: string }>(db.execute(`SELECT id, name, slug, created_at FROM projects WHERE id = ? AND workspace_id = ?`, [projectId, workspaceId]));
}

function projectEnvironments(db: ParadConnection, projectId: string): EnvironmentLabel[] {
  return rows<{ label: EnvironmentLabel }>(db.execute(`SELECT label FROM environments WHERE project_id = ? ORDER BY CASE label WHEN 'development' THEN 0 WHEN 'staging' THEN 1 ELSE 2 END`, [projectId])).map(row => row.label);
}

export function listProjects(db: ParadConnection, userId: string): ProjectRecord[] {
  const { workspaceId } = personalWorkspace(db, userId);
  const result = db.execute(`SELECT id, name, slug, created_at FROM projects WHERE workspace_id = ? ORDER BY created_at`, [workspaceId]);
  return rows<{ id: string; name: string; slug: string; created_at: string }>(result).map(row => ({ id: row.id, name: row.name, slug: row.slug, createdAt: row.created_at, environments: projectEnvironments(db, row.id) }));
}

export function createProject(db: ParadConnection, input: { userId: string; name: string; slug?: string }): ProjectRecord {
  const { workspaceId } = personalWorkspace(db, input.userId);
  const slug = input.slug?.trim().toLowerCase() || normalizeSlug(input.name);
  if (!PROJECT_SLUG.test(slug)) throw new Error("REQUEST_INVALID");
  if (first(db.execute(`SELECT id FROM projects WHERE workspace_id = ? AND slug = ?`, [workspaceId, slug]))) throw new Error("CONFLICT");
  const id = randomUUID();
  db.execute(`INSERT INTO projects (id, workspace_id, name, slug, created_at) VALUES (?, ?, ?, ?, ?)`, [id, workspaceId, input.name.trim(), slug, now()]);
  for (const label of ENV_LABELS) {
    db.execute(`INSERT INTO environments (id, project_id, label, created_at) VALUES (?, ?, ?, ?)`, [randomUUID(), id, label, now()]);
  }
  recordAudit(db, { workspaceId, projectId: id, actorType: "human", actorId: input.userId, eventType: "project.created", metadata: { name: input.name.trim(), slug } });
  return { id, name: input.name.trim(), slug, createdAt: now(), environments: [...ENV_LABELS] };
}

export function renameProject(db: ParadConnection, input: { userId: string; projectId: string; name: string }): void {
  const { workspaceId } = personalWorkspace(db, input.userId);
  const project = workspaceProject(db, workspaceId, input.projectId);
  if (!project) throw new Error("NOT_FOUND");
  db.execute(`UPDATE projects SET name = ? WHERE id = ? AND workspace_id = ?`, [input.name.trim(), input.projectId, workspaceId]);
  recordAudit(db, { workspaceId, projectId: input.projectId, actorType: "human", actorId: input.userId, eventType: "project.renamed", metadata: { name: input.name.trim() } });
}

export function deleteProject(db: ParadConnection, input: { userId: string; projectId: string }): void {
  const { workspaceId } = personalWorkspace(db, input.userId);
  const project = workspaceProject(db, workspaceId, input.projectId);
  if (!project) throw new Error("NOT_FOUND");
  const secrets = first(db.execute(`SELECT s.id FROM secrets s JOIN environments e ON e.id = s.environment_id WHERE e.project_id = ? LIMIT 1`, [input.projectId]));
  const variables = first(db.execute(`SELECT id FROM environment_variables WHERE environment_id IN (SELECT id FROM environments WHERE project_id = ?) LIMIT 1`, [input.projectId]));
  if (secrets || variables) throw new Error("CONFLICT");
  db.execute(`DELETE FROM environments WHERE project_id = ?`, [input.projectId]);
  db.execute(`DELETE FROM projects WHERE id = ? AND workspace_id = ?`, [input.projectId, workspaceId]);
  recordAudit(db, { workspaceId, projectId: input.projectId, actorType: "human", actorId: input.userId, eventType: "project.deleted", metadata: { name: project.name, slug: project.slug } });
}

export function addEnvironment(db: ParadConnection, input: { userId: string; projectId: string; label: EnvironmentLabel }): void {
  const { workspaceId } = personalWorkspace(db, input.userId);
  if (!workspaceProject(db, workspaceId, input.projectId)) throw new Error("NOT_FOUND");
  if (first(db.execute(`SELECT id FROM environments WHERE project_id = ? AND label = ?`, [input.projectId, input.label]))) throw new Error("CONFLICT");
  if (!(ENV_LABELS as string[]).includes(input.label)) throw new Error("REQUEST_INVALID");
  db.execute(`INSERT INTO environments (id, project_id, label, created_at) VALUES (?, ?, ?, ?)`, [randomUUID(), input.projectId, input.label, now()]);
  recordAudit(db, { workspaceId, projectId: input.projectId, actorType: "human", actorId: input.userId, eventType: "environment.added", metadata: { label: input.label } });
}

export function removeEnvironment(db: ParadConnection, input: { userId: string; projectId: string; label: EnvironmentLabel }): void {
  const { workspaceId } = personalWorkspace(db, input.userId);
  if (!workspaceProject(db, workspaceId, input.projectId)) throw new Error("NOT_FOUND");
  const environment = first<{ id: string }>(db.execute(`SELECT id FROM environments WHERE project_id = ? AND label = ?`, [input.projectId, input.label]));
  if (!environment) throw new Error("NOT_FOUND");
  if (first(db.execute(`SELECT id FROM secrets WHERE environment_id = ? LIMIT 1`, [environment.id]))) throw new Error("CONFLICT");
  db.execute(`DELETE FROM environment_variables WHERE environment_id = ?`, [environment.id]);
  db.execute(`DELETE FROM environments WHERE id = ?`, [environment.id]);
  recordAudit(db, { workspaceId, projectId: input.projectId, actorType: "human", actorId: input.userId, eventType: "environment.removed", metadata: { label: input.label } });
}

function normalizeSlug(name: string): string {
  const slug = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "";
}