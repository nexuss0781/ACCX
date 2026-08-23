import { createHash } from "node:crypto";
import type { ParadConnection } from "parad";
import type { ApiRequest } from "./http.js";

const now = () => new Date().toISOString();
const timestampSkewMs = 120_000;

function header(req: ApiRequest, name: string): string | null {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function remoteFingerprint(req: ApiRequest): string {
  const forwarded = header(req, "x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return createHash("sha256").update(forwarded).digest("hex").slice(0, 24);
}

export function assertSameOrigin(req: ApiRequest): void {
  const origin = header(req, "origin");
  const host = header(req, "host");
  if (!origin || !host) throw new Error("FORBIDDEN");
  const parsed = new URL(origin);
  if (parsed.host !== host || (parsed.protocol !== "https:" && parsed.hostname !== "localhost")) throw new Error("FORBIDDEN");
}

export function assertRateLimit(db: ParadConnection, req: ApiRequest, input: { bucket: string; limit: number; windowMs: number }): void {
  const bucket = `${input.bucket}:${remoteFingerprint(req)}`;
  const current = Date.now();
  const row = db.execute(`SELECT window_started_at, count FROM rate_limit_windows WHERE bucket = ?`, [bucket]).rows[0] as { window_started_at: number; count: number } | undefined;
  if (!row || current - Number(row.window_started_at) >= input.windowMs) {
    db.execute(`INSERT OR REPLACE INTO rate_limit_windows (bucket, window_started_at, count) VALUES (?, ?, 1)`, [bucket, current]);
    return;
  }
  if (Number(row.count) >= input.limit) throw new Error("RATE_LIMITED");
  db.execute(`UPDATE rate_limit_windows SET count = count + 1 WHERE bucket = ?`, [bucket]);
}

export function assertFreshMutation(db: ParadConnection, req: ApiRequest, input: { actorId: string; scope: string; limit: number; windowMs: number }): void {
  assertSameOrigin(req);
  assertRateLimit(db, req, { bucket: input.scope, limit: input.limit, windowMs: input.windowMs });
  const timestamp = Number(header(req, "x-accx-request-timestamp"));
  const nonce = header(req, "x-accx-request-nonce");
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > timestampSkewMs || !nonce || !/^[a-zA-Z0-9_-]{16,160}$/.test(nonce)) throw new Error("STALE_REQUEST");
  db.execute(`DELETE FROM request_nonces WHERE expires_at <= ?`, [now()]);
  const existing = db.execute(`SELECT nonce FROM request_nonces WHERE nonce = ?`, [nonce]).rows[0];
  if (existing) throw new Error("REPLAYED_REQUEST");
  db.execute(`INSERT INTO request_nonces (nonce, actor_id, scope, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`, [nonce, input.actorId, input.scope, new Date(Date.now() + timestampSkewMs).toISOString(), now()]);
}
