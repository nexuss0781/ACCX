import type { ApiRequest, ApiResponse } from "../../../../../_lib/http.js";
import { apiError, sendJson } from "../../../../../_lib/http.js";
import { withControlPlaneDb } from "../../../../../_lib/paradox.js";
import { beginPasskeyStepUp } from "../../../../../_lib/webauthn.js";

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try { sendJson(res, 200, await withControlPlaneDb(db => beginPasskeyStepUp(db, req), { write: true })); }
  catch (error) { apiError(res, error); }
}
