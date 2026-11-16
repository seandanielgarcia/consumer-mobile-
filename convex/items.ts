import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const liveByGarage = query({
  args: { garageId: v.id("garages") },
  handler: async (ctx, { garageId }) => {
    const items = await ctx.db
      .query("items")
      .withIndex("by_garage", (q) => q.eq("garageId", garageId))
      .order("desc")
      .collect();
    return items.filter((item) => item.status === "live");
  },
});

// Every item the seller should see on their own garage: live, reserved and sold, newest first. Drafts stay hidden.
export const byGarage = query({
  args: { garageId: v.id("garages") },
  handler: async (ctx, { garageId }) => {
    const items = await ctx.db
      .query("items")
      .withIndex("by_garage", (q) => q.eq("garageId", garageId))
      .order("desc")
      .collect();
    return items.filter((item) => item.status !== "draft");
  },
});

// Seller-side status changes after pickup. Only the Whop payment.succeeded webhook may set `reserved`
// (orders.markPaid), so this never accepts it. `ownerId` comes from the client today, so this is an
// ownership check, not authentication; it tightens once sign-in carries an identity.
const ALLOWED: Record<"sold" | "live", ReadonlyArray<string>> = {
  sold: ["reserved"], // picked up
  live: ["reserved", "sold"], // put back
};

export const setStatus = mutation({
  args: { itemId: v.id("items"), ownerId: v.id("users"), status: v.union(v.literal("sold"), v.literal("live")) },
  handler: async (ctx, { itemId, ownerId, status }) => {
    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Item not found");
    const garage = await ctx.db.get(item.garageId);
    if (!garage || garage.ownerId !== ownerId) throw new Error("This item isn't in your yard");
    if (!ALLOWED[status].includes(item.status)) throw new Error(`Can't move an item from ${item.status} to ${status}`);
    await ctx.db.patch(itemId, { status });

    // Keep the paid order in step with its items. A picked_up order is included for put-back, since an
    // order flips to picked_up as soon as its last item is marked sold.
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_garage", (q) => q.eq("garageId", item.garageId))
      .collect();
    const order = orders.find(
      (o) => (o.status === "paid" || (status === "live" && o.status === "picked_up")) && o.itemIds.includes(itemId),
    );
    if (order) {
      if (status === "sold") {
        const siblings = await Promise.all(order.itemIds.filter((id) => id !== itemId).map((id) => ctx.db.get(id)));
        if (siblings.every((s) => s?.status === "sold")) await ctx.db.patch(order._id, { status: "picked_up" });
      } else {
        await ctx.db.patch(order._id, { itemIds: order.itemIds.filter((id) => id !== itemId) });
      }
    }
    return { itemId, status, orderId: order?._id ?? null };
  },
});

async function ownedItem(ctx: MutationCtx, itemId: Id<"items">, ownerId: Id<"users">) {
  const item = await ctx.db.get(itemId);
  if (!item) throw new Error("Item not found");
  const garage = await ctx.db.get(item.garageId);
  if (!garage || garage.ownerId !== ownerId) throw new Error("This item isn't in your yard");
  return item;
}

// Edit a listing from the yard grid. Reserved items are frozen until pickup, since a buyer already paid for them.
export const update = mutation({
  args: {
    itemId: v.id("items"),
    ownerId: v.id("users"),
    title: v.string(),
    category: v.optional(v.string()),
    size: v.optional(v.string()),
    brand: v.optional(v.string()),
    condition: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.string(),
    priceCents: v.number(),
  },
  handler: async (ctx, { itemId, ownerId, ...fields }) => {
    const item = await ownedItem(ctx, itemId, ownerId);
    if (item.status === "reserved") throw new Error("Reserved items can't be edited until pickup");
    if (!fields.title.trim()) throw new Error("Add a title");
    if (!Number.isInteger(fields.priceCents) || fields.priceCents <= 0) throw new Error("Set a price");
    await ctx.db.patch(itemId, {
      ...fields,
      title: fields.title.trim(),
      description: fields.description.trim(),
      aiGenerated: false,
    });
    return itemId;
  },
});

// Remove a listing and its photo. Reserved items can't be removed, since a buyer already paid for them.
export const remove = mutation({
  args: { itemId: v.id("items"), ownerId: v.id("users") },
  handler: async (ctx, { itemId, ownerId }) => {
    const item = await ownedItem(ctx, itemId, ownerId);
    if (item.status === "reserved") throw new Error("Reserved items can't be removed until pickup");
    await ctx.db.delete(itemId);
    if (item.storageId) await ctx.storage.delete(item.storageId).catch(() => {});
    return itemId;
  },
});
