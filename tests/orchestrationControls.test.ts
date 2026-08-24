import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { actionExecutionPolicy, requiredScopesForAction } from "../server/_lib/orchestrator.js";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("ACCX orchestration controls", () => {
  it("keeps action scope, approval, timeout, and egress policy immutable on the server", () => {
    expect(requiredScopesForAction("provider.publish")).toEqual(["job.execute", "provider.publish"]);
    expect(actionExecutionPolicy("provider.publish")).toEqual({ approvalRequired: true, timeoutMs: 30_000, egressClass: "provider" });
    expect(actionExecutionPolicy("provider.health_check")).toEqual({ approvalRequired: false, timeoutMs: 10_000, egressClass: "health" });
    expect(() => actionExecutionPolicy("unregistered.action")).toThrow("UNSUPPORTED_ACTION");
  });

  it("creates approval state before high-impact publishing jobs can reach workers", () => {
    const sourceCode = source("server/_lib/orchestrator.ts");
    expect(sourceCode).toContain("status = executionPolicy.approvalRequired ? \"awaiting_approval\" : \"queued\"");
    expect(sourceCode).toContain("INSERT INTO job_approvals");
    expect(sourceCode).toContain("? \"job.approval_requested\" : \"job.submitted\"");
    expect(source("server/v1/internal/dispatch.ts")).toContain("WHERE status = 'queued'");
  });

  it("requires step-up authorization and mutation integrity before approval resolution", () => {
    const route = source("server/v1/app/jobs/approval.ts");
    expect(route).toContain("requireStepUp(db, req)");
    expect(route).toContain("assertFreshMutation");
    expect(route).toContain("resolveJobApproval");
  });

  it("registers a safe in-control-plane adapter for provider health checks", () => {
    const executor = source("server/_lib/executor.ts");
    expect(executor).toContain('adapters.set("provider.health_check"');
    expect(executor).toContain("Trusted provider lease health check completed.");
  });

  it("passes a cancellation signal to providers and never writes raw provider results to audits", () => {
    const executor = source("server/_lib/executor.ts");
    expect(executor).toContain("new AbortController()");
    expect(executor).toContain("signal: controller.signal");
    expect(executor).toContain("PROVIDER_TIMEOUT");
    expect(executor).toContain("health_status = 'healthy'");
    expect(executor).toContain("health_status = 'failed'");
    expect(executor).not.toMatch(/metadata:\s*\{[^}]*result/i);
  });

  it("requires HTTPS and server-owned egress allowlists for reusable HTTP provider adapters", () => {
    const adapter = source("server/_lib/providerAdapter.ts");
    expect(adapter).toContain("target.protocol !== \"https:\"");
    expect(adapter).toContain("origins.has(target.origin)");
    expect(adapter).toContain("redirect: \"error\"");
    expect(adapter).not.toContain("response.text()");
  });
});
