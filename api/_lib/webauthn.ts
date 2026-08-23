import { createHash, randomUUID } from "node:crypto";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse, type AuthenticationResponseJSON, type RegistrationResponseJSON } from "@simplewebauthn/server";
import type { ParadConnection } from "parad";
import type { ApiRequest } from "./http.js";
import { grantStepUp, requireSession } from "./auth.js";

const now = () => new Date().toISOString();
const challengeTtlMs = 5 * 60_000;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
type CredentialRow = { id: string; credential_id: string; public_key_b64: string; counter: number; transports_json: string; label: string };

function originContext(req: ApiRequest): { origin: string; rpId: string } {
  const originHeader = req.headers.origin;
  const raw = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  if (!raw) throw new Error("FORBIDDEN");
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") throw new Error("FORBIDDEN");
  return { origin: parsed.origin, rpId: parsed.hostname };
}

function consumeChallenge(db: ParadConnection, userId: string, purpose: "register" | "step_up"): string {
  const row = db.execute(`SELECT id, challenge, expires_at FROM webauthn_challenges WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`, [userId, purpose]).rows[0] as { id: string; challenge: string | null; expires_at: string } | undefined;
  if (!row?.challenge || new Date(row.expires_at).getTime() <= Date.now()) throw new Error("UNAUTHORIZED");
  db.execute(`UPDATE webauthn_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL`, [now(), row.id]);
  return row.challenge;
}

async function storeChallenge(db: ParadConnection, userId: string, purpose: "register" | "step_up", challenge: string): Promise<void> {
  db.execute(`UPDATE webauthn_challenges SET consumed_at = ? WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL`, [now(), userId, purpose]);
  db.execute(`INSERT INTO webauthn_challenges (id, user_id, purpose, challenge_hash, challenge, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [randomUUID(), userId, purpose, hash(challenge), challenge, new Date(Date.now() + challengeTtlMs).toISOString(), now()]);
}

export async function beginPasskeyRegistration(db: ParadConnection, req: ApiRequest, label: string) {
  const user = requireSession(db, req);
  const { rpId } = originContext(req);
  const known = db.execute(`SELECT credential_id, transports_json FROM webauthn_credentials WHERE user_id = ? AND revoked_at IS NULL`, [user.id]).rows as { credential_id: string; transports_json: string }[];
  const options = await generateRegistrationOptions({
    rpName: "ACCX",
    rpID: rpId,
    userName: user.email,
    userID: new TextEncoder().encode(user.id),
    userDisplayName: user.name,
    timeout: 60_000,
    attestationType: "none",
    excludeCredentials: known.map(row => ({ id: row.credential_id, transports: JSON.parse(row.transports_json) })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });
  await storeChallenge(db, user.id, "register", options.challenge);
  return { options, label };
}

export async function finishPasskeyRegistration(db: ParadConnection, req: ApiRequest, response: RegistrationResponseJSON, label: string): Promise<void> {
  const user = requireSession(db, req);
  const { origin, rpId } = originContext(req);
  const expectedChallenge = consumeChallenge(db, user.id, "register");
  const verification = await verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpId, requireUserVerification: true });
  if (!verification.verified) throw new Error("UNAUTHORIZED");
  const credential = verification.registrationInfo.credential;
  db.execute(`INSERT INTO webauthn_credentials (id, user_id, credential_id, public_key_b64, counter, transports_json, label, device_type, backed_up, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [randomUUID(), user.id, credential.id, Buffer.from(credential.publicKey).toString("base64url"), credential.counter, JSON.stringify(response.response.transports ?? []), label, verification.registrationInfo.credentialDeviceType, verification.registrationInfo.credentialBackedUp ? 1 : 0, now()]);
  grantStepUp(db, req, "passkey");
}

export async function beginPasskeyStepUp(db: ParadConnection, req: ApiRequest) {
  const user = requireSession(db, req);
  const { rpId } = originContext(req);
  const credentials = db.execute(`SELECT credential_id, transports_json FROM webauthn_credentials WHERE user_id = ? AND revoked_at IS NULL`, [user.id]).rows as { credential_id: string; transports_json: string }[];
  if (!credentials.length) throw new Error("FORBIDDEN");
  const options = await generateAuthenticationOptions({ rpID: rpId, timeout: 60_000, userVerification: "required", allowCredentials: credentials.map(row => ({ id: row.credential_id, transports: JSON.parse(row.transports_json) })) });
  await storeChallenge(db, user.id, "step_up", options.challenge);
  return { options };
}

export async function finishPasskeyStepUp(db: ParadConnection, req: ApiRequest, response: AuthenticationResponseJSON): Promise<void> {
  const user = requireSession(db, req);
  const { origin, rpId } = originContext(req);
  const expectedChallenge = consumeChallenge(db, user.id, "step_up");
  const stored = db.execute(`SELECT id, credential_id, public_key_b64, counter, transports_json, label FROM webauthn_credentials WHERE user_id = ? AND credential_id = ? AND revoked_at IS NULL`, [user.id, response.id]).rows[0] as CredentialRow | undefined;
  if (!stored) throw new Error("UNAUTHORIZED");
  const verification = await verifyAuthenticationResponse({ response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpId, requireUserVerification: true, credential: { id: stored.credential_id, publicKey: new Uint8Array(Buffer.from(stored.public_key_b64, "base64url")), counter: stored.counter, transports: JSON.parse(stored.transports_json) } });
  if (!verification.verified) throw new Error("UNAUTHORIZED");
  db.execute(`UPDATE webauthn_credentials SET counter = ?, last_used_at = ? WHERE id = ?`, [verification.authenticationInfo.newCounter, now(), stored.id]);
  grantStepUp(db, req, "passkey");
}
