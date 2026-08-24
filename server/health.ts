import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import { sendJson } from "./_lib/http.js";
import { withControlPlaneDb } from "./_lib/paradox.js";

function classifyDatabaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("Missing required server environment variable:")) return "missing_server_environment";
  if (/api.?key|unauthorized|authentication|login/i.test(message)) return "database_authentication";
  if (/passphrase|decrypt|cipher|encrypted/i.test(message)) return "database_decryption";
  if (/wasm|sql\.js|enoent/i.test(message)) return "database_runtime_asset";
  if (/fetch|network|timeout|gateway|connect|econn|enotfound|503|502/i.test(message)) return "database_connectivity";
  return "database_runtime";
}

export default async function handler(_req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    const databaseOk = await withControlPlaneDb(async db => Number(db.execute("SELECT 1 AS ok").rows[0]?.ok) === 1);
    sendJson(res, databaseOk ? 200 : 503, {
      service: "accx",
      status: databaseOk ? "ok" : "degraded",
      runtime: "vercel-serverless",
      dependencies: { database: databaseOk ? "ok" : "error" },
      revision: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "unknown",
    });
  } catch (error) {
    sendJson(res, 503, {
      service: "accx",
      status: "degraded",
      runtime: "vercel-serverless",
      dependencies: { database: "error" },
      revision: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "unknown",
      error: classifyDatabaseError(error),
    });
  }
}
