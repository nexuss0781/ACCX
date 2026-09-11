# accx-cli

Non-interactive ACCX control-plane CLI. Manages projects and environments over the
same PAT protocol the web console uses. Pure Node (>=18), zero dependencies,
JSON on stdout, errors on stderr, exit codes 0 / 1 / 2.

## Install / run

```bash
# run directly (no install)
node packages/cli/accx.mjs --help

# or install globally
npm i -g packages/cli
accx projects list
```

## Auth

The token needs `project.manage` scope (mint one in the web console under
**API Keys**).

```bash
export ACCX_PAT=accx_pat_...
# optional custom base URL (default https://accx-app.vercel.app)
export ACCX_BASE_URL=https://accx-app.vercel.app
```

## Commands

```bash
# projects
accx projects list
accx projects create --name my-app [--slug my-app]
accx projects rename my-app --name "My App 2"
accx projects delete my-app --yes

# environments (id, slug, or name accepted as the project selector)
accx environments list --project my-app
accx environments add    --project <id|slug|name> --name staging
accx environments remove --project <id|slug|name> --name staging --yes
```

Environment labels are fixed to `development | staging | production`. Destructive
operations require `--yes`. Pass `--token`/`--base-url` to override env vars per call.