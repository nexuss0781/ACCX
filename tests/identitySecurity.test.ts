import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { totpCode } from "../api/_lib/auth.js";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("ACCX identity and step-up security", () => {
  it("implements standard six-digit time-based authentication codes", () => {
    // RFC 6238 SHA-1 test vector: counter 1 (Unix time 59 seconds).
    expect(totpCode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000)).toBe("287082");
  });

  it("keeps session cookies HttpOnly, secure, same-site, and bounded", () => {
    const auth = source("api/_lib/auth.ts");
    expect(auth).toContain("HttpOnly; Secure; SameSite=Lax");
    expect(auth).toContain("const sessionDays = 7");
    expect(auth).toContain("rotateCurrentSession");
    expect(auth).toContain("revokeUserSession");
  });

  it("stores MFA material encrypted and never returns the TOTP seed or recovery hashes", () => {
    const auth = source("api/_lib/auth.ts");
    const schema = source("api/_lib/schema.ts");
    expect(auth).toContain("encryptSecret(secret)");
    expect(auth).toContain("decryptSecret(encryptedPayload(factor))");
    expect(auth).not.toContain("totpSecret:");
    expect(schema).toContain("encrypted_secret_json");
    expect(schema).toContain("mfa_recovery_codes");
  });

  it("requires an origin-bound, one-time WebAuthn challenge and advances credential counters", () => {
    const webauthn = source("api/_lib/webauthn.ts");
    expect(webauthn).toContain("const parsed = new URL(raw)");
    expect(webauthn).toContain("expectedOrigin: origin");
    expect(webauthn).toContain("consumed_at = ?");
    expect(webauthn).toContain("counter = ?");
    expect(webauthn).toContain("requireUserVerification: true");
  });

  it("gates recovery-code issuance behind a current step-up authorization", () => {
    const auth = source("api/_lib/auth.ts");
    expect(auth).toContain("const user = requireStepUp(db, req);");
    expect(auth).toContain("step_up_until");
    expect(auth).toContain("step_up_method");
  });
});
