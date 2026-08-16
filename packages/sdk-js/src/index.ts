import {
  jobSubmissionSchema,
  sanitizedJobResultSchema,
  secretMetadataSchema,
  type JobSubmission,
  type SanitizedJobResult,
  type SecretMetadata,
} from "./contracts.js";

export * from "./contracts.js";

export type AccxClientOptions = {
  baseUrl: string;
  workloadToken: string;
  fetch?: typeof globalThis.fetch;
  maxRetries?: number;
  retryBaseMs?: number;
  timeoutMs?: number;
};

export class AccxError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  constructor(status: number, message = "ACCX request was rejected.") {
    super(message);
    this.name = "AccxError";
    this.status = status;
    this.retryable = status === 0 || status === 408 || status === 429 || status >= 500;
  }
}

/** Redacts secret-shaped logging values without attempting to inspect credential contents. */
export function redactAccxValue(value: unknown): unknown {
  if (typeof value === "string") return "[redacted]";
  if (Array.isArray(value)) return value.map(redactAccxValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      /password|secret|token|credential|authorization|cookie|key/i.test(key) ? "[redacted]" : redactAccxValue(item),
    ]),
  );
}

/**
 * Server-side ACCX SDK. It sends stable secret references to ACCX and never
 * offers plaintext credential retrieval, clipboard, export, or browser storage APIs.
 */
export class AccxClient {
  private readonly fetcher: typeof globalThis.fetch;
  private readonly baseUrl: string;
  private readonly workloadToken: string;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly timeoutMs: number;
  private readonly metadataCache = new Map<string, { expiresAt: number; value: SecretMetadata }>();

  constructor(options: AccxClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.workloadToken = options.workloadToken;
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.maxRetries = Math.min(Math.max(options.maxRetries ?? 2, 0), 5);
    this.retryBaseMs = Math.min(Math.max(options.retryBaseMs ?? 250, 50), 5_000);
    this.timeoutMs = Math.min(Math.max(options.timeoutMs ?? 15_000, 1_000), 60_000);
  }

  async submitAction(job: JobSubmission): Promise<SanitizedJobResult> {
    const response = await this.request(`${this.baseUrl}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-ACCX-Workload-Token": this.workloadToken },
      body: JSON.stringify(jobSubmissionSchema.parse(job)),
    });
    return this.parseResponse(response);
  }

  async getJobStatus(jobId: string): Promise<SanitizedJobResult> {
    const response = await this.request(`${this.baseUrl}/api/v1/jobs/status?jobId=${encodeURIComponent(jobId)}`, {
      headers: { "X-ACCX-Workload-Token": this.workloadToken },
    });
    return this.parseResponse(response);
  }

  async getSecretMetadata(reference: string, options: { maxAgeMs?: number } = {}): Promise<SecretMetadata> {
    const maxAgeMs = Math.min(Math.max(options.maxAgeMs ?? 30_000, 0), 300_000);
    const cached = this.metadataCache.get(reference);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const response = await this.request(`${this.baseUrl}/api/v1/metadata/secrets`, { headers: { "X-ACCX-Workload-Token": this.workloadToken } });
    const payload = await response.json() as { secrets?: unknown };
    const secrets = Array.isArray(payload.secrets) ? payload.secrets.map(item => secretMetadataSchema.parse(item)) : [];
    for (const secret of secrets) this.metadataCache.set(secret.reference, { value: secret, expiresAt: Date.now() + maxAgeMs });
    const secret = this.metadataCache.get(reference)?.value;
    if (!secret) throw new AccxError(404, "ACCX secret metadata was not found.");
    return secret;
  }

  clearMetadataCache(): void { this.metadataCache.clear(); }

  private async request(url: string, init: RequestInit): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetcher(url, { ...init, signal: controller.signal });
        if (response.ok || !(response.status === 408 || response.status === 429 || response.status >= 500) || attempt === this.maxRetries) return response;
        lastError = new AccxError(response.status);
      } catch (error) {
        lastError = error;
        if (attempt === this.maxRetries) throw new AccxError(0, "ACCX network request failed.");
      } finally { clearTimeout(timeout); }
      await new Promise(resolve => setTimeout(resolve, this.retryBaseMs * (2 ** attempt) + Math.floor(Math.random() * 100)));
    }
    throw lastError instanceof Error ? lastError : new AccxError(0, "ACCX network request failed.");
  }

  private async parseResponse(response: Response): Promise<SanitizedJobResult> {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new AccxError(response.status, payload.error && response.status < 500 ? payload.error : "ACCX request was rejected.");
    return sanitizedJobResultSchema.parse(payload);
  }
}

export const ZERO_PLAINTEXT_SDK_GUARANTEE =
  "ACCX SDK methods accept references and return only sanitized job results; they never resolve raw credential values." as const;
