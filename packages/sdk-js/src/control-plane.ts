import { AccxError } from "./errors.js";
import { environmentSchema, type EnvironmentLabel } from "./contracts.js";

export type CloudProject = { id: string; name: string; slug: string; createdAt: string; environments: EnvironmentLabel[] };
export type CloudEnvVar = { key: string; projectId: string; projectName: string; environmentId: string; environment: EnvironmentLabel; updatedAt: string | null; createdBy: string };
export type ControlPlaneClientOptions = {
  baseUrl: string;
  personalAccessToken: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
};

const PROJECT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Personal-access-token control-plane client. Creates, lists, renames, and
 * deletes projects and environments over the same protocol the web console uses.
 */
export class ControlPlaneClient {
  private readonly fetcher: typeof globalThis.fetch;
  private readonly baseUrl: string;
  private readonly personalAccessToken: string;
  private readonly timeoutMs: number;

  constructor(options: ControlPlaneClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.personalAccessToken = options.personalAccessToken;
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.timeoutMs = Math.min(Math.max(options.timeoutMs ?? 15_000, 1_000), 60_000);
  }

  async listProjects(): Promise<CloudProject[]> {
    const payload = await this.request<{ projects?: unknown }>("list_projects", { operation: "list" });
    return Array.isArray(payload.projects) ? (payload.projects as CloudProject[]) : [];
  }

  async createProject(name: string, slug?: string): Promise<CloudProject> {
    const payload = await this.request<{ project?: CloudProject }>("create_project", { operation: "create", name, slug });
    if (!payload.project) throw new AccxError(502, "ACCX create_project returned no project.");
    return payload.project;
  }

  async renameProject(project: string, name: string): Promise<void> {
    const projectId = await this.resolveProjectId(project);
    await this.request<{ renamed?: boolean }>("rename_project", { operation: "rename", projectId, name });
  }

  async deleteProject(project: string): Promise<void> {
    const projectId = await this.resolveProjectId(project);
    await this.request<{ deleted?: boolean }>("delete_project", { operation: "delete", projectId });
  }

  async listEnvironments(project: string): Promise<{ project: CloudProject; environments: EnvironmentLabel[] }> {
    const target = await this.resolveProject(project);
    return { project: target, environments: target.environments };
  }

  async addEnvironment(project: string, label: EnvironmentLabel): Promise<void> {
    const projectId = await this.resolveProjectId(project);
    await this.request<{ added?: boolean }>("add_environment", { operation: "add_environment", projectId, label });
  }

  async removeEnvironment(project: string, label: EnvironmentLabel): Promise<void> {
    const projectId = await this.resolveProjectId(project);
    await this.request<{ removed?: boolean }>("remove_environment", { operation: "remove_environment", projectId, label });
  }

  /**
   * Greps environment variables across every project in the workspace.
   * A query matches variable keys or project names (case-insensitive substring).
   * Results are metadata only — values never leave ACCX.
   */
  async searchVariables(query?: string): Promise<CloudEnvVar[]> {
    const payload = await this.request<{ variables?: unknown }>("list_environment_variables", {
      operation: "list",
      ...(query && query.trim().length > 0 ? { query: query.trim() } : {}),
    });
    return Array.isArray(payload.variables) ? (payload.variables as CloudEnvVar[]) : [];
  }

  /** Resolves a project selector (UUID, slug, or name) to its full record. */
  async resolveProject(selector: string): Promise<CloudProject> {
    const projects = await this.listProjects();
    const match = projects.find(p => p.id === selector || p.slug === selector || p.name === selector);
    if (!match) throw new AccxError(404, `Project "${selector}" was not found.`);
    return match;
  }

  /** Resolves a project selector (UUID, slug, or name) to its id. */
  async resolveProjectId(selector: string): Promise<string> {
    if (PROJECT_UUID_RE.test(selector)) return selector;
    return (await this.resolveProject(selector)).id;
  }

  private async request<T>(command: string, body: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(`${this.baseUrl}/api/v1/app`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.personalAccessToken}`,
          Origin: this.baseUrl,
          "X-ACCX-Request-Timestamp": String(Date.now()),
          "X-ACCX-Request-Nonce": crypto.randomUUID().replace(/-/g, ""),
        },
        body: JSON.stringify({ command, ...body }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = (payload as { error?: unknown }).error;
        throw new AccxError(response.status, typeof message === "string" ? message : "ACCX control-plane request was rejected.");
      }
      return payload as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export { environmentSchema };