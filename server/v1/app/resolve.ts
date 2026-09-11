import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, sendJson } from "../../_lib/http.js";
import { requirePersonalPat } from "../../_lib/pats.js";
import { assertFreshRequest } from "../../_lib/integrity.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";
import { resolveEnvironmentVariables } from "../../_lib/resolver.js";

const schema = z.object({
  operation: z.literal("resolve"),
  project: z.string().trim().min(1).max(63),
  environment: z.enum(["development", "staging", "production"]),
  keys: z.array(z.string().trim().min(1).max(128)).max(128).optional(),
});

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const input = schema.parse(req.body);
    const result = await withControlPlaneDb(db => {
      const pat = requirePersonalPat(db, req, ["env.read"]);
      assertFreshRequest(db, req, { actorId: pat.tokenId, scope: `pat.resolve:${pat.tokenId}`, limit: 600, windowMs: 60_000 });
      const variables = resolveEnvironmentVariables(db, { userId: pat.userId, patId: pat.tokenId, project: input.project, environment: input.environment, keys: input.keys });
      return { variables };
    });
    sendJson(res, 200, result);
  } catch (error) { apiError(res, error); }
}