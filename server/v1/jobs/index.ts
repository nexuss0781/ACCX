import { jobSubmissionSchema } from "../../../shared/contracts.js";
import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, sendJson } from "../../_lib/http.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";
import { submitJob } from "../../_lib/orchestrator.js";

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const token = req.headers["x-accx-workload-token"];
    if (typeof token !== "string") return sendJson(res, 401, { error: "Unauthorized" });
    const job = jobSubmissionSchema.parse(req.body);
    const result = await withControlPlaneDb(db => submitJob(db, token, job), { write: true });
    sendJson(res, 202, result);
  } catch (error) { apiError(res, error); }
}
