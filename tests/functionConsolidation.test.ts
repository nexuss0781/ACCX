import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

function apiEntrypoints(): string[] {
  return readdirSync(resolve(process.cwd(), "api"), { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(ts|js)$/.test(entry.name))
    .map(entry => entry.parentPath ? `${entry.parentPath}/${entry.name}` : entry.name)
    .map(path => path.replace(`${resolve(process.cwd(), "api")}/`, "api/"))
    .sort();
}

describe("ACCX function consolidation", () => {
  it("keeps the Vercel entrypoint count below the Hobby threshold", () => {
    expect(apiEntrypoints()).toEqual([
      "api/health.ts",
      "api/v1/admin.ts",
      "api/v1/app.ts",
      "api/v1/auth.ts",
      "api/v1/worker.ts",
      "api/v1/workloads.ts",
    ]);
  });

  it("keeps the major capability subcommands wired to the original handlers", () => {
    const auth = source("api/v1/auth.ts");
    const app = source("api/v1/app.ts");
    const admin = source("api/v1/admin.ts");
    const workloads = source("api/v1/workloads.ts");
    const worker = source("api/v1/worker.ts");

    for (const command of ["register", "login", "session", "step_up", "totp_start", "passkey_register_options"]) expect(auth).toContain(command);
    for (const command of ["bootstrap", "create_secret_metadata", "update_secret_metadata", "revoke_secret", "export_vault", "import_vault"]) expect(app).toContain(command);
    for (const command of ["bootstrap_control_plane", "activate_secret_version", "list_audit_events"]) expect(admin).toContain(command);
    for (const command of ["create_identity", "provision_token", "list_secret_metadata", "submit_job", "job_status"]) expect(workloads).toContain(command);
    for (const command of ["dispatch_jobs", "execute_job"]) expect(worker).toContain(command);
  });
});
