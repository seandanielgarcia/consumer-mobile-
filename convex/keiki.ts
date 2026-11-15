import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { describeClothingPhoto } from "./ai";

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
    size: v.string(),
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
      listing = await describeClothingPhoto(storedUrl);
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
      title: listing.title,
      size: listing.size,
      description: listing.description,
      priceCents,
      status: live ? "live" : "draft",
    });
    return live
      ? { item_id: itemId, title: listing.title, size: listing.size, price: priceCents / 100, status: "live" }
      : { item_id: itemId, title: listing.title, size: listing.size, suggested_price: priceCents / 100, status: "draft" };
  },
});

export const setPrice = internalMutation({
  args: { phones: v.array(v.string()), itemId: v.string(), price: v.number() },
  handler: async (ctx, { phones, itemId, price }): Promise<ToolResult> => {
    const found = await itemInGarage(ctx, phones, itemId);
    if (!found.item) return found.error;
    const priceCents = toCents(price);
    if (priceCents === null) return { error: "invalid_price" };
    const { item } = found;
    if (item.status !== "draft" && item.status !== "live") return { error: "item_not_editable", status: item.status };
    await ctx.db.patch(item._id, { priceCents, status: "live" });
    return { item_id: item._id, title: item.title, price: priceCents / 100, status: "live" };
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
    // TODO(SEA-4 removed): "removed" waits on Hailey (H5): map to draft or add a 5th status.
    if (status !== "sold") return { error: "unsupported_status" };
    const { item } = found;
    await ctx.db.patch(item._id, { status: "sold" });
    return { item_id: item._id, title: item.title, status: "sold" };
  },
});
