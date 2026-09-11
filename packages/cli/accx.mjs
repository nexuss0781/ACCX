#!/usr/bin/env node
import { randomUUID } from 'node:crypto';

const DEFAULT_BASE_URL = 'https://accx-app.vercel.app';
const ENV_LABELS = ['development', 'staging', 'production'];

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function usage() {
  process.stdout.write(`ACCX Control-Plane CLI

Usage: accx <command> [args] [options]

Environment:
  ACCX_PAT       personal access token (required)                   
  ACCX_BASE_URL  API base URL (default: ${DEFAULT_BASE_URL})

Projects:
  accx projects list                                   List projects (JSON)
  accx projects create --name <n> [--slug <s>]         Create a project
  accx projects rename <id> --name <n>                 Rename a project
  accx projects delete <id> --yes                      Delete a project

Environments:
  accx environments list --project <id|slug>           List environments of a project
  accx environments add --project <id> --name <label>  Add an environment
  accx environments remove --project <id> --name <label> --yes  Remove an environment

Global options:
  --token <pat>   token to use instead of ACCX_PAT
  --base-url <u>  API base URL instead of ACCX_BASE_URL
  --json          machine-readable JSON output (default)
`);
}

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        const key = arg.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
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

function requireFlag(flags, name, label) {
  if (!flags[name]) fail(`Missing required --${name} ${label}`, 2);
  return flags[name];
}

function validateLabel(label) {
  if (!ENV_LABELS.includes(label)) fail(`Invalid environment label "${label}". Must be one of: ${ENV_LABELS.join(', ')}`, 2);
  return label;
}

async function main() {
  const { commands, flags } = parseCommand(process.argv.slice(2));
  if (commands[0] === 'help' || commands[0] === undefined) return usage();
  const token = flags.token || process.env.ACCX_PAT;
  if (!token) fail('No personal access token. Set ACCX_PAT or pass --token.', 2);
  const baseUrl = (flags['base-url'] || process.env.ACCX_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const client = new ApiClient(baseUrl, token);

  switch (commands[0]) {
    case 'projects': return runProjects(client, commands, flags);
    case 'environments': return runEnvironments(client, commands, flags);
    default: fail(`Unknown command "${commands[0]}".`, 2);
  }
}

function parseCommand(argv) {
  const { flags, positional } = parseArgs(argv);
  return { flags, commands: positional };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveProjectId(client, idOrSlug) {
  if (UUID_RE.test(idOrSlug)) return idOrSlug;
  const payload = await client.api('list_projects', { operation: 'list' });
  const match = payload.projects.find(p => p.slug === idOrSlug || p.name === idOrSlug);
  if (!match) fail(`Project "${idOrSlug}" not found.`, 1);
  return match.id;
}

async function runProjects(client, commands, flags) {
  const action = commands[1];
  if (!action) fail('Missing projects action: list | create | rename | delete', 2);
  if (action === 'list') {
    return client.api('list_projects', { operation: 'list' }).then(payload => print(payload.projects));
  }
  if (action === 'create') {
    const name = requireFlag(flags, 'name', '<n>');
    return client.api('create_project', { operation: 'create', name: name, slug: flags.slug }).then(payload => print(payload.project));
  }
  if (action === 'rename') {
    const idOrSlug = commands[2];
    const name = requireFlag(flags, 'name', '<n>');
    if (!idOrSlug) fail('Usage: accx projects rename <id|slug> --name <n>', 2);
    const projectId = await resolveProjectId(client, idOrSlug);
    return client.api('rename_project', { operation: 'rename', projectId, name }).then(() => print({ ok: true, projectId, name }));
  }
  if (action === 'delete') {
    const idOrSlug = commands[2];
    if (!idOrSlug) fail('Usage: accx projects delete <id|slug> --yes', 2);
    if (flags.yes !== true) fail('Refusing to delete without --yes', 2);
    const projectId = await resolveProjectId(client, idOrSlug);
    return client.api('delete_project', { operation: 'delete', projectId }).then(() => print({ ok: true, projectId }));
  }
  fail(`Unknown projects action "${action}".`, 2);
}

async function runEnvironments(client, commands, flags) {
  const action = commands[1];
  if (!action) fail('Missing environments action: list | add | remove', 2);
  if (action === 'list') {
    const project = requireFlag(flags, 'project', '<id|slug>');
    const payload = await client.api('list_projects', { operation: 'list' });
    const match = payload.projects.find(p => p.id === project || p.slug === project || p.name === project);
    if (!match) fail(`Project "${project}" not found.`, 1);
    return print({ project: { id: match.id, name: match.name, slug: match.slug }, environments: match.environments });
  }
  if (action === 'add') {
    const projectId = await resolveProjectId(client, requireFlag(flags, 'project', '<id|slug>'));
    const label = validateLabel(requireFlag(flags, 'name', '<label>'));
    return client.api('add_environment', { operation: 'add_environment', projectId, label }).then(() => print({ ok: true, projectId, environment: label }));
  }
  if (action === 'remove') {
    const projectId = await resolveProjectId(client, requireFlag(flags, 'project', '<id|slug>'));
    const label = validateLabel(requireFlag(flags, 'name', '<label>'));
    if (flags.yes !== true) fail('Refusing to remove without --yes', 2);
    return client.api('remove_environment', { operation: 'remove_environment', projectId, label }).then(() => print({ ok: true, projectId, environment: label }));
  }
  fail(`Unknown environments action "${action}".`, 2);
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

class ApiClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async api(command, body) {
    const response = await fetch(`${this.baseUrl}/api/v1/app`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
        Origin: this.baseUrl,
        'X-ACCX-Request-Timestamp': String(Date.now()),
        'X-ACCX-Request-Nonce': randomUUID().replace(/-/g, ''),
      },
      body: JSON.stringify({ command, ...body }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) fail(payload.error || `Request failed with status ${response.status}`, 1);
    return payload;
  }
}

main().catch(error => fail(error instanceof Error ? error.message : String(error)));