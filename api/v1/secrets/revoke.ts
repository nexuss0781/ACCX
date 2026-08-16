import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, authorizeAdmin, sendJson } from "../../_lib/http.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";
import { revokeSecret } from "../../_lib/vault.js";

const schema = z.object({ secretId: z.string().uuid(), reason: z.string().trim().min(3).max(200) });

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    authorizeAdmin(req);
    const subjectId = typeof req.headers["x-accx-subject-id"] === "string" ? req.headers["x-accx-subject-id"] : "operator";
    const input = schema.parse(req.body);
    await withControlPlaneDb(db => revokeSecret(db, { ...input, actorId: subjectId }), { write: true });
    sendJson(res, 204, null);
  } catch (error) { apiError(res, error); }
}
