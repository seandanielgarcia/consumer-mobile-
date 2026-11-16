/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

it.each(["", "jacket"])("shows an uploaded photo once per yard in Browse (%j)", async (q) => {
  const t = convexTest(schema, modules);
  await t.run(async ({ db, storage }) => {
    const ownerId = await db.insert("users", { name: "Maya", phone: "+15559770001", avatarColor: "#2340FF" });
    const yard = { ownerId, neighborhood: "Mission", approxLat: 37.76, approxLng: -122.42, isOpen: true };
    const yardId = await db.insert("garages", yard);
    const otherYardId = await db.insert("garages", yard);
    const upload = (content: string) => storage.store(new Blob([content], { type: "image/jpeg" }));
    const first = await upload("original jacket");
    const duplicate = await upload("original jacket");
    const different = await upload("different jacket");

    for (const [garageId, storageId] of [[yardId, first], [yardId, duplicate], [yardId, different], [otherYardId, first]] as const) {
      await db.insert("items", {
        garageId, storageId, photoUrl: (await storage.getUrl(storageId))!,
        title: "Jacket", description: "Denim jacket", priceCents: 500, status: "live", aiGenerated: false,
      });
    }
  });

  const results = await t.query(api.buyer.search, { q, lat: 37.76, lng: -122.42, radiusMiles: 2 });
  expect(results).toHaveLength(3);
  expect(new Set(results.map((item) => item._id)).size).toBe(3);
  expect(new Set(results.map((item) => item.garageId)).size).toBe(2);
});
