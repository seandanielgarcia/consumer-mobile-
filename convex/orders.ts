import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const HOLD_MS = 10 * 60 * 1000;

export async function heldItemIds(ctx: QueryCtx, garageId: Id<"garages">, exceptBuyerId?: Id<"users">) {
  const since = Date.now() - HOLD_MS;
  const pending = await ctx.db
    .query("orders")
    .withIndex("by_garage", (q) => q.eq("garageId", garageId))
    .filter((q) => q.and(q.eq(q.field("status"), "pending"), q.gt(q.field("_creationTime"), since)))
    .collect();
  return new Set(pending.filter((p) => p.buyerId !== exceptBuyerId).flatMap((p) => p.itemIds));
}

async function markOrderPaid(ctx: MutationCtx, orderId: Id<"orders">) {
  const order = await ctx.db.get(orderId);
  if (!order) throw new Error("Order not found");
  if (order.status === "cancelled") throw new Error("Order was cancelled");
  const garage = await ctx.db.get(order.garageId);
  const seller = garage && (await ctx.db.get(garage.ownerId));
  const result = { orderId, alreadyPaid: order.status !== "pending", sellerName: seller?.name ?? "", sellerPhone: seller?.phone ?? "" };
  if (result.alreadyPaid) return { ...result, unavailableItemIds: [] as Id<"items">[] };
  const unavailableItemIds: Id<"items">[] = [];
  for (const itemId of order.itemIds) {
    const item = await ctx.db.get(itemId);
    if (item?.status === "live") await ctx.db.patch(itemId, { status: "reserved" });
    else unavailableItemIds.push(itemId);
  }
  await ctx.db.patch(orderId, { status: "paid" });
  return { ...result, unavailableItemIds };
}

export const createPending = mutation({
  args: { buyerId: v.id("users"), garageId: v.id("garages"), itemIds: v.array(v.id("items")) },
  handler: async (ctx, { buyerId, garageId, itemIds }) => {
    const ids = [...new Set(itemIds)];
    if (ids.length === 0) throw new Error("Pick at least one item");
    if (!(await ctx.db.get(buyerId))) throw new Error("Unknown buyer");
    const held = await heldItemIds(ctx, garageId, buyerId);
    let totalCents = 0;
    for (const id of ids) {
      const item = await ctx.db.get(id);
      if (!item) throw new Error("An item no longer exists");
      if (item.garageId !== garageId) throw new Error("All items must come from one garage");
      if (item.status !== "live") throw new Error(`${item.title} is no longer available`);
      if (held.has(id)) throw new Error(`Someone else is checking out ${item.title} right now`);
      totalCents += item.priceCents;
    }
    const orderId = await ctx.db.insert("orders", { buyerId, garageId, itemIds: ids, totalCents, status: "pending" });
    return { orderId, totalCents };
  },
});

export const markPaid = internalMutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const payment = await markOrderPaid(ctx, orderId);
    if (!payment.alreadyPaid && payment.unavailableItemIds.length === 0 && payment.sellerPhone) {
      await ctx.scheduler.runAfter(0, internal.orders.textSeller, { orderId, phone: payment.sellerPhone });
    }
  },
});

export const confirmReturn = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    if (process.env.CHECKOUT_PAID_ON_REDIRECT !== "true") {
      return { markedPaid: false, status: (await ctx.db.get(orderId))?.status ?? null };
    }
    await markOrderPaid(ctx, orderId);
    return { markedPaid: true, status: "paid" as const };
  },
});

export const getOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) return null;
    const garage = await ctx.db.get(order.garageId);
    const seller = garage && (await ctx.db.get(garage.ownerId));
    const items = await Promise.all(order.itemIds.map((id) => ctx.db.get(id)));
    return {
      status: order.status,
      totalCents: order.totalCents,
      sellerName: seller?.name ?? "The seller",
      sellerTextSent: order.sellerTextSent,
      items: items
        .filter((i) => i !== null)
        .map((i) => ({ _id: i._id, title: i.title, size: i.size, priceCents: i.priceCents, photoUrl: i.photoUrl })),
    };
  },
});

export const textSeller = internalAction({
  args: { orderId: v.id("orders"), phone: v.string() },
  handler: async (ctx, { orderId, phone }) => {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) return;
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        From: TWILIO_FROM_NUMBER,
        Body: "An item from your Garage Sale was paid for. Open the app to check your garage.",
      }).toString(),
    });
    if (!response.ok) throw new Error(`Seller text failed (${response.status}).`);
    await ctx.runMutation(internal.orders.recordSellerText, { orderId });
  },
});

export const recordSellerText = internalMutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    await ctx.db.patch(orderId, { sellerTextSent: true });
  },
});
