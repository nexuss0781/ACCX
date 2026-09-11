import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, sendJson } from "../../_lib/http.js";
import { requireSession, requireStepUp } from "../../_lib/auth.js";
import { requirePersonalPat } from "../../_lib/pats.js";
import { assertFreshMutation } from "../../_lib/integrity.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";
import { deleteEnvironmentVariable, listEnvironmentVariables, revealEnvironmentVariable, setEnvironmentVariable } from "../../_lib/envvars.js";

const environmentId = z.string().uuid();
const key = z.string().trim().min(1).max(128);
const setSchema = z.object({ operation: z.literal("set"), environmentId, key, value: z.string().min(1).max(8192) });
const deleteSchema = z.object({ operation: z.literal("delete"), environmentId, key });
const listSchema = z.object({ operation: z.literal("list") });
const revealSchema = z.object({ operation: z.literal("reveal"), environmentId, key });
const schema = z.discriminatedUnion("operation", [listSchema, setSchema, deleteSchema, revealSchema]);

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const input = schema.parse(req.body);
    const result = await withControlPlaneDb(db => {
      if (input.operation === "reveal") {
        const user = requireStepUp(db, req);
        assertFreshMutation(db, req, { actorId: user.id, scope: "app.environment.reveal", limit: 30, windowMs: 60_000 });
        const variable = revealEnvironmentVariable(db, { userId: user.id, actorType: "human", actorId: user.id, environmentId: input.environmentId, key: input.key });
        return { variable };
      }
      const session = (() => { try { return requireSession(db, req).id; } catch { return null; } })();
      let actor: { userId: string; actorId: string; actorType: "human" | "service" };
      if (session) {
        actor = { userId: session, actorId: session, actorType: "human" };
      } else {
        const pat = requirePersonalPat(db, req, input.operation === "list" ? ["env.read"] : ["env.write"]);
        actor = { userId: pat.userId, actorId: pat.tokenId, actorType: "service" };
      }
      assertFreshMutation(db, req, { actorId: actor.userId, scope: `app.environment.${input.operation}`, limit: 120, windowMs: 60_000 });
      if (input.operation === "list") return { variables: listEnvironmentVariables(db, actor.userId) };
      if (input.operation === "set") return { variable: setEnvironmentVariable(db, { ...actor, environmentId: input.environmentId, key: input.key, value: input.value }) };
      deleteEnvironmentVariable(db, { ...actor, environmentId: input.environmentId, key: input.key });
      return { deleted: true };
    }, { write: input.operation !== "list" });
    sendJson(res, 200, result);
  } catch (error) { apiError(res, error); }
}