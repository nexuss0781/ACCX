import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../../_lib/http.js";
import { apiError, sendJson } from "../../../_lib/http.js";
import { requireStepUp } from "../../../_lib/auth.js";
import { assertFreshMutation } from "../../../_lib/integrity.js";
import { resolveJobApproval } from "../../../_lib/orchestrator.js";
import { withControlPlaneDb } from "../../../_lib/paradox.js";

const schema = z.object({ jobId: z.string().uuid(), approve: z.boolean(), reason: z.string().trim().min(3).max(240) });
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const input = schema.parse(req.body);
    const result = await withControlPlaneDb(db => { const user = requireStepUp(db, req); assertFreshMutation(db, req, { actorId: user.id, scope: "app.jobs.approval", limit: 10, windowMs: 60_000 }); return resolveJobApproval(db, { ...input, actorId: user.id }); }, { write: true });
    sendJson(res, 200, result);
  } catch (error) { apiError(res, error); }
}
