import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../../../_lib/http.js";
import { apiError, sendJson } from "../../../../_lib/http.js";
import { confirmTotpEnrollment } from "../../../../_lib/auth.js";
import { withControlPlaneDb } from "../../../../_lib/paradox.js";

const schema = z.object({ factorId: z.string().uuid(), code: z.string().trim().regex(/^\d{6}$/) });

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try { const input = schema.parse(req.body); await withControlPlaneDb(db => confirmTotpEnrollment(db, req, input.factorId, input.code), { write: true }); sendJson(res, 200, { verified: true, method: "totp" }); }
  catch (error) { apiError(res, error); }
}
