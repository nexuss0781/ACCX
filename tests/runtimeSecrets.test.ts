import { describe, expect, it } from "vitest";
import { GatewayClient, parseUrl } from "parad";
import { serverEnv } from "../server/_lib/env.js";

const managedIt = process.env.ACCX_MANAGED_SECRETS_TEST === "true" ? it : it.skip;
const networkIt = process.env.ACCX_NETWORK_TEST === "true" ? it : it.skip;

describe("ACCX managed server secrets", () => {
  managedIt("loads valid server-only ACCX keys and a canonical Paradox database URL", () => {
    expect(serverEnv.databaseUrl()).toMatch(/^parad:\/\//);
    expect(parseUrl(serverEnv.databaseUrl()).passphrase.length).toBeGreaterThanOrEqual(32);
    expect(Buffer.from(serverEnv.vaultMasterKey(), "base64")).toHaveLength(32);
    expect(serverEnv.adminKey().length).toBeGreaterThanOrEqual(32);
    expect(serverEnv.workerKey().length).toBeGreaterThanOrEqual(32);
  });

  networkIt("authenticates the canonical DATABASE_URL", async () => {
    const parsed = parseUrl(serverEnv.databaseUrl());
    const gateway = new GatewayClient(parsed.gateway_url, parsed.token);
    const profile = await gateway.authMe();
    expect(profile).toBeTypeOf("object");
  }, 15_000);
});
