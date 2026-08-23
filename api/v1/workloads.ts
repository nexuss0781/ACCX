import type { ApiRequest, ApiResponse } from "../../server/_lib/http.js";
import { dispatch } from "../../server/api/dispatch.js";
import workloads from "../../server/v1/workloads/index.js";
import metadata from "../../server/v1/metadata/secrets.js";
import jobs from "../../server/v1/jobs/index.js";
import jobStatus from "../../server/v1/jobs/status.js";

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  await dispatch(req, res, {
    create_identity: workloads,
    provision_token: workloads,
    revoke_identity: workloads,
    list_secret_metadata: metadata,
    submit_job: jobs,
    job_status: jobStatus,
  });
}
