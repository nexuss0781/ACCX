export { GatewayError } from './errors.js';
export interface UploadParams {
    database_name?: string;
    database_id?: string;
    project_id?: string;
    file_bytes: Buffer;
    version: number;
    version_type?: string;
    storage_channel?: string;
    log_channel?: string;
}
export interface UploadResult {
    request_id: string;
    message_id: string;
    version: number;
    uploaded_at: string;
}
export interface DownloadResult {
    bytes: Buffer;
    version: number | null;
    message_id: string | null;
}
export interface StatusDatabase {
    name: string;
    latest_version: number;
    latest_message_id: string;
    pending_changesets: number;
    last_sync_at: string | null;
}
export interface StatusResponse {
    user_id: string;
    databases: StatusDatabase[];
}
export interface VersionEntry {
    version: number;
    message_id: string;
    uploaded_at: string;
    size_bytes: number | null;
}
export interface VersionsResponse {
    database_name: string;
    versions: VersionEntry[];
}
export interface RollbackResponse {
    request_id: string;
    rolled_back_to: number;
    new_message_id: string;
}
/** Cloud-issued credentials — the API key is shown once and hashed at rest. */
export interface AuthResult {
    user_id: string;
    email: string;
    username: string;
    api_key: string;
}
/** Network/5xx failures mean offline. 409 is a conflict, not offline. */
export declare function isConnectivityError(err: unknown): boolean;
export declare class GatewayClient {
    gatewayUrl: string;
    apiKey: string;
    constructor(gatewayUrl: string, apiKey?: string);
    private headers;
    private fetchWithRetry;
    private request;
    /** Login issues a fresh cloud API key (the previous key is invalidated). */
    login(email: string, password: string): Promise<AuthResult>;
    /** Register creates the account and returns the first cloud API key. */
    registerEmail(email: string, username: string, password: string): Promise<AuthResult>;
    /** Mint a fresh API key for the current user (the old key is invalidated). */
    mintApiKey(): Promise<AuthResult>;
    authMe(): Promise<Record<string, unknown>>;
    listProjects(): Promise<unknown[]>;
    createProject(name: string, description?: string): Promise<{
        id: string;
        name: string;
    }>;
    listDatabases(projectId: string): Promise<unknown[]>;
    createDatabase(projectId: string, name: string, description?: string): Promise<{
        id: string;
        name: string;
    }>;
    ensureProject(name: string, description?: string): Promise<{
        id: string;
        name: string;
    }>;
    ensureDatabase(projectId: string, name: string, description?: string): Promise<{
        id: string;
        name: string;
    }>;
    upload(params: UploadParams): Promise<UploadResult>;
    download(database_name?: string, version?: number, database_id?: string, project_id?: string, storage_channel?: string): Promise<DownloadResult>;
    status(): Promise<StatusResponse>;
    versions(database_name: string): Promise<VersionsResponse>;
    rollback(database_name: string, target_version: number): Promise<RollbackResponse>;
}
//# sourceMappingURL=gateway.d.ts.map