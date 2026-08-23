import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, sendJson } from "../../_lib/http.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";
import { getJobStatus } from "../../_lib/orchestrator.js";

const schema = z.object({ jobId: z.string().uuid() });

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const token = req.headers["x-accx-workload-token"];
    if (typeof token !== "string") return sendJson(res, 401, { error: "Unauthorized" });
    const jobId = typeof req.query?.jobId === "string" ? req.query.jobId : "";
    const result = await withControlPlaneDb(db => getJobStatus(db, token, schema.parse({ jobId }).jobId));
    sendJson(res, 200, result);
  } catch (error) { apiError(res, error); }
}
