import { v } from "convex/values";
import { internalAction, internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { roundCoord } from "./lib/location";

const SEED = [
  {
    name: "Hailey",
    phone: "+15550100001",
    avatarColor: "#FFE14D",
    neighborhood: "Mission",
    lat: 37.7599,
    lng: -122.4148,
    items: [
      { photo: "levis-501", title: "Levi's 501 jeans", size: "28", priceCents: 3000, description: "Light wash straight leg Levi's 501 jeans, button fly, soft and broken in." },
      { photo: "silk-top", title: "Silk cami top", size: "S", priceCents: 1500, description: "Ivory silk camisole with adjustable straps and a lace trim neckline." },
      { photo: "field-jacket", title: "Field jacket", size: "M", priceCents: 4000, description: "Olive cotton military field jacket with four snap pockets and a drawcord waist." },
    ],
  },
  {
    name: "Maya",
    phone: "+15550100002",
    avatarColor: "#7EE0B5",
    neighborhood: "Hayes Valley",
    lat: 37.7764,
    lng: -122.4242,
    items: [
      { photo: "black-skinny-jeans", title: "Black skinny jeans", size: "28", priceCents: 2200, description: "Washed black skinny jeans with a mid rise and plenty of stretch." },
      { photo: "wide-leg-jeans", title: "Wide leg jeans", size: "27", priceCents: 2500, description: "Medium wash high waisted wide leg jeans, cropped at the ankle." },
      { photo: "knit-sweater", title: "Cable knit sweater", size: "M", priceCents: 2800, description: "Chunky oatmeal wool cable knit sweater, cozy and warm." },
    ],
  },
  {
    name: "Jon",
    phone: "+15550100003",
    avatarColor: "#FF8FB1",
    neighborhood: "Dogpatch",
    lat: 37.7609,
    lng: -122.3876,
    items: [
      { photo: "mom-jeans", title: "Mom jeans", size: "28", priceCents: 1800, description: "Light blue vintage mom jeans with a paper bag waist and tie belt." },
      { photo: "denim-jacket", title: "Denim trucker jacket", size: "L", priceCents: 3500, description: "Classic medium blue denim trucker jacket, nicely faded." },
      { photo: "flannel-shirt", title: "Plaid flannel shirt", size: "L", priceCents: 2000, description: "Red and black buffalo plaid flannel button up shirt." },
      { photo: "white-sneakers", title: "White leather sneakers", size: "10", priceCents: 3000, description: "White leather low top sneakers with a gum sole, lightly worn." },
    ],
  },
];

export const storePhoto = internalAction({
  args: { base64: v.string() },
  handler: async (ctx, { base64 }) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return await ctx.storage.store(new Blob([bytes], { type: "image/jpeg" }));
  },
});

export const run = internalMutation({
  args: { photos: v.record(v.string(), v.id("_storage")) },
  handler: async (ctx, { photos }) => {
    const used = new Set<string>();
    let created = 0;
    for (const g of SEED) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phone", g.phone))
        .unique();
      const ownerId =
        user?._id ?? (await ctx.db.insert("users", { name: g.name, phone: g.phone, avatarColor: g.avatarColor }));
      const garage = await ctx.db
        .query("garages")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .first();
      const garageId =
        garage?._id ??
        (await ctx.db.insert("garages", {
          ownerId,
          neighborhood: g.neighborhood,
          approxLat: roundCoord(g.lat),
          approxLng: roundCoord(g.lng),
          isOpen: true,
        }));
      const existing = await ctx.db
        .query("items")
        .withIndex("by_garage", (q) => q.eq("garageId", garageId))
        .collect();
      existing.forEach((e) => e.storageId && used.add(e.storageId));
      for (const { photo, ...item } of g.items) {
        if (existing.some((e) => e.title === item.title)) continue;
        const storageId = photos[photo];
        const photoUrl = storageId && (await ctx.storage.getUrl(storageId));
        if (!storageId || !photoUrl) continue;
        await ctx.db.insert("items", { ...item, garageId, storageId, photoUrl, status: "live", aiGenerated: false });
        used.add(storageId);
        created++;
      }
    }
    for (const id of Object.values(photos)) {
      if (!used.has(id)) await ctx.storage.delete(id);
    }
    return { created };
  },
});

