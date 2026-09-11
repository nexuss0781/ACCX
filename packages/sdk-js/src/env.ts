import { AccxError } from "./index.js";

export type AccxEnvironment = "development" | "staging" | "production";
export type AccxUrlRef = { project: string; environment: AccxEnvironment; key: string };

const ACCX_URL = /^accx:\/\/([a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?)\/(development|staging|production):([A-Za-z_][A-Za-z0-9_]{0,127})$/;
const ACCX_RAW_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

function freshnessHeaders(): Record<string, string> {
  const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
  return { "x-accx-request-timestamp": String(Date.now()), "x-accx-request-nonce": nonce };
}

export class EnvLoader {
  private readonly fetcher: typeof globalThis.fetch;
  private readonly baseUrl: string;
  private readonly personalToken: string;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly timeoutMs: number;

  constructor(options: { baseUrl: string; personalToken: string; fetch?: typeof globalThis.fetch; maxRetries?: number; retryBaseMs?: number; timeoutMs?: number }) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.personalToken = options.personalToken;
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.maxRetries = Math.min(Math.max(options.maxRetries ?? 2, 0), 5);
    this.retryBaseMs = Math.min(Math.max(options.retryBaseMs ?? 250, 50), 5_000);
    this.timeoutMs = Math.min(Math.max(options.timeoutMs ?? 15_000, 1_000), 60_000);
  }

  parseAccxUrl(value: string): AccxUrlRef | null {
    const match = ACCX_URL.exec(value);
    if (!match) return null;
    return { project: match[1], environment: match[2] as AccxEnvironment, key: match[3] };
  }

  async resolve(project: string, environment: AccxEnvironment, keys?: string[]): Promise<Record<string, string>> {
    const response = await this.request(this.baseUrl + "/api/v1/app", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.personalToken}`, ...freshnessHeaders() },
      body: JSON.stringify({ command: "resolve", operation: "resolve", project, environment, keys }),
    });
    const payload = await this.parseResponse(response);
    const variables = Array.isArray(payload.variables) ? payload.variables as { key: string; value: string }[] : [];
    return Object.fromEntries(variables.map(variable => [variable.key, variable.value]));
  }

  async load(input: { local?: Record<string, string>; accx?: string } = {}): Promise<Record<string, string>> {
    const result: Record<string, string> = { ...input.local };
    if (!input.accx) return result;
    const byRef = new Map<string, { envKey: string; ref: AccxUrlRef }[]>();
    for (const raw of input.accx.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const equals = line.indexOf("=");
      if (equals <= 0) continue;
      const envKey = line.slice(0, equals).trim();
      const value = line.slice(equals + 1).trim();
      if (!envKey) continue;
      const ref = this.parseAccxUrl(value);
      if (!ref) {
        if (!(envKey in result)) result[envKey] = value;
        continue;
      }
      const bucket = `${ref.project}/${ref.environment}`;
      const entries = byRef.get(bucket) ?? [];
      entries.push({ envKey, ref });
      byRef.set(bucket, entries);
    }
    for (const [bucket, entries] of byRef) {
      const keys = [...new Set(entries.map(entry => entry.ref.key))].filter(key => ACCX_RAW_KEY_PATTERN.test(key));
      if (keys.length > 128) throw new AccxError(400, "Too many distinct ACCX keys in one environment resolution.");
      const { project, environment } = entries[0]!.ref;
      const resolved = await this.resolve(project, environment, keys);
      for (const entry of entries) {
        if (entry.envKey in result) continue;
        const value = resolved[entry.ref.key];
        if (value === undefined) throw new AccxError(404, `ACCX key ${entry.ref.key} was not found in ${bucket}.`);
        result[entry.envKey] = value;
      }
    }
    return result;
  }

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

  private async parseResponse(response: Response): Promise<Record<string, unknown>> {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new AccxError(response.status, payload.error && response.status < 500 ? payload.error : "ACCX request was rejected.");
    return payload;
  }
}