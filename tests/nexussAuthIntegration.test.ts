import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Nexuss Auth integration", () => {
  it("keeps the integration on the consolidated auth function and callback rewrite", () => {
    const auth = source("api/v1/auth.ts");
    const vercel = source("vercel.json");
    expect(auth).toContain("nexuss_start");
    expect(auth).toContain("nexuss_callback");
    expect(auth).toContain("nexuss_token_login");
    expect(auth).toContain("nexuss_link");
    expect(vercel).toContain("/auth/nexuss/callback");
    expect(vercel).toContain("/api/v1/auth?command=nexuss_callback");
  });

  it("uses one-time browser-bound state and upstream server handoff", () => {
    const nexuss = source("server/v1/auth/nexuss.ts");
    expect(nexuss).toContain("nexuss_oauth_states");
    expect(nexuss).toContain("binding_hash");
    expect(nexuss).toContain("consumed_at");
    expect(nexuss).toContain("/v1/handoff/exchange");
    expect(nexuss).toContain("projectId: config.projectId");
    expect(nexuss).toContain("handoffToken: token");
    expect(nexuss).toContain("redirect: \"error\"");
  });

  it("maps stable issuer and subject instead of trusting email as the identity key", () => {
    const schema = source("server/_lib/schema.ts");
    const nexuss = source("server/v1/auth/nexuss.ts");
    expect(schema).toContain("UNIQUE(issuer, subject)");
    expect(nexuss).toContain("identityIssuer(config.authUrl)");
    expect(nexuss).toContain("WHERE issuer = ? AND subject = ?");
    expect(nexuss).toContain("NEXUSS_LINK_REQUIRED");
  });

  it("keeps Nexuss API keys on an explicit validation boundary", () => {
    const nexuss = source("server/v1/auth/nexuss.ts");
    expect(nexuss).toContain("/^nxa_[A-Za-z0-9_-]{20,160}$/");
    expect(nexuss).toContain("authorization: `Bearer ${token}`");
    expect(nexuss).toContain("/v1/me?project_id=");
    expect(nexuss).not.toContain("INSERT INTO workload_tokens");
  });

  it("does not expose raw-password fields in the normal public auth pages", () => {
    const login = source("src/pages/LoginPage.tsx");
    const register = source("src/pages/RegisterPage.tsx");
    for (const page of [login, register]) {
      expect(page).toContain("nexussStart");
      expect(page).toContain("Continue with GitHub");
      expect(page).toContain("Continue with Google");
      expect(page).not.toContain("type=\"password\"");
      expect(page).not.toContain("accxApi.login");
      expect(page).not.toContain("accxApi.register");
    }
  });
});
