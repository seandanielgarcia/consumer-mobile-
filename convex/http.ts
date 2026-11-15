import type { Whop } from "@whop/sdk";
import { unwrapWebhook } from "@whop/sdk/helpers";
import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { registerKeikiRoutes } from "./keikiHttp";

const http = httpRouter();

registerKeikiRoutes(http);

http.route({
  path: "/whop",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let event: { type: string; data: Whop.Payment };
    try {
      event = unwrapWebhook(await request.text(), {
        headers: Object.fromEntries(request.headers),
        key: process.env.WHOP_WEBHOOK_SECRET,
      });
    } catch {
      return new Response("Invalid webhook signature", { status: 401 });
    }
    const userId = event.data.metadata?.userId;
    if (event.type === "payment.succeeded" && typeof userId === "string") {
      await ctx.runMutation(internal.users.setPremium, { userId });
    }
    const orderId = event.data.metadata?.orderId;
    if (event.type === "payment.succeeded" && typeof orderId === "string") {
      await ctx.runMutation(internal.orders.markPaid, { orderId: orderId as Id<"orders"> });
      // TODO: text the seller once Keiki outbound is wired up.
    }
    return new Response("OK", { status: 200 });
  }),
});

http.route({
  path: "/whop/return",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const orderId = new URL(request.url).searchParams.get("orderId") ?? "";
    return new Response(null, {
      status: 302,
      headers: { Location: `garagesale://buyer/paid?orderId=${encodeURIComponent(orderId)}` },
    });
  }),
});

export default http;
