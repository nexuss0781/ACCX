export declare const JOURNAL_MAGIC: Buffer<ArrayBuffer>;
export declare const JOURNAL_VERSION = 1;
export interface JournalEntry {
    seq: number;
    sql: string;
    params: unknown[];
}
/**
 * Serialize a journal record. The layout is:
 *
 *   [4B 'PJRN'][1B version]
 *   [u32be seq]
 *   [u32be sqlLen][sql utf8]
 *   [u16be paramCount]
 *   [per param: 1B type + payload]
 *     T_NULL   0           (no payload)
 *     T_NUMBER 1 8B f64be
 *     T_STRING 2 [u32 len][utf8]
 *     T_BLOB   3 [u32 len][bytes]
 *     T_BOOL   4 1B
 *     T_BIGINT 5 8B i64be
 */
export declare function encodeEntry(seq: number, sql: string, params: unknown[]): Buffer;
/** Deserialize a journal record. Throws on malformed/unknown-format input. */
export declare function decodeEntry(buf: Buffer): JournalEntry;
/** Bytes of a length-prefixed encrypted entry stored in the journal file. */
export declare function wrapEntry(cipher: Buffer): Buffer;
//# sourceMappingURL=journal.d.ts.map