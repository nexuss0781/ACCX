export declare class DatabaseNotOpenError extends Error {
    constructor(message?: string);
}
export declare class SQLiteError extends Error {
    originalError: Error;
    constructor(message: string, originalError: Error);
}
export declare class DecryptionError extends Error {
    constructor(message?: string);
}
export declare class EncryptionError extends Error {
    constructor(message?: string);
}
export declare class GatewayError extends Error {
    statusCode: number;
    detail?: unknown;
    constructor(statusCode: number, message: string, detail?: unknown);
}
export declare class ConfigError extends Error {
    constructor(message?: string);
}
export declare class ConflictError extends Error {
    remoteVersion: number;
    yourVersion: number;
    remoteMessageId: string;
    constructor(remoteVersion: number, yourVersion: number, remoteMessageId: string);
}
export declare class RateLimitError extends Error {
    retryAfterSeconds: number;
    constructor(retryAfterSeconds: number);
}
export declare class AuthenticationError extends Error {
    constructor(message?: string);
}
export declare class NetworkError extends Error {
    constructor(message?: string);
}
//# sourceMappingURL=errors.d.ts.map