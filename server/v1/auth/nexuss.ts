import type { ParadConnection } from "parad";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { ApiRequest, ApiResponse } from "../../_lib/http.js";
import { sendJson } from "../../_lib/http.js";
import { serverEnv } from "../../_lib/env.js";
import { withControlPlaneDb } from "../../_lib/paradox.js";
import { bootstrapControlPlane } from "../../_lib/vault.js";
import { createUserSession, requireSession, sessionCookieHeader } from "../../_lib/auth.js";

const STATE_TTL_MS = 10 * 60_000;
const BINDING_COOKIE = "accx_nexuss_binding";
const identityIssuer = (authUrl: string) => authUrl.replace(/\/$/, "");
const now = () => new Date().toISOString();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const humanScopes = ["metadata.read", "secret.rotate", "provider.publish", "job.execute", "audit.read", "identity.manage"];

type Provider = "google" | "github";
type NexussUser = { id: string; email: string | null; name: string | null; avatarUrl?: string | null };
type IdentityResult = { user: { id: string; email: string; name: string; createdAt: string }; sessionToken: string };

type StateRow = {
  id: string;
  binding_hash: string;
  provider: Provider;
  redirect_uri: string;
  next_path: string;
  expires_at: string;
  consumed_at: string | null;
};

type Row = Record<string, unknown>;
function first<T extends Row>(result: { rows: Row[] }): T | null { return (result.rows[0] as T | undefined) ?? null; }
function header(req: ApiRequest, name: string): string | null {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
function queryValue(req: ApiRequest, name: string): string | null {
  const value = req.query?.[name];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
function bodyValue(req: ApiRequest, name: string): string | null {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body as Record<string, unknown> : {};
  return typeof body[name] === "string" ? body[name] as string : null;
}
function value(req: ApiRequest, name: string): string | null { return bodyValue(req, name) ?? queryValue(req, name); }
function validProvider(value: string | null): Provider | null { return value === "google" || value === "github" ? value : null; }
function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("\n") || value.includes("\r")) return "/";
  return value.length <= 240 ? value : "/";
}
function cookieValue(req: ApiRequest, name: string): string | null {
  const raw = header(req, "cookie") ?? "";
  const match = raw.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
function bindingCookieHeader(binding: string): string {
  return `${BINDING_COOKIE}=${encodeURIComponent(binding)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.ceil(STATE_TTL_MS / 1000)}`;
}
function clearBindingCookieHeader(): string {
  return `${BINDING_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
function configured(): NonNullable<ReturnType<typeof serverEnv.nexussAuth>> {
  const config = serverEnv.nexussAuth();
  if (!config) throw new Error("NEXUSS_AUTH_NOT_CONFIGURED");
  return config;
}
function errorResponse(res: ApiResponse, error: unknown): void {
  const message = error instanceof Error ? error.message : "";
  if (message === "NEXUSS_AUTH_NOT_CONFIGURED") return sendJson(res, 503, { error: "nexuss_auth_not_configured" });
  if (message === "NEXUSS_AUTH_CONFIGURATION_INVALID") return sendJson(res, 503, { error: "nexuss_auth_configuration_invalid" });
  if (message === "NEXUSS_AUTH_UNAUTHORIZED") return sendJson(res, 401, { error: "nexuss_auth_identity_unverified" });
  if (message === "NEXUSS_LINK_REQUIRED") return sendJson(res, 409, { error: "nexuss_auth_account_link_required" });
  if (message === "NEXUSS_STATE_INVALID") return sendJson(res, 400, { error: "nexuss_auth_state_invalid" });
  if (message === "NEXUSS_PROVIDER_INVALID") return sendJson(res, 400, { error: "nexuss_auth_provider_invalid" });
  sendJson(res, 500, { error: "nexuss_auth_failed" });
}
function validatedUser(value: unknown): NexussUser {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("NEXUSS_AUTH_UNAUTHORIZED");
  const candidate = value as Record<string, unknown>;
  const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
  if (!id || id.length > 200) throw new Error("NEXUSS_AUTH_UNAUTHORIZED");
  const email = candidate.email === null || candidate.email === undefined ? null : typeof candidate.email === "string" ? candidate.email.trim().toLowerCase().slice(0, 320) : null;
  const name = candidate.name === null || candidate.name === undefined ? null : typeof candidate.name === "string" ? candidate.name.trim().slice(0, 120) : null;
  const avatarUrl = candidate.avatarUrl === null || candidate.avatarUrl === undefined ? null : typeof candidate.avatarUrl === "string" ? candidate.avatarUrl.slice(0, 2_000) : null;
  return { id, email: email || null, name: name || null, avatarUrl };
}
function localUser(db: ParadConnection, userId: string): { id: string; email: string; name: string; createdAt: string } {
  const user = first<{ id: string; email: string; name: string; created_at: string }>(db.execute(`SELECT id, email, name, created_at FROM users WHERE id = ?`, [userId]));
  if (!user) throw new Error("NEXUSS_AUTH_UNAUTHORIZED");
  return { id: user.id, email: user.email, name: user.name, createdAt: user.created_at };
}
function newIdentityEmail(subject: string): string {
  return `nexuss-${hash(subject).slice(0, 32)}@identity.invalid`;
}
function ensureIdentity(db: ParadConnection, config: NonNullable<ReturnType<typeof serverEnv.nexussAuth>>, nexussUser: NexussUser, provider: string): { userId: string; created: boolean } {
  const issuer = identityIssuer(config.authUrl);
  const existingIdentity = first<{ user_id: string }>(db.execute(`SELECT user_id FROM external_identities WHERE issuer = ? AND subject = ?`, [issuer, nexussUser.id]));
  if (existingIdentity) {
    db.execute(`UPDATE external_identities SET last_seen_at = ?, email_at_link = ? WHERE issuer = ? AND subject = ?`, [now(), nexussUser.email, issuer, nexussUser.id]);
    return { userId: existingIdentity.user_id, created: false };
  }

  if (nexussUser.email) {
    const emailMatch = first<{ id: string }>(db.execute(`SELECT id FROM users WHERE email = ?`, [nexussUser.email]));
    if (emailMatch) throw new Error("NEXUSS_LINK_REQUIRED");
  }

  const userId = randomUUID();
  const email = nexussUser.email ?? newIdentityEmail(nexussUser.id);
  const name = nexussUser.name || nexussUser.email?.split("@")[0] || "Nexuss Auth user";
  const createdAt = now();
  db.execute(`INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)`, [userId, email, name, "!external-nexuss-auth", createdAt]);
  const controlPlane = bootstrapControlPlane(db, userId);
  db.execute(`INSERT OR IGNORE INTO workspace_members (id, workspace_id, subject_id, subject_type, scopes_json, created_at) VALUES (?, ?, ?, 'human', ?, ?)`, [randomUUID(), controlPlane.workspaceId, userId, JSON.stringify(humanScopes), createdAt]);
  db.execute(`INSERT INTO external_identities (id, user_id, issuer, subject, provider, email_at_link, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [randomUUID(), userId, issuer, nexussUser.id, provider, nexussUser.email, createdAt, createdAt]);
  return { userId, created: true };
}
function linkIdentity(db: ParadConnection, config: NonNullable<ReturnType<typeof serverEnv.nexussAuth>>, nexussUser: NexussUser, provider: string, userId: string): void {
  const issuer = identityIssuer(config.authUrl);
  const existing = first<{ user_id: string }>(db.execute(`SELECT user_id FROM external_identities WHERE issuer = ? AND subject = ?`, [issuer, nexussUser.id]));
  if (existing && existing.user_id !== userId) throw new Error("CONFLICT");
  if (!existing) {
    db.execute(`INSERT INTO external_identities (id, user_id, issuer, subject, provider, email_at_link, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [randomUUID(), userId, issuer, nexussUser.id, provider, nexussUser.email, now(), now()]);
  } else {
    db.execute(`UPDATE external_identities SET last_seen_at = ?, email_at_link = ? WHERE issuer = ? AND subject = ?`, [now(), nexussUser.email, issuer, nexussUser.id]);
  }
}
async function identityFromUpstream(config: NonNullable<ReturnType<typeof serverEnv.nexussAuth>>, token: string, handoff = false): Promise<NexussUser> {
  const endpoint = handoff ? `${config.authUrl}/v1/handoff/exchange` : `${config.authUrl}/v1/me?project_id=${encodeURIComponent(config.projectId)}`;
  const response = await fetch(endpoint, {
    method: handoff ? "POST" : "GET",
    headers: handoff ? { "content-type": "application/json", accept: "application/json" } : { accept: "application/json", authorization: `Bearer ${token}`, "x-nex-auth-project": config.projectId },
    body: handoff ? JSON.stringify({ projectId: config.projectId, handoffToken: token }) : undefined,
    redirect: "error",
  }).catch(() => { throw new Error("NEXUSS_AUTH_UNAUTHORIZED"); });
  if (!response.ok) throw new Error("NEXUSS_AUTH_UNAUTHORIZED");
  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("NEXUSS_AUTH_UNAUTHORIZED");
  const user = (payload as Record<string, unknown>).user;
  if (!user) throw new Error("NEXUSS_AUTH_UNAUTHORIZED");
  return validatedUser(user);
}
async function createLocalSession(config: NonNullable<ReturnType<typeof serverEnv.nexussAuth>>, nexussUser: NexussUser, provider: string, req: ApiRequest): Promise<IdentityResult> {
  return withControlPlaneDb(db => {
    const identity = ensureIdentity(db, config, nexussUser, provider);
    const user = localUser(db, identity.userId);
    const session = createUserSession(db, identity.userId, req);
    return { user, sessionToken: session.token };
  }, { write: true });
}

export async function startNexussAuth(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const config = configured();
    const provider = validProvider(value(req, "provider") ?? "github");
    if (!provider) throw new Error("NEXUSS_PROVIDER_INVALID");
    const nextPath = safeNextPath(value(req, "next"));
    const state = randomBytes(32).toString("base64url");
    const binding = randomBytes(32).toString("base64url");
    await withControlPlaneDb(db => {
      db.execute(`DELETE FROM nexuss_oauth_states WHERE expires_at <= ? OR consumed_at IS NOT NULL`, [now()]);
      db.execute(`INSERT INTO nexuss_oauth_states (id, state_hash, binding_hash, provider, redirect_uri, next_path, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [randomUUID(), hash(state), hash(binding), provider, config.redirectUri, nextPath, new Date(Date.now() + STATE_TTL_MS).toISOString(), now()]);
    }, { write: true });
    const loginUrl = new URL(`${config.authUrl}/oauth/start/${provider}`);
    loginUrl.searchParams.set("project_id", config.projectId);
    loginUrl.searchParams.set("redirect_uri", config.redirectUri);
    loginUrl.searchParams.set("handoff", "1");
    res.setHeader("Set-Cookie", bindingCookieHeader(binding));
    sendJson(res, 200, { authorizationUrl: loginUrl.toString() });
  } catch (error) { errorResponse(res, error); }
}

