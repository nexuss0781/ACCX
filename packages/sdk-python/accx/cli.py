"""Non-interactive ACCX control-plane CLI. Projects, environments, and variable search."""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

from .control_plane import ControlPlaneClient
from .errors import AccxError

DEFAULT_BASE_URL = "https://accx-app.vercel.app"
_VALID_LABELS = ("development", "staging", "production")


def _client(args: argparse.Namespace) -> ControlPlaneClient:
    base_url = args.base_url or DEFAULT_BASE_URL
    token = args.token or os.environ.get("ACCX_PAT", "")
    if not token:
        sys.stderr.write("No personal access token. Set ACCX_PAT or pass --token.\n")
        sys.exit(2)
    return ControlPlaneClient(base_url=base_url, personal_access_token=token)


def _print(value: Any) -> None:
    json.dump(value, sys.stdout, indent=2)
    sys.stdout.write("\n")


# ── projects ───────────────────────────────────────────────────────────────

def _projects_list(args: argparse.Namespace) -> None:
    _print(_client(args).list_projects())


def _projects_create(args: argparse.Namespace) -> None:
    _print(_client(args).create_project(args.name, slug=args.slug))


def _projects_rename(args: argparse.Namespace) -> None:
    _client(args).rename_project(args.project, args.name)
    _print({"ok": True, "project": args.project, "name": args.name})


def _projects_delete(args: argparse.Namespace) -> None:
    _client(args).delete_project(args.project)
    _print({"ok": True, "project": args.project})


# ── environments ───────────────────────────────────────────────────────────

def _envs_list(args: argparse.Namespace) -> None:
    _print(_client(args).list_environments(args.project))


def _envs_add(args: argparse.Namespace) -> None:
    _client(args).add_environment(args.project, args.label)
    _print({"ok": True, "project": args.project, "environment": args.label})


def _envs_remove(args: argparse.Namespace) -> None:
    _client(args).remove_environment(args.project, args.label)
    _print({"ok": True, "project": args.project, "environment": args.label})


# ── variables ─────────────────────────────────────────────────────────────

def _vars_list(args: argparse.Namespace) -> None:
    _print(_client(args).list_variables())


def _vars_search(args: argparse.Namespace) -> None:
    _print(_client(args).search_variables(args.query or ""))


# ── parser ─────────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="accx", description="ACCX SDK CLI")
    parser.add_argument("--token", help="Personal access token (overrides ACCX_PAT)")
    parser.add_argument("--base-url", help=f"API base URL (default: {DEFAULT_BASE_URL})")
    sub = parser.add_subparsers(dest="command")

    proj = sub.add_parser("projects", help="Project management")
    ps = proj.add_subparsers(dest="action")
    ps.add_parser("list", help="List projects")
    cr = ps.add_parser("create", help="Create a project")
    cr.add_argument("--name", required=True, help="Project name")
    cr.add_argument("--slug", help="Optional project slug")
    rn = ps.add_parser("rename", help="Rename a project")
    rn.add_argument("project", help="Project id, slug, or name")
    rn.add_argument("--name", required=True, help="New name")
    dl = ps.add_parser("delete", help="Delete a project")
    dl.add_argument("project", help="Project id, slug, or name")
    dl.add_argument("--yes", action="store_true", help="Confirm deletion")

    env = sub.add_parser("environments", help="Environment management")
    es = env.add_subparsers(dest="action")
    ls = es.add_parser("list", help="List environments for a project")
    ls.add_argument("--project", required=True, help="Project id, slug, or name")
    add_p = es.add_parser("add", help="Add an environment")
    add_p.add_argument("--project", required=True, help="Project id, slug, or name")
    add_p.add_argument("--label", required=True, choices=_VALID_LABELS, help="Environment label")
    rm = es.add_parser("remove", help="Remove an environment")
    rm.add_argument("--project", required=True, help="Project id, slug, or name")
    rm.add_argument("--label", required=True, choices=_VALID_LABELS, help="Environment label")
    rm.add_argument("--yes", action="store_true", help="Confirm removal")

    vars_cmd = sub.add_parser("variables", help="Variable search across projects")
    vs = vars_cmd.add_subparsers(dest="action")
    vsl = vs.add_parser("list", help="List every variable (metadata only, no values)")
    vsl.add_argument("--query", help="Filter by key or project name (grep)")
    vss = vs.add_parser("search", help="Grep variables across projects by key")
    vss.add_argument("query", help="Substring to search for")

    return parser


_ACTIONS: dict[str, dict[str, Any]] = {
    "projects.list": {"fn": _projects_list},
    "projects.create": {"fn": _projects_create},
    "projects.rename": {"fn": _projects_rename},
    "projects.delete": {"fn": _projects_delete, "confirm": "yes"},
    "environments.list": {"fn": _envs_list},
    "environments.add": {"fn": _envs_add},
    "environments.remove": {"fn": _envs_remove, "confirm": "yes"},
    "variables.list": {"fn": _vars_list},
    "variables.search": {"fn": _vars_search},
}


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return

    action_key = f"{args.command}.{args.action}"
    spec = _ACTIONS.get(action_key)
    if spec is None or args.action is None:
        parser.parse_args([args.command, "--help"])
        return

    if "confirm" in spec and not getattr(args, spec["confirm"], False):
        sys.stderr.write(f"Refusing to perform without --{spec['confirm']}\n")
        sys.exit(2)

    try:
        spec["fn"](args)
    except AccxError as error:
        sys.stderr.write(f"{error}\n")
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(130)


if __name__ == "__main__":
    main()