import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, authorizeWorker, sendJson } from "../../_lib/http.js";
import { executeQueuedJob } from "../../_lib/executor.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";

const schema = z.object({ jobId: z.string().uuid() });

/** Server-only entry point for a Vercel cron, queue, or dedicated worker. */
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    authorizeWorker(req);
    const input = schema.parse(req.body);
    const result = await withControlPlaneDb(db => executeQueuedJob(db, input.jobId), { write: true });
    sendJson(res, 200, result);
  } catch (error) { apiError(res, error); }
}
