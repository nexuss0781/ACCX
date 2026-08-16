import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, sendJson } from "../../_lib/http.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";
import { sessionUser } from "../../_lib/auth.js";

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  try { sendJson(res, 200, { user: await withControlPlaneDb(db => sessionUser(db, req)) }); } catch (error) { apiError(res, error); }
}
