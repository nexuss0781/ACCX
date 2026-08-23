import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, authorizeAdmin, sendJson } from "../../_lib/http.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";
import { activateEncryptedVersion } from "../../_lib/vault.js";

const cipherBox = z.object({ ciphertext: z.string().min(1), iv: z.string().min(1), tag: z.string().min(1) });
const schema = z.object({ secretId: z.string().uuid(), encryptedPayload: z.object({ encryptedDataKey: cipherBox, secretCiphertext: cipherBox, algorithm: z.literal("AES-256-GCM") }) });

/** Internal server-to-server provisioning endpoint. It accepts encrypted payloads only. */
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    authorizeAdmin(req);
    const actorId = typeof req.headers["x-accx-subject-id"] === "string" ? req.headers["x-accx-subject-id"] : "operator";
    const input = schema.parse(req.body);
    const result = await withControlPlaneDb(db => activateEncryptedVersion(db, { ...input, actorId }), { write: true });
    sendJson(res, 201, result);
  } catch (error) { apiError(res, error); }
}
