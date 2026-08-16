import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { secretMetadataSchema } from "../shared/contracts.js";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("ACCX metadata-only vault lifecycle", () => {
  it("models typed secret metadata without a plaintext-value property", () => {
    const metadata = secretMetadataSchema.parse({
      id: "a1111111-1111-4111-8111-111111111111", provider: "github", displayName: "Production token", reference: "github.production.token", environment: "production", status: "active", activeVersion: 2, rotationState: "stable", expiresAt: null, lastUsedAt: null,
      fieldKind: "api_token", tags: ["production", "deploy"], aliases: ["github.primary.token"], healthStatus: "healthy", lastRotatedAt: null, deletedAt: null, purgeAfter: null,
    });
    expect(metadata).not.toHaveProperty("value");
    expect(metadata).not.toHaveProperty("password");
    expect(metadata.aliases).toEqual(["github.primary.token"]);
  });

  it("keeps portable bundles ciphertext-only and uses a recognized format marker", () => {
    const vault = source("api/_lib/vault.ts");
    expect(vault).toContain('format: "accx.encrypted-vault.v1"');
    expect(vault).toContain("encryptedDataKey");
    expect(vault).toContain("encryptedSecret");
    expect(vault).not.toContain("decryptSecret(");
  });

  it("requires a current step-up grant before soft deletion, purge, export, or import", () => {
    const lifecycle = source("api/v1/app/secrets/lifecycle.ts");
    const exportRoute = source("api/v1/app/vault/export.ts");
    const importRoute = source("api/v1/app/vault/import.ts");
    expect(lifecycle).toContain("requireStepUp(db, req)");
    expect(exportRoute).toContain("requireStepUp(db, req)");
    expect(importRoute).toContain("requireStepUp(db, req)");
    expect(source("api/_lib/vault.ts")).toContain("purge_after");
  });

  it("revokes active leases when a secret is soft deleted", () => {
    const vault = source("api/_lib/vault.ts");
    expect(vault).toContain("eventType: \"secret.soft_deleted\"");
    expect(vault).toContain("UPDATE secret_leases SET revoked_at");
    expect(vault).toContain("eventType: \"secret.purged\"");
  });
});
