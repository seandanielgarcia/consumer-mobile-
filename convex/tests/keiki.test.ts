/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");
const phone = "+15559660001";

async function verifyFixture(withGarage: boolean) {
  vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site");
  const t = convexTest(schema, modules);
  const garageId = await t.run(async ({ db }) => {
    const ownerId = await db.insert("users", {
      name: "Hailey",
      phone,
      avatarColor: "#2340FF",
      verified: false,
      verifyCode: "2495",
      verifyCodeExpiresAt: Date.now() + 60_000,
    });
    if (!withGarage) return null;
    return await db.insert("garages", { ownerId, neighborhood: "Mission", approxLat: 37.76, approxLng: -122.42, isOpen: true });
  });
  return { t, garageId };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("keiki verify_phone", () => {
  it("replies with the yard link when the seller has a yard", async () => {
    const { t, garageId } = await verifyFixture(true);
    const result = await t.mutation(internal.keiki.verifyPhone, { phones: [phone], code: "2495" });
    expect(result).toEqual({
      ok: true,
      reply: `You're verified! Share your yard with friends: https://example.convex.site/yard/${garageId}`,
    });
  });

  it("points sellers without a yard to the app", async () => {
    const { t } = await verifyFixture(false);
    const result = await t.mutation(internal.keiki.verifyPhone, { phones: [phone], code: "2495" });
    expect(result).toEqual({ ok: true, reply: "You're verified! Open your yard in the app to start selling." });
  });

  it("rejects a reused code after verifying", async () => {
    const { t } = await verifyFixture(true);
    await t.mutation(internal.keiki.verifyPhone, { phones: [phone], code: "2495" });
    expect(await t.mutation(internal.keiki.verifyPhone, { phones: [phone], code: "2495" })).toEqual({ error: "bad_code" });
  });
});
