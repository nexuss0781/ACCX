import { randomBytes, randomUUID } from "node:crypto";
import type { ParadConnection } from "parad";
import type { Scope } from "../../shared/contracts.js";
import { allScopes, personalTokenPrefix } from "../../shared/contracts.js";
import type { ApiRequest } from "./http.js";
import { hashOpaqueToken, recordAudit } from "./vault.js";

const now = () => new Date().toISOString();
const NO_EXPIRY = "9999-12-31T23:59:59.999Z";
const TOKEN_PATTERN = /^accx_pat_[A-Za-z0-9_-]{43}$/;

type Row = Record<string, unknown>;
function first<T extends Row>(result: { rows: Row[] }): T | null { return (result.rows[0] as T | undefined) ?? null; }

function primaryMembership(db: ParadConnection, userId: string): { workspaceId: string; scopes: Scope[] } | null {
  const membership = first<{ workspace_id: string; scopes_json: string }>(db.execute(`SELECT workspace_id, scopes_json FROM workspace_members WHERE subject_id = ? AND subject_type = 'human' ORDER BY created_at LIMIT 1`, [userId]));
  if (!membership) return null;
  return { workspaceId: membership.workspace_id, scopes: JSON.parse(membership.scopes_json) as Scope[] };
}

export function personalTokenFromHeader(req: ApiRequest): string | null {
  const raw = req.headers.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(value.trim());
  if (!match) throw new Error("UNAUTHORIZED");
  const token = match[1];
  return token.startsWith(personalTokenPrefix) ? TOKEN_PATTERN.test(token) ? token : (() => { throw new Error("UNAUTHORIZED"); })() : null;
}

export type PersonalApiToken = { id: string; name: string; scopes: Scope[]; expiresAt: string | null; lastUsedAt: string | null; createdAt: string; revokedAt: string | null };

export function createPersonalApiToken(db: ParadConnection, input: { userId: string; name: string; scopes?: Scope[]; expiresAt?: string | null }): { tokenId: string; token: string; prefix: string; expiresAt: string } {
  const membership = primaryMembership(db, input.userId);
  if (!membership) throw new Error("FORBIDDEN");
  const requested = input.scopes && input.scopes.length > 0 ? input.scopes : [...membership.scopes];
  if (requested.some(scope => !membership.scopes.includes(scope))) throw new Error("FORBIDDEN");
  if (requested.length === 0 || requested.some(scope => !allScopes.includes(scope))) throw new Error("FORBIDDEN");
  const token = `${personalTokenPrefix}${randomBytes(32).toString("base64url")}`;
  const tokenId = randomUUID();
  const expiresAt = input.expiresAt ? input.expiresAt : NO_EXPIRY;
  db.execute(`INSERT INTO personal_api_tokens (id, user_id, name, token_prefix, token_digest, scopes_json, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [tokenId, input.userId, input.name.trim(), token.slice(0, 24), hashOpaqueToken(token), JSON.stringify(requested), expiresAt, now()]);
  recordAudit(db, { workspaceId: membership.workspaceId, actorType: "human", actorId: input.userId, eventType: "identity.pat_created", metadata: { tokenId, name: input.name.trim(), scopeCount: requested.length, expiresAt } });
  return { tokenId, token, prefix: token.slice(0, 24), expiresAt };
}

export function listPersonalApiTokens(db: ParadConnection, userId: string): PersonalApiToken[] {
  const result = db.execute(`SELECT id, name, scopes_json, expires_at, last_used_at, created_at, revoked_at FROM personal_api_tokens WHERE user_id = ? ORDER BY created_at DESC`, [userId]);
  return (result.rows as Row[]).map(row => ({
    id: String(row.id), name: String(row.name), scopes: JSON.parse(String(row.scopes_json)) as Scope[],
    expiresAt: row.expires_at === NO_EXPIRY ? null : String(row.expires_at), lastUsedAt: row.last_used_at === null ? null : String(row.last_used_at), createdAt: String(row.created_at), revokedAt: row.revoked_at === null ? null : String(row.revoked_at),
  }));
}

export function revokePersonalApiToken(db: ParadConnection, input: { userId: string; tokenId: string }): void {
  const membership = primaryMembership(db, input.userId);
  const token = first<{ name: string }>(db.execute(`SELECT name FROM personal_api_tokens WHERE id = ? AND user_id = ? AND revoked_at IS NULL`, [input.tokenId, input.userId]));
  if (!token) throw new Error("NOT_FOUND");
  db.execute(`UPDATE personal_api_tokens SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL`, [now(), input.tokenId, input.userId]);
  if (membership) recordAudit(db, { workspaceId: membership.workspaceId, actorType: "human", actorId: input.userId, eventType: "identity.pat_revoked", metadata: { tokenId: input.tokenId, name: token.name } });
}

export function requirePersonalPat(db: ParadConnection, req: ApiRequest, needed: readonly Scope[]): { userId: string; tokenId: string; workspaceId: string; scopes: Scope[] } {
  const token = personalTokenFromHeader(req);
  if (!token) throw new Error("UNAUTHORIZED");
  const record = first<{ id: string; user_id: string; workspace_id: string; scopes_json: string; member_scopes_json: string; expires_at: string; revoked_at: string | null }>(db.execute(`SELECT pt.id, pt.user_id, pt.scopes_json, pt.expires_at, pt.revoked_at, wm.workspace_id, wm.scopes_json AS member_scopes_json FROM personal_api_tokens pt JOIN workspace_members wm ON wm.subject_id = pt.user_id AND wm.subject_type = 'human' WHERE pt.token_digest = ?`, [hashOpaqueToken(token)]));
  if (!record || record.revoked_at || new Date(record.expires_at).getTime() <= Date.now()) throw new Error("UNAUTHORIZED");
  const tokenScopes = JSON.parse(record.scopes_json) as Scope[];
  const memberScopes = JSON.parse(record.member_scopes_json) as Scope[];
  const scopes = tokenScopes.filter(scope => memberScopes.includes(scope));
  if (!needed.every(scope => scopes.includes(scope))) throw new Error("FORBIDDEN");
  db.execute(`UPDATE personal_api_tokens SET last_used_at = ? WHERE id = ?`, [now(), record.id]);
  return { userId: record.user_id, tokenId: record.id, workspaceId: record.workspace_id, scopes };
}