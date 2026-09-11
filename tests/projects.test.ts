import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { addEnvironment, createProject, deleteProject, listProjects, renameProject, removeEnvironment } from "../server/_lib/projects.js";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

function db(...steps: (Record<string, unknown> | { rows?: Record<string, unknown>[] })[]) {
  let index = 0;
  const calls: string[] = [];
  return {
    execute(sql: string, _params: unknown[]) {
      calls.push(sql.replace(/\s+/g, " "));
      const step = steps[index];
      if (index < steps.length) index += 1;
      if (step && "rows" in step) return step;
      return { rows: step ? [{ ...step }] : [] };
    },
    calls,
  } as never;
}

const membership = { workspace_id: "workspace-a" };
const primaryProject = { id: "primary-project" };

describe("ACCX project and environment management", () => {
  it("creates a project with the three default environments and a derived slug", () => {
    const createDb = db(membership, primaryProject, null, null, null, null, null, null) as unknown as { calls: string[] };
    const service = createDb as typeof createDb & ReturnType<typeof db>;
    const project = createProject(service, { userId: "user-1", name: "My AI App" });
    expect(project.slug).toBe("my-ai-app");
    expect(project.environments).toEqual(["development", "staging", "production"]);
    const envInserts = service.calls.filter(sql => sql.includes("INSERT INTO environments"));
    expect(envInserts).toHaveLength(3);
    expect(service.calls.some(sql => sql.includes("INSERT INTO projects"))).toBe(true);
  });

  it("lists projects in the actor's personal workspace", () => {
    const listDb = db(membership, primaryProject, null);
    expect(listProjects(listDb as never, "user-1")).toEqual([]);
  });

  it("renames a project owned by the actor's workspace", () => {
    const renameDb = db(membership, primaryProject, { id: "p1", name: "Old", slug: "old", created_at: "2026-01-01T00:00:00.000Z" }) as unknown as { calls: string[] };
    renameProject(renameDb as never, { userId: "user-1", projectId: "p1", name: "New name" });
    expect((renameDb as unknown as { calls: string[] }).calls.some(sql => sql.includes("UPDATE projects SET name"))).toBe(true);

    const missingDb = db(membership, primaryProject, null) as unknown as { calls: string[] };
    expect(() => renameProject(missingDb as never, { userId: "user-1", projectId: "p2", name: "x" })).toThrow("NOT_FOUND");
  });

  it("refuses to delete a project that still holds secrets or environment variables", () => {
    const withSecrets = db(membership, primaryProject, { id: "p1", name: "A", slug: "a", created_at: "x" }, { id: "s1" });
    expect(() => deleteProject(withSecrets as never, { userId: "user-1", projectId: "p1" })).toThrow("CONFLICT");

    const withVars = db(membership, primaryProject, { id: "p1", name: "A", slug: "a", created_at: "x" }, null, { id: "v1" });
    expect(() => deleteProject(withVars as never, { userId: "user-1", projectId: "p1" })).toThrow("CONFLICT");

    const clean = db(membership, primaryProject, { id: "p1", name: "A", slug: "a", created_at: "x" }, null, null) as unknown as { calls: string[] };
    deleteProject(clean as never, { userId: "user-1", projectId: "p1" });
    expect(clean.calls.some(sql => sql.includes("DELETE FROM projects"))).toBe(true);
  });

  it("adds and removes environments while scrubbing their variables", () => {
    const addDb = db(membership, primaryProject, { id: "p1", name: "A", slug: "a", created_at: "x" }, null) as unknown as { calls: string[] };
    addEnvironment(addDb as never, { userId: "user-1", projectId: "p1", label: "staging" });
    expect(addDb.calls.some(sql => sql.includes("INSERT INTO environments"))).toBe(true);

    const duplicate = db(membership, primaryProject, { id: "p1", name: "A", slug: "a", created_at: "x" }, { id: "env" });
    expect(() => addEnvironment(duplicate as never, { userId: "user-1", projectId: "p1", label: "production" })).toThrow("CONFLICT");

    const removeDb = db(membership, primaryProject, { id: "p1", name: "A", slug: "a", created_at: "x" }, { id: "env-1" }, null) as unknown as { calls: string[] };
    removeEnvironment(removeDb as never, { userId: "user-1", projectId: "p1", label: "development" });
    const calls = removeDb.calls;
    expect(calls.some(sql => sql.includes("DELETE FROM environment_variables"))).toBe(true);
    expect(calls.some(sql => sql.includes("DELETE FROM environments"))).toBe(true);
  });

  it("canonicalizes project and environment routes", () => {
    const routes = source("api/v1/app.ts");
    expect(routes).toContain("list_projects: projects");
    expect(routes).toContain("create_project: projects");
    expect(routes).toContain("rename_project: projects");
    expect(routes).toContain("delete_project: projects");
    expect(routes).toContain("add_environment: projects");
    expect(routes).toContain("remove_environment: projects");
  });
});