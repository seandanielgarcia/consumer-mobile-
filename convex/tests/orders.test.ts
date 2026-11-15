import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { checkoutFixture } from "./fixtures.test-setup";

afterEach(() => vi.useRealTimers());

describe("orders.createPending", () => {
  it("rejects an empty cart", async () => {
    const { t, buyerId, garageId } = await checkoutFixture();
    await expect(t.mutation(api.orders.createPending, { buyerId, garageId, itemIds: [] }))
      .rejects.toThrow("Pick at least one item");
  });

  it("rejects an unknown buyer", async () => {
    const { t, buyerId, garageId, firstId } = await checkoutFixture();
    await t.run(({ db }) => db.delete(buyerId));
    await expect(t.mutation(api.orders.createPending, { buyerId, garageId, itemIds: [firstId] }))
      .rejects.toThrow("Unknown buyer");
  });

  it("rejects a cart spanning two yards", async () => {
    const { t, buyerId, garageId, firstId, foreignId } = await checkoutFixture();
    await expect(t.mutation(api.orders.createPending, { buyerId, garageId, itemIds: [firstId, foreignId] }))
      .rejects.toThrow("All items must come from one garage");
  });

  it.each(["reserved", "sold"] as const)("rejects an item marked %s", async (status) => {
    const { t, buyerId, garageId, reservedId, soldId } = await checkoutFixture();
    const itemId = status === "reserved" ? reservedId : soldId;
    await expect(t.mutation(api.orders.createPending, { buyerId, garageId, itemIds: [itemId] }))
      .rejects.toThrow("is no longer available");
  });

  it("blocks another buyer during the hold and accepts their cart after 10 minutes", async () => {
    vi.useFakeTimers();
    const start = Date.UTC(2026, 0, 1);
    vi.setSystemTime(start);
    const { t, buyerId, otherBuyerId, garageId, firstId } = await checkoutFixture();
    await t.mutation(api.orders.createPending, { buyerId, garageId, itemIds: [firstId] });

    const competingCart = { buyerId: otherBuyerId, garageId, itemIds: [firstId] };
    vi.setSystemTime(start + 9 * 60_000);
    await expect(t.mutation(api.orders.createPending, competingCart)).rejects.toThrow("Someone else is checking out");
    vi.setSystemTime(start + 10 * 60_000 + 1000);
    await expect(t.mutation(api.orders.createPending, competingCart)).resolves.toMatchObject({ totalCents: 100 });
  });

  it("calculates and persists the total in cents without counting duplicate IDs", async () => {
    const { t, buyerId, garageId, firstId, secondId } = await checkoutFixture();
    const result = await t.mutation(api.orders.createPending, { buyerId, garageId, itemIds: [firstId, secondId, firstId] });
    expect(result.totalCents).toBe(1350);
    const order = await t.run(({ db }) => db.get(result.orderId));
    expect(order).toMatchObject({ itemIds: [firstId, secondId], totalCents: 1350, status: "pending" });
  });

  // Enable this regression test once PR #10 lands.
  it.todo("cancels an older same-buyer pending order with an overlapping cart");
});

describe("orders.markPaid", () => {
  it("reserves live items, reports unavailable lines, and remains idempotent", async () => {
    const { t, buyerId, garageId, firstId, secondId } = await checkoutFixture();
    const { orderId } = await t.mutation(api.orders.createPending, { buyerId, garageId, itemIds: [firstId, secondId] });
    await t.run(({ db }) => db.patch(secondId, { status: "sold" }));
    const snapshot = () => t.run(({ db }) => Promise.all([db.get(orderId), db.get(firstId), db.get(secondId)]));

    const payment = await t.mutation(internal.orders.markPaid, { orderId });
    expect(payment).toMatchObject({ orderId, alreadyPaid: false, unavailableItemIds: [secondId] });
    const paid = await snapshot();
    expect(paid.map((row) => row?.status)).toEqual(["paid", "reserved", "sold"]);

    await expect(t.mutation(internal.orders.markPaid, { orderId }))
      .resolves.toMatchObject({ alreadyPaid: true, unavailableItemIds: [] });
    expect(await snapshot()).toEqual(paid);
  });
});

describe("orders.getOrder", () => {
  async function orderWithNamedSeller() {
    const { t, buyerId, garageId, firstId, sellerPhone } = await checkoutFixture();
    const { orderId } = await t.mutation(api.orders.createPending, { buyerId, garageId, itemIds: [firstId] });
    return { order: await t.query(api.orders.getOrder, { orderId }), sellerPhone };
  }

  it("omits the seller's phone number from the public response", async () => {
    const { order, sellerPhone } = await orderWithNamedSeller();
    expect(order).not.toBeNull();
    expect(order).not.toHaveProperty("sellerPhone");
    expect(JSON.stringify(order)).not.toContain(sellerPhone);
  });

  it("returns only the seller's first name for a multi-word stored name", async () => {
    const { order } = await orderWithNamedSeller();
    expect(order?.sellerName).toBe("Maya");
  });
});
