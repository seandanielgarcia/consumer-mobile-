/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import { checkoutFixture } from "./fixtures.test-setup";

describe("users.sellerContact", () => {
  it("returns the seller's first name and phone to a verified buyer", async () => {
    const { t, buyerId, garageId, sellerPhone } = await checkoutFixture();
    await t.run(({ db }) => db.patch(buyerId, { verified: true }));

    expect(await t.query(api.users.sellerContact, { garageId, buyerId })).toEqual({ firstName: "Maya", phone: sellerPhone });
  });

  it("returns nothing when signed out, unverified, mid-verification or the seller", async () => {
    const { t, buyerId, garageId } = await checkoutFixture();
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
