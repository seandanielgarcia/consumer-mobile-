import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const AVATAR_COLORS = ["#FFE14D", "#7EE0B5", "#FF8FB1", "#9DB4D6"];
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_INTERVAL_MS = 60 * 1000;

const isDemoPhone = (phone: string) => {
  const allowlist: string = process.env.DEMO_PHONES ?? "";
  return allowlist
    .split(",")
    .map((p: string) => p.trim())
    .includes(phone);
};

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
    if (isDemoPhone(phone)) {
      const demo = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phone", phone))
        .unique();
      const cleared = { verified: true, verifyCode: undefined, verifyCodeExpiresAt: undefined };
      if (demo) {
        await ctx.db.patch(demo._id, { ...(demo.verified ? {} : { name }), ...cleared });
        return { userId: demo._id, code: null, verified: true, name: demo.verified ? demo.name : name };
      }
      const userId = await ctx.db.insert("users", {
        phone,
        name,
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        verified: true,
      });
      return { userId, code: null, verified: true, name };
    }
    const existing = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .unique();
    const keptName = existing?.verified ? existing.name : name;
    if (
      existing?.verifyCode &&
      existing.verifyCodeExpiresAt &&
      existing.verifyCodeExpiresAt - CODE_TTL_MS + RESEND_INTERVAL_MS > Date.now()
    ) {
      return { userId: existing._id, code: existing.verifyCode, verified: false, name: keptName };
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
    const verification = { verifyCode: code, verifyCodeExpiresAt: Date.now() + CODE_TTL_MS };
    if (existing) {
      await ctx.db.patch(existing._id, existing.verified ? verification : { name, verified: false, ...verification });
      return { userId: existing._id, code, verified: false, name: keptName };
    }
    const userId = await ctx.db.insert("users", {
      phone,
      name,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      verified: false,
      ...verification,
    });
    return { userId, code, verified: false, name };
  },
});

export const isVerified = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    return user?.verified === true && !user.verifyCode;
  },
});

export const isDemoUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    return user ? isDemoPhone(user.phone) : false;
  },
});

export const devSkipVerification = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    if (process.env.DEV_ALLOW_SKIP !== "true") throw new Error("Skipping verification is off");
    await ctx.db.patch(userId, { verified: true, verifyCode: undefined, verifyCodeExpiresAt: undefined });
  },
});
