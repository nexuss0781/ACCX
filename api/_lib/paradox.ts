import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { connect, GatewayClient, type ParadConnection } from "parad";
import { serverEnv } from "./env.js";
import { ensureSchema } from "./schema.js";

const databaseName = "accx-control-plane";
const projectName = "accx";

function normalizeGatewayUrl(value: string): string {
  const trimmed = value.replace(/\/+$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

async function resolveGatewayUrl(): Promise<string> {
  try {
    const response = await fetch(serverEnv.paradoxResolverUrl, { cache: "no-store" });
    if (!response.ok) return normalizeGatewayUrl(serverEnv.paradoxGatewayUrl);
    const payload = await response.json() as { gatewayUrl?: string };
    return normalizeGatewayUrl(payload.gatewayUrl || serverEnv.paradoxGatewayUrl);
  } catch {
    return normalizeGatewayUrl(serverEnv.paradoxGatewayUrl);
  }
}

/** A Vercel invocation gets a fresh encrypted database copy and always closes it before returning. */
type InternalConnection = { databaseId: string; projectId: string; engine: { replaceBytes(bytes: Buffer): Promise<void>; getRawBytes(): Buffer } };

export async function withControlPlaneDb<T>(operation: (db: ParadConnection) => Promise<T> | T, options: { write?: boolean } = {}): Promise<T> {
  const requestKey = randomUUID();
  const dbPath = `/tmp/accx-${requestKey}.db`;
  const gatewayUrl = await resolveGatewayUrl();
  const apiKey = serverEnv.paradoxApiKey();
  const db = await connect({
    name: databaseName,
    project: projectName,
    dbPath,
    passphrase: serverEnv.paradoxPassphrase(),
    gatewayUrl,
    apiKey,
    autoSync: false,
    pullOnStartup: false,
  });
  const internal = db as unknown as InternalConnection;
  const gateway = new GatewayClient(gatewayUrl, apiKey);
  let baseVersion = 0;
  try {
    const snapshot = await gateway.download(databaseName, undefined, internal.databaseId, internal.projectId);
    baseVersion = snapshot.version ?? 0;
    if (snapshot.bytes?.length) await internal.engine.replaceBytes(snapshot.bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/no file data available/i.test(message)) throw error;
  }

  try {
    ensureSchema(db);
    db.execute("BEGIN");
    const result = await operation(db);
    db.execute("COMMIT");
    if (options.write) {
      try {
        await gateway.upload({ database_name: databaseName, database_id: internal.databaseId, project_id: internal.projectId, file_bytes: internal.engine.getRawBytes(), version: baseVersion });
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 409) throw new Error("PARADOX_CONFLICT");
        throw error;
      }
    }
    return result;
  } catch (error) {
    try { db.execute("ROLLBACK"); } catch { /* Statements autocommit only when no explicit transaction is active. */ }
    throw error;
  } finally {
    db.close();
    await Promise.allSettled([rm(dbPath, { force: true }), rm(`${dbPath}.journal`, { force: true })]);
  }
}
