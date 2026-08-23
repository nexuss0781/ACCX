import type { ApiRequest, ApiResponse } from "./_lib/http.js";
import { sendJson } from "./_lib/http.js";

export default function handler(_req: ApiRequest, res: ApiResponse): void {
  sendJson(res, 200, { service: "accx", status: "ok", runtime: "vercel-serverless" });
}
