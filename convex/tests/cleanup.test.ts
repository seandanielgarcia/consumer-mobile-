/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import type { Id, TableNames } from "../_generated/dataModel";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");
const now = Date.UTC(2026, 0, 1);
const old = now - 16 * 60_000;
const recent = now - 14 * 60_000;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup() {
  const t = convexTest(schema, modules);
  const user = (phone: string, name = "Fixture") =>
    t.run(({ db }) => db.insert("users", { name, phone, avatarColor: "#2340FF" }));

  const yard = (ownerId: Id<"users">) => t.run(async ({ db }) => {
    const garageId = await db.insert("garages", {
      ownerId, neighborhood: "Fixture", approxLat: 37.76, approxLng: -122.42, isOpen: true,
    });
    const itemId = await db.insert("items", {
      garageId, title: "Silk top", description: "Fixture", photoUrl: "https://example.test/item.jpg",
      priceCents: 100, status: "reserved", aiGenerated: false,
    });
    return { garageId, itemId };
  });

  const paidOrder = (garageId: Id<"garages">, itemId: Id<"items">, buyerId: Id<"users">) =>
    t.run(({ db }) => db.insert("orders", {
      garageId, buyerId, itemIds: [itemId], totalCents: 100, status: "paid",
    }));

  const read = <Table extends TableNames>(id: Id<Table>) => t.run(({ db }) => db.get(id));
  return { t, user, yard, paidOrder, read };
}

type TestApp = ReturnType<typeof setup>["t"];
const cleanups = [
  { name: "seed:devCleanup", run: (t: TestApp) => t.mutation(internal.seed.devCleanup, { dryRun: false }) },
  { name: "seed:resetDemo", run: (t: TestApp) => t.mutation(internal.seed.resetDemo, {}) },
];

describe.each(cleanups)("$name", ({ run }) => {
  it("keeps a recent throwaway yard and paid order intact", async () => {
    vi.setSystemTime(recent);
    const { t, user, yard, paidOrder, read } = setup();
    const ownerId = await user("+15559990001");
    const buyerId = await user("+15559990002");
    const { garageId, itemId } = await yard(ownerId);
    const orderId = await paidOrder(garageId, itemId, buyerId);

    vi.setSystemTime(now);
    await run(t);

    for (const id of [ownerId, buyerId, garageId]) expect(await read(id)).not.toBeNull();
    expect(await read(orderId)).toMatchObject({ status: "paid" });
    expect(await read(itemId)).toMatchObject({ status: "reserved" });
  });

  it("keeps an older smoke yard, users, and paid order", async () => {
    vi.setSystemTime(old);
    const { t, user, yard, paidOrder, read } = setup();
    const ownerId = await user("+15559770001");
    const buyerId = await user("+15559770002");
    const { garageId, itemId } = await yard(ownerId);
    const orderId = await paidOrder(garageId, itemId, buyerId);

    vi.setSystemTime(now);
    await run(t);

    for (const id of [ownerId, buyerId, garageId]) expect(await read(id)).not.toBeNull();
    expect(await read(orderId)).toMatchObject({ status: "paid" });
    expect(await read(itemId)).toMatchObject({ status: "reserved" });
  });

  it("deletes old throwaway users and their old yard, item, and order", async () => {
    vi.setSystemTime(old);
    const { t, user, yard, paidOrder, read } = setup();
    const ownerId = await user("+15559990001");
    const buyerId = await user("+15550199002");
    const { garageId, itemId } = await yard(ownerId);
    const orderId = await paidOrder(garageId, itemId, buyerId);

    vi.setSystemTime(now);
    await run(t);

    for (const id of [ownerId, buyerId, garageId, itemId, orderId]) expect(await read(id)).toBeNull();
  });

  it("preserves all three older seed accounts and their yards", async () => {
    vi.setSystemTime(old);
    const { t, read } = setup();
    await t.mutation(internal.seed.run, { photos: {} });
    const seeded = await t.run(async ({ db }) => ({
      users: await db.query("users").collect(),
      garages: await db.query("garages").collect(),
    }));
    expect(seeded.users.map((account) => account.phone).sort())
      .toEqual(["+15550100001", "+15550100002", "+15550100003"]);
    expect(seeded.garages).toHaveLength(3);

    vi.setSystemTime(now);
    await run(t);

    for (const row of [...seeded.users, ...seeded.garages]) expect(await read(row._id)).toEqual(row);
  });

  it("keeps a recent paid order and its reservation in an older seed yard", async () => {
    vi.setSystemTime(old);
    const { t, user, yard, paidOrder, read } = setup();
    const ownerId = await user("+15550100001");
    const buyerId = await user("+15559770001");
    const { garageId, itemId } = await yard(ownerId);
    await t.run(({ db }) => db.patch(itemId, { title: "Silk cami top" }));
    vi.setSystemTime(recent);
    const orderId = await paidOrder(garageId, itemId, buyerId);

    vi.setSystemTime(now);
    await run(t);

    expect(await read(orderId)).toMatchObject({ status: "paid" });
    expect(await read(itemId)).toMatchObject({ status: "reserved" });
  });

  it("keeps recent Sam and Maya B demo accounts", async () => {
    vi.setSystemTime(recent);
    const { t, user, read } = setup();
    const sam = await user("+15555550101", "Sam");
    const maya = await user("+15555550102", "Maya B");

    vi.setSystemTime(now);
    await run(t);

    expect(await read(sam)).toMatchObject({ name: "Sam" });
    expect(await read(maya)).toMatchObject({ name: "Maya B" });
  });

  it("keeps older Sam and Maya B demo accounts", async () => {
    vi.setSystemTime(old);
    const { t, user, read } = setup();
    const sam = await user("+15555550101", "Sam");
    const maya = await user("+15555550102", "Maya B");

    vi.setSystemTime(now);
    await run(t);

    expect([await read(sam), await read(maya)].map((account) => account?.name)).toEqual(["Sam", "Maya B"]);
  });

  it("keeps a recent paid order and its dependencies in an older throwaway yard", async () => {
    vi.setSystemTime(old);
    const { t, user, yard, paidOrder, read } = setup();
    const ownerId = await user("+15559990001");
    const buyerId = await user("+15559990002");
    const { garageId, itemId } = await yard(ownerId);
    vi.setSystemTime(recent);
    const orderId = await paidOrder(garageId, itemId, buyerId);

    vi.setSystemTime(now);
    await run(t);

    expect(await read(orderId)).toMatchObject({ status: "paid" });
    expect(await read(itemId)).toMatchObject({ status: "reserved" });
    for (const id of [ownerId, buyerId, garageId]) expect(await read(id)).not.toBeNull();
  });
});
