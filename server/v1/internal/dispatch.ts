import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, authorizeWorker, sendJson } from "../../_lib/http.js";
import { executeQueuedJob } from "../../_lib/executor.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";

const schema = z.object({ workerId: z.string().trim().min(3).max(128).regex(/^[a-zA-Z0-9._:-]+$/), limit: z.number().int().min(1).max(5).default(1) });

/** Private pull endpoint for a one-shot worker invocation. It returns sanitized execution state only. */
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    authorizeWorker(req);
    const input = schema.parse(req.body ?? {});
    const results = await withControlPlaneDb(async db => {
      const jobs = db.execute(`SELECT id FROM orchestration_jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT ?`, [input.limit]).rows as { id: string }[];
      const completed = [];
      for (const job of jobs) completed.push(await executeQueuedJob(db, job.id, input.workerId));
      return completed;
    }, { write: true });
    sendJson(res, 200, { dispatched: results.length, results });
  } catch (error) { apiError(res, error); }
}
