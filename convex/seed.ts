import { v } from "convex/values";
import { internalAction, internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { roundCoord } from "./lib/location";
import { STOCK, type StockPhoto } from "../src/lib/stock";

const seedItems = (seller: StockPhoto["seller"]) =>
  STOCK.filter((s) => s.use === "seed" && s.seller === seller).map(({ file, title, size, priceCents, description }) => ({
    photo: file.replace(/\.jpg$/, ""),
    title,
    size,
    priceCents,
    description,
  }));

const SEED = [
  {
    name: "Hailey",
    phone: "+15550100001",
    avatarColor: "#FFE14D",
    neighborhood: "Mission",
    lat: 37.7599,
    lng: -122.4148,
    items: seedItems("Hailey"),
  },
  {
    name: "Maya",
    phone: "+15550100002",
    avatarColor: "#7EE0B5",
    neighborhood: "Hayes Valley",
    lat: 37.7764,
    lng: -122.4242,
    items: seedItems("Maya"),
  },
  {
    name: "Jon",
    phone: "+15550100003",
    avatarColor: "#FF8FB1",
    neighborhood: "Dogpatch",
    lat: 37.7609,
    lng: -122.3876,
    items: seedItems("Jon"),
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

// Guard rails shared by devCleanup and resetDemo, so a cleanup can't wipe a demo or smoke test that is in flight:
// - nothing created in the last PROTECT_RECENT_MS is deleted or relisted unless the caller passes force: true;
// - users on the SMOKE_PHONE_PREFIX (automated smoke tests, CX-3) are never touched unless force: true;
// - the demo accounts (Sam, Maya B, DEMO_ACCOUNT_PHONES) are treated like throwaway users by both cleanups.
const PROTECT_RECENT_MS = 15 * 60 * 1000;
const SMOKE_PHONE_PREFIX = "+1555977";
const DEMO_ACCOUNT_PHONES = ["+15555550101", "+15555550102"]; // Sam, Maya B (DEMO_PHONES on the deployment)
const isSmokePhone = (phone: string) => phone.startsWith(SMOKE_PHONE_PREFIX);
const isRecent = (doc: { _creationTime: number }, now: number) => now - doc._creationTime < PROTECT_RECENT_MS;
// The one rule for the demo logins: never deleted by any cleanup at any age; resetDemo only resets their yards and orders, and only `resetDemo --force` wipes them.
const isDemoAccount = (phone: string) => DEMO_ACCOUNT_PHONES.includes(phone);

// A recent order (unless force) protects everything it points to: the order, its items, its yard, the yard's owner and the buyer.
async function protectedByRecentOrders(ctx: MutationCtx, now: number, force: boolean) {
  const orders = new Set<Id<"orders">>();
  const items = new Set<Id<"items">>();
  const garages = new Set<Id<"garages">>();
  const users = new Set<Id<"users">>();
  if (force) return { orders, items, garages, users };
  for (const order of await ctx.db.query("orders").collect()) {
    if (!isRecent(order, now)) continue;
    orders.add(order._id);
    order.itemIds.forEach((id) => items.add(id));
    garages.add(order.garageId);
    users.add(order.buyerId);
    const garage = await ctx.db.get(order.garageId);
    if (garage) users.add(garage.ownerId);
  }
  return { orders, items, garages, users };
}

const SEED_PHONES = new Set(SEED.map((g) => g.phone));
const SEED_TITLES = new Set(SEED.flatMap((g) => g.items.map((i) => i.title)));
const TEST_TITLE = /^(QA|E2E|Zqlatency)|\(edited\)|bundle/i;
const isFictional = (phone: string) => /^\+1(555|\d{3}555)/.test(phone);

export const devCleanup = internalMutation({
  args: { dryRun: v.boolean(), alsoPhones: v.optional(v.array(v.string())), force: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun, alsoPhones, force }) => {
    const now = Date.now();
    const protect = <T extends { _creationTime: number }>(doc: T) => !force && isRecent(doc, now);
    const held = await protectedByRecentOrders(ctx, now, force === true);
    const extra = new Set(alsoPhones ?? []);
    const users = await ctx.db.query("users").collect();
    const keepUser = (u: Doc<"users">) =>
      isDemoAccount(u.phone) ||
      held.users.has(u._id) ||
      (!force && isSmokePhone(u.phone)) ||
      protect(u) ||
      (!extra.has(u.phone) && (SEED_PHONES.has(u.phone) || !isFictional(u.phone)));
    const dropUsers = users.filter((u) => !keepUser(u));
    const dropUserIds = new Set<Id<"users">>(dropUsers.map((u) => u._id));
    const seedOwnerIds = new Set(users.filter((u) => SEED_PHONES.has(u.phone)).map((u) => u._id));

    const garages = await ctx.db.query("garages").collect();
    const dropGarages = garages.filter((g) => dropUserIds.has(g.ownerId) && !held.garages.has(g._id));
    const dropGarageIds = new Set<Id<"garages">>(dropGarages.map((g) => g._id));
    const seedGarageIds = new Set(garages.filter((g) => seedOwnerIds.has(g.ownerId)).map((g) => g._id));

    const items = await ctx.db.query("items").collect();
    const dropItems = items.filter(
      (i) =>
        !protect(i) &&
        !held.items.has(i._id) &&
        (dropGarageIds.has(i.garageId) || TEST_TITLE.test(i.title) || (seedGarageIds.has(i.garageId) && !SEED_TITLES.has(i.title))),
    );
    const dropItemIds = new Set<Id<"items">>(dropItems.map((i) => i._id));

    const orders = await ctx.db.query("orders").collect();
    const dropOrders = orders.filter(
      (o) =>
        !held.orders.has(o._id) && (dropUserIds.has(o.buyerId) || dropGarageIds.has(o.garageId) || o.itemIds.some((id) => dropItemIds.has(id))),
    );
    // Items held by a protected (recent) order stay reserved; everything else in a seed yard goes back to live.
    const resetItems = items.filter(
      (i) => !dropItemIds.has(i._id) && !held.items.has(i._id) && seedGarageIds.has(i.garageId) && i.status !== "live",
    );
    const protectedCount = {
      users: users.filter((u) => protect(u) || held.users.has(u._id) || (!force && isSmokePhone(u.phone))).length,
      items: items.filter((i) => protect(i) || held.items.has(i._id)).length,
      orders: held.orders.size,
    };

    const report = {
      users: dropUsers.map((u) => `${u.name} ${u.phone}`),
      garages: dropGarages.map((g) => `${users.find((u) => u._id === g.ownerId)?.name ?? "?"} · ${g.neighborhood}`),
      items: dropItems.map((i) => `${i.title} (${i.status})`),
      orders: dropOrders.map((o) => `${o._id} ${o.status} $${o.totalCents / 100}`),
      resetToLive: resetItems.map((i) => `${i.title} (${i.status})`),
      protected: protectedCount,
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
// their yards, items and orders. Orders are only ever touched inside a seed or throwaway yard. Anything created in
// the last 15 minutes, and any smoke-test user (+1555977…), is left alone unless force: true.
const DEMO_SELLER_PHONES = SEED.map((g) => g.phone);
const THROWAWAY_PHONE_PREFIXES = ["+1555999", "+15550199"];

async function garagesOf(ctx: MutationCtx, ownerId: Id<"users">) {
  return await ctx.db.query("garages").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect();
}

// Same cleanup as demoOrder: release the order's reserved items before the order goes away. Recent orders are kept
// (unless force) and the item ids they hold are returned so the caller leaves those items reserved.
async function deleteOrdersIn(ctx: MutationCtx, garageId: Id<"garages">, now: number, force: boolean) {
  let deleted = 0;
  const kept = new Set<Id<"items">>();
  const orders = await ctx.db.query("orders").withIndex("by_garage", (q) => q.eq("garageId", garageId)).collect();
  for (const order of orders) {
    if (!force && isRecent(order, now)) {
      order.itemIds.forEach((id) => kept.add(id));
      continue;
    }
    for (const id of order.itemIds) {
      const item = await ctx.db.get(id);
      if (item?.status === "reserved") await ctx.db.patch(id, { status: "live" });
    }
    await ctx.db.delete(order._id);
    deleted++;
  }
  return { deleted, kept };
}

export const resetDemo = internalMutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, { force = false }) => {
    const now = Date.now();
    const held = await protectedByRecentOrders(ctx, now, force);
    const counts = { itemsRelisted: 0, ordersDeleted: 0, usersDeleted: 0, garagesDeleted: 0, itemsDeleted: 0, protectedUsers: 0, protectedOrders: held.orders.size };

    // Seed yards, and (unless --force) the demo logins' yards, are reset in place: orders out, items back to live.
    const resetPhones = force ? DEMO_SELLER_PHONES : [...DEMO_SELLER_PHONES, ...DEMO_ACCOUNT_PHONES];
    for (const phone of resetPhones) {
      const user = await ctx.db.query("users").withIndex("by_phone", (q) => q.eq("phone", phone)).unique();
      if (!user) continue;
      for (const garage of await garagesOf(ctx, user._id)) {
        const { deleted, kept } = await deleteOrdersIn(ctx, garage._id, now, force);
        counts.ordersDeleted += deleted;
        const items = await ctx.db.query("items").withIndex("by_garage", (q) => q.eq("garageId", garage._id)).collect();
        for (const item of items) {
          if (kept.has(item._id)) continue;
          if (item.status === "reserved" || item.status === "sold") {
            await ctx.db.patch(item._id, { status: "live" });
            counts.itemsRelisted++;
          }
        }
      }
    }

    const throwaway: Doc<"users">[] = [];
    if (force) {
      for (const phone of DEMO_ACCOUNT_PHONES) {
        const user = await ctx.db.query("users").withIndex("by_phone", (q) => q.eq("phone", phone)).unique();
        if (user) throwaway.push(user);
      }
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
      // Skip smoke users, anyone created recently, and anyone a recent order points to (buyer or yard owner).
      if (!force && (isSmokePhone(user.phone) || isRecent(user, now) || held.users.has(user._id))) {
        counts.protectedUsers++;
        continue;
      }
      for (const garage of await garagesOf(ctx, user._id)) {
        if (held.garages.has(garage._id)) continue;
        const { deleted } = await deleteOrdersIn(ctx, garage._id, now, force);
        counts.ordersDeleted += deleted;
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
