import { describe, expect, it } from "vitest";
import { withControlPlaneDb } from "../api/_lib/paradox.js";
import { bootstrapControlPlane } from "../api/_lib/vault.js";

describe.runIf(process.env.ACCX_LIVE_PARADOX_TEST === "true")("ACCX live Paradox control plane", () => {
  it("provisions and reads the encrypted cloud control plane", async () => {
    const bootstrap = await withControlPlaneDb(db => bootstrapControlPlane(db, "operator"), { write: true });
    const workspaces = await withControlPlaneDb(db => db.execute("SELECT id, slug FROM workspaces WHERE id = ?", [bootstrap.workspaceId]).rows);
    expect(workspaces).toEqual([{ id: bootstrap.workspaceId, slug: "accx" }]);
  }, 90_000);
});
