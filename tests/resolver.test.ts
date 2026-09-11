process.env.ACCX_VAULT_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { describe, expect, it } from "vitest";
import { encryptSecret } from "../server/_lib/security.js";
import { resolveEnvironmentVariables } from "../server/_lib/resolver.js";

const source = (path: string) => readFileSync(resolvePath(process.cwd(), path), "utf8");

function db(...steps: (Record<string, unknown> | { rows?: Record<string, unknown>[] })[]) {
  let index = 0;
  const calls: string[] = [];
  return {
    execute(sql: string, _params: unknown[] = []) {
      calls.push(sql.replace(/\s+/g, " "));
      const step = steps[index];
      if (index < steps.length) index += 1;
      if (step && "rows" in step) return step;
      return { rows: step ? [{ ...step }] : [] };
    },
    calls,
  } as never;
}

const membership = { workspace_id: "workspace-a" };
const personalProject = { id: "p1" };
const acmeSlugRow = { id: "p1", slug: "acme" };
const encrypted = (value: string) => {
  const payload = encryptSecret(value);
  return { encrypted_data_key_json: JSON.stringify(payload.encryptedDataKey), encrypted_secret_json: JSON.stringify(payload.secretCiphertext), algorithm: payload.algorithm };
};

describe("ACCX environment variable resolution", () => {
  it("resolves plaintext values by project slug and environment label", () => {
    const service = db(membership, personalProject, acmeSlugRow, { id: "env-production", project_id: "p1" }, { rows: [{ key: "API_URL", ...encrypted("https://api.acme.dev") }, { key: "GEMINI_KEY", ...encrypted("sk-live") }] }) as typeof db & { calls: string[] };
    const out = resolveEnvironmentVariables(service as never, { userId: "user-1", patId: "pat-1", project: "acme", environment: "production" });
    expect(out).toEqual([{ key: "API_URL", value: "https://api.acme.dev" }, { key: "GEMINI_KEY", value: "sk-live" }]);
  });

  it("reflects a key subset filter into the lookup", () => {
    const service = db(membership, personalProject, acmeSlugRow, { id: "env-production", project_id: "p1" }, { rows: [] }) as typeof db & { calls: string[] };
    resolveEnvironmentVariables(service as never, { userId: "user-1", patId: "pat-1", project: "acme", environment: "production", keys: ["GEMINI_KEY"] });
    expect(service.calls.some(call => call.includes("AND key IN (?) ORDER"))).toBe(true);
  });

  it("rejects an unknown project", () => {
    const service = db(membership, personalProject, null) as typeof db & { calls: string[] };
    expect(() => resolveEnvironmentVariables(service as never, { userId: "user-1", patId: "pat-1", project: "missing", environment: "production" })).toThrow("NOT_FOUND");
  });

  it("mints the resolve route behind an env.read PAT with rate limiting", () => {
    const routes = source("api/v1/app.ts");
    expect(routes).toContain("resolve_environment_variables: resolve");
    expect(routes).toContain("resolve: resolve");
    const handler = source("server/v1/app/resolve.ts");
    expect(handler).toContain('["env.read"]');
    expect(handler).toContain("requirePersonalPat");
    expect(handler).toContain("assertFreshRequest");
  });
});