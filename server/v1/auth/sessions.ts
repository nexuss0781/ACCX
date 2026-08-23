import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, sendJson } from "../../_lib/http.js";
import { listUserSessions, rotateCurrentSession, setSessionCookie } from "../../_lib/auth.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    if (req.method === "GET") return sendJson(res, 200, { sessions: await withControlPlaneDb(db => listUserSessions(db, req)) });
    if (req.method === "POST") { const result = await withControlPlaneDb(db => rotateCurrentSession(db, req), { write: true }); setSessionCookie(res, result.token); return sendJson(res, 200, { rotated: true, expiresAt: result.expiresAt }); }
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) { apiError(res, error); }
}
