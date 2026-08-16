import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../../_lib/http.js";
import { apiError, sendJson } from "../../../_lib/http.js";
import { requireStepUp } from "../../../_lib/auth.js";
import { withControlPlaneDb } from "../../../_lib/paradox.js";
import { exportEncryptedWorkspace } from "../../../_lib/vault.js";

const schema = z.object({ workspaceId: z.string().uuid() });
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try { const input = schema.parse(req.body); sendJson(res, 200, await withControlPlaneDb(db => { const user = requireStepUp(db, req); return { bundle: exportEncryptedWorkspace(db, { workspaceId: input.workspaceId, actorId: user.id }) }; }, { write: true })); }
  catch (error) { apiError(res, error); }
}
