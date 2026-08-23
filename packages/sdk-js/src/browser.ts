import { secretMetadataSchema, type SecretMetadata } from "./contracts.js";

/** Restricted browser surface: metadata only, same-origin cookies only, no workload token or plaintext methods. */
export class AccxBrowserMetadataClient {
  async listMetadata(): Promise<SecretMetadata[]> {
    const response = await fetch("/api/v1/app/bootstrap", { credentials: "same-origin", headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({})) as { secrets?: unknown };
    if (!response.ok) throw new Error("ACCX metadata request was rejected.");
    return Array.isArray(payload.secrets) ? payload.secrets.map(item => secretMetadataSchema.parse(item)) : [];
  }
}
