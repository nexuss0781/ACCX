import type { ParadConnection } from "parad";
import { createHash, createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { ApiRequest, ApiResponse } from "./http.js";
import { decryptSecret, encryptSecret, type EncryptedSecretPayload } from "./security.js";

const now = () => new Date().toISOString();
const sessionDays = 7;
const stepUpMinutes = 10;
type Row = Record<string, unknown>;
function first<T extends Row>(result: { rows: Row[] }): T | null { return (result.rows[0] as T | undefined) ?? null; }
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const opaqueHash = (value: string) => createHash("sha256").update(value).digest("hex");

export type SessionUser = { id: string; email: string; name: string; createdAt: string; sessionId: string; stepUpUntil: string | null; stepUpMethod: string | null };
export type MfaStatus = { totpEnabled: boolean; passkeyCount: number; recoveryCodeCount: number };

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const digest = scryptSync(password, salt, 64).toString("base64url");
  return `${salt}:${digest}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest) return false;
  const calculated = Buffer.from(scryptSync(password, salt, 64).toString("base64url"));
  const expected = Buffer.from(digest);
  return expected.length === calculated.length && timingSafeEqual(expected, calculated);
}

function requestLabel(req?: ApiRequest): string {
  const agent = req?.headers["user-agent"];
  const value = Array.isArray(agent) ? agent[0] : agent;
  return value ? value.slice(0, 120) : "Unknown device";
}

export function createUserSession(db: ParadConnection, userId: string, req?: ApiRequest, rotatedFrom?: string): { token: string; expiresAt: string } {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDays * 86_400_000).toISOString();
  const createdAt = now();
  const agent = req?.headers["user-agent"];
  const userAgent = Array.isArray(agent) ? agent[0] : agent ?? "";
  db.execute(`INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at, session_label, user_agent_hash, rotated_from) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [randomUUID(), userId, tokenHash(token), expiresAt, createdAt, createdAt, requestLabel(req), opaqueHash(userAgent), rotatedFrom ?? null]);
  return { token, expiresAt };
}

