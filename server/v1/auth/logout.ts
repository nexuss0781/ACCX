import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, sendJson } from "../../_lib/http.js";
import { clearSessionCookie, revokeCurrentSession } from "../../_lib/auth.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try { await withControlPlaneDb(db => revokeCurrentSession(db, req), { write: true }); clearSessionCookie(res); sendJson(res, 200, { ok: true }); } catch (error) { apiError(res, error); }
}
