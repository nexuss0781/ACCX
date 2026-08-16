import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("ACCX security automation and runbooks", () => {
  it("keeps CI verification, dependency audit, secret scanning, code scanning, and artifact checks enabled", () => {
    const workflow = source(".github/workflows/security.yml");
    expect(workflow).toContain("pnpm audit --audit-level high");
    expect(workflow).toContain("gitleaks/gitleaks-action");
    expect(workflow).toContain("github/codeql-action");
    expect(workflow).toContain("pnpm --dir packages/sdk-js pack --dry-run");
    expect(workflow).toContain("python -m build --wheel");
  });

  it("keeps dependency updates and required security operations documented without embedding live credentials", () => {
    expect(source(".github/dependabot.yml")).toContain("package-ecosystem: npm");
    const documents = ["docs/threat-model.md", "docs/incident-response.md", "docs/backup-recovery.md", "docs/monitoring.md"].map(source).join("\n");
    expect(documents).toContain("master key");
    expect(documents).toContain("ciphertext-only");
    expect(documents).not.toMatch(/pk_[A-Za-z0-9]{12,}|ACCX_VAULT_MASTER_KEY\s*=\s*[^\s]/);
  });
});
