import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { ParadConnection } from "parad";
import type { ApiRequest, ApiResponse } from "./http.js";

const now = () => new Date().toISOString();
const sessionDays = 7;
type Row = Record<string, unknown>;
function first<T extends Row>(result: { rows: Row[] }): T | null { return (result.rows[0] as T | undefined) ?? null; }
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export type SessionUser = { id: string; email: string; name: string; createdAt: string };

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const digest = scryptSync(password, salt, 64).toString("base64url");
  return `${salt}:${digest}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest) return false;
  const calculated = Buffer.from(scryptSync(password, salt, 64).toString("base64url"));
  const expected = Buffer.from(digest);
  return expected.length === calculated.length && timingSafeEqual(expected, calculated);
}

export function createUserSession(db: ParadConnection, userId: string): { token: string; expiresAt: string } {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDays * 86_400_000).toISOString();
  db.execute(`INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`, [randomBytes(16).toString("hex"), userId, tokenHash(token), expiresAt, now()]);
  return { token, expiresAt };
}

function cookieValue(req: ApiRequest, name: string): string | null {
  const raw = req.headers.cookie ?? "";
  const match = raw.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function sessionUser(db: ParadConnection, req: ApiRequest): SessionUser | null {
  const token = cookieValue(req, "accx_session");
  if (!token) return null;
  const result = first<{ id: string; email: string; name: string; created_at: string }>(db.execute(`SELECT u.id, u.email, u.name, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?`, [tokenHash(token), now()]));
  return result ? { id: result.id, email: result.email, name: result.name, createdAt: result.created_at } : null;
}

export function requireSession(db: ParadConnection, req: ApiRequest): SessionUser {
  const user = sessionUser(db, req);
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export function setSessionCookie(res: ApiResponse, token: string): void {
  res.setHeader("Set-Cookie", `accx_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${sessionDays * 86_400}`);
}

export function clearSessionCookie(res: ApiResponse): void {
  res.setHeader("Set-Cookie", "accx_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
}

export function revokeCurrentSession(db: ParadConnection, req: ApiRequest): void {
  const token = cookieValue(req, "accx_session");
  if (token) db.execute(`UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL`, [now(), tokenHash(token)]);
}
