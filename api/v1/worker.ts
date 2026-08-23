import type { ApiRequest, ApiResponse } from "../../server/_lib/http.js";
import { dispatch } from "../../server/api/dispatch.js";
import dispatchJobs from "../../server/v1/internal/dispatch.js";
import executeJob from "../../server/v1/internal/execute.js";

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  await dispatch(req, res, {
    dispatch_jobs: dispatchJobs,
    execute_job: executeJob,
  });
}
