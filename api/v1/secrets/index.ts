import { z } from "zod";
import { secretReferenceSchema } from "../../../shared/contracts.js";
import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, authorizeAdmin, sendJson } from "../../_lib/http.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";
import { listSecretMetadata, registerSecretMetadata } from "../../_lib/vault.js";

const createSchema = z.object({ environmentId: z.string().uuid(), provider: z.string().trim().min(1).max(80), displayName: z.string().trim().min(1).max(160), reference: secretReferenceSchema });

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    authorizeAdmin(req);
    const subjectId = typeof req.headers["x-accx-subject-id"] === "string" ? req.headers["x-accx-subject-id"] : "operator";
    if (req.method === "GET") {
      const workspaceId = typeof req.query?.workspaceId === "string" ? req.query.workspaceId : "";
      if (!workspaceId) return sendJson(res, 400, { error: "workspaceId is required" });
      const secrets = await withControlPlaneDb(db => listSecretMetadata(db, workspaceId));
      return sendJson(res, 200, { secrets });
    }
    if (req.method === "POST") {
      const input = createSchema.parse(req.body);
      const secret = await withControlPlaneDb(db => registerSecretMetadata(db, { ...input, actorId: subjectId }), { write: true });
      return sendJson(res, 201, { secret });
    }
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) { apiError(res, error); }
}
