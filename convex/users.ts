import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { SEED_YARD_PHONES } from "./seed";

const AVATAR_COLORS = ["#FFE14D", "#7EE0B5", "#FF8FB1", "#9DB4D6"];
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_INTERVAL_MS = 60 * 1000;

export const isDemoPhone = (phone: string) => {
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

// sellerContact trusts a client-supplied buyerId, so only demo and seed numbers are textable.
// allowBuyerTexts is stored but inert until session-token auth (option A) lands; then the opt-in returns.
const isTextableSeller = (seller: Doc<"users">) =>
  /^\+[1-9]\d{7,14}$/.test(seller.phone) && (isDemoPhone(seller.phone) || SEED_YARD_PHONES.includes(seller.phone));

export const requestBuyerTexts = mutation({
  args: { garageId: v.id("garages"), ownerId: v.id("users"), allow: v.boolean() },
  handler: async (ctx, { garageId, ownerId, allow }) => {
    const garage = await ctx.db.get(garageId);
    const seller = garage?.ownerId === ownerId ? await ctx.db.get(ownerId) : null;
    if (!seller?.verified) throw new ConvexError("Verify your phone before changing buyer texts.");
    const previous = seller.buyerTextsRequest;
    const now = Date.now();
    if (previous?.allow === allow && previous.expiresAt > now) return previous.code;

    // Leading zeroes keep consent codes separate from regular sign-in codes.
    // Only a Keiki text from the seller's phone can apply the requested change.
    let code: string;
    do {
      code = String((allow ? 1 : 501) + Math.floor(Math.random() * 499)).padStart(4, "0");
    } while (code === previous?.code);
    await ctx.db.patch(ownerId, { buyerTextsRequest: { code, allow, expiresAt: now + CODE_TTL_MS } });
    return code;
  },
});

export const sellerTextable = query({
  args: { garageId: v.id("garages") },
  handler: async (ctx, { garageId }) => {
    const garage = await ctx.db.get(garageId);
    const seller = garage && (await ctx.db.get(garage.ownerId));
    return !!seller && isTextableSeller(seller);
  },
});

export const sellerContact = query({
  args: { garageId: v.id("garages"), buyerId: v.optional(v.id("users")) },
  handler: async (ctx, { garageId, buyerId }) => {
    if (!buyerId) return null;
    const buyer = await ctx.db.get(buyerId);
    if (!buyer || buyer.verified !== true || buyer.verifyCode) return null;
    const garage = await ctx.db.get(garageId);
    if (!garage || garage.ownerId === buyerId) return null;
    const seller = await ctx.db.get(garage.ownerId);
    if (!seller || !isTextableSeller(seller)) return null;
    return { firstName: seller.name.trim().split(/\s+/)[0] || "the seller", phone: seller.phone };
  },
});
