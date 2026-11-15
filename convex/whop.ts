import { WhopClient, WhopEnvironment } from "@whop/sdk";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery } from "./_generated/server";

function whopClient() {
  return new WhopClient({
    token: process.env.WHOP_API_KEY!,
    environment: process.env.WHOP_ENVIRONMENT === "production" ? WhopEnvironment.Production : WhopEnvironment.Sandbox,
  });
}

export const pendingOrder = internalQuery({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");
    if (order.status !== "pending") throw new Error("Order is not awaiting payment");
    return { totalCents: order.totalCents };
  },
});

export const normalizeOrderId = internalQuery({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => ctx.db.normalizeId("orders", orderId),
});

export const setOrderCheckout = internalMutation({
  args: { orderId: v.id("orders"), whopCheckoutId: v.string() },
  handler: async (ctx, { orderId, whopCheckoutId }) => {
    await ctx.db.patch(orderId, { whopCheckoutId });
  },
});

export const createOrderCheckout = action({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }): Promise<{ purchaseUrl: string }> => {
    const { totalCents } = await ctx.runQuery(internal.whop.pendingOrder, { orderId });
    const checkout = await whopClient().checkoutConfigurations.create({
      variant: {
        title: "Garage Sale order",
        billing_type: "one_time",
        initial_price: totalCents / 100,
        currency: "usd",
        force_create_new_plan: true,
      },
      metadata: { orderId },
      redirect_url: `${process.env.CONVEX_SITE_URL}/whop/return?orderId=${orderId}`,
    });
    if (!checkout.purchase_url) throw new Error("Whop returned no purchase_url");
    await ctx.runMutation(internal.whop.setOrderCheckout, { orderId, whopCheckoutId: checkout.id });
    return { purchaseUrl: checkout.purchase_url };
  },
});
