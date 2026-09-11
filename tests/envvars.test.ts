process.env.ACCX_VAULT_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { encryptSecret } from "../server/_lib/security.js";
import { deleteEnvironmentVariable, listEnvironmentVariables, revealEnvironmentVariable, setEnvironmentVariable } from "../server/_lib/envvars.js";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

type Call = { sql: string; params: unknown[] };
function db(...steps: (Record<string, unknown> | { rows?: Record<string, unknown>[] })[]) {
  let index = 0;
  const calls: Call[] = [];
  return {
    execute(sql: string, params: unknown[] = []) {
      calls.push({ sql: sql.replace(/\s+/g, " "), params });
      const step = steps[index];
      if (index < steps.length) index += 1;
      if (step && "rows" in step) return step;
      return { rows: step ? [{ ...step }] : [] };
    },
    calls,
  } as never;
}

const membership = { workspace_id: "workspace-a" };
const primaryProject = { id: "primary-project" };
const environmentRow = { id: "env-1", label: "production", project_id: "p1" };
const actor = { userId: "user-1", actorType: "service" as const, actorId: "pat-1" };

describe("ACCX environment variable write path", () => {
  it("stores values encrypted at rest with a hash, never plaintext", () => {
    const service = db(membership, primaryProject, environmentRow, null, null) as typeof db & { calls: Call[] };
    const out = setEnvironmentVariable(service as never, { ...actor, environmentId: "env-1", key: "GEMINI_KEY", value: "sk-super-secret" });
    expect(out.updated).toBe(false);
    const insert = service.calls.find(call => call.sql.includes("INSERT INTO environment_variables"));
    expect(insert).toBeTruthy();
    expect(insert!.params[2]).toBe("GEMINI_KEY");
    expect(String(insert!.params[5])).toContain("ciphertext");
    expect(String(insert!.params[5])).not.toContain("sk-super-secret");
    expect(String(insert!.params[3])).not.toContain("sk-super-secret");
  });

  it("updates in place when the variable already exists", () => {
    const service = db(membership, primaryProject, environmentRow, { id: "row-1" }) as typeof db & { calls: Call[] };
    const out = setEnvironmentVariable(service as never, { ...actor, environmentId: "env-1", key: "GEMINI_KEY", value: "sk-v2" });
    expect(out.updated).toBe(true);
    expect(service.calls.some(call => call.sql.includes("UPDATE environment_variables SET value_hash"))).toBe(true);
  });

  it("reveals the decrypted value held for a human actor", () => {
    const payload = encryptSecret("sk-live-value");
    const service = db(membership, primaryProject, environmentRow, { encrypted_data_key_json: JSON.stringify(payload.encryptedDataKey), encrypted_secret_json: JSON.stringify(payload.secretCiphertext), algorithm: payload.algorithm }) as typeof db & { calls: Call[] };
    const out = revealEnvironmentVariable(service as never, { ...actor, actorType: "human", actorId: "user-1", environmentId: "env-1", key: "GEMINI_KEY" });
    expect(out.value).toBe("sk-live-value");
  });

  it("rejects malformed variable names", () => {
    const service = db(membership, primaryProject) as typeof db & { calls: Call[] };
    expect(() => setEnvironmentVariable(service as never, { ...actor, environmentId: "env-1", key: "1BAD_START", value: "x" })).toThrow("REQUEST_INVALID");
  });

  it("deletes a variable scoped to its environment and key", () => {
    const service = db(membership, primaryProject, environmentRow, { id: "row-1" }, null) as typeof db & { calls: Call[] };
    deleteEnvironmentVariable(service as never, { ...actor, environmentId: "env-1", key: "GEMINI_KEY" });
    const del = service.calls.find(call => call.sql.includes("DELETE FROM environment_variables"));
    expect(del).toBeTruthy();
    expect(del!.params).toContain("row-1");
  });

  it("lists masked descriptors grouped by workspace project and environment", () => {
    const descriptors = { rows: [{ key: "API_URL", project_id: "p1", project_name: "Acme", environment_id: "env-1", environment: "production", updated_at: "2026-01-01T00:00:00.000Z", created_by_subject: "user-1" }] };
    const service = db(membership, primaryProject, descriptors) as typeof db & { calls: Call[] };
    const out = listEnvironmentVariables(service as never, "user-1");
    expect(out).toHaveLength(1);
    expect(Object.keys(out[0])).not.toContain("value");
    expect(out[0]).toEqual({ key: "API_URL", projectId: "p1", projectName: "Acme", environmentId: "env-1", environment: "production", updatedAt: "2026-01-01T00:00:00.000Z", createdBy: "user-1" });
  });

  it("claims the env variable routes", () => {
    const routes = source("api/v1/app.ts");
    expect(routes).toContain("set_environment_variable: environment");
    expect(routes).toContain("delete_environment_variable: environment");
    expect(routes).toContain("list_environment_variables: environment");
    expect(routes).toContain("reveal_environment_variable: environment");
    const schema = source("server/_lib/schema.ts");
    expect(schema).toContain("environment_variables");
    expect(schema).toContain("encrypted_secret_json");
  });
});