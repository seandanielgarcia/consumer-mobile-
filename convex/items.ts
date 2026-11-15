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
