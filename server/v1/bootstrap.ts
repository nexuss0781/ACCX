import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { apiError, authorizeAdmin, sendJson } from "../_lib/http.js";
import { withControlPlaneDb } from "../_lib/paradox.js";
import { bootstrapControlPlane } from "../_lib/vault.js";

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    authorizeAdmin(req);
    const operatorId = typeof req.headers["x-accx-subject-id"] === "string" ? req.headers["x-accx-subject-id"] : "operator";
    const result = await withControlPlaneDb(db => bootstrapControlPlane(db, operatorId), { write: true });
    sendJson(res, 201, result);
  } catch (error) { apiError(res, error); }
}
