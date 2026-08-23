import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, authorizeAdmin, sendJson } from "../../_lib/http.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";
import { listAuditEvents } from "../../_lib/vault.js";

const schema = z.object({ workspaceId: z.string().uuid(), limit: z.coerce.number().int().min(1).max(100).default(50) });

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    authorizeAdmin(req);
    const actorId = typeof req.headers["x-accx-subject-id"] === "string" ? req.headers["x-accx-subject-id"] : "operator";
    const query = schema.parse(req.query);
    const events = await withControlPlaneDb(db => listAuditEvents(db, { ...query, actorId }));
    sendJson(res, 200, { events });
  } catch (error) { apiError(res, error); }
}
