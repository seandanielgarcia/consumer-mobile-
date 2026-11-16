/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

it.each(["", "jacket"])("shows an uploaded photo once across titles and yards in Browse (%j)", async (q) => {
  const t = convexTest(schema, modules);
  const nearestId = await t.run(async ({ db, storage }) => {
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

    const nearest = await insert(yardId, first, "Jacket");
    await insert(yardId, different, "Jacket");
    await insert(otherYardId, duplicate, "Denim jacket");
    return nearest;
  });

  const results = await t.query(api.buyer.search, { q, lat: 37.76, lng: -122.42, radiusMiles: 2 });
  expect(results).toHaveLength(2);
  expect(results.map((item) => item.title)).toEqual(["Jacket", "Jacket"]);
  expect(results.some((item) => item._id === nearestId)).toBe(true);
});
