import { z } from "zod";
import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { apiError, sendJson } from "../../_lib/http.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";
import { createUserSession, setSessionCookie, verifyPassword } from "../../_lib/auth.js";

const schema = z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(256) });

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const input = schema.parse(req.body);
    const result = await withControlPlaneDb(db => {
      const user = db.execute(`SELECT id, email, name, password_hash, created_at FROM users WHERE email = ?`, [input.email.toLowerCase()]).rows[0] as Record<string, string> | undefined;
      if (!user || !verifyPassword(input.password, user.password_hash)) throw new Error("UNAUTHORIZED");
      return { user: { id: user.id, email: user.email, name: user.name, createdAt: user.created_at }, ...createUserSession(db, user.id) };
    }, { write: true });
    setSessionCookie(res, result.token);
    sendJson(res, 200, { user: result.user });
  } catch (error) { apiError(res, error); }
}