export async function handleNexussCallback(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  let nextPath = "/";
  try {
    const config = configured();
    const state = queryValue(req, "state");
    const handoffToken = queryValue(req, "handoff_token");
    const binding = cookieValue(req, BINDING_COOKIE);
    if (!state || !handoffToken || !binding) throw new Error("NEXUSS_STATE_INVALID");
    const stateRecord = await withControlPlaneDb(db => {
      db.execute(`DELETE FROM nexuss_oauth_states WHERE expires_at <= ?`, [now()]);
      const record = first<StateRow>(db.execute(`SELECT id, binding_hash, provider, redirect_uri, next_path, expires_at, consumed_at FROM nexuss_oauth_states WHERE state_hash = ?`, [hash(state)]));
      if (!record || record.consumed_at || record.binding_hash !== hash(binding) || record.redirect_uri !== config.redirectUri || new Date(record.expires_at).getTime() <= Date.now()) throw new Error("NEXUSS_STATE_INVALID");
      db.execute(`UPDATE nexuss_oauth_states SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL`, [now(), record.id]);
      return record;
    }, { write: true });
    nextPath = safeNextPath(stateRecord.next_path);
    const user = await identityFromUpstream(config, handoffToken, true);
    const result = await createLocalSession(config, user, stateRecord.provider, req);
    res.statusCode = 302;
    res.setHeader("Location", nextPath);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Set-Cookie", [sessionCookieHeader(result.sessionToken), clearBindingCookieHeader()]);
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NEXUSS_STATE_INVALID") return sendJson(res, 400, { error: "nexuss_auth_state_invalid" });
    if (message === "NEXUSS_LINK_REQUIRED") {
      res.statusCode = 302;
      res.setHeader("Location", "/login?error=nexuss_auth_account_link_required");
      res.setHeader("Set-Cookie", clearBindingCookieHeader());
      res.end();
      return;
    }
    if (message === "NEXUSS_AUTH_UNAUTHORIZED") {
      res.statusCode = 302;
      res.setHeader("Location", "/login?error=nexuss_auth_identity_unverified");
      res.setHeader("Set-Cookie", clearBindingCookieHeader());
      res.end();
      return;
    }
    errorResponse(res, error);
  }
}

export async function loginWithNexussToken(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const config = configured();
    const token = header(req, "authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
    if (!/^nxa_[A-Za-z0-9_-]{20,160}$/.test(token)) throw new Error("NEXUSS_AUTH_UNAUTHORIZED");
    const user = await identityFromUpstream(config, token);
    const result = await createLocalSession(config, user, "api_token", req);
    res.setHeader("Set-Cookie", sessionCookieHeader(result.sessionToken));
    sendJson(res, 200, { user: result.user });
  } catch (error) { errorResponse(res, error); }
}

export async function linkNexussIdentity(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const config = configured();
    const token = header(req, "authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
    if (!/^nxa_[A-Za-z0-9_-]{20,160}$/.test(token)) throw new Error("NEXUSS_AUTH_UNAUTHORIZED");
    const user = await identityFromUpstream(config, token);
    await withControlPlaneDb(db => {
      const current = requireSession(db, req);
      linkIdentity(db, config, user, "api_token", current.id);
    }, { write: true });
    sendJson(res, 200, { linked: true });
  } catch (error) { errorResponse(res, error); }
}
