import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

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

export const isPremium = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => (await ctx.db.get(userId))?.premium === true,
});

export const exists = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => (await ctx.db.get(userId)) !== null,
});

export const setPremium = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const userId = ctx.db.normalizeId("users", args.userId);
    if (!userId || !(await ctx.db.get(userId))) return false;
    await ctx.db.patch(userId, { premium: true });
    return true;
  },
});
