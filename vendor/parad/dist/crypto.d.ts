export { DecryptionError } from './errors.js';
export declare const SALT: Buffer<ArrayBuffer>;
export declare const KDF_ITERATIONS = 256000;
export declare const KEY_LENGTH = 32;
export declare const IV_LENGTH = 16;
export declare const SQLITE_MAGIC: Buffer<ArrayBuffer>;
export declare const MIN_ENCRYPTED_LENGTH: number;
export declare function deriveKey(passphrase: string): Buffer;
/** Encrypt bytes with AES-256-CBC. Returns IV + ciphertext. */
export declare function encryptBytes(data: Buffer, passphrase: string): Buffer;
/** Encrypt an SQLite database file (alias of encryptBytes, kept for clarity). */
export declare function encryptFile(data: Buffer, passphrase: string): Buffer;
/**
 * Decrypt AES-256-CBC data (IV + ciphertext). Returns the original bytes.
 *
 * Throws DecryptionError on wrong passphrase, truncated/corrupt input, or
 * invalid PKCS7 padding. Does NOT require a SQLite magic header — used for
 * journal records.
 */
export declare function decryptBytes(data: Buffer, passphrase: string): Buffer;
/**
 * Decrypt an SQLite database file (IV + ciphertext). Same as decryptBytes but
 * also enforces that the plaintext starts with the SQLite magic header.
 */
export declare function decryptFile(data: Buffer, passphrase: string): Buffer;
/** Return true if data decrypts with passphrase, false otherwise. Never throws. */
export declare function validatePassphrase(data: Buffer, passphrase: string): boolean;
//# sourceMappingURL=crypto.d.ts.map