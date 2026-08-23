import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, sendJson } from "../../_lib/http.js";
import { requireSession } from "../../_lib/auth.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";
import { assertScopes, listAuditEvents, listSecretMetadata } from "../../_lib/vault.js";

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const data = await withControlPlaneDb(db => {
      const user = requireSession(db, req);
      const membership = db.execute(`SELECT workspace_id FROM workspace_members WHERE subject_id = ? AND subject_type = 'human' LIMIT 1`, [user.id]).rows[0] as { workspace_id: string } | undefined;
      if (!membership) throw new Error("FORBIDDEN");
      assertScopes(db, membership.workspace_id, user.id, ["metadata.read"]);
      const environments = db.execute(`SELECT e.id, e.label, p.id AS project_id, p.name AS project_name FROM environments e JOIN projects p ON p.id = e.project_id WHERE p.workspace_id = ? ORDER BY p.name, e.label`, [membership.workspace_id]).rows;
      return { user, workspaceId: membership.workspace_id, environments, secrets: listSecretMetadata(db, membership.workspace_id), audit: listAuditEvents(db, { workspaceId: membership.workspace_id, actorId: user.id, limit: 25 }) };
    });
    sendJson(res, 200, data);
  } catch (error) { apiError(res, error); }
}
