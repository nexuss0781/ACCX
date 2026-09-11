#!/usr/bin/env node
import { ControlPlaneClient } from "./control-plane.js";
import { environmentSchema, type EnvironmentLabel } from "./contracts.js";

const DEFAULT_BASE_URL = "https://accx-app.vercel.app";
const ENV_LABELS = environmentSchema.options;

function fail(message: string, code = 1): never {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function usage(): void {
  process.stdout.write(`ACCX SDK CLI

Usage: accx <command> [args] [options]

Environment:
  ACCX_PAT       personal access token (required)                   
  ACCX_BASE_URL  API base URL (default: ${DEFAULT_BASE_URL})

Projects:
  accx projects list                                   List projects (JSON)
  accx projects create --name <n> [--slug <s>]         Create a project
  accx projects rename <id|slug|name> --name <n>       Rename a project
  accx projects delete <id|slug|name> --yes            Delete a project

Environments:
  accx environments list --project <id|slug|name>      List environments of a project
  accx environments add --project <id> --name <label>  Add an environment
  accx environments remove --project <id> --name <label> --yes  Remove an environment

Variables (search across ALL projects):
  accx variables list                      List every variable (metadata only)
  accx variables list --query <q>          Filter by key or project name (grep)
  accx variables search <q>                Grep variables across projects by key

Global options:
  --token <pat>   token to use instead of ACCX_PAT
  --base-url <u>  API base URL instead of ACCX_BASE_URL
`);
}

type Parsed = { flags: Record<string, string | boolean>; positional: string[] };

function parseArgs(argv: string[]): Parsed {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        const key = arg.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags[key] = next;
          i += 1;
        } else {
          flags[key] = true;
        }
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

function requireFlag(flags: Record<string, string | boolean>, name: string, label: string): string {
  const value = flags[name];
  if (typeof value !== "string" || value.length === 0) fail(`Missing required --${name} ${label}`, 2);
  return value;
}

function labelFlag(flags: Record<string, string | boolean>): EnvironmentLabel {
  const label = requireFlag(flags, "name", "<label>");
  if (!ENV_LABELS.includes(label as EnvironmentLabel)) fail(`Invalid environment label "${label}". Must be one of: ${ENV_LABELS.join(", ")}`, 2);
  return label as EnvironmentLabel;
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main(): Promise<void> {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const command = positional[0];
  if (command === "help" || command === undefined) return usage();

  const token = typeof flags.token === "string" ? flags.token : process.env.ACCX_PAT;
  if (!token) fail("No personal access token. Set ACCX_PAT or pass --token.", 2);
  const baseUrl = ((typeof flags["base-url"] === "string" ? flags["base-url"] : process.env.ACCX_BASE_URL) || DEFAULT_BASE_URL).replace(/\/$/, "");
  const client = new ControlPlaneClient({ baseUrl, personalAccessToken: token });

  if (command === "projects") return runProjects(client, positional, flags);
  if (command === "environments") return runEnvironments(client, positional, flags);
  if (command === "variables") return runVariables(client, positional, flags);
  fail(`Unknown command "${command}".`, 2);
}

async function runProjects(client: ControlPlaneClient, positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  const action = positional[1];
  if (!action) fail("Missing projects action: list | create | rename | delete", 2);
  if (action === "list") return print(await client.listProjects());
  if (action === "create") {
    const name = requireFlag(flags, "name", "<n>");
    const slug = typeof flags.slug === "string" && flags.slug.length > 0 ? flags.slug : undefined;
    return print(await client.createProject(name, slug));
  }
  if (action === "rename") {
    const project = positional[2];
    if (!project) fail("Usage: accx projects rename <id|slug|name> --name <n>", 2);
    const name = requireFlag(flags, "name", "<n>");
    await client.renameProject(project, name);
    return print({ ok: true, project, name });
  }
  if (action === "delete") {
    const project = positional[2];
    if (!project) fail("Usage: accx projects delete <id|slug|name> --yes", 2);
    if (flags.yes !== true) fail("Refusing to delete without --yes", 2);
    await client.deleteProject(project);
    return print({ ok: true, project });
  }
  fail(`Unknown projects action "${action}".`, 2);
}

async function runEnvironments(client: ControlPlaneClient, positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  const action = positional[1];
  if (!action) fail("Missing environments action: list | add | remove", 2);
  if (action === "list") return print(await client.listEnvironments(requireFlag(flags, "project", "<id|slug|name>")));
  if (action === "add") {
    const projectId = requireFlag(flags, "project", "<id|slug|name>");
    const label = labelFlag(flags);
    await client.addEnvironment(projectId, label);
    return print({ ok: true, projectId, environment: label });
  }
  if (action === "remove") {
    const projectId = requireFlag(flags, "project", "<id|slug|name>");
    const label = labelFlag(flags);
    if (flags.yes !== true) fail("Refusing to remove without --yes", 2);
    await client.removeEnvironment(projectId, label);
    return print({ ok: true, projectId, environment: label });
  }
  fail(`Unknown environments action "${action}".`, 2);
}

async function runVariables(client: ControlPlaneClient, positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  const action = positional[1];
  const query = typeof flags.query === "string" && flags.query.trim().length > 0 ? flags.query.trim() : positional[2];
  if (action === "list") return print(await client.searchVariables(query));
  if (action === "search") {
    if (!query) fail("Usage: accx variables search <query>", 2);
    return print(await client.searchVariables(query));
  }
  if (!action) fail("Missing variables action: list | search", 2);
  fail(`Unknown variables action "${action}".`, 2);
}

main().catch(error => fail(error instanceof Error ? error.message : String(error)));