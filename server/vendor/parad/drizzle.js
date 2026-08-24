import { drizzle as drizzleProxy } from 'drizzle-orm/sqlite-proxy';
import { connect, ParadConnection } from './connection.js';
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
export async function drizzle(source, config) {
    const connection = source instanceof ParadConnection
        ? source
        : await connect(typeof source === 'string' || source === undefined ? source ?? {} : source);
    const callback = async (sql, params, method) => {
        if (method === 'run') {
            connection.engine.execute(sql, params);
            return { rows: [] };
        }
        return { rows: connection.engine.executeRawValues(sql, params) };
    };
    const batchCallback = async (batch) => {
        return Promise.all(batch.map(({ sql, params, method }) => callback(sql, params, method)));
    };
    const db = drizzleProxy(callback, batchCallback, config);
    db.$client = connection;
    db.close = () => connection.close();
    db.push = () => connection.push();
    db.pull = () => connection.pull();
    return db;
}
