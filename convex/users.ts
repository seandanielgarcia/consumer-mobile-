import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

const AVATAR_COLORS = ["#FFE14D", "#7EE0B5", "#FF8FB1", "#9DB4D6"];
const CODE_TTL_MS = 10 * 60 * 1000;

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

export const startVerification = mutation({
  args: { name: v.string(), phone: v.string() },
  handler: async (ctx, { name, phone }) => {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const verification = { verifyCode: code, verifyCodeExpiresAt: Date.now() + CODE_TTL_MS };
    const existing = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { name, verified: false, ...verification });
      return { userId: existing._id, code };
    }
    const userId = await ctx.db.insert("users", {
      phone,
      name,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      verified: false,
      ...verification,
    });
    return { userId, code };
  },
});

export const isVerified = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => (await ctx.db.get(userId))?.verified === true,
});

export const devSkipVerification = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    if (process.env.DEV_ALLOW_SKIP !== "true") throw new Error("Skipping verification is off");
    await ctx.db.patch(userId, { verified: true, verifyCode: undefined, verifyCodeExpiresAt: undefined });
  },
});

export const isPremium = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => (await ctx.db.get(userId))?.isPremium === true,
});

export const checkoutBlocker = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return "Unknown user";
    if (user.isPremium) return "Already premium";
    return null;
  },
});

export const setPremium = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const userId = ctx.db.normalizeId("users", args.userId);
    if (!userId || !(await ctx.db.get(userId))) return false;
    await ctx.db.patch(userId, { isPremium: true });
    return true;
  },
});
