import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalQuery } from "./_generated/server";

export const soldNoticeDetails = internalQuery({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) return null;
    const garage = await ctx.db.get(order.garageId);
    const seller = garage && (await ctx.db.get(garage.ownerId));
    const buyer = await ctx.db.get(order.buyerId);
    const items = await Promise.all(order.itemIds.map((id) => ctx.db.get(id)));
    return {
      sellerPhone: seller?.phone ?? "",
      buyerName: buyer?.name ?? "A buyer",
      totalCents: order.totalCents,
      items: items.filter((i) => i !== null).map((i) => ({ _id: i._id, title: i.title })),
    };
  },
});

export const notifySellerSold = internalAction({
  args: { orderId: v.id("orders"), unavailableItemIds: v.array(v.id("items")) },
  handler: async (ctx, { orderId, unavailableItemIds }) => {
    const apiKey = process.env.KEIKI_API_KEY;
    if (!apiKey) {
      console.warn(`KEIKI_API_KEY is not set; skipping the sold notice for order ${orderId}`);
      return;
    }
    const details = await ctx.runQuery(internal.notify.soldNoticeDetails, { orderId });
    if (!details?.sellerPhone) {
      console.error(`No seller phone for order ${orderId}; skipping the sold notice`);
      return;
    }
    const unavailable = details.items.filter((i) => unavailableItemIds.includes(i._id)).map((i) => i.title);
    const titles = details.items.map((i) => i.title).join(", ");
    const text =
      `Payment received: ${details.buyerName} bought ${titles} for $${(details.totalCents / 100).toFixed(2)} from this seller's garage. ` +
      `Tell them it sold and that the buyer will text to arrange pickup.` +
      (unavailable.length > 0
        ? ` These items were no longer available when the payment arrived: ${unavailable.join(", ")}. Tell them to refund those lines manually in Whop.`
        : "");
    const base = process.env.KEIKI_API_BASE ?? "https://onkeiki.com";
    const agentId = process.env.KEIKI_AGENT_ID ?? "3f824c5c-0cd6-49fd-bf14-f13b29bcf927";
    const response = await fetch(`${base}/api/v1/developer/agents/${agentId}/notice`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text, phone: details.sellerPhone }),
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`Keiki notice failed for order ${orderId}: ${response.status} ${body}`);
    console.log(`Keiki sold notice for order ${orderId}: ${body}`);
  },
});
