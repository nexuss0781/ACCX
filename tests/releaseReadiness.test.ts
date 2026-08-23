import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("ACCX release-readiness contract", () => {
  it("keeps authenticated metadata, session, and worker routes present", () => {
    expect(source("server/v1/auth/session.ts")).toContain("sessionUser");
    expect(source("server/v1/app/bootstrap.ts")).toContain("requireSession");
    expect(source("server/v1/app/secrets.ts")).toContain("registerSecretMetadata");
    expect(source("server/v1/internal/dispatch.ts")).toContain("authorizeWorker");
    expect(source("server/v1/internal/execute.ts")).toContain("authorizeWorker");
  });

  it("keeps release documentation explicit about non-public secret boundaries", () => {
    const guide = source("docs/release-readiness.md");
    expect(guide).toContain("server-only");
    expect(guide).toContain("never be placed in `VITE_*`");
    expect(guide).toContain("Publishing remains a separate human-controlled action");
    expect(source("packages/sdk-js/package.json")).toContain("publishConfig");
    expect(source("packages/sdk-python/pyproject.toml")).toContain("readme = \"README.md\"");
  });
});
