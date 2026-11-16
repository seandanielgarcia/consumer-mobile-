/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { signedPayment, webhookSecret } from "./fixtures.test-setup";

const modules = import.meta.glob("../**/*.ts");
const location = { lat: 37.761234, lng: -122.419876 };
const jeansSearch = { ...location, q: "jeans", radiusMiles: 2 };
const people = [
  { name: "Maya Rivera", phone: "+15559770111" },
  { name: "Jo", phone: "+15559770112" },
  { name: "Sam", phone: "+15559770113" },
];
const notifyFetch = vi.fn(async () => new Response("ok"));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  vi.stubEnv("DEMO_PHONES", people.map(({ phone }) => phone).join(","));
  vi.stubEnv("WHOP_WEBHOOK_SECRET", webhookSecret);
  vi.stubEnv("KEIKI_API_KEY", "fixture-key");
  vi.stubEnv("KEIKI_API_BASE", "https://keiki.example.test");
  notifyFetch.mockClear();
  vi.stubGlobal("fetch", notifyFetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function publishYards() {
  const t = convexTest(schema, modules);
  const [seller, buyer, otherBuyer] = await Promise.all(
    people.map((person) => t.mutation(api.users.startVerification, person)),
  );
  const [jeansPhoto, beltPhoto, distantPhoto] = await t.run(({ storage }) =>
    Promise.all(
      ["jeans photo", "belt photo", "distant photo"].map((contents) =>
        storage.store(new Blob([contents], { type: "image/jpeg" }))),
    ),
  );
  const listing = (storageId: Id<"_storage">, title: string, priceCents: number) =>
    ({ storageId, title, priceCents, description: title, aiGenerated: false });
  const { garageId, itemIds } = await t.mutation(api.garages.openWithItems, {
    ownerId: seller.userId,
    neighborhood: "Mission",
    ...location,
    items: [
      listing(jeansPhoto, "Dark wash jeans", 1800),
      listing(beltPhoto, "Leather belt", 700),
    ],
  });
  const { itemIds: [distantJeansId] } = await t.mutation(api.garages.openWithItems, {
    ownerId: otherBuyer.userId,
    neighborhood: "Far away",
    lat: 38.761234,
    lng: location.lng,
    items: [listing(distantPhoto, "Vintage jeans", 1000)],
  });
  const checkout = (buyerId: Id<"users">, selected: Id<"items">[]) =>
    t.mutation(api.orders.createPending, { buyerId, garageId, itemIds: selected });
  const search = (buyerId: Id<"users">) => t.query(api.buyer.search, { ...jeansSearch, buyerId });
  return { t, checkout, search, seller, buyer, otherBuyer, garageId, itemIds, distantJeansId };
}

describe("yardsale core loop", () => {
  it("publishes a rounded yard, finds jeans, and reserves a two-item checkout exactly once via Whop", async () => {
    const { t, checkout, search, seller, buyer, otherBuyer, garageId, itemIds, distantJeansId } = await publishYards();
    const [jeansId, beltId] = itemIds;
    const yard = await t.run(({ db }) => db.get(garageId));
    expect(yard).toMatchObject({ isOpen: true, approxLat: 37.76, approxLng: -122.42 });
    const addressFields = Object.keys(yard ?? {}).filter((field) => /address|street/i.test(field));
    expect(addressFields).toEqual([]);
    expect(await t.query(api.buyer.yards, { ...jeansSearch, buyerId: buyer.userId }))
      .toMatchObject([{ garageId, lat: 37.76, lng: -122.42 }]);
    expect(await search(buyer.userId)).toMatchObject([{ _id: jeansId, garageId, title: "Dark wash jeans" }]);
    expect(await search(seller.userId)).toEqual([]);

    await expect(checkout(buyer.userId, [])).rejects.toThrow("Pick at least one item");
    await expect(checkout(seller.userId, itemIds)).rejects.toThrow("own yard");
    await expect(checkout(buyer.userId, [jeansId, distantJeansId])).rejects.toThrow("All items must come from one garage");
    const { orderId, totalCents } = await checkout(buyer.userId, [...itemIds, jeansId]);
    expect(totalCents).toBe(2500);
    expect(await t.query(api.orders.getOrder, { orderId })).toMatchObject({ status: "pending" });
    expect((await t.query(api.items.byGarage, { garageId })).map((item) => item.status)).toEqual(["live", "live"]);

    expect(await search(otherBuyer.userId)).toEqual([]);
    await expect(checkout(otherBuyer.userId, [jeansId])).rejects.toThrow("Someone else is checking out");

    vi.stubEnv("WHOP_API_KEY", "fixture-whop-key");
    vi.stubEnv("WHOP_ENVIRONMENT", "sandbox");
    vi.stubEnv("CONVEX_SITE_URL", "https://yard.example.test");
    const sandboxCheckout = "https://sandbox.whop.com/checkout/core-loop";
    const createCheckoutFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      expect(new URL(request.url).hostname).toBe("sandbox-api.whop.com");
      expect(await request.json()).toMatchObject({ metadata: { orderId }, variant: { initial_price: 25 } });
      return Response.json({ id: "ch_core_loop", purchase_url: sandboxCheckout });
    });
    vi.stubGlobal("fetch", createCheckoutFetch);
    const { purchaseUrl } = await t.action(api.whop.createOrderCheckout, { orderId });
    expect(purchaseUrl.split("?")[0]).toBe(sandboxCheckout);
    expect(createCheckoutFetch).toHaveBeenCalledTimes(1);
    vi.stubGlobal("fetch", notifyFetch);

    const unsigned = await signedPayment(orderId);
    unsigned.headers.delete("webhook-signature");
    expect((await t.fetch("/whop", unsigned)).status).toBe(401);
    expect(await t.query(api.orders.getOrder, { orderId })).toMatchObject({ status: "pending" });

    const payment = await signedPayment(orderId);
    expect((await t.fetch("/whop", payment)).status).toBe(200);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.query(api.orders.getOrder, { orderId })).toMatchObject({
      status: "paid",
      sellerName: "Maya",
      totalCents: 2500,
      items: [{ _id: jeansId }, { _id: beltId }],
    });
    expect((await t.query(api.items.byGarage, { garageId })).map((item) => item.status))
      .toEqual(["reserved", "reserved"]);
    expect(await search(buyer.userId)).toEqual([]);
    await expect(checkout(otherBuyer.userId, [jeansId])).rejects.toThrow("is no longer available");

    expect((await t.fetch("/whop", payment)).status).toBe(200);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const orders = await t.run(({ db }) => db.query("orders").collect());
    expect(orders).toMatchObject([{ _id: orderId, status: "paid", itemIds, whopCheckoutId: "ch_core_loop" }]);
    expect(notifyFetch).toHaveBeenCalledTimes(1);
  });

  it("restores an unpaid listing to search and lets the next buyer check out after 10 minutes", async () => {
    const { t, checkout, search, buyer, otherBuyer, itemIds } = await publishYards();
    const [jeansId] = itemIds;
    const started = Date.now();
    const { orderId } = await checkout(buyer.userId, [jeansId]);

    vi.setSystemTime(started + 10 * 60_000 - 1000);
    expect(await search(otherBuyer.userId)).toEqual([]);
    await expect(checkout(otherBuyer.userId, [jeansId])).rejects.toThrow("Someone else is checking out");

    vi.setSystemTime(started + 10 * 60_000 + 1000);
    expect(await search(otherBuyer.userId)).toMatchObject([{ _id: jeansId }]);
    await expect(checkout(otherBuyer.userId, [jeansId])).resolves.toMatchObject({ totalCents: 1800 });
    expect(await t.query(api.orders.getOrder, { orderId })).toMatchObject({ status: "pending" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(notifyFetch).not.toHaveBeenCalled();
  });
});
