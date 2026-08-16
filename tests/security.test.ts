import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret, redactAuditMetadata } from "../api/_lib/security.js";
import { executeQueuedJob } from "../api/_lib/executor.js";
import { isLeaseActive, requiredScopesForAction } from "../api/_lib/orchestrator.js";
import { assertScopes } from "../api/_lib/vault.js";
import { ZERO_PLAINTEXT_INVARIANT, jobSubmissionSchema } from "../shared/contracts.js";

process.env.ACCX_VAULT_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");

describe("ACCX zero-plaintext boundary", () => {
  it("envelope-encrypts secret material without serializing the original value", () => {
    const fixture = "do-not-expose-social-password";
    const encrypted = encryptSecret(fixture);
    expect(JSON.stringify(encrypted)).not.toContain(fixture);
    expect(decryptSecret(encrypted)).toBe(fixture);
  });

  it("redacts secret-shaped audit fields", () => {
    expect(redactAuditMetadata({ action: "provider.publish", token: "value", password: "value", outcome: "accepted" })).toEqual({ action: "provider.publish", outcome: "accepted" });
  });

  it("uses immutable server action policies and rejects expired or revoked leases", () => {
    expect(requiredScopesForAction("provider.publish")).toEqual(["job.execute", "provider.publish"]);
    expect(() => requiredScopesForAction("client.supplied.permission")).toThrow(/unsupported_action/i);
    expect(isLeaseActive({ expiresAt: "2030-01-01T00:01:00.000Z", revokedAt: null, secretStatus: "active" }, Date.parse("2030-01-01T00:00:00.000Z"))).toBe(true);
    expect(isLeaseActive({ expiresAt: "2029-12-31T23:59:00.000Z", revokedAt: null, secretStatus: "active" }, Date.parse("2030-01-01T00:00:00.000Z"))).toBe(false);
    expect(isLeaseActive({ expiresAt: "2030-01-01T00:01:00.000Z", revokedAt: "2030-01-01T00:00:00.000Z", secretStatus: "active" }, Date.parse("2030-01-01T00:00:00.000Z"))).toBe(false);
  });

  it("enforces workspace scopes on the server-side data path", () => {
    const allowDb = { execute: () => ({ rows: [{ scopes_json: JSON.stringify(["metadata.read", "job.execute"]) }] }) };
    const denyDb = { execute: () => ({ rows: [{ scopes_json: JSON.stringify(["metadata.read"]) }] }) };
    expect(() => assertScopes(allowDb as never, "workspace", "worker", ["job.execute"])).not.toThrow();
    expect(() => assertScopes(denyDb as never, "workspace", "worker", ["provider.publish"])).toThrow(/forbidden/i);
  });

  it("keeps job contracts reference-only and omits a raw secret field", () => {
    const job = jobSubmissionSchema.parse({ action: "provider.publish", secretReferences: ["social.twitter.primary"], requiredScopes: ["job.execute", "provider.publish"], input: { contentId: "post-1" }, idempotencyKey: "b5e70a5e-16bb-4dcb-bd23-4a7fbef488d2" });
    expect(JSON.stringify(job)).not.toMatch(/password|plaintext|credential/i);
    expect(ZERO_PLAINTEXT_INVARIANT).toMatch(/never be serialized/i);
  });

  it("does not expose plaintext-resolution methods from either SDK source", () => {
    const js = readFileSync(new URL("../packages/sdk-js/src/index.ts", import.meta.url), "utf8");
    const python = readFileSync(new URL("../packages/sdk-python/accx/client.py", import.meta.url), "utf8");
    expect(`${js}\n${python}`).not.toMatch(/resolvePlaintext|resolveRawSecret|getPassword|copySecret/i);
  });

  it("fails an unregistered provider action without querying an encrypted secret version", async () => {
    const execute = vi.fn((sql: string) => {
      if (sql.includes("FROM orchestration_jobs")) {
        return { rows: [{ id: "job-1", action: "provider.unsupported", status: "queued", service_identity_id: "identity-1", project_id: "project-1", workspace_id: "workspace-1", input_json: "{}" }] };
      }
      return { rows: [] };
    });
    const result = await executeQueuedJob({ execute } as never, "job-1");
    expect(result).toEqual({ jobId: "job-1", status: "failed", message: "No trusted provider adapter is registered for this action." });
    expect(execute.mock.calls.some(([sql]) => String(sql).includes("encrypted_data_key_json"))).toBe(false);
  });
});
