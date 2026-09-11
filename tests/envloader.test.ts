import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AccxError, EnvLoader } from "../packages/sdk-js/src/index.js";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

function mockFetch(body: unknown, status = 200) {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body), headers: new Headers(), clone: () => ({}) }) as unknown as Response;
}

function captureFetch(responseBody: unknown, status = 200) {
  let capturedUrl: string | undefined;
  let capturedInit: RequestInit | undefined;
  const fetch = async (url: string, init: RequestInit) => {
    capturedUrl = url;
    capturedInit = init;
    return mockFetch(responseBody, status)(url, init);
  };
  return { fetch: fetch as unknown as typeof fetch, get url() { return capturedUrl; }, get init() { return capturedInit; } };
}

describe("ACCX JS EnvLoader", () => {
  const loader = new EnvLoader({ baseUrl: "https://api.accx.dev", personalToken: "accx_pat_test123", fetch: mockFetch({ variables: [] }) });

  it("parses a valid accx URL reference", () => {
    expect(loader.parseAccxUrl("accx://acme/production:GEMINI_KEY")).toEqual({ project: "acme", environment: "production", key: "GEMINI_KEY" });
    expect(loader.parseAccxUrl("accx://my-org/staging:DB_PASS")).toEqual({ project: "my-org", environment: "staging", key: "DB_PASS" });
    expect(loader.parseAccxUrl("accx://x/development:K")).toEqual({ project: "x", environment: "development", key: "K" });
  });

  it("rejects malformed URL references", () => {
    expect(loader.parseAccxUrl("https://acme.com/api")).toBeNull();
    expect(loader.parseAccxUrl("accx://acme/unknown:K")).toBeNull();
    expect(loader.parseAccxUrl("accx://UPPER/production:K")).toBeNull();
    expect(loader.parseAccxUrl("accx://a/bad:K")).toBeNull();
    expect(loader.parseAccxUrl("GEMINI_KEY=sk-abc")).toBeNull();
  });

  it("sends the personal token in the Authorization header and posts to /api/v1/app", async () => {
    const capture = captureFetch({ variables: [{ key: "API_URL", value: "https://acme.dev" }] });
    const service = new EnvLoader({ baseUrl: "https://api.accx.dev", personalToken: "accx_pat_tok123", fetch: capture.fetch, maxRetries: 0 });
    const result = await service.resolve("acme", "production", ["API_URL"]);
    expect(capture.url).toBe("https://api.accx.dev/api/v1/app");
    const init = capture.init!;
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer accx_pat_tok123");
    expect(init.body).toContain('"operation":"resolve"');
    expect(init.body).toContain('"project":"acme"');
    expect(result).toEqual({ API_URL: "https://acme.dev" });
  });

  it("throws AccxError on fetch failure or non-2xx response", async () => {
    const service = new EnvLoader({ baseUrl: "https://api.accx.dev", personalToken: "accx_pat_test123", fetch: mockFetch({ error: "Not found" }, 404), maxRetries: 0 });
    await expect(service.resolve("acme", "production")).rejects.toThrow(AccxError);
    await expect(service.resolve("acme", "production")).rejects.toMatchObject({ status: 404 });
  });

  it("merges local and accx lines with local values taking precedence", async () => {
    const capture = captureFetch({ variables: [{ key: "GEMINI_KEY", value: "sk-live" }, { key: "DB_HOST", value: "db.acme.dev" }] });
    const service = new EnvLoader({ baseUrl: "https://api.accx.dev", personalToken: "accx_pat_test123", fetch: capture.fetch, maxRetries: 0 });
    const out = await service.load({
      local: { API_URL: "http://localhost:3000", GEMINI_KEY: "local-wins" },
      accx: "API_URL=http://localhost:3000\nGEMINI_KEY=accx://acme/production:GEMINI_KEY\nDB_HOST=accx://acme/production:DB_HOST",
    });
    expect(out.API_URL).toBe("http://localhost:3000");
    expect(out.GEMINI_KEY).toBe("local-wins");
    expect(out.DB_HOST).toBe("db.acme.dev");
  });

  it("returns local-only map when no accx lines are present", async () => {
    const out = await loader.load({ local: { X: "1" }, accx: "# no refs here\n" });
    expect(out).toEqual({ X: "1" });
  });
});

describe("ACCX Python env module", () => {
  it("exports the EnvLoader twin in the package __init__", () => {
    const init = source("packages/sdk-python/accx/__init__.py");
    expect(init).toContain("EnvLoader");
    expect(init).toContain("from .env import EnvLoader");
  });

  it("includes the URL parser, resolver and loader methods", () => {
    const env = source("packages/sdk-python/accx/env.py");
    expect(env).toContain("ACCX_URL_RE");
    expect(env).toContain("parse_accx_url");
    expect(env).toContain("def resolve");
    expect(env).toContain("def load");
    expect(env).toContain("Bearer");
  });
});