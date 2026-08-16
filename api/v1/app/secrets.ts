import { z } from "zod";
import { secretReferenceSchema } from "../../../shared/contracts.js";
import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, sendJson } from "../../_lib/http.js";
import { requireSession } from "../../_lib/auth.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";
import { registerSecretMetadata } from "../../_lib/vault.js";

const schema = z.object({ environmentId: z.string().uuid(), provider: z.string().trim().min(1).max(80), displayName: z.string().trim().min(1).max(160), reference: secretReferenceSchema, fieldKind: z.enum(["password", "api_token", "refresh_token", "client_secret", "recovery_code", "cookie", "ssh_key", "custom"]).default("custom"), tags: z.array(z.string().trim().min(1).max(48)).max(20).default([]), aliases: z.array(secretReferenceSchema).max(20).default([]) });

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const secret = await withControlPlaneDb(db => {
      const user = requireSession(db, req);
      return registerSecretMetadata(db, { ...schema.parse(req.body), actorId: user.id });
    }, { write: true });
    sendJson(res, 201, { secret });
  } catch (error) { apiError(res, error); }
}
