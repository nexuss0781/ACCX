import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../api/_lib/auth.js";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("frontend metadata-only boundary", () => {
  it("does not retain credential reveal, clipboard, sample-account, or browser credential-store behavior", () => {
    const frontend = ["src/pages/AccountsPage.tsx", "src/store/index.ts", "src/types/index.ts"].map(source).join("\n");
    expect(frontend).not.toContain("navigator.clipboard");
    expect(frontend).not.toContain("account.password");
    expect(frontend).not.toContain("defaultAccounts");
    expect(frontend).not.toContain("accx-users");
    expect(frontend).not.toContain("accx-store");
  });

  it("uses non-reversible password verification for human session authentication", () => {
    const stored = hashPassword("a high entropy test passphrase");
    expect(stored).not.toContain("a high entropy test passphrase");
    expect(verifyPassword("a high entropy test passphrase", stored)).toBe(true);
    expect(verifyPassword("incorrect passphrase", stored)).toBe(false);
  });
});
