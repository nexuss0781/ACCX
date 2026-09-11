import type { ApiRequest, ApiResponse } from "../../server/_lib/http.js";
import { dispatch } from "../../server/api/dispatch.js";
import bootstrap from "../../server/v1/app/bootstrap.js";
import approval from "../../server/v1/app/jobs/approval.js";
import secrets from "../../server/v1/app/secrets.js";
import lifecycle from "../../server/v1/app/secrets/lifecycle.js";
import vaultExport from "../../server/v1/app/vault/export.js";
import vaultImport from "../../server/v1/app/vault/import.js";
import audit from "../../server/v1/audit/index.js";
import keys from "../../server/v1/app/keys.js";
import projects from "../../server/v1/app/projects.js";
import environment from "../../server/v1/app/environment.js";
import resolve from "../../server/v1/app/resolve.js";

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  await dispatch(req, res, {
    bootstrap,
    create_secret_metadata: secrets,
    update_secret_metadata: lifecycle,
    soft_delete_secret: lifecycle,
    revoke_secret: lifecycle,
    purge_deleted_secrets: lifecycle,
    export_vault: vaultExport,
    import_vault: vaultImport,
    list_audit_events: audit,
    approve_job: approval,
    list_projects: projects,
    create_project: projects,
    rename_project: projects,
    delete_project: projects,
    add_environment: projects,
    remove_environment: projects,
    set_environment_variable: environment,
    delete_environment_variable: environment,
    list_environment_variables: environment,
    reveal_environment_variable: environment,
    resolve_environment_variables: resolve,
    resolve: resolve,
    create_pat: keys,
    list_pats: keys,
    revoke_pat: keys,
  });
}
