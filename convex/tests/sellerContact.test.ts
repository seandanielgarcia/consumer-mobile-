/// <reference types="vite/client" />

import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { SEED_YARD_PHONES } from "../seed";
import { checkoutFixture } from "./fixtures.test-setup";

describe("users.sellerContact", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns a demo seller's first name and phone to a verified buyer", async () => {
    const { t, buyerId, garageId, sellerPhone } = await checkoutFixture();
    vi.stubEnv("DEMO_PHONES", sellerPhone);
    await t.run(({ db }) => db.patch(buyerId, { verified: true }));

    expect(await t.query(api.users.sellerContact, { garageId, buyerId })).toEqual({ firstName: "Maya", phone: sellerPhone });
    expect(await t.query(api.users.sellerTextable, { garageId })).toBe(true);
  });

  it("never returns a real-number seller's phone", async () => {
    const { t, buyerId, garageId } = await checkoutFixture();
    await t.run(async ({ db }) => {
      await db.patch(buyerId, { verified: true });
      await db.patch((await db.get(garageId))!.ownerId, { phone: "+16505550123" });
    });

    expect(await t.query(api.users.sellerContact, { garageId, buyerId })).toBeNull();
    expect(await t.query(api.users.sellerTextable, { garageId })).toBe(false);
  });

  it("shares a real number only after the seller confirms in Messages and removes it when they turn texts off", async () => {
    vi.stubEnv("KEIKI_TOOL_TOKEN", "test-token");
    const { t, buyerId, garageId, sellerPhone } = await checkoutFixture();
    const ownerId = await t.run(async ({ db }) => {
      const ownerId = (await db.get(garageId))!.ownerId;
      await db.patch(ownerId, { verified: true });
      await db.patch(buyerId, { verified: true });
      return ownerId;
    });
    const contact = () => t.query(api.users.sellerContact, { garageId, buyerId });
    const textable = () => t.query(api.users.sellerTextable, { garageId });
    const sendCode = async (code: number | string) => {
      const response = await t.fetch("/keiki/verify_phone?token=test-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { code }, context: { phone: sellerPhone } }),
      });
      expect(response.status).toBe(200);
      return response.json();
    };

    await expect(t.mutation(api.users.requestBuyerTexts, { garageId, ownerId: buyerId, allow: true })).rejects.toThrow();
    const on = await t.mutation(api.users.requestBuyerTexts, { garageId, ownerId, allow: true });
    expect(on).toMatch(/^0[0-4]\d{2}$/);
    expect(await contact()).toBeNull();
    expect(await textable()).toBe(false);
    expect(await t.mutation(internal.keiki.verifyPhone, { phones: ["+15559770002"], code: on })).toEqual({ error: "bad_code" });

    expect(await sendCode(Number(on))).toMatchObject({ ok: true });
    expect(await textable()).toBe(true);
    expect(await contact()).toEqual({ firstName: "Maya", phone: sellerPhone });
    expect(await t.query(api.users.sellerContact, { garageId })).toBeNull();
    expect(await t.query(api.users.sellerContact, { garageId, buyerId: ownerId })).toBeNull();
    expect(await sendCode(on)).toEqual({ error: "bad_code" });

    const off = await t.mutation(api.users.requestBuyerTexts, { garageId, ownerId, allow: false });
    expect(await sendCode(on)).toEqual({ error: "bad_code" });
    expect(await sendCode(off)).toMatchObject({ ok: true });
    expect(await textable()).toBe(false);
    expect(await contact()).toBeNull();
  });

  it("rejects expired buyer text consent codes", async () => {
    const { t, garageId, sellerPhone } = await checkoutFixture();
    const ownerId = await t.run(async ({ db }) => {
      const ownerId = (await db.get(garageId))!.ownerId;
      await db.patch(ownerId, { verified: true, buyerTextsRequest: { allow: true, code: "0123", expiresAt: Date.now() - 1 } });
      return ownerId;
    });

    expect(await t.mutation(internal.keiki.verifyPhone, { phones: [sellerPhone], code: "0123" })).toEqual({ error: "expired" });
    expect(await t.query(api.users.sellerTextable, { garageId })).toBe(false);
    expect(await t.mutation(api.users.requestBuyerTexts, { garageId, ownerId, allow: true })).not.toBe("0123");
  });

  it("allows seed sellers' fictional numbers", async () => {
    const { t, buyerId, garageId } = await checkoutFixture();
    await t.run(async ({ db }) => {
      await db.patch(buyerId, { verified: true });
      await db.patch((await db.get(garageId))!.ownerId, { phone: SEED_YARD_PHONES[0] });
    });

    expect(await t.query(api.users.sellerContact, { garageId, buyerId })).toMatchObject({ phone: SEED_YARD_PHONES[0] });
  });

  it("returns nothing when signed out, unverified, mid-verification or the seller", async () => {
    const { t, buyerId, garageId, sellerPhone } = await checkoutFixture();
    vi.stubEnv("DEMO_PHONES", sellerPhone);
    const sellerId = await t.run(async ({ db }) => (await db.get(garageId))!.ownerId);

    expect(await t.query(api.users.sellerContact, { garageId })).toBeNull();
    expect(await t.query(api.users.sellerContact, { garageId, buyerId })).toBeNull();

    await t.run(({ db }) => db.patch(buyerId, { verified: true, verifyCode: "1234", verifyCodeExpiresAt: Date.now() + 60_000 }));
    expect(await t.query(api.users.sellerContact, { garageId, buyerId })).toBeNull();

    await t.run(({ db }) => db.patch(sellerId, { verified: true }));
    expect(await t.query(api.users.sellerContact, { garageId, buyerId: sellerId })).toBeNull();
  });

  it("keeps the phone out of the yard, search and order queries", async () => {
    const { t, buyerId, garageId, firstId, sellerPhone } = await checkoutFixture();
    await t.run(({ db }) => db.patch(buyerId, { verified: true }));
    const { orderId } = await t.mutation(api.orders.createPending, { buyerId, garageId, itemIds: [firstId] });
    const where = { lat: 37.76, lng: -122.42 };

    const results = await Promise.all([
      t.query(api.buyer.garage, { garageId, ...where, buyerId }),
      t.query(api.buyer.search, { q: "", ...where, radiusMiles: 2, buyerId }),
      t.query(api.buyer.item, { itemId: firstId, ...where }),
      t.query(api.orders.getOrder, { orderId }),
    ]);
    for (const result of results) expect(JSON.stringify(result)).not.toContain(sellerPhone);
  });
});
