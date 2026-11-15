import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { describeItemPhoto } from "./ai";

type ToolResult = Record<string, unknown>;

const NO_GARAGE = { error: "no_garage" };
const NOT_FOUND = { error: "item_not_found" };

function phoneCandidates(raw: string): string[] {
  const stripped = raw.trim().replace(/^[a-z]+:/i, "");
  const digits = stripped.replace(/\D/g, "");
  const candidates = [raw.trim(), stripped];
  if (digits.length === 10) candidates.push(`+1${digits}`);
  if (digits.length > 10) candidates.push(`+${digits}`);
  return [...new Set(candidates.filter(Boolean))];
}

async function userForPhones(ctx: QueryCtx, phones: string[]): Promise<Doc<"users"> | null> {
  for (const phone of phones.flatMap(phoneCandidates)) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();
    if (user) return user;
  }
  return null;
}

async function garageForPhones(ctx: QueryCtx, phones: string[]): Promise<Doc<"garages"> | null> {
  for (const phone of phones.flatMap(phoneCandidates)) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();
    if (!user) continue;
    const garage = await ctx.db
      .query("garages")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .first();
    if (garage) return garage;
  }
  return null;
}

async function itemInGarage(ctx: QueryCtx, phones: string[], itemId: string) {
  const garage = await garageForPhones(ctx, phones);
  if (!garage) return { item: null, error: NO_GARAGE };
  const id = ctx.db.normalizeId("items", itemId);
  const item = id ? await ctx.db.get(id) : null;
  if (!item || item.garageId !== garage._id) return { item: null, error: NOT_FOUND };
  return { item, error: null };
}

function missingFields(item: { category?: string; size?: string }, hasPrice: boolean): string[] {
  const missing = hasPrice ? [] : ["price"];
  if (/cloth|shoe|apparel|footwear/i.test(item.category ?? "") && !item.size) missing.push("size");
  return missing;
}

function details(item: { title: string; category?: string; size?: string; brand?: string; condition?: string; color?: string; description: string }) {
  const { title, category, size, brand, condition, color, description } = item;
  return { title, category, size, brand, condition, color, description };
}

function itemLink(itemId: Id<"items">) {
  return `${process.env.CONVEX_SITE_URL}/i/${itemId}`;
}

