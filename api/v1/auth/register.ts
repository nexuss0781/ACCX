import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, sendJson } from "../../_lib/http.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";
import { createUserSession, hashPassword, setSessionCookie } from "../../_lib/auth.js";
import { bootstrapControlPlane } from "../../_lib/vault.js";

const schema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(320), password: z.string().min(12).max(256) });

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const input = schema.parse(req.body);
    const result = await withControlPlaneDb(db => {
      const existing = db.execute(`SELECT id FROM users WHERE email = ?`, [input.email.toLowerCase()]).rows[0];
      if (existing) throw new Error("CONFLICT");
      const userId = randomUUID();
      db.execute(`INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)`, [userId, input.email.toLowerCase(), input.name, hashPassword(input.password), new Date().toISOString()]);
      const controlPlane = bootstrapControlPlane(db, userId);
      db.execute(`INSERT OR IGNORE INTO workspace_members (id, workspace_id, subject_id, subject_type, scopes_json, created_at) VALUES (?, ?, ?, 'human', ?, ?)`, [randomUUID(), controlPlane.workspaceId, userId, JSON.stringify(["metadata.read", "secret.rotate", "provider.publish", "job.execute", "audit.read", "identity.manage"]), new Date().toISOString()]);
      return { user: { id: userId, email: input.email.toLowerCase(), name: input.name, createdAt: new Date().toISOString() }, ...createUserSession(db, userId) };
    }, { write: true });
    setSessionCookie(res, result.token);
    sendJson(res, 201, { user: result.user });
  } catch (error) { apiError(res, error); }
}
