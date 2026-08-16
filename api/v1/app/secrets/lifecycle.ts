import { z } from "zod";
import { secretReferenceSchema } from "../../../../shared/contracts.js";
import type { ApiRequest, ApiResponse } from "../../../_lib/http.js";
import { apiError, sendJson } from "../../../_lib/http.js";
import { requireSession, requireStepUp } from "../../../_lib/auth.js";
import { withControlPlaneDb } from "../../../_lib/paradox.js";
import { purgeSoftDeletedSecrets, softDeleteSecret, updateSecretMetadata } from "../../../_lib/vault.js";

const metadataSchema = z.object({ operation: z.literal("metadata"), secretId: z.string().uuid(), tags: z.array(z.string().trim().min(1).max(48)).max(20), aliases: z.array(secretReferenceSchema).max(20), healthStatus: z.enum(["unknown", "healthy", "attention", "failed"]), expiresAt: z.string().datetime().nullable() });
const deleteSchema = z.object({ operation: z.literal("soft_delete"), secretId: z.string().uuid(), retentionDays: z.number().int().min(1).max(3650).default(30) });
const purgeSchema = z.object({ operation: z.literal("purge"), workspaceId: z.string().uuid(), force: z.boolean().default(false) });
const schema = z.discriminatedUnion("operation", [metadataSchema, deleteSchema, purgeSchema]);

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const input = schema.parse(req.body);
    const result = await withControlPlaneDb(db => {
      const user = input.operation === "metadata" ? requireSession(db, req) : requireStepUp(db, req);
      if (input.operation === "metadata") { updateSecretMetadata(db, { ...input, actorId: user.id }); return { updated: true }; }
      if (input.operation === "soft_delete") { softDeleteSecret(db, { ...input, actorId: user.id }); return { deleted: true }; }
      return { purged: purgeSoftDeletedSecrets(db, { workspaceId: input.workspaceId, actorId: user.id, force: input.force }) };
    }, { write: true });
    sendJson(res, 200, result);
  } catch (error) { apiError(res, error); }
}
