import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, sendJson } from "../../_lib/http.js";
import { listWorkloadSecretMetadata } from "../../_lib/orchestrator.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";

function token(req: ApiRequest): string {
  const raw = req.headers["x-accx-workload-token"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) throw new Error("UNAUTHORIZED");
  return value;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  try { sendJson(res, 200, { secrets: await withControlPlaneDb(db => listWorkloadSecretMetadata(db, token(req))) }); }
  catch (error) { apiError(res, error); }
}
