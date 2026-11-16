/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { checkoutFixture } from "./fixtures.test-setup";

const modules = import.meta.glob("../**/*.ts");

afterEach(() => vi.unstubAllEnvs());

it("deduplicates Browse photos and shows every matching yard in list and map search", async () => {
  vi.stubEnv("CONVEX_CLOUD_URL", "https://example.convex.cloud");
  const t = convexTest(schema, modules);
  const { yardId, otherYardId } = await t.run(async ({ db, storage }) => {
    const ownerId = await db.insert("users", { name: "Maya", phone: "+15559770001", avatarColor: "#2340FF" });
    const yard = { ownerId, neighborhood: "Mission", approxLat: 37.76, approxLng: -122.42, isOpen: true };
    const yardId = await db.insert("garages", yard);
    const otherYardId = await db.insert("garages", { ...yard, approxLat: 37.77 });
    const upload = (content: string) => storage.store(new Blob([content], { type: "image/jpeg" }));
    const first = await upload("original jacket");
    const duplicate = await upload("original jacket");
    const different = await upload("different jacket");

    const listing = {
      description: "Denim jacket", priceCents: 500, status: "live" as const, aiGenerated: false,
    };
    const insert = async (garageId: typeof yardId, storageId: typeof first, title: string) =>
      db.insert("items", {
        ...listing, garageId, storageId, title, photoUrl: (await storage.getUrl(storageId))!,
      });

    await insert(yardId, first, "Jacket");
    await insert(yardId, different, "Jacket");
    // Older rows can reference a stored image through the URL alone.
    await db.insert("items", {
      ...listing, garageId: otherYardId, title: "Denim jacket",
      photoUrl: `https://example.convex.cloud/api/storage/${duplicate}`,
    });
    await insert(yardId, duplicate, "Another denim jacket");
    const unrelatedYardId = await db.insert("garages", { ...yard, approxLng: -122.43 });
    await db.insert("items", {
      ...listing, garageId: unrelatedYardId, title: "Lamp", description: "Blue desk lamp",
      photoUrl: "https://example.test/lamp.jpg",
    });
    return { yardId, otherYardId };
  });

  const nearby = { lat: 37.76, lng: -122.42, radiusMiles: 2 };
  const browse = await t.query(api.buyer.search, { ...nearby, q: "" });
  expect(browse.filter((item) => item.title !== "Lamp").map((item) => item.garageId))
    .toEqual([yardId, yardId]);

  const search = { ...nearby, q: "  jacket " };
  const matches = await t.query(api.buyer.search, search);
  expect(matches.map((item) => item.garageId)).toEqual([yardId, yardId, otherYardId]);
  const pins = await t.query(api.buyer.yards, search);
  expect(pins.map(({ garageId, liveCount }) => ({ garageId, liveCount }))).toEqual([
    { garageId: yardId, liveCount: 2 },
    { garageId: otherYardId, liveCount: 1 },
  ]);
});

it.each(["", "Silk"])("shows another seller's listing and excludes the signed-in user's yard (%j)", async (q) => {
  const { t, buyerId, garageId, firstId, secondId, foreignId } = await checkoutFixture();
  const ownerId = await t.run(async ({ db }) => {
    await db.patch(secondId, { photoUrl: "https://example.test/jacket.jpg" });
    await db.patch(foreignId, { photoUrl: "https://example.test/boots.jpg" });
    return (await db.get(garageId))!.ownerId;
  });
  const search = { q, lat: 37.76, lng: -122.42, radiusMiles: 2 };
  const shopperResults = await t.query(api.buyer.search, { ...search, buyerId });
  const sellerResults = await t.query(api.buyer.search, { ...search, buyerId: ownerId });

  expect(shopperResults.some((item) => item._id === firstId)).toBe(true);
  expect(sellerResults.every((item) => item.garageId !== garageId)).toBe(true);
  if (!q) expect(sellerResults.some((item) => item._id === foreignId)).toBe(true);
});
