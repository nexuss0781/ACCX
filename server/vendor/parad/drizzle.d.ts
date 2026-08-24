import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import type { DrizzleConfig } from 'drizzle-orm/utils';
import { type ConnectOptions, ParadConnection } from './connection.js';
export type ParadDrizzleDatabase<TSchema extends Record<string, unknown> = Record<string, never>> = SqliteRemoteDatabase<TSchema> & {
    /** The underlying Parad connection. */
    $client: ParadConnection;
    /** Close the encrypted database and stop auto-sync. */
    close(): void;
    /** Push the current encrypted snapshot to the gateway. */
    push(): Promise<number | null>;
    /** Pull the latest encrypted snapshot from the gateway. */
    pull(): Promise<boolean>;
};
export type ParadDrizzleSource = string | ConnectOptions | ParadConnection | undefined;
/**
 * Create a Drizzle SQLite database backed by Parad's encrypted engine.
 *
 * Parad opens sql.js asynchronously, so the factory is intentionally async:
 *
 *   const db = await drizzle(process.env.DATABASE_URL, { schema });
 *
 * Drizzle query builders, relational queries, prepared statements, and async
 * transactions remain available on the returned database. The attached
 * `close`, `push`, and `pull` methods retain Parad's encrypted persistence and
 * synchronization lifecycle.
 */
export declare function drizzle<TSchema extends Record<string, unknown> = Record<string, never>>(source?: ParadDrizzleSource, config?: DrizzleConfig<TSchema>): Promise<ParadDrizzleDatabase<TSchema>>;
export type { DrizzleConfig };
//# sourceMappingURL=drizzle.d.ts.map