function cookieValue(req: ApiRequest, name: string): string | null {
  const raw = req.headers.cookie ?? "";
  const match = raw.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function sessionUser(db: ParadConnection, req: ApiRequest): SessionUser | null {
  const token = cookieValue(req, "accx_session");
  if (!token) return null;
  const result = first<{ session_id: string; id: string; email: string; name: string; created_at: string; step_up_until: string | null; step_up_method: string | null }>(db.execute(`SELECT s.id AS session_id, s.step_up_until, s.step_up_method, u.id, u.email, u.name, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?`, [tokenHash(token), now()]));
  if (!result) return null;
  return { id: result.id, email: result.email, name: result.name, createdAt: result.created_at, sessionId: result.session_id, stepUpUntil: result.step_up_until, stepUpMethod: result.step_up_method };
}

export function requireSession(db: ParadConnection, req: ApiRequest): SessionUser {
  const user = sessionUser(db, req);
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export function setSessionCookie(res: ApiResponse, token: string): void {
  res.setHeader("Set-Cookie", `accx_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${sessionDays * 86_400}`);
}

export function clearSessionCookie(res: ApiResponse): void {
  res.setHeader("Set-Cookie", "accx_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
}

export function revokeCurrentSession(db: ParadConnection, req: ApiRequest): void {
  const token = cookieValue(req, "accx_session");
  if (token) db.execute(`UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL`, [now(), tokenHash(token)]);
}

export function rotateCurrentSession(db: ParadConnection, req: ApiRequest): { token: string; expiresAt: string } {
  const user = requireSession(db, req);
  db.execute(`UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`, [now(), user.sessionId]);
  return createUserSession(db, user.id, req, user.sessionId);
}

export function listUserSessions(db: ParadConnection, req: ApiRequest): { id: string; label: string; createdAt: string; lastSeenAt: string | null; expiresAt: string; current: boolean }[] {
  const user = requireSession(db, req);
  const rows = db.execute(`SELECT id, session_label, created_at, last_seen_at, expires_at FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_seen_at DESC`, [user.id, now()]).rows as { id: string; session_label: string | null; created_at: string; last_seen_at: string | null; expires_at: string }[];
  return rows.map(row => ({ id: row.id, label: row.session_label ?? "Unknown device", createdAt: row.created_at, lastSeenAt: row.last_seen_at, expiresAt: row.expires_at, current: row.id === user.sessionId }));
}

export function revokeUserSession(db: ParadConnection, req: ApiRequest, sessionId: string): void {
  const user = requireSession(db, req);
  db.execute(`UPDATE sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL`, [now(), sessionId, user.id]);
}

export function grantStepUp(db: ParadConnection, req: ApiRequest, method: "totp" | "recovery" | "passkey"): void {
  const user = requireSession(db, req);
  db.execute(`UPDATE sessions SET step_up_until = ?, step_up_method = ? WHERE id = ?`, [new Date(Date.now() + stepUpMinutes * 60_000).toISOString(), method, user.sessionId]);
}

export function requireStepUp(db: ParadConnection, req: ApiRequest): SessionUser {
  const user = requireSession(db, req);
  if (!user.stepUpUntil || new Date(user.stepUpUntil).getTime() <= Date.now()) throw new Error("STEP_UP_REQUIRED");
  return user;
}

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Encode(value: Buffer): string {
  let bits = "";
  for (const byte of value) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) output += base32Alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  return output;
}
function base32Decode(value: string): Buffer {
  const normalized = value.replace(/\s|=/g, "").toUpperCase();
  if (!/^[A-Z2-7]+$/.test(normalized)) throw new Error("FORBIDDEN");
  let bits = "";
  for (const character of normalized) bits += base32Alphabet.indexOf(character).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}
export function totpCode(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const digest = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  return (((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000)).toString().padStart(6, "0");
}
function encryptedPayload(row: { encrypted_data_key_json: string; encrypted_secret_json: string; algorithm: "AES-256-GCM" }): EncryptedSecretPayload {
  return { encryptedDataKey: JSON.parse(row.encrypted_data_key_json), secretCiphertext: JSON.parse(row.encrypted_secret_json), algorithm: row.algorithm };
}
function validTotp(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  return [-1, 0, 1].some(offset => {
    const expected = Buffer.from(totpCode(secret, Date.now() + offset * 30_000));
    const received = Buffer.from(code);
    return expected.length === received.length && timingSafeEqual(expected, received);
  });
}

export function mfaStatus(db: ParadConnection, req: ApiRequest): MfaStatus {
  const user = requireSession(db, req);
  const totpEnabled = Boolean(first(db.execute(`SELECT id FROM mfa_totp_factors WHERE user_id = ? AND verified_at IS NOT NULL AND revoked_at IS NULL LIMIT 1`, [user.id])));
  const passkeyCount = Number((first<{ count: number }>(db.execute(`SELECT COUNT(*) AS count FROM webauthn_credentials WHERE user_id = ? AND revoked_at IS NULL`, [user.id]))?.count) ?? 0);
  const recoveryCodeCount = Number((first<{ count: number }>(db.execute(`SELECT COUNT(*) AS count FROM mfa_recovery_codes WHERE user_id = ? AND used_at IS NULL`, [user.id]))?.count) ?? 0);
  return { totpEnabled, passkeyCount, recoveryCodeCount };
}

export function beginTotpEnrollment(db: ParadConnection, req: ApiRequest, label: string): { factorId: string; otpauthUri: string } {
  const user = requireSession(db, req);
  const secret = base32Encode(randomBytes(20));
  const encrypted = encryptSecret(secret);
  const factorId = randomUUID();
  db.execute(`INSERT INTO mfa_totp_factors (id, user_id, label, encrypted_data_key_json, encrypted_secret_json, algorithm, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [factorId, user.id, label, JSON.stringify(encrypted.encryptedDataKey), JSON.stringify(encrypted.secretCiphertext), encrypted.algorithm, now()]);
  const issuer = "ACCX";
  return { factorId, otpauthUri: `otpauth://totp/${encodeURIComponent(`${issuer}:${user.email}`)}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30` };
}

export function confirmTotpEnrollment(db: ParadConnection, req: ApiRequest, factorId: string, code: string): void {
  const user = requireSession(db, req);
  const factor = first<{ encrypted_data_key_json: string; encrypted_secret_json: string; algorithm: "AES-256-GCM" }>(db.execute(`SELECT encrypted_data_key_json, encrypted_secret_json, algorithm FROM mfa_totp_factors WHERE id = ? AND user_id = ? AND verified_at IS NULL AND revoked_at IS NULL`, [factorId, user.id]));
  if (!factor || !validTotp(decryptSecret(encryptedPayload(factor)), code)) throw new Error("UNAUTHORIZED");
  db.execute(`UPDATE mfa_totp_factors SET verified_at = ? WHERE id = ?`, [now(), factorId]);
  grantStepUp(db, req, "totp");
}

export function verifyTotpStepUp(db: ParadConnection, req: ApiRequest, code: string): void {
  const user = requireSession(db, req);
  const factors = db.execute(`SELECT encrypted_data_key_json, encrypted_secret_json, algorithm FROM mfa_totp_factors WHERE user_id = ? AND verified_at IS NOT NULL AND revoked_at IS NULL`, [user.id]).rows as { encrypted_data_key_json: string; encrypted_secret_json: string; algorithm: "AES-256-GCM" }[];
  if (!factors.some(factor => validTotp(decryptSecret(encryptedPayload(factor)), code))) throw new Error("UNAUTHORIZED");
  grantStepUp(db, req, "totp");
}

export function createRecoveryCodes(db: ParadConnection, req: ApiRequest): string[] {
  const user = requireStepUp(db, req);
  db.execute(`DELETE FROM mfa_recovery_codes WHERE user_id = ?`, [user.id]);
  const codes = Array.from({ length: 10 }, () => randomBytes(9).toString("base64url").toUpperCase());
  for (const code of codes) db.execute(`INSERT INTO mfa_recovery_codes (id, user_id, code_hash, created_at) VALUES (?, ?, ?, ?)`, [randomUUID(), user.id, opaqueHash(code), now()]);
  return codes;
}

export function verifyRecoveryCodeStepUp(db: ParadConnection, req: ApiRequest, code: string): void {
  const user = requireSession(db, req);
  const record = first<{ id: string }>(db.execute(`SELECT id FROM mfa_recovery_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL`, [user.id, opaqueHash(code.trim().toUpperCase())]));
  if (!record) throw new Error("UNAUTHORIZED");
  db.execute(`UPDATE mfa_recovery_codes SET used_at = ? WHERE id = ?`, [now(), record.id]);
  grantStepUp(db, req, "recovery");
}
