import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { sendJson } from "../_lib/http.js";

export type RouteHandler = (req: ApiRequest, res: ApiResponse) => void | Promise<void>;

type Body = Record<string, unknown>;

function asRecord(value: unknown): Body | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Body : null;
}

export function commandFrom(req: ApiRequest): string {
  const body = asRecord(req.body);
  const bodyCommand = typeof body?.command === "string" ? body.command : "";
  const queryCommand = Array.isArray(req.query?.command) ? req.query?.command[0] : req.query?.command;
  return bodyCommand || (typeof queryCommand === "string" ? queryCommand : "");
}

function withoutCommand(req: ApiRequest): ApiRequest {
  const body = asRecord(req.body);
  const query = req.query ? { ...req.query } : undefined;
  if (body) {
    const { command: _command, ...payload } = body;
    req.body = payload;
  }
  if (query) {
    delete query.command;
    req.query = query;
  }
  return req;
}

export async function dispatch(req: ApiRequest, res: ApiResponse, handlers: Record<string, RouteHandler>): Promise<void> {
  const command = commandFrom(req);
  const handler = handlers[command];
  if (!handler) {
    sendJson(res, 400, { error: "A valid command is required" });
    return;
  }
  await handler(withoutCommand(req), res);
}
