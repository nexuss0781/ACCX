import { ClientEngine } from './engine.js';
export interface ParsedUrl {
    name: string;
    project: string | null;
    passphrase: string;
    gateway_url: string;
    token: string;
    email: string;
    password: string;
}
export declare function parseUrl(url: string): ParsedUrl;
export declare function generateUrl(name: string, passphrase?: string, gatewayUrl?: string, project?: string | null, token?: string, email?: string, password?: string): string;
export declare function dbStateKey(name: string, project?: string | null): string;
/** Remove credentials from a Parad URL before displaying it in normal CLI output. */
export declare function redactUrl(url: string): string;
/**
 * Resolve the canonical single-value database URL.
 *
 * Precedence is explicit at the call site, then DATABASE_URL, then the
 * persisted config.database_url. Legacy split fields are used only as a
 * compatibility fallback and the reconstructed URL is persisted immediately.
 */
export declare function getCanonicalDatabaseUrl(name?: string): string;
export interface SyncDaemonOptions {
    engine: ClientEngine;
    dbName: string;
    gatewayUrl: string;
    apiKey?: string;
    project?: string | null;
    databaseId?: string;
    projectId?: string;
    pushIntervalMs?: number;
    pullIntervalMs?: number;
    storageChannel?: string;
    logChannel?: string;
}
export declare class SyncDaemon {
    PUSH_INTERVAL: number;
    PULL_INTERVAL: number;
    private engine;
    private dbName;
    private dbKey;
    private databaseId;
    private projectId;
    private storageChannel;
    private logChannel;
    private gateway;
    private timer;
    lastSync: number | null;
    private _offline;
    private _consecutiveFailures;
    private _lastError;
    private _ticking;
    constructor(opts: SyncDaemonOptions);
    start(): void;
    stop(): void;
    private _onTick;
    get isRunning(): boolean;
    get offline(): boolean;
    get consecutiveFailures(): number;
    get lastError(): string | null;
    private _onSuccess;
    private _onFailure;
    private _maybePush;
    private _push;
    pull(): Promise<boolean>;
    private _pushCounter;
    private _pullCounter;
    private _tick;
}
export declare class ParadConnection {
    engine: ClientEngine;
    private passphrase;
    private gatewayUrl;
    private apiKey;
    private project;
    private databaseId;
    private projectId;
    private dbName;
    private _dbKey;
    private storageChannel;
    private logChannel;
    private _daemon;
    private _autoSync;
    private _pullOnStartup;
    private _pushIntervalMs?;
    private _pullIntervalMs?;
    constructor(opts: {
        dbPath: string;
        passphrase: string;
        gatewayUrl: string;
        apiKey?: string;
        autoSync?: boolean;
        project?: string | null;
        databaseId?: string;
        projectId?: string;
        pullOnStartup?: boolean;
        pushIntervalMs?: number;
        pullIntervalMs?: number;
        storageChannel?: string;
        logChannel?: string;
    });
    init(): Promise<void>;
    get daemon(): SyncDaemon | null;
    get isConnected(): boolean;
    get dbKey(): string;
    /** Canonical connection URL for this successfully resolved database. */
    get databaseUrl(): string;
    execute(sql: string, params?: any[]): {
        rows: any[];
        changes: number;
        lastInsertRowid: number;
    };
    commit(): void;
    rollback(): void;
    close(): void;
    push(): Promise<number | null>;
    private _pushManual;
    pull(): Promise<boolean>;
    pullVersion(version: number): Promise<boolean>;
}
export declare function generatePassphrase(): string;
export interface ConnectOptions {
    name?: string;
    project?: string;
    passphrase?: string;
    url?: string;
    dbPath?: string;
    gatewayUrl?: string;
    apiKey?: string;
    autoSync?: boolean;
    pullOnStartup?: boolean;
    pushIntervalMs?: number;
    pullIntervalMs?: number;
    storageChannel?: string;
    logChannel?: string;
    allowLegacyDefault?: boolean;
}
export declare function connect(opts: ConnectOptions | string): Promise<ParadConnection>;
//# sourceMappingURL=connection.d.ts.map