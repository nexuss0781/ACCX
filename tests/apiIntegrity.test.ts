import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertFreshMutation, assertSameOrigin } from "../api/_lib/integrity.js";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const request = (headers: Record<string, string>) => ({ headers }) as never;

function fakeDb() {
  const nonces = new Set<string>();
  const windows = new Map<string, { window_started_at: number; count: number }>();
  return {
    execute(sql: string, values: unknown[] = []) {
      if (sql.includes("SELECT window_started_at")) return { rows: windows.has(String(values[0])) ? [windows.get(String(values[0]))] : [] };
      if (sql.includes("INSERT OR REPLACE INTO rate_limit_windows")) { windows.set(String(values[0]), { window_started_at: Number(values[1]), count: Number(values[2]) }); return { rows: [] }; }
      if (sql.includes("UPDATE rate_limit_windows")) { const entry = windows.get(String(values[0])); if (entry) entry.count += 1; return { rows: [] }; }
      if (sql.includes("SELECT nonce FROM request_nonces")) return { rows: nonces.has(String(values[0])) ? [{ nonce: values[0] }] : [] };
      if (sql.includes("INSERT INTO request_nonces")) { nonces.add(String(values[0])); return { rows: [] }; }
      return { rows: [] };
    },
  } as never;
}

describe("ACCX mutation integrity", () => {
  it("rejects cross-origin state-changing requests", () => {
    expect(() => assertSameOrigin(request({ origin: "https://attacker.invalid", host: "accx-app.vercel.app" }))).toThrow("FORBIDDEN");
    expect(() => assertSameOrigin(request({ origin: "https://accx-app.vercel.app", host: "accx-app.vercel.app" }))).not.toThrow();
  });

  it("accepts a fresh nonce once and rejects its replay", () => {
    const db = fakeDb();
    const req = request({ origin: "https://accx-app.vercel.app", host: "accx-app.vercel.app", "x-forwarded-for": "203.0.113.10", "x-accx-request-timestamp": String(Date.now()), "x-accx-request-nonce": "noncevalue12345678" });
    expect(() => assertFreshMutation(db, req, { actorId: "user-1", scope: "test", limit: 3, windowMs: 60_000 })).not.toThrow();
    expect(() => assertFreshMutation(db, req, { actorId: "user-1", scope: "test", limit: 3, windowMs: 60_000 })).toThrow("REPLAYED_REQUEST");
  });

  it("rejects stale timestamps and documents browser-generated mutation headers", () => {
    const db = fakeDb();
    const stale = request({ origin: "https://accx-app.vercel.app", host: "accx-app.vercel.app", "x-accx-request-timestamp": String(Date.now() - 300_000), "x-accx-request-nonce": "anothernoncevalue12" });
    expect(() => assertFreshMutation(db, stale, { actorId: "user-1", scope: "test", limit: 3, windowMs: 60_000 })).toThrow("STALE_REQUEST");
    const client = source("src/lib/accxApi.ts");
    expect(client).toContain("X-ACCX-Request-Timestamp");
    expect(client).toContain("X-ACCX-Request-Nonce");
  });
});
