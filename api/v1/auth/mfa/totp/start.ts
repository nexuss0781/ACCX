import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../../../_lib/http.js";
import { apiError, sendJson } from "../../../../_lib/http.js";
import { beginTotpEnrollment } from "../../../../_lib/auth.js";
import { withControlPlaneDb } from "../../../../_lib/paradox.js";

const schema = z.object({ label: z.string().trim().min(1).max(80).default("Authenticator app") });

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try { sendJson(res, 200, await withControlPlaneDb(db => beginTotpEnrollment(db, req, schema.parse(req.body).label), { write: true })); }
  catch (error) { apiError(res, error); }
}
