import { z } from "zod";
import { scopeSchema } from "../../../shared/contracts.js";
import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, authorizeAdmin, sendJson } from "../../_lib/http.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";
import { createServiceIdentity, provisionWorkloadToken, revokeServiceIdentity } from "../../_lib/orchestrator.js";

const identitySchema = z.object({ projectId: z.string().uuid(), name: z.string().trim().min(3).max(100), scopes: z.array(scopeSchema).min(1) });
const provisionSchema = z.object({ serviceIdentityId: z.string().uuid(), ttlSeconds: z.number().int().min(60).max(900).default(900) });

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    authorizeAdmin(req);
    const subjectId = typeof req.headers["x-accx-subject-id"] === "string" ? req.headers["x-accx-subject-id"] : "operator";
    const body = req.body as Record<string, unknown>;
    if (body.operation === "create") {
      const identity = await withControlPlaneDb(db => createServiceIdentity(db, { ...identitySchema.parse(body), actorId: subjectId }), { write: true });
      return sendJson(res, 201, { identity });
    }
    if (body.operation === "provision") {
      const receipt = await withControlPlaneDb(db => provisionWorkloadToken(db, { ...provisionSchema.parse(body), actorId: subjectId }), { write: true });
      // This endpoint is server-to-server only. Never call it from the ACCX browser UI.
      return sendJson(res, 201, { tokenId: receipt.tokenId, token: receipt.token, expiresAt: receipt.expiresAt, delivery: "place_token_in_server_secret_store" });
    }
    if (body.operation === "revoke") {
      const serviceIdentityId = z.object({ serviceIdentityId: z.string().uuid() }).parse(body).serviceIdentityId;
      await withControlPlaneDb(db => revokeServiceIdentity(db, { serviceIdentityId, actorId: subjectId }), { write: true });
      return sendJson(res, 204, null);
    }
    return sendJson(res, 400, { error: "Unsupported workload operation" });
  } catch (error) { apiError(res, error); }
}
