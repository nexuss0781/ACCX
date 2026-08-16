import {
  jobSubmissionSchema,
  sanitizedJobResultSchema,
  type JobSubmission,
  type SanitizedJobResult,
} from "./contracts.js";

export * from "./contracts.js";

export type AccxClientOptions = {
  baseUrl: string;
  workloadToken: string;
  fetch?: typeof globalThis.fetch;
};

/**
 * Server-side ACCX SDK. It sends stable secret references to ACCX and never
 * offers plaintext credential retrieval, clipboard, export, or browser storage APIs.
 */
export class AccxClient {
  private readonly fetcher: typeof globalThis.fetch;
  private readonly baseUrl: string;
  private readonly workloadToken: string;

  constructor(options: AccxClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.workloadToken = options.workloadToken;
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  async submitAction(job: JobSubmission): Promise<SanitizedJobResult> {
    const response = await this.fetcher(`${this.baseUrl}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-ACCX-Workload-Token": this.workloadToken },
      body: JSON.stringify(jobSubmissionSchema.parse(job)),
    });
    return this.parseResponse(response);
  }

  async getJobStatus(jobId: string): Promise<SanitizedJobResult> {
    const response = await this.fetcher(`${this.baseUrl}/api/v1/jobs/status?jobId=${encodeURIComponent(jobId)}`, {
      headers: { "X-ACCX-Workload-Token": this.workloadToken },
    });
    return this.parseResponse(response);
  }

  private async parseResponse(response: Response): Promise<SanitizedJobResult> {
    const payload = await response.json() as unknown;
    if (!response.ok) throw new Error("ACCX request was rejected.");
    return sanitizedJobResultSchema.parse(payload);
  }
}

export const ZERO_PLAINTEXT_SDK_GUARANTEE =
  "ACCX SDK methods accept references and return only sanitized job results; they never resolve raw credential values." as const;
