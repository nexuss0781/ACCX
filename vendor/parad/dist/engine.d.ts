export declare class ClientEngine {
    private db;
    private _passphrase;
    dbPath: string;
    private _opCount;
    private journalPath;
    private journalFd;
    private journalLen;
    private baseSeq;
    private seq;
    private inTx;
    constructor(dbPath: string, passphrase: string);
    open(create?: boolean): Promise<void>;
    close(): void;
    /** Replace the whole database from plaintext SQLite bytes (used by pull). */
    replaceBytes(bytes: Buffer): Promise<void>;
    private readUserVersion;
    /** Mirror the write watermark into the SQLite header, but only when it
     *  actually changed (a redundant PRAGMA write bumps the file change counter
     *  and would make exports non-deterministic). */
    private stampUserVersion;
    /** Export the in-memory DB, stamp the write watermark, and atomically
     *  rewrite the encrypted snapshot file. Does NOT clear the journal. */
    private writeSnapshot;
    /** Write snapshot then clear the journal. */
    private checkpoint;
    private atomicWriteSnapshot;
    private ensureJournalFd;
    private closeJournalFd;
    private clearJournal;
    private truncateJournalTo;
    private syncJournal;
    private appendJournal;
    /** Track transaction depth for durable fsync boundaries. */
    private updateTxnDepth;
    /**
     * Apply every journal record with seq > baseSeq onto the in-memory DB.
     * Records already folded into the snapshot are skipped, making replay
     * idempotent. On a corrupt/failed record the clean prefix is folded into a
     * snapshot and the bad tail is dropped so the next open starts clean.
     */
    private replayJournal;
    /** Execute SQL and return rows for queries and DML with RETURNING. */
    executeRaw(sql: string, params?: any[]): any[];
    /** Execute SQL and return positional SQLite rows for Drizzle and proxy adapters. */
    executeRawValues(sql: string, params?: any[]): any[][];
    execute(sql: string, params?: any[]): {
        rows: any[];
        changes: number;
        lastInsertRowid: number;
    };
    private queryValues;
    private queryAll;
    insert(table: string, row: Record<string, any>): number;
    select(table: string, where?: Record<string, any>, options?: {
        orderBy?: string;
        limit?: number;
        offset?: number;
    }): any[];
    update(table: string, set: Record<string, any>, where: Record<string, any>): number;
    delete(table: string, where: Record<string, any>): number;
    /** Fetch the first row matching `where`, or null when nothing matches. */
    get(table: string, where: Record<string, any>): any | null;
    /** Insert many rows atomically (single transaction). Returns each rowid. */
    insertMany(table: string, rows: Record<string, any>[]): number[];
    /**
     * Insert `row`, or when a conflict on `conflictColumns` occurs, update the
     * existing row with every non-conflict column (`col = excluded.col`).
     * Returns the number of rows affected (1 inserted or 1 updated, 0 on
     * DO NOTHING).
     */
    upsert(table: string, row: Record<string, any>, conflictColumns: string | string[]): number;
    /** Return the current PLAINTEXT SQLite bytes (not encrypted). */
    getRawBytes(): Buffer;
    get isOpen(): boolean;
    get passphrase(): string;
    get operationCount(): number;
    resetOperationCount(): void;
}
//# sourceMappingURL=engine.d.ts.map