export const demoOrder = internalMutation({
  args: { removeOrderId: v.optional(v.id("orders")) },
  handler: async (ctx, { removeOrderId }) => {
    if (removeOrderId) {
      const order = await ctx.db.get(removeOrderId);
      for (const id of order?.itemIds ?? []) {
        const item = await ctx.db.get(id);
        if (item?.status === "reserved") await ctx.db.patch(id, { status: "live" });
      }
      await ctx.db.delete(removeOrderId);
      return null;
    }
    const buyer = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", "+15550100003"))
      .unique();
    const seller = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", "+15550100001"))
      .unique();
    if (!buyer || !seller) throw new Error("Run seed:run first");
    const garage = await ctx.db
      .query("garages")
      .withIndex("by_owner", (q) => q.eq("ownerId", seller._id))
      .first();
    if (!garage) throw new Error("Run seed:run first");
    const items = (
      await ctx.db
        .query("items")
        .withIndex("by_garage", (q) => q.eq("garageId", garage._id))
        .collect()
    )
      .filter((i) => i.status === "live")
      .slice(0, 2);
    if (items.length === 0) throw new Error("No live items left in Hailey's yard");
    for (const i of items) await ctx.db.patch(i._id, { status: "reserved" });
    return await ctx.db.insert("orders", {
      buyerId: buyer._id,
      garageId: garage._id,
      itemIds: items.map((i) => i._id),
      totalCents: items.reduce((sum, i) => sum + i.priceCents, 0),
      status: "paid",
    });
  },
});

const SEED_PHONES = new Set(SEED.map((g) => g.phone));
const SEED_TITLES = new Set(SEED.flatMap((g) => g.items.map((i) => i.title)));
const KEEP_NAMES = new Set(["Sam", "Maya B"]);
const TEST_TITLE = /^(QA|E2E|Zqlatency)|\(edited\)|bundle/i;
const isFictional = (phone: string) => /^\+1(555|\d{3}555)/.test(phone);

export const devCleanup = internalMutation({
  args: { dryRun: v.boolean(), alsoPhones: v.optional(v.array(v.string())) },
  handler: async (ctx, { dryRun, alsoPhones }) => {
    const extra = new Set(alsoPhones ?? []);
    const users = await ctx.db.query("users").collect();
    const keepUser = (u: Doc<"users">) =>
      !extra.has(u.phone) && (SEED_PHONES.has(u.phone) || KEEP_NAMES.has(u.name) || !isFictional(u.phone));
    const dropUsers = users.filter((u) => !keepUser(u));
    const dropUserIds = new Set<Id<"users">>(dropUsers.map((u) => u._id));
    const seedOwnerIds = new Set(users.filter((u) => SEED_PHONES.has(u.phone)).map((u) => u._id));

    const garages = await ctx.db.query("garages").collect();
    const dropGarages = garages.filter((g) => dropUserIds.has(g.ownerId));
    const dropGarageIds = new Set<Id<"garages">>(dropGarages.map((g) => g._id));
    const seedGarageIds = new Set(garages.filter((g) => seedOwnerIds.has(g.ownerId)).map((g) => g._id));

    const items = await ctx.db.query("items").collect();
    const dropItems = items.filter(
      (i) => dropGarageIds.has(i.garageId) || TEST_TITLE.test(i.title) || (seedGarageIds.has(i.garageId) && !SEED_TITLES.has(i.title)),
    );
    const dropItemIds = new Set<Id<"items">>(dropItems.map((i) => i._id));
    const resetItems = items.filter((i) => !dropItemIds.has(i._id) && seedGarageIds.has(i.garageId) && i.status !== "live");

    const orders = await ctx.db.query("orders").collect();
    const dropOrders = orders.filter(
      (o) => dropUserIds.has(o.buyerId) || dropGarageIds.has(o.garageId) || o.itemIds.some((id) => dropItemIds.has(id)),
    );

    const report = {
      users: dropUsers.map((u) => `${u.name} ${u.phone}`),
      garages: dropGarages.map((g) => `${users.find((u) => u._id === g.ownerId)?.name ?? "?"} · ${g.neighborhood}`),
      items: dropItems.map((i) => `${i.title} (${i.status})`),
      orders: dropOrders.map((o) => `${o._id} ${o.status} $${o.totalCents / 100}`),
      resetToLive: resetItems.map((i) => `${i.title} (${i.status})`),
    };
    if (dryRun) return report;

    const usedStorage = new Set(items.filter((i) => !dropItemIds.has(i._id) && i.storageId).map((i) => i.storageId!));
    for (const o of dropOrders) await ctx.db.delete(o._id);
    for (const i of dropItems) {
      await ctx.db.delete(i._id);
      if (i.storageId && !usedStorage.has(i.storageId)) await ctx.storage.delete(i.storageId).catch(() => {});
    }
    for (const i of resetItems) await ctx.db.patch(i._id, { status: "live" });
    for (const g of dropGarages) await ctx.db.delete(g._id);
    for (const u of dropUsers) await ctx.db.delete(u._id);
    return report;
  },
});

