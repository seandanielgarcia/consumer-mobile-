import { WhopClient, WhopEnvironment } from "@whop/sdk";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

export const createCheckout = action({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<string> => {
    if (!(await ctx.runQuery(internal.users.exists, { userId }))) throw new Error("Unknown user");
    const client = new WhopClient({
      token: process.env.WHOP_API_KEY!,
      environment: process.env.WHOP_ENVIRONMENT === "production" ? WhopEnvironment.Production : WhopEnvironment.Sandbox,
    });
    const checkout = await client.checkoutConfigurations.create({
      variant: {
        title: "Garage Sale Premium",
        billing_type: "one_time",
        initial_price: 4.99,
        currency: "usd",
      },
      metadata: { userId },
    });
    if (!checkout.purchase_url) throw new Error("Whop returned no purchase_url");
    return checkout.purchase_url;
  },
});
