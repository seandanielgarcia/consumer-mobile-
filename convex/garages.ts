import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { roundCoord } from "./lib/location";
import { internal } from "./_generated/api";

export const mine = query({
  args: { ownerId: v.id("users") },
  handler: async (ctx, { ownerId }) => {
    const garage = await ctx.db
      .query("garages")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .first();
    if (!garage) return null;
    const items = await ctx.db
      .query("items")
      .withIndex("by_garage", (q) => q.eq("garageId", garage._id))
      .order("desc")
      .collect();
    return { garage, items: items.filter((item) => item.status === "live") };
  },
});

export const get = query({
  args: { garageId: v.id("garages") },
  handler: async (ctx, { garageId }) => {
    const garage = await ctx.db.get(garageId);
    if (!garage) return null;
    return { _id: garage._id, neighborhood: garage.neighborhood, city: garage.city, isOpen: garage.isOpen };
  },
});

export const openWithItems = mutation({
  args: {
    ownerId: v.id("users"),
    neighborhood: v.string(),
    city: v.optional(v.string()),
    lat: v.number(),
    lng: v.number(),
    items: v.array(
      v.object({
        storageId: v.id("_storage"),
        title: v.string(),
        category: v.optional(v.string()),
        size: v.optional(v.string()),
        brand: v.optional(v.string()),
        condition: v.optional(v.string()),
        color: v.optional(v.string()),
        description: v.string(),
        priceCents: v.number(),
        aiGenerated: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, { ownerId, neighborhood, city, lat, lng, items }) => {
    if (items.length === 0) throw new Error("Add at least one item");
    const location = { neighborhood, city, approxLat: roundCoord(lat), approxLng: roundCoord(lng), isOpen: true };
    const existing = await ctx.db
      .query("garages")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .first();
    const garageId = existing?._id ?? (await ctx.db.insert("garages", { ownerId, ...location }));
    if (existing) await ctx.db.patch(existing._id, location);
    if (!existing?.isOpen) await ctx.scheduler.runAfter(0, internal.yard.notifyYardOpen, { garageId });
    const itemIds = [];
    for (const item of items) {
      const photoUrl = await ctx.storage.getUrl(item.storageId);
      if (!photoUrl) throw new Error("Photo upload missing");
      itemIds.push(await ctx.db.insert("items", { ...item, garageId, photoUrl, status: "live" }));
    }
    return { garageId, itemIds, firstOpen: !existing };
  },
});
