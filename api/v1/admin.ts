import type { ApiRequest, ApiResponse } from "../../server/_lib/http.js";
import { dispatch } from "../../server/api/dispatch.js";
import bootstrap from "../../server/v1/bootstrap.js";
import secrets from "../../server/v1/secrets/index.js";
import activate from "../../server/v1/secrets/activate.js";
import revoke from "../../server/v1/secrets/revoke.js";
import audit from "../../server/v1/audit/index.js";

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  await dispatch(req, res, {
    bootstrap_control_plane: bootstrap,
    list_secret_metadata: secrets,
    create_secret_metadata: secrets,
    activate_secret_version: activate,
    revoke_secret: revoke,
    list_audit_events: audit,
  });
}
