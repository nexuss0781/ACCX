import { randomUUID } from "node:crypto";
import { connect, type ParadConnection } from "parad";
import { serverEnv } from "./env.js";
import { ensureSchema } from "./schema.js";

const databaseName = "accx-control-plane";
const projectName = "accx";

async function resolveGatewayUrl(): Promise<string> {
  try {
    const response = await fetch(serverEnv.paradoxResolverUrl, { cache: "no-store" });
    if (!response.ok) return serverEnv.paradoxGatewayUrl;
    const payload = await response.json() as { gatewayUrl?: string };
    return payload.gatewayUrl || serverEnv.paradoxGatewayUrl;
  } catch {
    return serverEnv.paradoxGatewayUrl;
  }
}

/** A Vercel invocation gets a fresh encrypted database copy and always closes it before returning. */
export async function withControlPlaneDb<T>(operation: (db: ParadConnection) => Promise<T> | T, options: { write?: boolean } = {}): Promise<T> {
  const requestKey = randomUUID();
  const db = await connect({
    name: databaseName,
    project: projectName,
    dbPath: `/tmp/accx-${requestKey}.db`,
    passphrase: serverEnv.paradoxPassphrase(),
    gatewayUrl: await resolveGatewayUrl(),
    apiKey: serverEnv.paradoxApiKey(),
    autoSync: false,
    pullOnStartup: true,
  });

  try {
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
  }
}
