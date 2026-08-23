import type { TrustedProviderAdapter } from "./executor.js";

export type ProviderRequest = { url: string; method: "GET" | "POST"; headers?: Record<string, string>; body?: string };
export type ProviderAdapterTemplate = { allowedOrigins: readonly string[]; buildRequest: (input: { action: string; secret: string; input: Record<string, unknown> }) => ProviderRequest };

/**
 * Server-only provider adapter factory. The request builder belongs to reviewed server code;
 * untrusted job input never controls the destination host or determines audit output.
 */
export function createHttpProviderAdapter(template: ProviderAdapterTemplate): TrustedProviderAdapter {
  const origins = new Set(template.allowedOrigins);
  return async ({ action, secret, input, signal }) => {
    const request = template.buildRequest({ action, secret, input });
    const target = new URL(request.url);
    if (target.protocol !== "https:" || !origins.has(target.origin)) throw new Error("EGRESS_DENIED");
    const response = await fetch(target, { method: request.method, headers: request.headers, body: request.body, signal, redirect: "error", cache: "no-store" });
    if (!response.ok) throw new Error("PROVIDER_RESPONSE_REJECTED");
    return { message: `Trusted provider action completed with HTTP ${response.status}.` };
  };
}
