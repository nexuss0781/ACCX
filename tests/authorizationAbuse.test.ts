import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertScopes } from "../server/_lib/vault.js";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("ACCX authorization abuse cases", () => {
  it("fails closed when an actor has no membership in a target workspace", () => {
    const db = { execute: () => ({ rows: [] }) } as never;
    expect(() => assertScopes(db, "workspace-b", "actor-from-workspace-a", ["metadata.read"])).toThrow("FORBIDDEN");
  });

  it("requires every requested scope instead of treating one granted scope as sufficient", () => {
    const db = { execute: () => ({ rows: [{ scopes_json: JSON.stringify(["metadata.read"]) }] }) } as never;
    expect(() => assertScopes(db, "workspace-a", "actor-a", ["metadata.read", "secret.rotate"])).toThrow("FORBIDDEN");
  });

  it("keeps metadata and audit queries tenant-filtered and never selects plaintext columns", () => {
    const vault = source("server/_lib/vault.ts");
    expect(vault).toContain("WHERE p.workspace_id = ? AND s.deleted_at IS NULL");
    expect(vault).toContain("WHERE workspace_id = ? ORDER BY created_at DESC");
    expect(vault).not.toMatch(/SELECT[^`]*encrypted_secret_json[^`]*FROM secrets/i);
  });

  it("retains server-side replay protection and atomic trusted-worker claiming", () => {
    const integrity = source("server/_lib/integrity.ts");
    const executor = source("server/_lib/executor.ts");
    expect(integrity).toContain("REPLAYED_REQUEST");
    expect(integrity).toContain("RATE_LIMITED");
    expect(executor).toContain("WHERE id = ? AND status = 'queued'");
  });
});
