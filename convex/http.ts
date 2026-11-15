import type { Whop } from "@whop/sdk";
import { unwrapWebhook } from "@whop/sdk/helpers";
import { httpRouter } from "convex/server";
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
    console.log("whop webhook", event.type, event.data.id);
    return new Response("OK", { status: 200 });
  }),
});

export default http;
