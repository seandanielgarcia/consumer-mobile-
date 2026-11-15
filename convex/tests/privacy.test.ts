/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

function expectNoAddressFields(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  for (const [field, nested] of Object.entries(value)) {
    expect(field).not.toMatch(/address|street/i);
    expectNoAddressFields(nested);
  }
}

function expectPrivateLocation(garage: Doc<"garages">) {
  for (const coordinate of [garage.approxLat, garage.approxLng]) {
    expect(Number.isFinite(coordinate)).toBe(true);
    expect(coordinate).toBe(Number(coordinate.toFixed(2)));
  }
  expectNoAddressFields(garage);
}

describe("garage location privacy", () => {
  it("rounds the seed's unrounded coordinates before storing every seeded yard", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.run, { photos: {} });

    const garages = await t.run(({ db }) => db.query("garages").collect());
    expect(garages).toHaveLength(3);
    garages.forEach(expectPrivateLocation);
  });

  it("rounds coordinates when a seller opens and updates a yard", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, storageId } = await t.run(async ({ db, storage }) => ({
      ownerId: await db.insert("users", { name: "Privacy", phone: "+15559990001", avatarColor: "#2340FF" }),
      storageId: await storage.store(new Blob(["fixture photo"], { type: "image/jpeg" })),
    }));
    const args = {
      ownerId,
      neighborhood: "Mission",
      lat: 37.761234,
      lng: -122.419876,
      items: [{
        storageId,
        title: "Fixture item",
        description: "Fixture",
        priceCents: 100,
        aiGenerated: false,
      }],
    };
    const garages = () => t.run(({ db }) => db.query("garages").collect());

    await t.mutation(api.garages.openWithItems, args);
    const opened = await garages();
    expect(opened).toHaveLength(1);
    opened.forEach(expectPrivateLocation);
    expect(opened[0]).toMatchObject({ approxLat: 37.76, approxLng: -122.42 });

    await t.mutation(api.garages.openWithItems, { ...args, lat: 37.771234, lng: -122.409876 });
    const updated = await garages();
    expect(updated).toHaveLength(1);
    updated.forEach(expectPrivateLocation);
    expect(updated[0]).toMatchObject({ _id: opened[0]._id, approxLat: 37.77, approxLng: -122.41 });
  });
});
