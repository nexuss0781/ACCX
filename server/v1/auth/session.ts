import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, sendJson } from "../../_lib/http.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";
import { mfaStatus, sessionUser } from "../../_lib/auth.js";

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  try { sendJson(res, 200, await withControlPlaneDb(db => { const user = sessionUser(db, req); return { user, mfa: user ? mfaStatus(db, req) : null }; })); } catch (error) { apiError(res, error); }
}
