import type { Whop } from "@whop/sdk";
import { unwrapWebhook } from "@whop/sdk/helpers";
import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
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
    const rawOrderId = event.data.metadata?.orderId;
    if (event.type === "payment.succeeded" && typeof rawOrderId === "string") {
      const orderId = await ctx.runQuery(internal.whop.normalizeOrderId, { orderId: rawOrderId });
      if (!orderId) {
        console.error(`Whop payment ${event.data.id} names unknown order ${rawOrderId}`);
        return new Response("OK", { status: 200 });
      }
      try {
        const { unavailableItemIds } = await ctx.runMutation(internal.orders.markPaid, { orderId });
        if (unavailableItemIds.length > 0) {
          console.warn(`Order ${orderId} paid with unavailable items ${unavailableItemIds.join(", ")}; seller must refund those lines in Whop`);
        }
        // TODO: text the seller (sellerName, sellerPhone from markPaid) once Keiki outbound is wired up; name any unavailableItemIds and ask them to refund those lines manually in Whop.
      } catch (error) {
        console.error(`Whop payment ${event.data.id} could not mark order ${orderId} paid: ${error}`);
      }
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
