import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../../_lib/http.js";
import { apiError, sendJson } from "../../../_lib/http.js";
import { requireStepUp } from "../../../_lib/auth.js";
import { assertFreshMutation } from "../../../_lib/integrity.js";
import { withControlPlaneDb } from "../../../_lib/paradox.js";
import { importEncryptedWorkspace } from "../../../_lib/vault.js";

const schema = z.object({ workspaceId: z.string().uuid(), bundle: z.object({ format: z.literal("accx.encrypted-vault.v1"), generatedAt: z.string().datetime(), workspaceId: z.string().uuid(), secrets: z.array(z.unknown()).max(500) }) });
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try { const input = schema.parse(req.body); sendJson(res, 200, await withControlPlaneDb(db => { const user = requireStepUp(db, req); assertFreshMutation(db, req, { actorId: user.id, scope: "app.vault.import", limit: 5, windowMs: 60_000 }); return { imported: importEncryptedWorkspace(db, { workspaceId: input.workspaceId, actorId: user.id, bundle: input.bundle as never }) }; }, { write: true })); }
  catch (error) { apiError(res, error); }
}
