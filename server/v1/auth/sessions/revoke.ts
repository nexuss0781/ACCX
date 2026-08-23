import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../../_lib/http.js";
import { apiError, sendJson } from "../../../_lib/http.js";
import { revokeUserSession } from "../../../_lib/auth.js";
import { withControlPlaneDb } from "../../../_lib/paradox.js";

const schema = z.object({ sessionId: z.string().uuid() });
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try { const input = schema.parse(req.body); await withControlPlaneDb(db => revokeUserSession(db, req, input.sessionId), { write: true }); sendJson(res, 200, { revoked: true }); }
  catch (error) { apiError(res, error); }
}
