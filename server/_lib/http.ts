import type { IncomingMessage, ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "./env.js";

export type ApiRequest = IncomingMessage & { query?: Record<string, string | string[] | undefined>; body?: unknown };
export type ApiResponse = ServerResponse & { status: (code: number) => ApiResponse; json: (body: unknown) => void };

export function sendJson(res: ApiResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export function authorizeAdmin(req: ApiRequest): void {
  const presented = req.headers["x-accx-admin-key"];
  const candidate = Array.isArray(presented) ? presented[0] : presented;
  if (!candidate) throw new Error("UNAUTHORIZED");
  const expected = Buffer.from(serverEnv.adminKey());
  const received = Buffer.from(candidate);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error("UNAUTHORIZED");
}

export function authorizeWorker(req: ApiRequest): void {
  const presented = req.headers["x-accx-worker-key"];
  const candidate = Array.isArray(presented) ? presented[0] : presented;
  if (!candidate) throw new Error("UNAUTHORIZED");
  const expected = Buffer.from(serverEnv.workerKey());
  const received = Buffer.from(candidate);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error("UNAUTHORIZED");
}

export function apiError(res: ApiResponse, error: unknown): void {
  const message = error instanceof Error ? error.message : "Request failed";
  const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" || message === "STEP_UP_REQUIRED" ? 403 : message === "CONFLICT" || message === "PARADOX_CONFLICT" || message === "REPLAYED_REQUEST" ? 409 : message === "RATE_LIMITED" ? 429 : message === "STALE_REQUEST" ? 400 : 500;
  const errorText = status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : status === 409 ? "Request conflicts with existing control-plane state." : status === 429 ? "Too many requests." : status === 400 ? "Request expired or invalid." : "Internal server error";
  sendJson(res, status, { error: errorText });
}