function toCents(price: number): number | null {
  const cents = Math.round(price * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export const garageIdForPhone = internalQuery({
  args: { phones: v.array(v.string()) },
  handler: async (ctx, { phones }): Promise<Id<"garages"> | null> => (await garageForPhones(ctx, phones))?._id ?? null,
});

export const insertItem = internalMutation({
  args: {
    garageId: v.id("garages"),
    storageId: v.id("_storage"),
    title: v.string(),
    category: v.optional(v.string()),
    size: v.optional(v.string()),
    brand: v.optional(v.string()),
    condition: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.string(),
    priceCents: v.number(),
    status: v.union(v.literal("draft"), v.literal("live")),
  },
  handler: async (ctx, { storageId, ...item }) => {
    const photoUrl = await ctx.storage.getUrl(storageId);
    if (!photoUrl) throw new Error("Photo upload missing");
    return await ctx.db.insert("items", { ...item, storageId, photoUrl, aiGenerated: true });
  },
});

export const addItem = internalAction({
  args: { phones: v.array(v.string()), photoUrl: v.string(), price: v.optional(v.number()) },
  handler: async (ctx, { phones, photoUrl, price }): Promise<ToolResult> => {
    const garageId = await ctx.runQuery(internal.keiki.garageIdForPhone, { phones });
    if (!garageId) return NO_GARAGE;
    const askedCents = price === undefined ? undefined : toCents(price);
    if (askedCents === null) return { error: "invalid_price" };

    let photo: Response;
    try {
      photo = await fetch(photoUrl);
    } catch {
      return { error: "photo_fetch_failed" };
    }
    if (!photo.ok) return { error: "photo_fetch_failed" };
    const storageId = await ctx.storage.store(await photo.blob());
    const storedUrl = await ctx.storage.getUrl(storageId);
    if (!storedUrl) return { error: "photo_fetch_failed" };

    let listing;
    try {
      listing = await describeItemPhoto(storedUrl);
    } catch (e) {
      await ctx.storage.delete(storageId);
      console.error("keiki add_item AI step failed", e);
      return { error: "ai_failed" };
    }

    const live = askedCents !== undefined;
    const priceCents = askedCents ?? listing.suggestedPriceCents;
    const itemId = await ctx.runMutation(internal.keiki.insertItem, {
      garageId,
      storageId,
      ...details(listing),
      priceCents,
      status: live ? "live" : "draft",
    });
    return {
      item_id: itemId,
      ...details(listing),
      ...(live ? { price: priceCents / 100, link: itemLink(itemId) } : { suggested_price: priceCents / 100 }),
      status: live ? "live" : "draft",
      missing: missingFields(listing, live),
    };
  },
});

export const setPrice = internalMutation({
  args: { phones: v.array(v.string()), itemId: v.string(), price: v.optional(v.number()), size: v.optional(v.string()) },
  handler: async (ctx, { phones, itemId, price, size }): Promise<ToolResult> => {
    const found = await itemInGarage(ctx, phones, itemId);
    if (!found.item) return found.error;
    if (price === undefined && size === undefined) return { error: "nothing_to_update" };
    const priceCents = price === undefined ? undefined : toCents(price);
    if (priceCents === null) return { error: "invalid_price" };
    const { item } = found;
    if (item.status !== "draft" && item.status !== "live") return { error: "item_not_editable", status: item.status };
    const updated = {
      ...item,
      ...(size !== undefined && { size }),
      ...(priceCents !== undefined && { priceCents, status: "live" as const }),
    };
    await ctx.db.patch(item._id, { size: updated.size, priceCents: updated.priceCents, status: updated.status });
    return {
      item_id: item._id,
      ...details(updated),
      price: updated.priceCents / 100,
      status: updated.status,
      ...(updated.status === "live" && { link: itemLink(item._id) }),
      missing: missingFields(updated, updated.status === "live"),
    };
  },
});

export const listItems = internalQuery({
  args: { phones: v.array(v.string()) },
  handler: async (ctx, { phones }): Promise<ToolResult> => {
    const garage = await garageForPhones(ctx, phones);
    if (!garage) return NO_GARAGE;
    const items = await ctx.db
      .query("items")
      .withIndex("by_garage", (q) => q.eq("garageId", garage._id))
      .order("desc")
      .collect();
    return {
      items: items.map((item) => ({
        item_id: item._id,
        title: item.title,
        category: item.category,
        size: item.size,
        price: item.priceCents / 100,
        status: item.status,
      })),
    };
  },
});

export const updateItem = internalMutation({
  args: { phones: v.array(v.string()), itemId: v.string(), status: v.string() },
  handler: async (ctx, { phones, itemId, status }): Promise<ToolResult> => {
    const found = await itemInGarage(ctx, phones, itemId);
    if (!found.item) return found.error;
    const { item } = found;
    if (status === "sold") {
      await ctx.db.patch(item._id, { status: "sold" });
      return { item_id: item._id, title: item.title, status: "sold" };
    }
    if (status !== "removed") return { error: "unsupported_status" };
    if (item.status !== "draft" && item.status !== "live") return { error: "item_not_editable", status: item.status };
    await ctx.db.patch(item._id, { status: "draft" });
    return { item_id: item._id, title: item.title, status: "draft" };
  },
});

export const verifyPhone = internalMutation({
  args: { phones: v.array(v.string()), code: v.string() },
  handler: async (ctx, { phones, code }): Promise<ToolResult> => {
    const user = await userForPhones(ctx, phones);
    if (!user) return { error: "no_user" };
    if (!user.verifyCode || user.verifyCode !== code.trim()) return { error: "bad_code" };
    if (!user.verifyCodeExpiresAt || user.verifyCodeExpiresAt <= Date.now()) return { error: "expired" };
    await ctx.db.patch(user._id, { verified: true, verifyCode: undefined, verifyCodeExpiresAt: undefined });
    return { ok: true };
  },
});
