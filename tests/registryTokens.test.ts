import { describe, expect, it } from "vitest";

const basic = (username: string, password: string) => `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

const registrySecretsAvailable = Boolean(process.env.NPM_TOKEN && process.env.PYPI_TOKEN);

describe.skipIf(!registrySecretsAvailable)("protected ACCX registry publication credentials", () => {
  it("accepts the configured npm token at npm's identity endpoint", async () => {
    const token = process.env.NPM_TOKEN;
    expect(token, "NPM_TOKEN must be configured through the protected secret input").toBeTruthy();
    const response = await fetch("https://registry.npmjs.org/-/whoami", { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
    expect(response.status).toBe(200);
    expect((await response.json()).username).toBeTruthy();
  }, 20_000);

  it("uses a PyPI API-token format for a non-publishing authenticated upload-endpoint probe", async () => {
    const token = process.env.PYPI_TOKEN;
    expect(token, "PYPI_TOKEN must be configured through the protected secret input").toMatch(/^pypi-/);
    const body = new FormData();
    body.append(":action", "file_upload");
    const response = await fetch("https://upload.pypi.org/legacy/", { method: "POST", headers: { authorization: basic("__token__", token!) }, body, signal: AbortSignal.timeout(15_000) });
    expect(response.status, "PyPI authentication must not reject the protected token").not.toBe(401);
    expect(response.status, "PyPI authentication must not reject the protected token").not.toBe(403);
    expect(response.status).toBe(400);
  }, 20_000);
});
