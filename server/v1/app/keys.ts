import { z } from "zod";
import { scopeSchema } from "../../../shared/contracts.js";
import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, sendJson } from "../../_lib/http.js";
import { requireSession } from "../../_lib/auth.js";
import { assertFreshMutation } from "../../_lib/integrity.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";
import { createPersonalApiToken, listPersonalApiTokens, revokePersonalApiToken } from "../../_lib/pats.js";

const createSchema = z.object({
  operation: z.literal("create"),
  name: z.string().trim().min(1).max(100),
  scopes: z.array(scopeSchema).max(9).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
}).refine(input => !input.expiresAt || Date.parse(input.expiresAt) > Date.now(), { message: "expiresAt must be in the future" });
const listSchema = z.object({ operation: z.literal("list") });
const revokeSchema = z.object({ operation: z.literal("revoke"), tokenId: z.string().uuid() });
const schema = z.discriminatedUnion("operation", [createSchema, listSchema, revokeSchema]);

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const input = schema.parse(req.body);
    const result = await withControlPlaneDb(db => {
      const user = requireSession(db, req);
      assertFreshMutation(db, req, { actorId: user.id, scope: `app.pats.${input.operation}`, limit: 30, windowMs: 60_000 });
      if (input.operation === "create") return { token: createPersonalApiToken(db, { userId: user.id, name: input.name, scopes: input.scopes, expiresAt: input.expiresAt ?? null }) };
      if (input.operation === "list") return { tokens: listPersonalApiTokens(db, user.id) };
      revokePersonalApiToken(db, { userId: user.id, tokenId: input.tokenId });
      return { revoked: true };
    }, { write: true });
    sendJson(res, input.operation === "create" ? 201 : 200, result);
  } catch (error) { apiError(res, error); }
}