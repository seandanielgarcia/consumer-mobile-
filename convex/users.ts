import { v } from "convex/values";
import { mutation } from "./_generated/server";

const AVATAR_COLORS = ["#FFE14D", "#7EE0B5", "#FF8FB1", "#9DB4D6"];

export const getOrCreateByPhone = mutation({
  args: { phone: v.string(), name: v.optional(v.string()) },
  handler: async (ctx, { phone, name }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("users", {
      phone,
      name: name ?? "",
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    });
  },
});
