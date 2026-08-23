import { describe, expect, it } from "vitest";
import { GatewayClient } from "parad";
import { serverEnv } from "../api/_lib/env.js";

const managedIt = process.env.ACCX_MANAGED_SECRETS_TEST === "true" ? it : it.skip;
const networkIt = process.env.ACCX_NETWORK_TEST === "true" ? it : it.skip;

describe("ACCX managed server secrets", () => {
  managedIt("loads a valid server-only vault key, operator key, Paradox passphrase, and gateway configuration", () => {
    expect(Buffer.from(serverEnv.vaultMasterKey(), "base64")).toHaveLength(32);
    expect(serverEnv.adminKey().length).toBeGreaterThanOrEqual(32);
    expect(serverEnv.workerKey().length).toBeGreaterThanOrEqual(32);
    expect(serverEnv.paradoxPassphrase().length).toBeGreaterThanOrEqual(32);
    expect(serverEnv.paradoxGatewayUrl).toMatch(/^https:\/\//);
    expect(serverEnv.paradoxResolverUrl).toMatch(/^https:\/\//);
  });

  networkIt("reaches the configured Paradox gateway authentication route", async () => {
    const response = await fetch(`${serverEnv.paradoxGatewayUrl}/auth/me`);
    // A missing key is expected here; a 401 proves the active gateway route exists.
    expect(response.status).toBe(401);
  }, 15_000);

  networkIt("authenticates the server-only Paradox API key", async () => {
    const gateway = new GatewayClient(serverEnv.paradoxGatewayUrl, process.env.PARADOX_API_KEY);
    const profile = await gateway.authMe();
    expect(profile).toHaveProperty("email", "nexuss0781@gmail.com");
  }, 15_000);
});
