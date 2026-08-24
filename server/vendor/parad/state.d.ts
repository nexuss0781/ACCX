export declare function sanitizeStateKey(dbKey: string): string;
export interface SyncState {
    database_name: string;
    remote_version: number | null;
    remote_hash: string | null;
    last_sync: string | null;
    last_local_hash: string | null;
    dirty: boolean;
    offline: boolean;
}
export declare function loadState(dbName: string): SyncState;
export declare function saveState(dbName: string, state: SyncState): void;
export declare function getRemoteVersion(dbName: string): number | null;
export declare function setRemoteVersion(dbName: string, version: number, fileHash?: string): void;
export declare function getLastLocalHash(dbName: string): string | null;
export declare function setLastLocalHash(dbName: string, fileHash: string): void;
export declare function markDirty(dbKey: string): void;
export declare function clearDirty(dbKey: string): void;
export declare function isDirty(dbKey: string): boolean;
export declare function setOffline(dbKey: string, offline: boolean): void;
export declare function isOffline(dbKey: string): boolean;
export declare function getSyncStatus(dbKey: string): SyncState;
//# sourceMappingURL=state.d.ts.map