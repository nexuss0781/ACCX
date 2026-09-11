import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, sendJson } from "../../_lib/http.js";
import { requireSession } from "../../_lib/auth.js";
import { requirePersonalPat } from "../../_lib/pats.js";
import { assertFreshMutation } from "../../_lib/integrity.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";
import { addEnvironment, createProject, deleteProject, listProjects, removeEnvironment, renameProject } from "../../_lib/projects.js";

const createSchema = z.object({ operation: z.literal("create"), name: z.string().trim().min(1).max(80), slug: z.string().trim().min(1).max(63).optional() });
const renameSchema = z.object({ operation: z.literal("rename"), projectId: z.string().uuid(), name: z.string().trim().min(1).max(80) });
const deleteSchema = z.object({ operation: z.literal("delete"), projectId: z.string().uuid() });
const listSchema = z.object({ operation: z.literal("list") });
const addEnvSchema = z.object({ operation: z.literal("add_environment"), projectId: z.string().uuid(), label: z.enum(["development", "staging", "production"]) });
const removeEnvSchema = z.object({ operation: z.literal("remove_environment"), projectId: z.string().uuid(), label: z.enum(["development", "staging", "production"]) });
const schema = z.discriminatedUnion("operation", [listSchema, createSchema, renameSchema, deleteSchema, addEnvSchema, removeEnvSchema]);

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const input = schema.parse(req.body);
    const result = await withControlPlaneDb(db => {
      const session = (() => { try { return requireSession(db, req).id; } catch { return null; } })();
      const actorId = session ?? requirePersonalPat(db, req, ["project.manage"]).userId;
      assertFreshMutation(db, req, { actorId, scope: `app.projects.${input.operation}`, limit: 40, windowMs: 60_000 });
      if (input.operation === "list") return { projects: listProjects(db, actorId) };
      if (input.operation === "create") return { project: createProject(db, { userId: actorId, name: input.name, slug: input.slug }) };
      if (input.operation === "rename") { renameProject(db, { userId: actorId, projectId: input.projectId, name: input.name }); return { renamed: true }; }
      if (input.operation === "delete") { deleteProject(db, { userId: actorId, projectId: input.projectId }); return { deleted: true }; }
      if (input.operation === "add_environment") { addEnvironment(db, { userId: actorId, projectId: input.projectId, label: input.label }); return { added: true }; }
      removeEnvironment(db, { userId: actorId, projectId: input.projectId, label: input.label });
      return { removed: true };
    }, { write: true });
    sendJson(res, input.operation === "create" ? 201 : 200, result);
  } catch (error) { apiError(res, error); }
}