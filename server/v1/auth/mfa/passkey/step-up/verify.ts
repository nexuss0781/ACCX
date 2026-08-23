import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../../../../_lib/http.js";
import { apiError, sendJson } from "../../../../../_lib/http.js";
import { withControlPlaneDb } from "../../../../../_lib/paradox.js";
import { finishPasskeyStepUp } from "../../../../../_lib/webauthn.js";

const schema = z.object({ response: z.record(z.string(), z.unknown()) });
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try { const input = schema.parse(req.body); await withControlPlaneDb(db => finishPasskeyStepUp(db, req, input.response as never), { write: true }); sendJson(res, 200, { verified: true, method: "passkey", expiresInSeconds: 600 }); }
  catch (error) { apiError(res, error); }
}
