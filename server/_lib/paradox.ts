import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { connect, type ParadConnection } from "parad";
import { serverEnv } from "./env.js";
import { ensureSchema } from "./schema.js";

/** A Vercel invocation gets a fresh encrypted database copy and always closes it before returning. */
export async function withControlPlaneDb<T>(operation: (db: ParadConnection) => Promise<T> | T, options: { write?: boolean } = {}): Promise<T> {
  const requestKey = randomUUID();
  const dbPath = `/tmp/accx-${requestKey}.db`;
  const db = await connect({
    url: serverEnv.databaseUrl(),
    dbPath,
    autoSync: false,
    pullOnStartup: false,
  });

  try {
    try {
      await db.pull();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!/no file data available|not found|404/i.test(message)) throw error;
    }
    ensureSchema(db);
    db.execute("BEGIN");
    const result = await operation(db);
    db.execute("COMMIT");
    if (options.write) await db.push();
    return result;
  } catch (error) {
    try { db.execute("ROLLBACK"); } catch { /* Statements autocommit only when no explicit transaction is active. */ }
    throw error;
  } finally {
    db.close();
    await Promise.allSettled([rm(dbPath, { force: true }), rm(`${dbPath}.journal`, { force: true })]);
  }
}
