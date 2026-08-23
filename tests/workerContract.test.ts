import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("dedicated worker deployment contract", () => {
  it("keeps the standalone worker limited to dispatch credentials and sanitized output", () => {
    const worker = source("worker/accx-worker.mjs");
    expect(worker).toContain("ACCX_CONTROL_PLANE_URL");
    expect(worker).toContain("ACCX_WORKER_KEY");
    expect(worker).not.toContain("ACCX_VAULT_MASTER_KEY");
    expect(worker).not.toContain("PARADOX_API_KEY");
    expect(worker).not.toContain("ACCX_ADMIN_KEY");
    expect(worker).not.toContain("ACCX_WORKLOAD_TOKEN");
    expect(worker).toContain("/api/v1/worker");
    expect(worker).not.toMatch(/console\.log\(.*workerKey/);
  });

  it("uses a server-side queue claim before attempting an adapter and documents one-shot deployment", () => {
    const executor = source("server/_lib/executor.ts");
    const dispatch = source("server/v1/internal/dispatch.ts");
    const guide = source("docs/worker-deployment.md");
    expect(executor).toContain("status = 'running', claimed_by");
    expect(executor).toContain("status = 'queued'");
    expect(dispatch).toContain("authorizeWorker(req)");
    expect(dispatch).toContain("LIMIT ?");
    expect(guide).toContain("one-shot worker");
    expect(guide).toContain("atomically changes `queued` jobs to `running`");
  });
});