// Demo reset (scripts/reset-demo.sh). Seed yards go back to all-live with their orders removed, and throwaway
// sign-in users (phones starting +1555999 or +15550199) plus the demo accounts (Sam and Maya B) are deleted with
// their yards, items and orders. Orders are only ever touched inside a seed or throwaway yard.
const DEMO_SELLER_PHONES = SEED.map((g) => g.phone);
const THROWAWAY_PHONE_PREFIXES = ["+1555999", "+15550199"];
const DEMO_ACCOUNT_PHONES = ["+15555550101", "+15555550102"]; // Sam, Maya B

async function garagesOf(ctx: MutationCtx, ownerId: Id<"users">) {
  return await ctx.db.query("garages").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect();
}

// Same cleanup as demoOrder: release the order's reserved items before the order goes away.
async function deleteOrdersIn(ctx: MutationCtx, garageId: Id<"garages">) {
  let deleted = 0;
  const orders = await ctx.db.query("orders").withIndex("by_garage", (q) => q.eq("garageId", garageId)).collect();
  for (const order of orders) {
    for (const id of order.itemIds) {
      const item = await ctx.db.get(id);
      if (item?.status === "reserved") await ctx.db.patch(id, { status: "live" });
    }
    await ctx.db.delete(order._id);
    deleted++;
  }
  return deleted;
}

export const resetDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const counts = { itemsRelisted: 0, ordersDeleted: 0, usersDeleted: 0, garagesDeleted: 0, itemsDeleted: 0 };

    for (const phone of DEMO_SELLER_PHONES) {
      const user = await ctx.db.query("users").withIndex("by_phone", (q) => q.eq("phone", phone)).unique();
      if (!user) continue;
      for (const garage of await garagesOf(ctx, user._id)) {
        counts.ordersDeleted += await deleteOrdersIn(ctx, garage._id);
        const items = await ctx.db.query("items").withIndex("by_garage", (q) => q.eq("garageId", garage._id)).collect();
        for (const item of items) {
          if (item.status === "reserved" || item.status === "sold") {
            await ctx.db.patch(item._id, { status: "live" });
            counts.itemsRelisted++;
          }
        }
      }
    }

    const throwaway: Doc<"users">[] = [];
    for (const phone of DEMO_ACCOUNT_PHONES) {
      const user = await ctx.db.query("users").withIndex("by_phone", (q) => q.eq("phone", phone)).unique();
      if (user) throwaway.push(user);
    }
    for (const prefix of THROWAWAY_PHONE_PREFIXES) {
      throwaway.push(
        ...(await ctx.db
          .query("users")
          .withIndex("by_phone", (q) => q.gte("phone", prefix).lt("phone", prefix + "\uffff"))
          .collect()),
      );
    }
    for (const user of throwaway) {
      for (const garage of await garagesOf(ctx, user._id)) {
        counts.ordersDeleted += await deleteOrdersIn(ctx, garage._id);
        const items = await ctx.db.query("items").withIndex("by_garage", (q) => q.eq("garageId", garage._id)).collect();
        for (const item of items) {
          await ctx.db.delete(item._id);
          counts.itemsDeleted++;
        }
        await ctx.db.delete(garage._id);
        counts.garagesDeleted++;
      }
      await ctx.db.delete(user._id);
      counts.usersDeleted++;
    }
    return counts;
  },
});
