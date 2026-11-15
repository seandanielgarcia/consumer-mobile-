import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const AVATAR_COLORS = ["#FFE14D", "#7EE0B5", "#FF8FB1", "#9DB4D6"];
const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_RESEND_MS = 60 * 1000;

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
    const now = Date.now();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .unique();
    if (existing?.verifyCodeIssuedAt !== undefined && now - existing.verifyCodeIssuedAt < CODE_RESEND_MS) {
      const wait = Math.ceil((CODE_RESEND_MS - (now - existing.verifyCodeIssuedAt)) / 1000);
      throw new Error(`A code was just sent. Try again in ${wait} s.`);
    }
    let code = String(Math.floor(1000 + Math.random() * 9000));
    for (let attempt = 0; attempt < 20; attempt++) {
      const holder = await ctx.db
        .query("users")
        .withIndex("by_verifyCode", (q) => q.eq("verifyCode", code))
        .first();
      if (!holder || holder.phone === phone || (holder.verifyCodeExpiresAt ?? 0) <= Date.now()) break;
      code = String(Math.floor(1000 + Math.random() * 9000));
    }
    const verification = { verifyCode: code, verifyCodeExpiresAt: now + CODE_TTL_MS, verifyCodeIssuedAt: now };
    if (existing) {
      // A verified account keeps its name and stays verified; the new code only re-proves the same number.
      const verified = existing.verified === true;
      await ctx.db.patch(existing._id, verified ? verification : { name, verified: false, ...verification });
      return { userId: existing._id, code, verified };
    }
    const userId = await ctx.db.insert("users", {
      phone,
      name,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      verified: false,
      ...verification,
    });
    return { userId, code, verified: false };
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
    await ctx.db.patch(userId, { verified: true, verifyCode: undefined, verifyCodeExpiresAt: undefined, verifyCodeIssuedAt: undefined });
  },
});
