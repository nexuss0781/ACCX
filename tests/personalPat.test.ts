import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createPersonalApiToken, personalTokenFromHeader, requirePersonalPat, revokePersonalApiToken } from "../server/_lib/pats.js";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

type Script = { rows: Record<string, unknown>[] };

function fakeDb(script: Script[], calls?: string[]) {
  let index = 0;
  const lastParams: unknown[][] = [];
  return {
    execute(sql: string, params: unknown[]) {
      if (calls) calls.push(sql.replace(/\s+/g, " "));
      lastParams.push(params ?? []);
      const next = script[index] ?? script[script.length - 1];
      if (index < script.length) index += 1;
      return { rows: next.rows };
    },
    lastParams,
  } as never;
}

function mint(db: ReturnType<typeof fakeDb>): string {
  return createPersonalApiToken(db, { userId: "user-1", name: "cli" }).token;
}

const membership = { workspace_id: "workspace-a", scopes_json: JSON.stringify(["env.read", "env.write", "project.manage", "audit.read"]) };
const patRecord = (extra: Record<string, unknown>[] = []) => ({ id: "token-1", user_id: "user-1", workspace_id: "workspace-a", scopes_json: JSON.stringify(["env.read", "project.manage"]), member_scopes_json: membership.scopes_json, expires_at: "9999-12-31T23:59:59.999Z", revoked_at: null, ...extra[0] });
const lookupDb = (record: Record<string, unknown> | null) => {
  let checked = false;
  return {
    execute(_sql: string, _params: unknown[]) {
      if (!checked) { checked = true; return { rows: record ? [record] : [] }; }
      return { rows: [] };
    },
  } as never;
};

describe("ACCX personal API tokens (PAT)", () => {
  it("mints a one-time accx_pat_ token and stores a digest, never the plaintext", () => {
    const calls: string[] = [];
    const db = fakeDb([{ rows: [membership] }], calls);
    const receipt = createPersonalApiToken(db, { userId: "user-1", name: "cli" });
    expect(receipt.token).toMatch(/^accx_pat_[A-Za-z0-9_-]{43}$/);
    expect(receipt.prefix).toBe(receipt.token.slice(0, 24));
    expect(calls.some(sql => sql.includes("INSERT INTO personal_api_tokens") && sql.includes("token_digest"))).toBe(true);
    const insertParams = (db as unknown as { lastParams: unknown[][] }).lastParams.find(params => params.length >= 8 && /^[a-f0-9]{64}$/.test(String(params[4])));
    expect(insertParams).toBeTruthy();
    expect(String(insertParams![4])).not.toContain(receipt.token);
  });

  it("bounds requested scopes to the membership grant and rejects out-of-scope requests", () => {
    const okDb = fakeDb([{ rows: [membership] }]);
    expect(createPersonalApiToken(okDb, { userId: "user-1", name: "ok", scopes: ["env.read"] }).token.startsWith("accx_pat_")).toBe(true);

    const denyDb = fakeDb([{ rows: [{ workspace_id: "workspace-a", scopes_json: JSON.stringify(["env.read"]) }] }]);
    expect(() => createPersonalApiToken(denyDb, { userId: "user-1", name: "no", scopes: ["project.manage"] })).toThrow("FORBIDDEN");
  });

  it("authenticates a minted PAT and returns membership-intersected scopes", () => {
    const token = mint(fakeDb([{ rows: [membership] }]));
    const db = lookupDb(patRecord());
    const pat = requirePersonalPat(db, { headers: { authorization: `Bearer ${token}` } } as never, ["env.read"]);
    expect(pat.userId).toBe("user-1");
    expect(pat.workspaceId).toBe("workspace-a");
    expect(pat.scopes).toEqual(["env.read", "project.manage"]);
  });

  it("rejects tokens missing the required scope, revoked tokens, and unknown tokens", () => {
    const token = mint(fakeDb([{ rows: [membership] }]));
    const scopedDb = lookupDb(patRecord());
    expect(() => requirePersonalPat(scopedDb, { headers: { authorization: `Bearer ${token}` } } as never, ["env.write"])).toThrow("FORBIDDEN");

    const revokedDb = lookupDb(patRecord([{ revoked_at: "2026-01-01T00:00:00.000Z" }]));
    expect(() => requirePersonalPat(revokedDb, { headers: { authorization: `Bearer ${token}` } } as never, ["env.read"])).toThrow("UNAUTHORIZED");

    const unknownDb = lookupDb(null);
    expect(() => requirePersonalPat(unknownDb, { headers: { authorization: `Bearer ${token}` } } as never, ["env.read"])).toThrow("UNAUTHORIZED");
  });

  it("parses only Bearer header tokens carrying the personal prefix", () => {
    const token = mint(fakeDb([{ rows: [membership] }]));
    expect(personalTokenFromHeader({ headers: { authorization: `Bearer ${token}` } } as never)).toBe(token);
    expect(personalTokenFromHeader({ headers: { authorization: "Bearer some-other-token" } } as never)).toBeNull();
    expect(() => personalTokenFromHeader({ headers: { authorization: "Token abc" } } as never)).toThrow("UNAUTHORIZED");
  });

  it("revokes a PAT and reports missing token ids", () => {
    const calls: string[] = [];
    const db = fakeDb([{ rows: [membership] }, { rows: [{ name: "cli" }] }], calls);
    revokePersonalApiToken(db, { userId: "user-1", tokenId: "token-1" });
    expect(calls.some(sql => sql.includes("UPDATE personal_api_tokens SET revoked_at"))).toBe(true);

    const missingDb = fakeDb([{ rows: [membership] }, { rows: [] }]);
    expect(() => revokePersonalApiToken(missingDb, { userId: "user-1", tokenId: "token-2" })).toThrow("NOT_FOUND");
  });

  it("canonicalizes the personal API token lifecycle in schema and routes", () => {
    const schema = source("server/_lib/schema.ts");
    const routes = source("api/v1/app.ts");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS personal_api_tokens");
    expect(schema).toContain("token_digest TEXT NOT NULL UNIQUE");
    expect(routes).toContain("create_pat: keys");
    expect(routes).toContain("list_pats: keys");
    expect(routes).toContain("revoke_pat: keys");
  });
});