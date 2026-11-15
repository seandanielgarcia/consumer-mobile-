import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

export const reservedByOwner = query({
  args: { ownerId: v.id("users") },
  handler: async (ctx, { ownerId }) => {
    const garage = await ctx.db.query("garages")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .first();
    if (!garage) return [];
    const items = await ctx.db.query("items")
      .withIndex("by_garage", (q) => q.eq("garageId", garage._id))
      .order("desc")
      .collect();
    return items.filter((item) => item.status === "reserved");
  },
});

export const resolvePickup = mutation({
  args: {
    ownerId: v.id("users"),
    itemId: v.id("items"),
    status: v.union(v.literal("sold"), v.literal("live")),
  },
  handler: async (ctx, { ownerId, itemId, status }) => {
    const item = await ctx.db.get(itemId);
    const garage = item && await ctx.db.get(item.garageId);
    if (!item || !garage || garage.ownerId !== ownerId) {
      throw new Error("This item is unavailable.");
    }
    if (item.status !== "reserved") {
      throw new Error("This item is no longer reserved.");
    }
    await ctx.db.patch(itemId, { status });
  },
});
