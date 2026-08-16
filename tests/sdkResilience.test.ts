import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AccxClient, AccxError, redactAccxValue } from "../packages/sdk-js/src/index.js";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const metadata = { id: "a1111111-1111-4111-8111-111111111111", provider: "github", displayName: "Production token", reference: "github.production.token", environment: "production", status: "active", activeVersion: 2, rotationState: "stable", expiresAt: null, lastUsedAt: null, fieldKind: "api_token", tags: ["production"], aliases: [], healthStatus: "healthy", lastRotatedAt: null, deletedAt: null, purgeAfter: null };

describe("ACCX SDK resilience and zero-plaintext surfaces", () => {
  it("retries transient metadata responses and caches sanitized metadata by reference", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return calls === 1 ? new Response(JSON.stringify({ error: "busy" }), { status: 503 }) : new Response(JSON.stringify({ secrets: [metadata] }), { status: 200 });
    };
    const client = new AccxClient({ baseUrl: "https://accx.example", workloadToken: "server-only", fetch: fetcher as never, retryBaseMs: 1, maxRetries: 1 });
    await expect(client.getSecretMetadata("github.production.token")).resolves.toMatchObject({ reference: "github.production.token" });
    await client.getSecretMetadata("github.production.token");
    expect(calls).toBe(2);
  });

  it("emits typed sanitized transport errors and redacts secret-shaped keys", async () => {
    const client = new AccxClient({ baseUrl: "https://accx.example", workloadToken: "server-only", fetch: async () => new Response("", { status: 403 }), maxRetries: 0 });
    await expect(client.getJobStatus("a1111111-1111-4111-8111-111111111111")).rejects.toBeInstanceOf(AccxError);
    expect(redactAccxValue({ token: "value", label: "visible" })).toEqual({ token: "[redacted]", label: "[redacted]" });
  });

  it("keeps browser and Python SDK surfaces restricted to metadata and sanitized orchestration results", () => {
    const browser = source("packages/sdk-js/src/browser.ts");
    const python = source("packages/sdk-python/accx/client.py");
    expect(browser).toContain("AccxBrowserMetadataClient");
    expect(browser).not.toContain("workloadToken");
    expect(python).toContain("class AsyncAccxClient");
    expect(python).toContain("class AccxClient");
    expect(source("packages/sdk-python/accx/integrations.py")).toContain("fastapi_client_dependency");
    expect(`${browser}\n${python}`).not.toMatch(/resolvePlaintext|resolveRawSecret|getPassword|copySecret/i);
  });
});
