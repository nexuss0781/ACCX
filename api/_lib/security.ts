import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { serverEnv } from "./env.js";

type CipherBox = { ciphertext: string; iv: string; tag: string };
export type EncryptedSecretPayload = { encryptedDataKey: CipherBox; secretCiphertext: CipherBox; algorithm: "AES-256-GCM" };

function masterKey(): Buffer {
  const key = Buffer.from(serverEnv.vaultMasterKey(), "base64");
  if (key.length !== 32) throw new Error("ACCX_VAULT_MASTER_KEY must decode to exactly 32 bytes.");
  return key;
}

function encrypt(key: Buffer, value: Buffer): CipherBox {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}

function decrypt(key: Buffer, box: CipherBox): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(box.iv, "base64"));
  decipher.setAuthTag(Buffer.from(box.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(box.ciphertext, "base64")), decipher.final()]);
}

export function encryptSecret(value: string): EncryptedSecretPayload {
  const dataKey = randomBytes(32);
  try {
    return { encryptedDataKey: encrypt(masterKey(), dataKey), secretCiphertext: encrypt(dataKey, Buffer.from(value, "utf8")), algorithm: "AES-256-GCM" };
  } finally {
    dataKey.fill(0);
  }
}

export function decryptSecret(payload: EncryptedSecretPayload): string {
  const dataKey = decrypt(masterKey(), payload.encryptedDataKey);
  try {
    return decrypt(dataKey, payload.secretCiphertext).toString("utf8");
  } finally {
    dataKey.fill(0);
  }
}

export function redactAuditMetadata(value: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const forbidden = /password|secret|token|credential|passphrase|ciphertext|key/i;
  return Object.fromEntries(Object.entries(value).filter(([field]) => !forbidden.test(field)).map(([field, item]) => [field, typeof item === "string" || typeof item === "number" || typeof item === "boolean" || item === null ? item : "[redacted]"]));
}
