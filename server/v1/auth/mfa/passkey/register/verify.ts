import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../../../../_lib/http.js";
import { apiError, sendJson } from "../../../../../_lib/http.js";
import { withControlPlaneDb } from "../../../../../_lib/paradox.js";
import { finishPasskeyRegistration } from "../../../../../_lib/webauthn.js";

const schema = z.object({ label: z.string().trim().min(1).max(80).default("Passkey"), response: z.record(z.string(), z.unknown()) });
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try { const input = schema.parse(req.body); await withControlPlaneDb(db => finishPasskeyRegistration(db, req, input.response as never, input.label), { write: true }); sendJson(res, 200, { verified: true, method: "passkey" }); }
  catch (error) { apiError(res, error); }
}
