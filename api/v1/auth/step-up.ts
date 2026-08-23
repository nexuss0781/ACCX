import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, sendJson } from "../../_lib/http.js";
import { verifyRecoveryCodeStepUp, verifyTotpStepUp } from "../../_lib/auth.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";

const schema = z.discriminatedUnion("method", [z.object({ method: z.literal("totp"), code: z.string().trim().regex(/^\d{6}$/) }), z.object({ method: z.literal("recovery"), code: z.string().trim().min(8).max(64) })]);

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const input = schema.parse(req.body);
    await withControlPlaneDb(db => input.method === "totp" ? verifyTotpStepUp(db, req, input.code) : verifyRecoveryCodeStepUp(db, req, input.code), { write: true });
    sendJson(res, 200, { verified: true, method: input.method, expiresInSeconds: 600 });
  } catch (error) { apiError(res, error); }
}
