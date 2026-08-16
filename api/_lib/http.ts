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

export function apiError(res: ApiResponse, error: unknown): void {
  const message = error instanceof Error ? error.message : "Request failed";
  const status = message === "UNAUTHORIZED" ? 401 : 500;
  sendJson(res, status, { error: status === 401 ? "Unauthorized" : "Internal server error" });
}
