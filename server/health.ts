import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import { sendJson } from "./_lib/http.js";
import { withControlPlaneDb } from "./_lib/paradox.js";

export default async function handler(_req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    const databaseOk = await withControlPlaneDb(async db => Number(db.execute("SELECT 1 AS ok").rows[0]?.ok) === 1);
    sendJson(res, databaseOk ? 200 : 503, {
      service: "accx",
      status: databaseOk ? "ok" : "degraded",
      runtime: "vercel-serverless",
      dependencies: { database: databaseOk ? "ok" : "error" },
    });
  } catch {
    sendJson(res, 503, {
      service: "accx",
      status: "degraded",
      runtime: "vercel-serverless",
      dependencies: { database: "error" },
    });
  }
}
